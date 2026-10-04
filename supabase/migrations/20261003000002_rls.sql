-- M1: RLS, published-only read surface, revision-checked save.
-- Non-owners can never select from public.boards (it holds `doc`). They read
-- through public.public_boards / get_published_board / list_shared_boards /
-- get_board_links, which expose published data only.
--
-- Write surface: clients get column-level grants only. `revision`, `doc`,
-- `published_*` are written exclusively by the security definer RPCs save_board /
-- publish_board, so the revision check cannot be bypassed by a direct UPDATE/INSERT.

alter table public.boards enable row level security;
alter table public.board_shares enable row level security;
alter table public.board_links enable row level security;
alter table public.topics enable row level security;
alter table public.board_topics enable row level security;

-- Deny by default: strip every privilege Supabase's default privileges handed out,
-- for existing and future objects, then grant exactly what is needed below.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
-- Caveat: schema-level default privileges can only remove explicit grants, not PostgreSQL's implicit
-- PUBLIC EXECUTE on new functions. Every migration that adds a function must therefore revoke
-- PUBLIC/anon/authenticated and grant explicitly (as the end of this file does).
do $$
declare r text;
begin
  foreach r in array array['postgres', 'supabase_admin'] loop
    if exists (select 1 from pg_roles where rolname = r) and pg_has_role(current_user, r, 'member') then
      execute format('alter default privileges for role %I in schema public revoke all on tables from anon, authenticated', r);
      execute format('alter default privileges for role %I in schema public revoke all on sequences from anon, authenticated', r);
      execute format('alter default privileges for role %I in schema public revoke all on functions from anon, authenticated', r);
    end if;
  end loop;
end $$;

