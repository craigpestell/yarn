-- pgTAP: write surface, bounds, deny-by-default. Run with 'supabase test db'.
begin;
select plan(43);
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

update public.boards set updated_at = '2000-01-01' where slug = 'pub';
insert into public.topics (slug, title) values ('t1', 'Topic 1');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
-- owner cannot bypass the revision check or forge published data (AC 3, 5, 7)
select throws_ok($$update public.boards set doc = '{"v":"forged"}' where slug = 'pub'$$, '42501', null, 'owner cannot update doc directly');
select throws_ok($$update public.boards set revision = 99 where slug = 'pub'$$, '42501', null, 'owner cannot update revision directly');
select throws_ok($$update public.boards set published_doc = '{"v":"forged"}' where slug = 'pub'$$, '42501', null, 'owner cannot update published_doc directly');
select throws_ok($$update public.boards set published_revision = 99 where slug = 'pub'$$, '42501', null, 'owner cannot update published_revision directly');
select throws_ok($$update public.boards set published_links = '[]' where slug = 'pub'$$, '42501', null, 'owner cannot update published_links directly');
select throws_ok($$update public.boards set owner_id = 'bbbbbbbb-0000-0000-0000-000000000002' where slug = 'pub'$$, '42501', null, 'owner cannot reassign owner_id');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc, published_doc) values ('aaaaaaaa-0000-0000-0000-000000000001', 'forged', 'F', '{}', '{"v":"forged"}')$$, '42501', null, 'owner cannot insert with published_doc');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc, revision) values ('aaaaaaaa-0000-0000-0000-000000000001', 'forged', 'F', '{}', 50)$$, '42501', null, 'owner cannot insert with a chosen revision');
select throws_ok($$delete from public.boards where slug = 'pub'$$, '42501', null, 'no hard delete for clients (soft delete only)');
select lives_ok($$insert into public.boards (owner_id, slug, title, doc, visibility) values ('aaaaaaaa-0000-0000-0000-000000000001', 'fresh-board', 'Fresh', '{}', 'unlisted')$$, 'owner can insert a normal board');
select is((select revision from public.boards where slug = 'fresh-board'), 0, 'new board starts at revision 0');
select is((select published_doc from public.boards where slug = 'fresh-board'), null, 'new board is unpublished');
select lives_ok($$update public.boards set title = 'Renamed' where slug = 'pub'$$, 'owner can still rename');
select ok((select updated_at > '2000-01-01' from public.boards where slug = 'pub'), 'updated_at trigger fires');
select is(public.save_board('11111111-0000-0000-0000-000000000001', 3, '{"v":"ok"}'), 4, 'save_board (security definer) still works for the owner');
select is(public.publish_board('11111111-0000-0000-0000-000000000001'), 4, 'publish_board still works for the owner');

-- bounds (AC 3 hardening)
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', 'arr-doc', 'T', '[]')$$, '23514', null, 'doc must be a json object');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) select 'aaaaaaaa-0000-0000-0000-000000000001', 'huge-doc', 'T', jsonb_build_object('a', string_agg(md5(i::text), '')) from generate_series(1, 40000) i$$, '23514', null, 'doc over 1 MiB is rejected');
select throws_ok($$select public.save_board('11111111-0000-0000-0000-000000000001', 4, '[]')$$, '23514', null, 'save_board rejects a non-object doc');
select throws_ok($$select public.save_board('11111111-0000-0000-0000-000000000001', 4, '{"widgets":{}}')$$, '23514', null, 'save_board rejects doc.widgets that is not an array');
select throws_ok($$select public.save_board('11111111-0000-0000-0000-000000000001', 4, '{"edges":"x"}')$$, '23514', null, 'save_board rejects doc.edges that is not an array');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', 'AB', 'T', '{}')$$, '23514', null, 'slug too short / uppercase rejected');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', 'has space', 'T', '{}')$$, '23514', null, 'slug must be url-safe');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', '-edge-', 'T', '{}')$$, '23514', null, 'slug cannot start or end with a hyphen');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', repeat('a', 81), 'T', '{}')$$, '23514', null, 'slug over 80 chars rejected');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', 'empty-title', '', '{}')$$, '23514', null, 'empty title rejected');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', 'long-title', repeat('t', 201), '{}')$$, '23514', null, 'title over 200 chars rejected');

-- public_boards view is read-only for everyone
select throws_ok($$update public.public_boards set slug = 'x'$$, '42501', null, 'authenticated cannot update through public_boards');
select throws_ok($$delete from public.public_boards$$, '42501', null, 'authenticated cannot delete through public_boards');
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select throws_ok($$update public.public_boards set slug = 'x'$$, '42501', null, 'anon cannot update through public_boards');
select throws_ok($$delete from public.public_boards$$, '42501', null, 'anon cannot delete through public_boards');
select throws_ok($$insert into public.public_boards (id, owner_id, slug, published_doc) values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'viaview', '{}')$$, '42501', null, 'anon cannot insert through public_boards');
select throws_ok($$select 1 from public.boards$$, '42501', null, 'anon cannot read boards');
select throws_ok($$select public.save_board('11111111-0000-0000-0000-000000000001', 3, '{}')$$, '42501', null, 'anon cannot execute save_board');
select throws_ok($$select public.publish_board('11111111-0000-0000-0000-000000000001')$$, '42501', null, 'anon cannot execute publish_board');
select throws_ok($$select 1 from public.board_shares$$, '42501', null, 'anon cannot read board_shares');
select throws_ok($$insert into public.topics values ('anon-t', 'x')$$, '42501', null, 'anon cannot write topics');
reset role;

-- deny by default (Supabase default privileges must not leak into new objects)
select is((select count(*)::int from information_schema.role_table_grants where grantee in ('anon', 'authenticated') and table_schema = 'public' and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')), 0, 'no TRUNCATE/REFERENCES/TRIGGER grants to anon/authenticated');
select is((select count(*)::int from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public' and privilege_type <> 'SELECT'), 0, 'anon has only SELECT anywhere');
create table public.zz_new (i int);
create function public.zz_new_f() returns int language sql as $$ select 1 $$;
select ok(not has_table_privilege('anon', 'public.zz_new', 'select') and not has_table_privilege('authenticated', 'public.zz_new', 'insert'), 'new tables get no default grants for clients');
select is((select count(*)::int from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.proname = 'zz_new_f' and a.grantee in ('anon'::regrole, 'authenticated'::regrole)), 0, 'new functions get no explicit default execute grants for clients');

-- topics bounds
select throws_ok($$insert into public.topics (slug, title, tags) values ('many', 'M', array_fill('t'::text, array[21]))$$, '23514', null, 'topics.tags capped at 20');
select is((select tags from public.topics where slug = 't1'), '{}'::text[], 'topics.tags defaults to empty array');

select * from finish();
rollback;
