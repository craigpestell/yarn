-- M5: publish with visibility, shares by email, reader helpers, widget links, backlinks, topic search, OG, published thumbnails.
-- Every function below is security definer with an explicit EXECUTE grant (see the rule at the end of the RLS migration).

-- Owner toggle for the backlinks list on the public page.
alter table public.boards add column show_backlinks boolean not null default true;
grant update (show_backlinks) on public.boards to authenticated;
create index boards_published_links_idx on public.boards using gin (published_links jsonb_path_ops);

-- publish_board now optionally sets visibility in the same statement as the snapshot (null keeps it).
-- Returns the published revision, or null when not the owner / deleted / invalid visibility.
drop function public.publish_board(uuid);
create function public.publish_board(p_id uuid, p_visibility text default null)
returns int language sql security definer set search_path = '' as $$
  update public.boards
  set published_doc = doc,
      published_title = title,
      published_revision = revision,
      visibility = coalesce(p_visibility, visibility),
      published_links = coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id, 'from_widget_id', l.from_widget_id, 'to_board_id', l.to_board_id,
          'label', l.label, 'pinned_revision', l.pinned_revision) order by l.id)
        from public.board_links l where l.from_board_id = p_id), '[]'::jsonb)
  where id = p_id and owner_id = auth.uid() and deleted_at is null
    and (p_visibility is null or p_visibility in ('private', 'unlisted', 'public'))
  returning published_revision;
$$;

-- Shares by email, as invites. An invite is just (board, lowercase email); it is never matched against
-- auth.users when it is written or listed, so the owner cannot tell whether an address has an account (no
-- enumeration). Access is resolved at read time: a signed-in user can read boards invited to THEIR OWN
-- auth email (is_shared_with_me, security definer with a pinned search_path). Invites for addresses that
-- register later start working at registration. The table has RLS on and no grants: RPCs only.
create table public.board_share_invites (
  board_id uuid not null references public.boards on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 254),
  primary key (board_id, email)
);
alter table public.board_share_invites enable row level security;
revoke all on public.board_share_invites from public, anon, authenticated;

-- True when the caller was given read access: a board_shares grant (legacy, by user id) or an invite to the
-- caller's own CONFIRMED auth email (an unconfirmed signup must not claim someone else's invite). Internal helper: no EXECUTE grant (callers are other security definer functions).
create function public.is_shared_with_me(p_board_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.board_shares s where s.board_id = p_board_id and s.user_id = auth.uid())
      or exists (
        select 1 from public.board_share_invites i
        join auth.users u on lower(u.email) = i.email
        where u.id = auth.uid() and u.email_confirmed_at is not null and i.board_id = p_board_id);
$$;

create or replace function public.can_read_board(p_board_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.boards b
    where b.id = p_board_id
      and (
        b.owner_id = auth.uid()
        or (
          b.deleted_at is null
          and b.published_doc is not null
          and (b.visibility in ('public', 'unlisted') or public.is_shared_with_me(b.id))
        )
      )
  );
$$;

create or replace function public.list_shared_boards()
returns table (id uuid, owner_id uuid, slug text, title text, published_revision int, published_doc jsonb)
language sql stable security definer set search_path = '' as $$
  select b.id, b.owner_id, b.slug,
         case when b.owner_id = auth.uid() then b.title else b.published_title end,
         b.published_revision, b.published_doc
  from public.boards b
  where b.deleted_at is null and b.published_doc is not null and public.is_shared_with_me(b.id);
$$;

-- Returns false only when the caller does not own the board (or the invite cap is reached). Same answer for
-- every address, registered or not.
-- Invites replace by-user-id grants: clients no longer write board_shares (existing rows keep working, read-only).
revoke insert, delete on public.board_shares from authenticated;

