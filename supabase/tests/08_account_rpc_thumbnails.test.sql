-- pgTAP: delete_my_account RPC (AC 2) and thumbnails bucket RLS. Run with 'supabase test db'.
-- Storage behaviour worth knowing: Storage's own trigger (storage.protect_delete) forbids direct SQL deletes on
-- storage.objects/buckets, even from security definer functions, so file removal must go through the Storage API
-- (the client does this before calling delete_my_account). The RLS policies below are exercised here as plain
-- row-level checks; the Storage service enforces the same policies for API calls.
begin;
select plan(16);
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.dev'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@test.dev');
insert into public.boards (id, owner_id, slug, title, visibility, doc, published_doc, published_revision, published_title) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'a-pub', 'A', 'public', '{}', '{}', 0, 'A'),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'a-priv', 'A2', 'private', '{}', null, null, null),
  ('22222222-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'b-priv', 'B', 'private', '{}', null, null, null);
insert into storage.objects (bucket_id, name, owner_id) values
  ('thumbnails', 'aaaaaaaa-0000-0000-0000-000000000001/11111111-0000-0000-0000-000000000001.png', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('thumbnails', 'bbbbbbbb-0000-0000-0000-000000000002/22222222-0000-0000-0000-000000000001.png', 'bbbbbbbb-0000-0000-0000-000000000002');

-- anon cannot call it
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select throws_ok($$select public.delete_my_account()$$, '42501', null, 'anon cannot execute delete_my_account');
reset role;

-- thumbnails: bob cannot see or write into alice's folder
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from storage.objects where bucket_id = 'thumbnails'), 1, 'bob sees only his own thumbnail');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('thumbnails', 'aaaaaaaa-0000-0000-0000-000000000001/x.png', 'bbbbbbbb-0000-0000-0000-000000000002')$$,
  '42501', null, 'bob cannot write into alice''s folder');
select is((select count(*)::int from public.boards), 1, 'precondition: bob sees one board');
reset role;
select is((select public from storage.buckets where id = 'thumbnails'), false, 'thumbnails bucket is private');


-- more thumbnail policy cases
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select is((select count(*)::int from storage.objects where bucket_id = 'thumbnails'), 0, 'anon cannot read thumbnails');
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
update storage.objects set metadata = '{"x":1}'::jsonb where name like 'aaaaaaaa-0000-0000-0000-000000000001/%';
reset role;
select is((select count(*)::int from storage.objects where name like 'aaaaaaaa-0000-0000-0000-000000000001/%' and metadata is not null), 0, 'bob cannot update alice''s thumbnail row');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
select lives_ok($$update storage.objects set metadata = '{"x":1}'::jsonb where name like 'bbbbbbbb-0000-0000-0000-000000000002/%'$$, 'bob can update his own thumbnail row');
reset role;
select is((select count(*)::int from storage.objects where name like 'bbbbbbbb-0000-0000-0000-000000000002/%' and metadata is not null), 1, 'bob''s own update took effect');
select is((select file_size_limit from storage.buckets where id = 'thumbnails'), 262144::bigint, 'bucket has a size limit');
select is((select allowed_mime_types from storage.buckets where id = 'thumbnails'), array['image/png'], 'bucket only accepts PNG');

-- alice deletes her account through the RPC
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.boards), 2, 'precondition: alice sees her two boards');
select lives_ok($$select public.delete_my_account()$$, 'alice can delete her account');
reset role;

select is((select count(*)::int from public.boards where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'no board rows remain for the deleted owner');
select is((select count(*)::int from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'the user row is gone');
select is((select count(*)::int from public.boards where owner_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 1, 'other users'' boards are untouched');

select * from finish();
