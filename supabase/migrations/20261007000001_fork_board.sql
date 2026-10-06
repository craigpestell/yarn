-- Fork a board: a signed-in user gets a private, editable copy of a board they can read, built ONLY from the
-- published snapshot (published_doc / published_title / published_links), never the live `doc`.
-- Both functions below are security definer with a pinned search_path and are executable by `authenticated` only
-- (revoke from public/anon/authenticated first, then grant: see the rule in 20261003000002_rls.sql).

-- Provenance. Existing rows all have forked_from null (the column was reserved and never written).
-- ON DELETE SET NULL: deleting a source (purge, or its owner's account) only deletes rows, and the fork survives.
alter table public.boards
  add constraint boards_forked_from_fkey foreign key (forked_from) references public.boards (id) on delete set null;
-- Serves the set-null action and the per-user fork-rate count.
create index boards_forked_from_idx on public.boards (forked_from) where forked_from is not null;
create index boards_owner_forked_created_idx on public.boards (owner_id, created_at) where forked_from is not null;

-- Returns the new board's id and slug. EVERY failure (anon, nonexistent, private-unshared, unpublished, soft-deleted,
-- unconfirmed-email share, rate cap) raises the same neutral error, so it is not an oracle for board existence.
-- Copies: the published doc minus Storage-path images (those paths belong to the source owner and are unusable by
-- the forker; https refs are kept), and the published widget links whose target the forker can read and that is not
-- deleted. Never copies shares, invites, topics, thumbnails or the live doc.
create function public.fork_board(p_source_id uuid)
returns table (new_id uuid, new_slug text)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  src record;
  nid uuid := gen_random_uuid();
  d jsonb;
  s text;
  tries int := 0;
  fork_cap constant int := 20;      -- forks per user per window
  fork_window constant interval := interval '1 hour';
  link_cap constant int := 100;
begin
  if uid is null or p_source_id is null then
    raise exception 'fork unavailable';
  end if;
  -- serialise a user's forks so the cap cannot be raced
  perform pg_advisory_xact_lock(hashtextextended('fork_board:' || uid::text, 0));

  select b.published_doc, b.published_title, b.published_links into src
  from public.boards b
  where b.id = p_source_id and b.deleted_at is null and b.published_doc is not null
    and public.can_read_board(b.id);
  if not found then
    raise exception 'fork unavailable';
  end if;
  if (select count(*) from public.boards f
      where f.owner_id = uid and f.forked_from is not null and f.created_at > now() - fork_window) >= fork_cap then
    raise exception 'fork unavailable';
  end if;

  d := src.published_doc;
  if jsonb_typeof(d -> 'widgets') = 'array' then
    d := jsonb_set(d, '{widgets}', coalesce((
      select jsonb_agg(
        case when jsonb_typeof(t.w -> 'data') = 'object' and (t.w -> 'data') ? 'image'
                  and not (jsonb_typeof(t.w -> 'data' -> 'image') = 'string' and lower(t.w -> 'data' ->> 'image') like 'https://%')
             then jsonb_set(t.w, '{data}', (t.w -> 'data') - 'image')
             else t.w end
        order by t.ord)
      from jsonb_array_elements(d -> 'widgets') with ordinality as t(w, ord)), '[]'::jsonb));
  end if;

  loop
    s := 'fork-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    begin
      insert into public.boards (id, owner_id, slug, title, visibility, doc, forked_from)
      values (nid, uid, s, left('Fork of ' || src.published_title, 200), 'private', d, p_source_id);
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries >= 5 then raise exception 'fork unavailable'; end if;
    end;
  end loop;

  -- one link per widget that exists in the new doc; the target must be readable by the forker and not deleted
  insert into public.board_links (from_board_id, from_widget_id, to_board_id, label, pinned_revision)
  select nid, c.wid, c.to_id, left(c.label, 200), c.pinned
  from (
    select distinct on (x ->> 'from_widget_id')
           x ->> 'from_widget_id' as wid, (x ->> 'to_board_id')::uuid as to_id,
           x ->> 'label' as label, (x ->> 'pinned_revision')::int as pinned
    from jsonb_array_elements(src.published_links) as e(x)
    where jsonb_typeof(x) = 'object' and char_length(x ->> 'from_widget_id') between 1 and 100
    order by x ->> 'from_widget_id', x ->> 'id'
  ) c
  where c.to_id not in (nid, p_source_id)
    and exists (select 1 from jsonb_array_elements(d -> 'widgets') w where w ->> 'id' = c.wid)
    and exists (select 1 from public.boards t where t.id = c.to_id and t.deleted_at is null)
    and public.can_read_board(c.to_id)
  order by c.wid
  limit link_cap;

  return query select nid, s;
end;
$$;

-- Provenance label for a fork the caller can read: one row when the board is a fork (source_slug/source_title are
-- null when the caller cannot read the source, so a title never leaks), no row otherwise. A fork whose source was
-- deleted has forked_from null and shows no label.
create function public.get_fork_source(p_board_id uuid)
returns table (source_slug text, source_title text)
language sql stable security definer set search_path = '' as $$
  select case when ok then s.slug end,
         case when ok then case when s.owner_id = auth.uid() then s.title else s.published_title end end
  from public.boards f
  left join public.boards s on s.id = f.forked_from
  cross join lateral (select s.id is not null and s.deleted_at is null and public.can_read_board(s.id) as ok) r(ok)
  where f.id = p_board_id and f.forked_from is not null and public.can_read_board(f.id);
$$;

revoke all on function public.fork_board(uuid), public.get_fork_source(uuid) from public, anon, authenticated;
grant execute on function public.fork_board(uuid), public.get_fork_source(uuid) to authenticated;
