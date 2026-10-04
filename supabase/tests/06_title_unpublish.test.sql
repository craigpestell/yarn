-- pgTAP: published title snapshot (AC 7) and unpublish_board. Run with 'supabase test db'.
begin;
select plan(31);
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


-- links: pub -> unl (live link), published below
insert into public.board_links (id, from_board_id, from_widget_id, to_board_id, label) values
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'w1', '11111111-0000-0000-0000-000000000002', 'to unl');
insert into public.topics (slug, title) values ('t1', 'Topic 1');
insert into public.board_topics values ('11111111-0000-0000-0000-000000000001', 't1');
insert into public.board_shares values ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');

-- title snapshot: owner publishes, then renames both the source and the target board
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select is(public.publish_board('11111111-0000-0000-0000-000000000001'), 3, 'publish');
select is(public.publish_board('11111111-0000-0000-0000-000000000002'), 1, 'publish target');
update public.boards set title = 'Pub renamed' where slug = 'pub';
update public.boards set title = 'Unl renamed' where slug = 'unl';
select is((select title from public.get_published_board('pub')), 'Pub renamed', 'owner sees the live title (get_published_board)');
select is((select title from public.public_boards where slug = 'pub'), 'Pub renamed', 'owner sees the live title (public_boards)');
select is((select to_title from public.get_board_links('11111111-0000-0000-0000-000000000001')), 'Unl renamed', 'owner sees the live target title');
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
select is((select title from public.get_published_board('pub')), 'Pub', 'stranger sees the published title after a rename');
select is((select title from public.public_boards where slug = 'pub'), 'Pub', 'stranger sees the published title in public_boards');
select is((select to_title from public.get_board_links('11111111-0000-0000-0000-000000000001')), 'Unl', 'non-owner sees the published target title');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select is((select title from public.get_published_board('pub')), 'Pub', 'anon sees the published title after a rename');
select is((select title from public.public_boards where slug = 'pub'), 'Pub', 'anon sees the published title in public_boards');
select is((select to_title from public.get_board_links('11111111-0000-0000-0000-000000000001')), 'Unl', 'anon sees the published target title');
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
select is((select title from public.list_shared_boards() where slug = 'pub'), 'Pub', 'sharee sees the published title in list_shared_boards');
reset role;
-- republish picks up the rename
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select public.publish_board('11111111-0000-0000-0000-000000000001');
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
select is((select title from public.get_published_board('pub')), 'Pub renamed', 'republish updates the published title');
reset role;

-- unpublish: only the owner, and it drops the whole snapshot
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
select is(public.unpublish_board('11111111-0000-0000-0000-000000000001'), false, 'stranger cannot unpublish');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select throws_ok($$select public.unpublish_board('11111111-0000-0000-0000-000000000001')$$, '42501', null, 'anon cannot execute unpublish_board');
reset role;
select is((select published_doc is not null from public.boards where slug = 'pub'), true, 'failed unpublish attempts changed nothing');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select is(public.unpublish_board('11111111-0000-0000-0000-000000000001'), true, 'owner unpublishes');
select is(public.unpublish_board('11111111-0000-0000-0000-000000000099'), false, 'unpublish of an unknown board returns false');
select is((select visibility from public.boards where slug = 'pub'), 'private', 'unpublish sets visibility private');
select is((select (published_doc is null and published_title is null and published_revision is null and published_links = '[]'::jsonb) from public.boards where slug = 'pub'), true, 'unpublish clears the whole snapshot');
select is((select doc->>'v' from public.boards where slug = 'pub'), 'draft-pub', 'unpublish keeps the draft');
select is((select count(*)::int from public.board_links where from_board_id = '11111111-0000-0000-0000-000000000001'), 1, 'unpublish keeps live links');
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.get_published_board('pub')), 0, 'shared user no longer reads the unpublished board');
select is((select count(*)::int from public.list_shared_boards() where slug = 'pub'), 0, 'shared user no longer lists it');
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.get_published_board('pub')), 0, 'stranger cannot read the unpublished board');
select is((select count(*)::int from public.get_board_links('11111111-0000-0000-0000-000000000001')), 0, 'stranger sees no links of an unpublished board');
select is((select count(*)::int from public.board_topics), 0, 'tags of the unpublished board are hidden');
reset role;
-- tags stay hidden even if the owner flips visibility back to public without publishing
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
update public.boards set visibility = 'public' where slug = 'pub';
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select is((select count(*)::int from public.board_topics), 0, 'tags stay hidden until the board is published again');
select is((select count(*)::int from public.public_boards where slug = 'pub'), 0, 'public visibility without a snapshot is not listed');
reset role;
-- republish: fresh snapshot with the current draft and title
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select is(public.publish_board('11111111-0000-0000-0000-000000000001'), 3, 'owner republishes');
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
select is((select published_doc->>'v' from public.get_published_board('pub')), 'draft-pub', 'republish creates a fresh snapshot from the draft');
reset role;

select * from finish();
rollback;
