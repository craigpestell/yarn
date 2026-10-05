-- pgTAP: Explore (list_public_boards, published_at). Run with 'supabase test db'.
begin;
select plan(33);
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.dev'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@test.dev');

-- Public published: p1 oldest, p2/p3/p4 tie on published_at, p5 newest. Plus every kind that must never appear.
insert into public.boards (id, owner_id, slug, title, visibility, doc, published_doc, published_revision, published_title, published_at) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'p-one', 'One', 'public', '{}', '{}', 0, 'Pub One', '2026-01-01T00:00:00Z'),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'p-two', 'Two', 'public', '{}', '{}', 0, 'Pub Two', '2026-02-01T00:00:00Z'),
  ('11111111-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'p-three', 'Three', 'public', '{}', '{}', 0, 'Pub Three', '2026-02-01T00:00:00Z'),
  ('11111111-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', 'p-four', 'Four', 'public', '{}', '{}', 0, 'Pub Four', '2026-02-01T00:00:00Z'),
  ('11111111-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000002', 'p-five', 'Five', 'public', '{}', '{}', 0, 'Pub Five', '2026-03-01T00:00:00Z');
insert into public.boards (id, owner_id, slug, title, visibility, doc, published_doc, published_revision, published_title, deleted_at) values
  ('22222222-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'x-unlisted', 'U', 'unlisted', '{}', '{}', 0, 'Unlisted secret', null),
  ('22222222-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'x-private', 'P', 'private', '{}', '{}', 0, 'Private secret', null),
  ('22222222-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'x-draft', 'D', 'public', '{}', null, null, null, null),
  ('22222222-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'x-trashed', 'T', 'public', '{}', '{}', 0, 'Trashed secret', now());
insert into public.board_shares (board_id, user_id) values ('22222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002');

-- Anon: only public, non-deleted, published boards, newest first, ties broken by id desc.
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select is((select count(*)::int from public.list_public_boards()), 5, 'anon sees exactly the five public published boards');
select is((select array_agg(slug) from public.list_public_boards()), array['p-five', 'p-four', 'p-three', 'p-two', 'p-one'], 'newest first, ties by id desc');
select is((select count(*)::int from public.list_public_boards() where published_title like '%secret%'), 0, 'unlisted, private/shared and trashed boards never appear');
select is((select thumbnail_path from public.list_public_boards(null, null, 1)), 'bbbbbbbb-0000-0000-0000-000000000002/pub-11111111-0000-0000-0000-000000000005.png', 'thumbnail path is owner/pub-id.png');
select is((select array_agg(slug) from public.list_public_boards(null, null, 2)), array['p-five', 'p-four'], 'page 1');
select is((select array_agg(slug) from public.list_public_boards('2026-02-01T00:00:00Z', '11111111-0000-0000-0000-000000000004', 2)), array['p-three', 'p-two'], 'page 2 continues inside a tie: no gap, no duplicate');
select is((select array_agg(slug) from public.list_public_boards('2026-02-01T00:00:00Z', '11111111-0000-0000-0000-000000000002', 2)), array['p-one'], 'last page is short');
select is((select count(*)::int from public.list_public_boards('2026-01-01T00:00:00Z', '11111111-0000-0000-0000-000000000001', 2)), 0, 'past the end is empty');
select is((select count(*)::int from public.list_public_boards(null, null, 0)), 1, 'limit 0 clamps up to 1');
select is((select count(*)::int from public.list_public_boards(null, null, -5)), 1, 'negative limit clamps up to 1');
select is((select count(*)::int from public.list_public_boards(null, null, null)), 5, 'null limit uses the default');
select is((select count(*)::int from public.list_public_boards('2026-02-01T00:00:00Z', null, 10)), 4, 'cursor without an id starts at the top of that timestamp (ties included)');
reset role;

-- Clamp upper bound: 60 more public boards, a limit of 1000 returns 48.
insert into public.boards (owner_id, slug, title, visibility, doc, published_doc, published_revision, published_title, published_at)
select 'aaaaaaaa-0000-0000-0000-000000000001', 'bulk-' || g, 'B', 'public', '{}', '{}', 0, 'Bulk ' || g, '2025-01-01T00:00:00Z'::timestamptz + g * interval '1 minute'
from generate_series(1, 60) g;
set local role anon;
select is((select count(*)::int from public.list_public_boards(null, null, 1000)), 48, 'limit is clamped to 48');
reset role;
delete from public.boards where slug like 'bulk-%';

-- Same list when signed in.
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
select is((select array_agg(slug) from public.list_public_boards()), array['p-five', 'p-four', 'p-three', 'p-two', 'p-one'], 'signed-in users see the same list (including the shared private board excluded)');
reset role;

-- Shape and grants.
select is((select proargnames from pg_proc where oid = 'public.list_public_boards(timestamptz, uuid, int)'::regprocedure),
  array['p_before_at', 'p_before_id', 'p_limit', 'slug', 'published_title', 'published_at', 'id', 'thumbnail_path'], 'returns exactly the five agreed columns');
select is((select not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = 'public.list_public_boards(timestamptz, uuid, int)'::regprocedure and a.grantee = 0)), true, 'no PUBLIC grant');
select is(has_function_privilege('anon', 'public.list_public_boards(timestamptz, uuid, int)', 'execute'), true, 'anon can execute');
select is(has_function_privilege('authenticated', 'public.list_public_boards(timestamptz, uuid, int)', 'execute'), true, 'authenticated can execute');
select is(has_function_privilege('anon', 'public.set_published_at()', 'execute') or has_function_privilege('authenticated', 'public.set_published_at()', 'execute'), false, 'the trigger function is not callable by clients');

-- published_at lifecycle (as the owner, through the real write paths).
insert into public.boards (id, owner_id, slug, title, doc) values ('33333333-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'life-cycle', 'L', '{}');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select is((select published_at from public.boards where id = '33333333-0000-0000-0000-000000000001'), null, 'a new private board has no published_at');
select is(public.publish_board('33333333-0000-0000-0000-000000000001'), 0, 'publish while private');
select is((select published_at from public.boards where id = '33333333-0000-0000-0000-000000000001'), null, 'published but private: still null');
select is(public.publish_board('33333333-0000-0000-0000-000000000001', 'public'), 0, 'first public publish');
select isnt((select published_at from public.boards where id = '33333333-0000-0000-0000-000000000001'), null, 'set on first public publish');
reset role;
-- Backdate as superuser, then prove the trigger keeps the value on republish while public.
alter table public.boards disable trigger boards_set_published_at;
update public.boards set published_at = '2026-05-05T00:00:00Z' where id = '33333333-0000-0000-0000-000000000001';
alter table public.boards enable trigger boards_set_published_at;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select public.publish_board('33333333-0000-0000-0000-000000000001', 'public');
select is((select published_at from public.boards where id = '33333333-0000-0000-0000-000000000001'), '2026-05-05T00:00:00Z'::timestamptz, 'unchanged on republish while public');
update public.boards set visibility = 'unlisted' where id = '33333333-0000-0000-0000-000000000001';
select is((select published_at from public.boards where id = '33333333-0000-0000-0000-000000000001'), null, 'cleared when made non-public');
update public.boards set visibility = 'public' where id = '33333333-0000-0000-0000-000000000001';
select isnt((select published_at from public.boards where id = '33333333-0000-0000-0000-000000000001'), null, 'set again on becoming public again');
select is(public.unpublish_board('33333333-0000-0000-0000-000000000001'), true, 'unpublish');
select is((select published_at from public.boards where id = '33333333-0000-0000-0000-000000000001'), null, 'cleared on unpublish');
select throws_ok($$update public.boards set published_at = now() where id = '33333333-0000-0000-0000-000000000001'$$, '42501', null, 'clients cannot write published_at');
reset role;
-- Backfill: the migration's statement, replayed on a legacy-shaped row (public, published, no published_at).
alter table public.boards disable trigger boards_set_published_at;
insert into public.boards (id, owner_id, slug, title, visibility, doc, published_doc, published_revision, published_title, updated_at) values
  ('44444444-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'legacy-pub', 'Legacy', 'public', '{}', '{}', 0, 'Legacy', '2025-06-06T00:00:00Z');
alter table public.boards enable trigger boards_set_published_at;
select is((select published_at from public.boards where id = '44444444-0000-0000-0000-000000000001'), null, 'legacy row starts without published_at');
alter table public.boards disable trigger boards_set_published_at; -- the migration runs before the trigger exists
update public.boards set published_at = updated_at
where visibility = 'public' and deleted_at is null and published_doc is not null and published_at is null;
alter table public.boards enable trigger boards_set_published_at;
select is((select published_at from public.boards where id = '44444444-0000-0000-0000-000000000001'), '2025-06-06T00:00:00Z'::timestamptz, 'backfill copies updated_at');

-- Slug reservation.
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', 'explore', 'T', '{}')$$, '23514', null, 'reserved slug explore rejected');
select * from finish();
rollback;
