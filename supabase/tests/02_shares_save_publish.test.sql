-- pgTAP: shares, save/publish RPCs. Run with 'supabase test db'.
begin;
select plan(13);
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

-- shares: bob reads priv snapshot only
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
select is((select published_doc->>'v' from public.get_published_board('priv')), 'snap-priv', 'shared user reads private board snapshot');
select is((select count(*)::int from public.list_shared_boards()), 1, 'shared user lists the shared board');
select is((select count(*)::int from public.boards), 0, 'shared user cannot read boards table (no doc)');
select is(public.save_board('11111111-0000-0000-0000-000000000003', 1, '{"v":"bob"}'), null, 'save_board by a non-owner returns null');
reset role;
select is((select doc->>'v' from public.boards where slug = 'priv'), 'draft-priv', 'shared user cannot write');

-- stranger sees no shares
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.board_shares), 0, 'stranger sees no shares');
select throws_ok($$insert into public.board_shares values ('11111111-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000003')$$, '42501', null, 'stranger cannot grant themselves a share');
reset role;

-- save_board: revision check (AC 5)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select is(public.save_board('11111111-0000-0000-0000-000000000001', 3, '{"v":"new"}'), 4, 'save with current revision succeeds and bumps revision');
select is(public.save_board('11111111-0000-0000-0000-000000000001', 3, '{"v":"stale"}'), null, 'stale save is rejected (null)');
select is((select doc->>'v' from public.boards where slug = 'pub'), 'new', 'stale save did not overwrite');

-- publish (AC 7): snapshot is frozen until the next publish
select is(public.publish_board('11111111-0000-0000-0000-000000000001'), 4, 'publish returns the published revision');
select public.save_board('11111111-0000-0000-0000-000000000001', 4, '{"v":"after-publish"}');
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
select is((select published_doc->>'v' from public.get_published_board('pub')), 'new', 'reader still sees the published snapshot, not later edits');
select is((select published_revision from public.get_published_board('pub')), 4, 'reader sees published_revision');
reset role;

select * from finish();
rollback;
