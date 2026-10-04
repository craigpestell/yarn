-- Permanently delete boards that have been in the trash for 30 days (see the note in 20261003000002_rls.sql).
-- Rows in board_links, board_shares, board_share_invites and board_topics go with them (ON DELETE CASCADE).
-- Known limit: Supabase Storage forbids deleting files from SQL, so the board's thumbnail PNGs
-- ('<owner uid>/<board id>.png' and '<owner uid>/pub-<board id>.png', 256 KB max each) are left behind.
create extension if not exists pg_cron;

create function public.purge_trashed_boards(p_retention interval default interval '30 days')
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.boards where deleted_at is not null and deleted_at < now() - p_retention;
  get diagnostics n = row_count;
  return n;
end;
$$;
-- Only the cron job (runs as postgres) calls this; nobody reaches it through the API.
revoke all on function public.purge_trashed_boards(interval) from public, anon, authenticated;

-- cron.schedule upserts by job name, so re-running this migration does not duplicate the job.
select cron.schedule('purge-trashed-boards', '0 4 * * *', $$select public.purge_trashed_boards()$$);
