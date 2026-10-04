-- M4: private 'thumbnails' bucket. Objects live at '<owner uid>/<board id>.png'.
-- Owner read/write only for now; public/unlisted board thumbnails (for OG meta) are an M5 follow-up.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('thumbnails', 'thumbnails', false, 262144, array['image/png'])
on conflict (id) do update set public = false, file_size_limit = 262144, allowed_mime_types = array['image/png'];

create policy thumbnails_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = auth.uid()::text);
create policy thumbnails_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = auth.uid()::text);
create policy thumbnails_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = auth.uid()::text);
create policy thumbnails_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = auth.uid()::text);
