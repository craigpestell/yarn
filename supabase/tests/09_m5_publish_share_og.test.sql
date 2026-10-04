-- pgTAP: M5 publish snapshot isolation (AC 7), visibility, shares by email (invites; no account enumeration),
-- OG data and published thumbnails (AC 8).
begin;
select plan(50);
insert into auth.users (id, email, email_confirmed_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.dev', now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@test.dev', now()),
  ('cccccccc-0000-0000-0000-000000000003', 'carol@test.dev', now());
insert into public.boards (id, owner_id, slug, title, doc) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'alice-board', 'Alice v1', '{"v":"one"}'),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'alice-priv', 'Alice private', '{"v":"p"}'),
  ('11111111-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'alice-shared', 'Alice shared', '{"v":"s"}');
insert into storage.objects (bucket_id, name, owner_id) values
  ('thumbnails', 'aaaaaaaa-0000-0000-0000-000000000001/pub-11111111-0000-0000-0000-000000000001.png', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('thumbnails', 'aaaaaaaa-0000-0000-0000-000000000001/11111111-0000-0000-0000-000000000001.png', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('thumbnails', 'aaaaaaaa-0000-0000-0000-000000000001/pub-11111111-0000-0000-0000-000000000002.png', 'aaaaaaaa-0000-0000-0000-000000000001');

-- alice publishes as unlisted, then keeps editing
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select is(public.publish_board('11111111-0000-0000-0000-000000000001', 'unlisted'), 0, 'publish with visibility returns the published revision');
select is((select visibility from public.boards where id = '11111111-0000-0000-0000-000000000001'), 'unlisted', 'visibility set by publish');
select is(public.publish_board('11111111-0000-0000-0000-000000000001', 'secret'), null, 'invalid visibility is refused');
select is(public.save_board('11111111-0000-0000-0000-000000000001', 0, '{"v":"two"}', 'Alice v2 (draft rename)'), 1, 'later edit saved');
select is(public.save_board('11111111-0000-0000-0000-000000000001', 1, '{"v":"three"}'), 2, 'second later edit saved');
select is((select published_doc ->> 'v' from public.boards where id = '11111111-0000-0000-0000-000000000001'), 'one', 'owner row: published_doc unchanged by edits');
select is((select published_revision from public.boards where id = '11111111-0000-0000-0000-000000000001'), 0, 'published_revision unchanged by edits');
reset role;

-- a reader (anon and stranger) keeps fetching the snapshot, never the draft or the draft title
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select is((select published_doc ->> 'v' from public.get_published_board('alice-board')), 'one', 'anon reads the snapshot after later edits');
select is((select title from public.get_published_board('alice-board')), 'Alice v1', 'anon sees the published title, not the draft rename');
select is((select published_revision from public.get_published_board('alice-board')), 0, 'anon sees the published revision');
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
select is((select published_doc ->> 'v' from public.get_published_board('alice-board')), 'one', 'stranger reads the snapshot after later edits');
select is((select count(*)::int from public.get_published_board('alice-priv')), 0, 'stranger cannot read a private unpublished board');
select is((select count(*)::int from public.resolve_board('alice-priv')), 0, 'resolve_board hides an unreadable board');
select is((select title from public.resolve_board('alice-board')), 'Alice v1', 'resolve_board returns the published title');
reset role;

-- republish updates what readers see
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select is(public.publish_board('11111111-0000-0000-0000-000000000001'), 2, 'republish keeps visibility (null) and snapshots again');
select is((select visibility from public.boards where id = '11111111-0000-0000-0000-000000000001'), 'unlisted', 'null visibility keeps the current value');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select is((select published_doc ->> 'v' from public.get_published_board('alice-board')), 'three', 'republish exposes the new snapshot');
select throws_ok($$select public.publish_board('11111111-0000-0000-0000-000000000001', 'public')$$, '42501', null, 'anon cannot publish');
reset role;

-- shares by email: invites only, so an address with no account is indistinguishable from one with an account
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select is(public.publish_board('11111111-0000-0000-0000-000000000003', 'private'), 0, 'alice publishes a private board');
select is(public.share_board('11111111-0000-0000-0000-000000000003', 'BOB@test.dev'), true, 'owner shares by email (case-insensitive)');
select is(public.share_board('11111111-0000-0000-0000-000000000003', 'nobody@test.dev'), true, 'unknown email gives the same answer');
select is((select array_agg(email order by email) from public.list_board_shares('11111111-0000-0000-0000-000000000003')), array['bob@test.dev', 'nobody@test.dev'], 'list shows both invites trimmed and lowercased: a real and an unknown address look the same');
select is((select count(*)::int from public.board_shares), 0, 'sharing by email creates no user-id grant (no account lookup is visible)');
select is(public.share_board('11111111-0000-0000-0000-000000000003', 'not-an-email'), false, 'malformed address is refused');
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
select is((select published_doc ->> 'v' from public.get_published_board('alice-shared')), 's', 'the invited account reads the private published board');
select is((select count(*)::int from public.list_shared_boards()), 1, 'the invited account lists it as shared with them');
select is(public.share_board('11111111-0000-0000-0000-000000000003', 'carol@test.dev'), false, 'a shared reader cannot share onward');
select is((select count(*)::int from public.list_board_shares('11111111-0000-0000-0000-000000000003')), 0, 'a shared reader cannot list invites');
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.get_published_board('alice-shared')), 0, 'an account that was not invited cannot read it');
select is((select count(*)::int from public.list_shared_boards()), 0, 'an account that was not invited lists nothing');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select is((select count(*)::int from public.get_published_board('alice-shared')), 0, 'anon cannot read an invited-only board');
reset role;
-- an invite for an address that registers later: nothing until the email is confirmed, then only for that address
insert into auth.users (id, email) values ('dddddddd-0000-0000-0000-000000000004', 'Nobody@Test.dev');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.get_published_board('alice-shared')), 0, 'an UNCONFIRMED account with the invited email gets no access');
select is((select count(*)::int from public.list_shared_boards()), 0, 'an unconfirmed account lists nothing as shared with them');
reset role;
update auth.users set email_confirmed_at = now() where id = 'dddddddd-0000-0000-0000-000000000004';
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.get_published_board('alice-shared')), 1, 'once confirmed, the account with the invited email (any casing) reads it');
select is((select count(*)::int from public.list_shared_boards()), 1, 'and lists it as shared with them');
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.get_published_board('alice-shared')), 0, 'a confirmed stranger with a different email still gets nothing');
reset role;

