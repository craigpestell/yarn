-- pgTAP: board read/write access per role. Run with 'supabase test db'.
begin;
select plan(15);
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

-- owner (alice)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.boards), 4, 'owner sees all own boards incl. doc');
select is((select doc->>'v' from public.boards where slug = 'pub'), 'draft-pub', 'owner reads draft doc');
select lives_ok($$update public.boards set title = 'Pub2' where slug = 'pub'$$, 'owner can update');
select lives_ok($$update public.boards set deleted_at = now() where slug = 'draft'$$, 'owner can soft delete');
select is((select count(*)::int from public.boards where slug = 'draft' and deleted_at is not null), 1, 'owner still sees soft-deleted board (restorable)');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) values ('bbbbbbbb-0000-0000-0000-000000000002', 'x', 'X', '{}')$$, '42501', null, 'owner cannot insert a board for someone else');
reset role;

-- stranger (carol): no direct table access, published-only via view/RPC
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.boards), 0, 'stranger cannot select boards table');
update public.boards set title = 'hacked' where slug = 'pub';
reset role;
select is((select title from public.boards where slug = 'pub'), 'Pub2', 'stranger update affected nothing');
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
select is((select published_doc->>'v' from public.get_published_board('pub')), 'snap-pub', 'stranger reads public snapshot via RPC');
select is((select published_doc->>'v' from public.get_published_board('unl')), 'snap-unl', 'stranger reads unlisted snapshot by slug');
select is((select count(*)::int from public.get_published_board('priv')), 0, 'stranger gets nothing for private board');
select is((select count(*)::int from public.get_published_board('draft')), 0, 'never-published board returns nothing');
select is((select count(*)::int from public.public_boards), 1, 'public_boards lists only public published boards (not unlisted)');
select throws_ok($$select doc from public.public_boards$$, '42703', null, 'view has no doc column');
reset role;

-- anon
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select is((select published_doc->>'v' from public.get_published_board('pub')), 'snap-pub', 'anon reads public snapshot');
reset role;

select * from finish();
rollback;