create function public.share_board(p_board_id uuid, p_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare e text := lower(trim(p_email));
begin
  if not public.owns_board(p_board_id) or e is null or char_length(e) not between 3 and 254 or e !~ '^[^@\s]+@[^@\s]+$' then
    return false;
  end if;
  if (select count(*) from public.board_share_invites where board_id = p_board_id) >= 100 then return false; end if;
  insert into public.board_share_invites (board_id, email) values (p_board_id, e) on conflict do nothing;
  return true;
end;
$$;

-- The owner's invite list, trimmed and lowercased, whether or not an account exists.
create function public.list_board_shares(p_board_id uuid)
returns table (email text)
language sql stable security definer set search_path = '' as $$
  select i.email from public.board_share_invites i
  where i.board_id = p_board_id and public.owns_board(p_board_id)
  order by i.email;
$$;

-- Revoke an invite, and any legacy by-user-id grant for the same address. Same answer either way.
create function public.unshare_board(p_board_id uuid, p_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare e text := lower(trim(p_email));
begin
  if not public.owns_board(p_board_id) then return false; end if;
  delete from public.board_share_invites where board_id = p_board_id and email = e;
  delete from public.board_shares s using auth.users u where s.board_id = p_board_id and u.id = s.user_id and lower(u.email) = e;
  return true;
end;
$$;

-- Slug -> id/title for a board the caller can read (used to link to another board by pasted URL).
create function public.resolve_board(p_slug text)
returns table (id uuid, slug text, title text)
language sql stable security definer set search_path = '' as $$
  select b.id, b.slug, case when b.owner_id = auth.uid() then b.title else b.published_title end
  from public.boards b
  where b.slug = p_slug and b.deleted_at is null and public.can_read_board(b.id);
$$;

-- One link per widget: replaces any existing link of that widget. Returns the link id, or null when the
-- caller does not own the board, the target is not readable/deleted, or it links to itself.
create function public.set_widget_link(p_board_id uuid, p_widget_id text, p_to_board_id uuid, p_label text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare lid uuid;
begin
  if p_widget_id is null or char_length(p_widget_id) not between 1 and 100
     or p_to_board_id = p_board_id
     or not public.owns_board(p_board_id)
     or not public.can_read_board(p_to_board_id)
     or not exists (select 1 from public.boards t where t.id = p_to_board_id and t.deleted_at is null) then
    return null;
  end if;
  delete from public.board_links where from_board_id = p_board_id and from_widget_id = p_widget_id;
  insert into public.board_links (from_board_id, from_widget_id, to_board_id, label)
  values (p_board_id, p_widget_id, p_to_board_id, left(p_label, 200))
  returning id into lid;
  return lid;
end;
$$;

-- Backlinks: boards whose published snapshot links here, restricted to what the caller may see
-- (public boards, own boards, boards shared with the caller; unlisted boards of others are never listed).
-- Non-owners get nothing when the target's owner switched backlinks off.
create function public.get_backlinks(p_board_id uuid)
returns table (slug text, title text)
language sql stable security definer set search_path = '' as $$
  select f.slug, case when f.owner_id = auth.uid() then f.title else f.published_title end
  from public.boards t
  join public.boards f on f.published_links @> jsonb_build_array(jsonb_build_object('to_board_id', t.id))
  where t.id = p_board_id and public.can_read_board(t.id)
    and (t.show_backlinks or t.owner_id = auth.uid())
    and f.id <> t.id and f.deleted_at is null and f.published_doc is not null
    and (f.visibility = 'public' or f.owner_id = auth.uid()
         or public.is_shared_with_me(f.id))
  order by 2, 1
  limit 50;
$$;

-- Topic search over title, summary and tags (case-insensitive substring, wildcards escaped).
create function public.search_topics(p_q text)
returns table (slug text, title text, summary text, tags text[])
language sql stable security definer set search_path = '' as $$
  select t.slug, t.title, t.summary, t.tags
  from (select '%' || replace(replace(replace(trim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
        where char_length(trim(p_q)) between 1 and 100) q
  join public.topics t on t.title ilike q.pat or t.summary ilike q.pat
    or exists (select 1 from unnest(t.tags) g where g ilike q.pat)
  order by t.title, t.slug
  limit 50;
$$;

-- Public boards tagged with a topic (published title only).
create function public.list_topic_boards(p_topic_slug text)
returns table (slug text, title text)
language sql stable security definer set search_path = '' as $$
  select b.slug, b.published_title
  from public.board_topics bt join public.boards b on b.id = bt.board_id
  where bt.topic_slug = p_topic_slug and b.visibility = 'public' and b.deleted_at is null and b.published_doc is not null
  order by b.published_title, b.slug
  limit 100;
$$;

-- Open Graph data for the edge function: public/unlisted published boards only, as the anon role.
create function public.get_board_og(p_slug text)
returns table (title text, thumbnail_path text, visibility text)
language sql stable security definer set search_path = '' as $$
  select b.published_title, b.owner_id::text || '/pub-' || b.id::text || '.png', b.visibility
  from public.boards b
  where b.slug = p_slug and b.visibility in ('public', 'unlisted') and b.deleted_at is null and b.published_doc is not null;
$$;

-- Published thumbnails live at '<owner uid>/pub-<board id>.png' (uploaded at publish time, so they never show
-- drafts) and are readable by anyone while the board is a published public/unlisted board.
create function public.is_published_thumbnail(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.boards b
    where p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/pub-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$'
      and b.id::text = substring(p_name from '/pub-([0-9a-f-]{36})\.png$')
      and b.owner_id::text = split_part(p_name, '/', 1)
      and b.visibility in ('public', 'unlisted') and b.deleted_at is null and b.published_doc is not null
  );
$$;
create policy thumbnails_published_select on storage.objects for select to anon, authenticated
  using (bucket_id = 'thumbnails' and public.is_published_thumbnail(name));

revoke all on function public.publish_board(uuid, text), public.share_board(uuid, text), public.list_board_shares(uuid), public.unshare_board(uuid, text),
  public.is_shared_with_me(uuid), public.resolve_board(text), public.set_widget_link(uuid, text, uuid, text), public.get_backlinks(uuid),
  public.search_topics(text), public.list_topic_boards(text), public.get_board_og(text), public.is_published_thumbnail(text)
  from public, anon, authenticated;
grant execute on function public.publish_board(uuid, text), public.share_board(uuid, text), public.list_board_shares(uuid), public.unshare_board(uuid, text),
  public.resolve_board(text), public.set_widget_link(uuid, text, uuid, text) to authenticated;
grant execute on function public.get_backlinks(uuid), public.search_topics(text), public.list_topic_boards(text),
  public.get_board_og(text), public.is_published_thumbnail(text) to anon, authenticated;
