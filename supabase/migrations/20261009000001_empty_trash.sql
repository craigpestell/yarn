-- Permanently delete the caller's trashed boards ("Empty trash" / "Delete forever").
-- `boards` has no client DELETE grant by design (see 20261003000002_rls.sql); deletion goes through these two
-- owner-scoped security-definer functions, like delete_my_account. Both pin search_path and are executable by
-- `authenticated` only (revoke from public/anon/authenticated first, then grant).
-- Cascades: board_links (both directions), board_shares, board_share_invites, board_topics. Forks survive
-- (forked_from is ON DELETE SET NULL). Storage thumbnails cannot be deleted from SQL; the client removes them best effort.
-- Each delete re-checks deleted_at in the same statement, so a board restored meanwhile is never deleted.

-- Returns the ids of the deleted boards (count = array length; empty when the trash is empty).
create function public.empty_my_trash()
returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  ids uuid[];
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  with d as (
    delete from public.boards b
    where b.owner_id = uid and b.deleted_at is not null
    returning b.id
  )
  select coalesce(array_agg(d.id), '{}'::uuid[]) into ids from d;
  return ids;
end;
$$;
revoke all on function public.empty_my_trash() from public, anon, authenticated;
grant execute on function public.empty_my_trash() to authenticated;

-- True if a row was deleted. A missing, active or foreign board returns false (neutral, not an existence oracle).
create function public.delete_trashed_board(p_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from public.boards b
  where b.id = p_id and b.owner_id = uid and b.deleted_at is not null;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
revoke all on function public.delete_trashed_board(uuid) from public, anon, authenticated;
grant execute on function public.delete_trashed_board(uuid) to authenticated;