-- Helpers (security definer so they can see rows the caller's RLS hides).
-- True when the caller may read the board's published snapshot (or owns it).
-- Note: executable by anon (board_topics_select / get_board_links reach it); it is a
-- boolean existence/visibility oracle for a guessed uuid. Accepted for v1 because
-- uuids are unguessable; revisit with random slugs / anon tightening later.
create function public.can_read_board(p_board_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.boards b
    where b.id = p_board_id
      and (
        b.owner_id = auth.uid()
        or (
          b.deleted_at is null
          and b.published_doc is not null
          and (
            b.visibility in ('public', 'unlisted')
            or exists (select 1 from public.board_shares s where s.board_id = b.id and s.user_id = auth.uid())
          )
        )
      )
  );
$$;

create function public.is_public_board(p_board_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.boards b
    where b.id = p_board_id and b.visibility = 'public' and b.deleted_at is null and b.published_doc is not null
  );
$$;

create function public.owns_board(p_board_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.boards b where b.id = p_board_id and b.owner_id = auth.uid());
$$;

create function public.owns_public_board(p_board_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.boards b
    where b.id = p_board_id and b.owner_id = auth.uid() and b.visibility = 'public' and b.deleted_at is null
  );
$$;

-- boards: owner only (select includes soft-deleted rows so they can be restored).
-- No client DELETE, intentionally: removal is soft (deleted_at). A 30-day purge job for soft-deleted
-- boards is a follow-up (M4/M5). Unpublishing goes through unpublish_board().
-- Account deletion still removes boards through the auth.users ON DELETE CASCADE.
grant select on public.boards to authenticated;
grant insert (owner_id, slug, title, doc, visibility) on public.boards to authenticated;
grant update (title, visibility, deleted_at) on public.boards to authenticated;
create policy boards_owner_select on public.boards for select to authenticated using (owner_id = auth.uid());
create policy boards_owner_insert on public.boards for insert to authenticated with check (owner_id = auth.uid());
create policy boards_owner_update on public.boards for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- board_shares: board owner manages; the shared user can see their own grant.
grant select, insert, delete on public.board_shares to authenticated;
create policy shares_select on public.board_shares for select to authenticated
  using (user_id = auth.uid() or public.owns_board(board_id));
create policy shares_insert on public.board_shares for insert to authenticated with check (public.owns_board(board_id));
create policy shares_delete on public.board_shares for delete to authenticated using (public.owns_board(board_id));

-- board_links: the live table is owner-only (it may contain links not yet published).
-- Other readers go through get_board_links, which serves the snapshot taken at publish.
-- Writes are only toward boards the owner can read.
grant select, insert, delete on public.board_links to authenticated;
grant update (from_widget_id, to_board_id, label, pinned_revision) on public.board_links to authenticated;
create policy links_select on public.board_links for select to authenticated using (public.owns_board(from_board_id));
create policy links_insert on public.board_links for insert to authenticated
  with check (public.owns_board(from_board_id) and public.can_read_board(to_board_id));
create policy links_update on public.board_links for update to authenticated
  using (public.owns_board(from_board_id))
  with check (public.owns_board(from_board_id) and public.can_read_board(to_board_id));
create policy links_delete on public.board_links for delete to authenticated using (public.owns_board(from_board_id));

-- topics: world-readable, no client writes (curated by service role / dashboard).
grant select on public.topics to anon, authenticated;
create policy topics_select on public.topics for select to anon, authenticated using (true);

-- board_topics: readable for public boards (or your own); write only by owner of a public board.
grant select on public.board_topics to anon, authenticated;
grant insert, delete on public.board_topics to authenticated;
create policy board_topics_select on public.board_topics for select to anon, authenticated
  using (public.is_public_board(board_id) or public.owns_board(board_id));
create policy board_topics_insert on public.board_topics for insert to authenticated
  with check (public.owns_public_board(board_id));
create policy board_topics_delete on public.board_topics for delete to authenticated
  using (public.owns_board(board_id));

-- Published-only read surface. Never exposes `doc`. Read-only: all privileges revoked
-- (an auto-updatable view would otherwise accept writes with the view owner's rights),
-- then SELECT only. security_barrier keeps caller-supplied predicates from seeing hidden rows.
create view public.public_boards with (security_barrier = true) as
  select id, owner_id, slug,
         case when owner_id = auth.uid() then title else published_title end as title,
         published_revision, published_doc
  from public.boards
  where visibility = 'public' and deleted_at is null and published_doc is not null;
revoke all on public.public_boards from public, anon, authenticated;
grant select on public.public_boards to anon, authenticated;

-- Titles: non-owners get published_title (the snapshot), the owner gets the live title.
-- Slug lookup for public/unlisted boards and boards shared with the caller.
create function public.get_published_board(p_slug text)
returns table (id uuid, owner_id uuid, slug text, title text, visibility text, published_revision int, published_doc jsonb)
language sql stable security definer set search_path = '' as $$
  select b.id, b.owner_id, b.slug,
         case when b.owner_id = auth.uid() then b.title else b.published_title end,
         b.visibility, b.published_revision, b.published_doc
  from public.boards b
  where b.slug = p_slug and public.can_read_board(b.id);
$$;

create function public.list_shared_boards()
returns table (id uuid, owner_id uuid, slug text, title text, published_revision int, published_doc jsonb)
language sql stable security definer set search_path = '' as $$
  select b.id, b.owner_id, b.slug,
         case when b.owner_id = auth.uid() then b.title else b.published_title end,
         b.published_revision, b.published_doc
  from public.boards b
  join public.board_shares s on s.board_id = b.id and s.user_id = auth.uid()
  where b.deleted_at is null and b.published_doc is not null;
$$;

-- Links of a board with target title/slug. The owner sees live links; everyone else sees
-- only the links that existed at the last publish (published_links). Null title means
-- "unavailable": the title is only revealed when the caller can read the target.
create function public.get_board_links(p_board_id uuid)
returns table (id uuid, from_widget_id text, to_board_id uuid, label text, pinned_revision int, to_title text, to_slug text)
language sql stable security definer set search_path = '' as $$
  with src as (
    select coalesce(b.owner_id = auth.uid(), false) as is_owner, b.published_links
    from public.boards b
    where b.id = p_board_id and public.can_read_board(b.id)
  ), rows as (
    select l.id, l.from_widget_id, l.to_board_id, l.label, l.pinned_revision
    from public.board_links l, src
    where src.is_owner and l.from_board_id = p_board_id
    union all
    select (e.x ->> 'id')::uuid, e.x ->> 'from_widget_id', (e.x ->> 'to_board_id')::uuid,
           e.x ->> 'label', (e.x ->> 'pinned_revision')::int
    from src, jsonb_array_elements(src.published_links) as e(x)
    where not src.is_owner
  )
  select r.id, r.from_widget_id, r.to_board_id, r.label, r.pinned_revision,
         case when public.can_read_board(r.to_board_id)
              then case when t.owner_id = auth.uid() then t.title else t.published_title end end,
         case when public.can_read_board(r.to_board_id) then t.slug end
  from rows r
  left join public.boards t on t.id = r.to_board_id;
$$;

-- Revision-checked save. Returns the new revision, or null when the revision is stale
-- (or the caller does not own the board). security definer: it is the only writer of
-- doc/revision, so it checks ownership itself.
create function public.save_board(p_id uuid, p_expected_revision int, p_doc jsonb, p_title text default null)
returns int language sql security definer set search_path = '' as $$
  update public.boards
  set doc = p_doc, revision = revision + 1, title = coalesce(p_title, title)
  where id = p_id and revision = p_expected_revision and owner_id = auth.uid() and deleted_at is null
  returning revision;
$$;

-- Publish: snapshot doc, title and the current links -> published_*. Returns published revision or null.
create function public.publish_board(p_id uuid)
returns int language sql security definer set search_path = '' as $$
  update public.boards
  set published_doc = doc,
      published_title = title,
      published_revision = revision,
      published_links = coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id, 'from_widget_id', l.from_widget_id, 'to_board_id', l.to_board_id,
          'label', l.label, 'pinned_revision', l.pinned_revision) order by l.id)
        from public.board_links l where l.from_board_id = p_id), '[]'::jsonb)
  where id = p_id and owner_id = auth.uid() and deleted_at is null
  returning published_revision;
