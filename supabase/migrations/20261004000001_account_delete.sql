-- M4: self-service account deletion (AC 2).
-- Deleting the auth.users row cascades to boards, shares, links and topic tags (see M1 schema).
-- Thumbnail files under '<uid>/' cannot be deleted here (Storage forbids direct SQL deletes); the client
-- removes them through the Storage API before calling this function.
create function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
