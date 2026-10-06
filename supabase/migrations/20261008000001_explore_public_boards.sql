-- Explore: a public, newest-first listing of published PUBLIC boards (never unlisted/private/shared/trashed/unpublished).

-- Sort key for Explore. Maintained only by the trigger below; clients have no column grant on it.
alter table public.boards add column published_at timestamptz;

-- Backfill existing public published boards (updated_at is the best available proxy).
update public.boards set published_at = updated_at
where visibility = 'public' and deleted_at is null and published_doc is not null;

create index boards_explore_idx on public.boards (published_at desc, id desc)
  where visibility = 'public' and deleted_at is null and published_doc is not null;

-- published_at is set when a board first becomes public-and-published (or becomes so again after being
-- non-public/unpublished), kept while it stays so (a plain republish does not bump it), and cleared otherwise.
-- A trigger rather than publish_board, because visibility is also written directly by clients (column grant),
-- and unpublish_board / trashing must clear it too. publish_board itself is unchanged.
-- "Public-and-published" ignores deleted_at on purpose: trashing a board hides it from the RPC filter and
-- restoring it keeps its original position.
create function public.set_published_at() returns trigger language plpgsql set search_path = '' as $$
declare
  now_public boolean := new.visibility = 'public' and new.published_doc is not null;
  was_public boolean := tg_op = 'UPDATE' and old.visibility = 'public' and old.published_doc is not null;
begin
  if not now_public then
    new.published_at := null;
  elsif was_public and old.published_at is not null then
    new.published_at := old.published_at;
  elsif tg_op = 'INSERT' then
    new.published_at := coalesce(new.published_at, now());
  else
    new.published_at := now();
  end if;
  return new;
end;
$$;
create trigger boards_set_published_at before insert or update on public.boards
  for each row execute function public.set_published_at();

-- One page of Explore. Returns ONLY these five columns (no doc, published_doc or bare owner_id).
-- Keyset pagination on (published_at desc, id desc): pass the last row's published_at and id as the cursor.
create function public.list_public_boards(p_before_at timestamptz default null, p_before_id uuid default null, p_limit int default 24)
returns table (slug text, published_title text, published_at timestamptz, id uuid, thumbnail_path text)
language sql stable security definer set search_path = '' as $$
  select b.slug, b.published_title, b.published_at, b.id, b.owner_id::text || '/pub-' || b.id::text || '.png'
  from public.boards b
  where b.visibility = 'public' and b.deleted_at is null and b.published_doc is not null and b.published_at is not null
    and (p_before_at is null
         or (b.published_at, b.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by b.published_at desc, b.id desc
  limit least(greatest(coalesce(p_limit, 24), 1), 48);
$$;

-- 'explore' is an app route now.
alter table public.boards drop constraint boards_slug_check;
alter table public.boards add constraint boards_slug_check check (
  slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'
  and slug !~ '--'
  and slug <> all (array['new', 'edit', 'api', 'b', 'topics', 'explore', 'my', 'login', 'admin'])
) not valid;
do $$
begin
  alter table public.boards validate constraint boards_slug_check;
exception when check_violation then
  raise notice 'boards_slug_check left NOT VALID: existing rows violate it';
end $$;

revoke all on function public.set_published_at(), public.list_public_boards(timestamptz, uuid, int) from public, anon, authenticated;
grant execute on function public.list_public_boards(timestamptz, uuid, int) to anon, authenticated;