$$;

-- Unpublish: back to private and drop the whole snapshot, so shares and links stop resolving and a
-- later publish starts fresh. board_topics rows are kept but is_public_board() hides them
-- (published_doc is null and visibility is private). Returns true when a board was unpublished.
create function public.unpublish_board(p_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  with u as (
    update public.boards
    set visibility = 'private', published_doc = null, published_links = '[]'::jsonb,
        published_title = null, published_revision = null
    where id = p_id and owner_id = auth.uid() and deleted_at is null
    returning 1
  )
  select exists (select 1 from u);
$$;

-- Explicit EXECUTE grants. Re-revoke first so functions created in this file start from zero
-- even if default privileges could not be altered for the migration role.
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.can_read_board(uuid), public.is_public_board(uuid), public.owns_board(uuid),
  public.owns_public_board(uuid), public.get_published_board(text), public.get_board_links(uuid)
  to anon, authenticated;
grant execute on function public.list_shared_boards(), public.save_board(uuid, int, jsonb, text),
  public.publish_board(uuid), public.unpublish_board(uuid) to authenticated;

-- Expected Supabase advisor warnings (all intentional, do not "fix" without a design change):
--  * public_boards is a security_barrier view owned by a privileged role (advisor: security definer view);
--    it is the published-only read surface and exposes no `doc`.
--  * can_read_board, is_public_board, owns_board, owns_public_board, get_published_board and
--    get_board_links are security definer and executable by anon (policies and public reads need them).
-- Rule: every future migration that adds a function or table must grant explicitly (revoke from
-- public/anon/authenticated first, then grant only what is needed); default privileges are not relied on.
