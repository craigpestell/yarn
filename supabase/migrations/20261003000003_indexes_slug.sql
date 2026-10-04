-- FK lookup indexes (cascade deletes, "boards shared with me", topic listings).
create index if not exists board_shares_user_id_idx on public.board_shares (user_id);
create index if not exists board_topics_topic_slug_idx on public.board_topics (topic_slug);

-- Tighter board slugs: no consecutive hyphens, and no slug that collides with an app route.
alter table public.boards drop constraint boards_slug_check;
alter table public.boards add constraint boards_slug_check check (
  slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'
  and slug !~ '--'
  and slug <> all (array['new', 'edit', 'api', 'b', 'topics', 'my', 'login', 'admin'])
) not valid;
-- Enforced for all new/changed rows regardless. Validate existing rows when they comply;
-- if legacy rows violate it, keep the constraint NOT VALID instead of failing the migration.
do $$
begin
  alter table public.boards validate constraint boards_slug_check;
exception when check_violation then
  raise notice 'boards_slug_check left NOT VALID: existing rows violate it';
end $$;
