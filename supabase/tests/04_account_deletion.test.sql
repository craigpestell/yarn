-- pgTAP: account deletion removes all owned data (AC 2). Run with 'supabase test db'.
begin;
select plan(10);
-- Users: alice (owner), bob (shared on priv), carol (stranger).
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.dev'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@test.dev'),
  ('cccccccc-0000-0000-0000-000000000003', 'carol@test.dev');
-- Boards (inserted as superuser). pub: public+published; unl: unlisted+published;
-- priv: private+published, shared with bob; draft: public, never published.
insert into public.boards (id, owner_id, slug, title, visibility, doc, revision, published_doc, published_revision, published_title) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'pub', 'Pub', 'public', '{"v":"draft-pub"}', 3, '{"v":"snap-pub"}', 2, 'Pub'),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'unl', 'Unl', 'unlisted', '{"v":"draft-unl"}', 1, '{"v":"snap-unl"}', 1, 'Unl'),
  ('11111111-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'priv', 'Priv', 'private', '{"v":"draft-priv"}', 1, '{"v":"snap-priv"}', 1, 'Priv'),
  ('11111111-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'draft', 'Draft', 'public', '{"v":"draft-draft"}', 0, null, null, null);
insert into public.board_shares values ('11111111-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002');
-- Role switch idiom used below:
--   select set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true); set local role authenticated;
--   reset role;  -- back to superuser

insert into auth.users (id, email) values ('dddddddd-0000-0000-0000-000000000004', 'dave@test.dev');
insert into public.boards (id, owner_id, slug, title, doc, published_doc, published_revision, published_title)
  values ('22222222-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000004', 'dave-board', 'Dave', '{}', '{}', 0, 'Dave');
insert into public.topics (slug, title) values ('t1', 'Topic 1');
insert into public.board_topics values ('11111111-0000-0000-0000-000000000001', 't1');
insert into public.board_links (from_board_id, to_board_id, label) values
  ('11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'alice to alice'),
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'dave to alice');

select is((select count(*)::int from public.boards where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 4, 'precondition: alice owns 4 boards');

-- account deletion (what GoTrue does: delete from auth.users)
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select is((select count(*)::int from public.boards where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'no boards remain for the deleted owner');
select is((select count(*)::int from public.boards where owner_id = 'dddddddd-0000-0000-0000-000000000004'), 1, 'other users'' boards are untouched');
select is((select count(*)::int from public.board_shares), 0, 'shares on the deleted owner''s boards are gone');
select is((select count(*)::int from public.board_links), 0, 'links from and to the deleted owner''s boards are gone');
select is((select count(*)::int from public.board_topics), 0, 'topic tags of the deleted owner''s boards are gone');
select is((select count(*)::int from public.topics), 1, 'curated topics survive');

select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.get_published_board('pub')), 0, 'deleted owner''s public board is not readable by a stranger');
select is((select count(*)::int from public.public_boards where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'deleted owner''s boards are not listed');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select is((select count(*)::int from public.get_published_board('unl')), 0, 'deleted owner''s unlisted board is not readable by anon');
reset role;

select * from finish();
rollback;
