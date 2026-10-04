-- pgTAP: M5 topics browse, search and tagging (AC 11).
begin;
select plan(17);
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.dev'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@test.dev');
insert into public.boards (id, owner_id, slug, title, visibility, doc, published_doc, published_revision, published_title) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'a-pub', 'A public', 'public', '{}', '{}', 0, 'A public'),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'a-unl', 'A unlisted', 'unlisted', '{}', '{}', 0, 'A unlisted'),
  ('11111111-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'a-draft', 'A draft', 'public', '{}', null, null, null),
  ('11111111-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'a-priv', 'A private', 'private', '{}', '{}', 0, 'A private secret');
insert into public.topics (slug, title, summary, tags) values
  ('dyatlov', 'Dyatlov Pass', 'Nine hikers, 1959', '{ural,mystery}'),
  ('moon', 'Moon landing', 'Apollo 11 100% real', '{nasa,space}'),
  ('wild', 'Under_score', null, '{}');

select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select is((select count(*)::int from public.topics), 3, 'anon browses all topics');
select is((select slug from public.search_topics('dyat')), 'dyatlov', 'search matches title (case-insensitive substring)');
select is((select slug from public.search_topics('1959')), 'dyatlov', 'search matches summary');
select is((select slug from public.search_topics('SPACE')), 'moon', 'search matches a tag');
select is((select count(*)::int from public.search_topics('%')), 1, 'search escapes LIKE wildcards (only the literal percent matches)');
select is((select count(*)::int from public.search_topics('   ')), 0, 'blank search returns nothing');
select is((select count(*)::int from public.search_topics('zzzz')), 0, 'no match returns nothing');
select throws_ok($$insert into public.topics (slug, title) values ('x', 'X')$$, '42501', null, 'anon cannot create topics');
reset role;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select lives_ok($$insert into public.board_topics values ('11111111-0000-0000-0000-000000000001', 'dyatlov')$$, 'owner tags own public board');
select throws_ok($$insert into public.board_topics values ('11111111-0000-0000-0000-000000000002', 'dyatlov')$$, '42501', null, 'cannot tag an unlisted board');
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
select throws_ok($$insert into public.board_topics values ('11111111-0000-0000-0000-000000000001', 'moon')$$, '42501', null, 'cannot tag someone else''s public board');
reset role;
-- an untagged-by-RLS public draft (never published) is listed nowhere even if tagged by the superuser
insert into public.board_topics values ('11111111-0000-0000-0000-000000000003', 'dyatlov');
-- a published but private board tagged by the superuser (e.g. tagged, then made private) must stay hidden
insert into public.board_topics values ('11111111-0000-0000-0000-000000000004', 'dyatlov');
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select is((select count(*)::int from public.list_topic_boards('dyatlov')), 1, 'topic lists only published public boards');
select is((select title from public.list_topic_boards('dyatlov')), 'A public', 'listed with the published title');
select is((select count(*)::int from public.board_topics), 1, 'anon sees only tags of public published boards');
select is((select count(*)::int from public.list_topic_boards('dyatlov') where title like '%secret%'), 0, 'a private tagged board never appears in list_topic_boards');
select is((select count(*)::int from public.board_topics where board_id = '11111111-0000-0000-0000-000000000004'), 0, 'anon never sees the tag of a private board');
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select lives_ok($$delete from public.board_topics where board_id = '11111111-0000-0000-0000-000000000001'$$, 'owner removes a tag');
reset role;
select * from finish();
rollback;
