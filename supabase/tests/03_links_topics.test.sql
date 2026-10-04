-- pgTAP: board_links and board_topics. Run with 'supabase test db'.
begin;
select plan(21);
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
-- dave owns a private board with a published snapshot that nobody else can read.
insert into public.boards (id, owner_id, slug, title, doc, published_doc, published_revision, published_title)
  values ('22222222-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000004', 'dave-secret', 'Secret Title', '{}', '{}', 0, 'Secret Title');
insert into public.topics (slug, title) values ('t1', 'Topic 1');

-- links inserted as superuser: pub -> unl, and pub -> dave's secret (models a target that is not readable by others)
insert into public.board_links (id, from_board_id, from_widget_id, to_board_id, label) values
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'w1', '11111111-0000-0000-0000-000000000002', 'to unl'),
  ('33333333-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'w2', '22222222-0000-0000-0000-000000000001', 'to secret');

-- owner publishes (snapshotting the two links), then adds a third link that is not yet published
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select is(public.publish_board('11111111-0000-0000-0000-000000000001'), 3, 'owner publishes (snapshots links)');
select throws_ok($$insert into public.board_links (from_board_id, to_board_id) values ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001')$$, '42501', null, 'owner cannot link to an unreadable board');
select lives_ok($$insert into public.board_links (from_board_id, to_board_id, label) values ('11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', 'late')$$, 'owner can link to own board');
select is((select count(*)::int from public.get_board_links('11111111-0000-0000-0000-000000000001')), 3, 'owner sees live links incl. the unpublished one');
select is((select count(*)::int from public.board_links), 3, 'owner reads the live links table');
reset role;

-- stranger: published links only, via RPC
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.board_links), 0, 'stranger cannot read the live links table');
select is((select count(*)::int from public.get_board_links('11111111-0000-0000-0000-000000000001')), 2, 'stranger sees only links that existed at publish');
select is((select count(*)::int from public.get_board_links('11111111-0000-0000-0000-000000000001') where label = 'late'), 0, 'link added after publish is invisible to a stranger');
select is((select to_title from public.get_board_links('11111111-0000-0000-0000-000000000001') where label = 'to unl'), 'Unl', 'readable target title is returned');
select is((select to_title from public.get_board_links('11111111-0000-0000-0000-000000000001') where label = 'to secret'), null, 'inaccessible target title is null (unavailable)');
select is((select to_slug from public.get_board_links('11111111-0000-0000-0000-000000000001') where label = 'to secret'), null, 'inaccessible target slug is null');
select is((select count(*)::int from public.get_board_links('11111111-0000-0000-0000-000000000003')), 0, 'links of an unreadable board are hidden');
select throws_ok($$insert into public.board_links (from_board_id, to_board_id) values ('11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002')$$, '42501', null, 'non-owner cannot add links');
reset role;

-- anon: same as a stranger
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select is((select count(*)::int from public.get_board_links('11111111-0000-0000-0000-000000000001')), 2, 'anon sees only published links');
select is((select count(*)::int from public.get_board_links('11111111-0000-0000-0000-000000000001') where label = 'late'), 0, 'anon cannot see the unpublished link');
select throws_ok($$select count(*) from public.board_links$$, '42501', null, 'anon has no direct access to board_links');
reset role;

-- topics (AC 11): owner of a public board only
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select lives_ok($$insert into public.board_topics values ('11111111-0000-0000-0000-000000000001', 't1')$$, 'owner tags own public board');
select throws_ok($$insert into public.board_topics values ('11111111-0000-0000-0000-000000000003', 't1')$$, '42501', null, 'owner cannot tag a non-public board');
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
select throws_ok($$insert into public.board_topics values ('11111111-0000-0000-0000-000000000004', 't1')$$, '42501', null, 'stranger cannot tag someone else''s board');
select is((select count(*)::int from public.board_topics), 1, 'anyone can read tags of public boards');
select throws_ok($$insert into public.topics values ('hack', 'Hack')$$, '42501', null, 'clients cannot create topics');
reset role;

select * from finish();
rollback;