-- revoking works the same for known and unknown addresses
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select is(public.unshare_board('11111111-0000-0000-0000-000000000003', 'bob@test.dev'), true, 'owner revokes an invite');
select is(public.unshare_board('11111111-0000-0000-0000-000000000003', 'ghost@test.dev'), true, 'revoking an address that was never invited gives the same answer');
select is((select array_agg(email) from public.list_board_shares('11111111-0000-0000-0000-000000000003')), array['nobody@test.dev'], 'revoked invite is gone from the list');
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.get_published_board('alice-shared')), 0, 'a revoked account loses access');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('thumbnails', 'aaaaaaaa-0000-0000-0000-000000000001/pub-11111111-0000-0000-0000-000000000003.png', 'bbbbbbbb-0000-0000-0000-000000000002')$$, '42501', null, 'another user cannot write a pub-* thumbnail into the owner folder');
reset role;

-- OG data: anon sees public/unlisted published boards only
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select is((select title from public.get_board_og('alice-board')), 'Alice v2 (draft rename)', 'og: unlisted board gives the republished title');
select is((select thumbnail_path from public.get_board_og('alice-board')), 'aaaaaaaa-0000-0000-0000-000000000001/pub-11111111-0000-0000-0000-000000000001.png', 'og: published thumbnail path');
select is((select count(*)::int from public.get_board_og('alice-priv')), 0, 'og: private board gives nothing');
select is((select count(*)::int from public.get_board_og('no-such-board')), 0, 'og: unknown slug gives nothing');
-- published thumbnails readable by anon only for the published public/unlisted board
select is((select count(*)::int from storage.objects where bucket_id = 'thumbnails'), 1, 'anon reads exactly the published thumbnail');
select is((select count(*)::int from storage.objects where name like '%/11111111-0000-0000-0000-000000000001.png'), 0, 'anon cannot read the draft thumbnail');
reset role;

-- unpublish closes the thumbnail and og
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select is(public.unpublish_board('11111111-0000-0000-0000-000000000001'), true, 'owner unpublishes');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select is((select count(*)::int from storage.objects where bucket_id = 'thumbnails'), 0, 'unpublished board thumbnail is unreadable again');
select is((select count(*)::int from public.get_board_og('alice-board')), 0, 'og: unpublished board gives nothing');
reset role;
select * from finish();
rollback;
