-- pgTAP: empty_my_trash / delete_trashed_board. Run with 'supabase test db'.
begin;
select plan(29);
insert into auth.users (id, email, email_confirmed_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.dev', now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@test.dev', now());

-- alice: T1, T2 trashed; A1 active. bob: BT trashed, BA active.
insert into public.boards (id, owner_id, slug, title, doc, deleted_at) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'trashed-one', 'T1', '{}', now()),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'trashed-two', 'T2', '{}', now()),
  ('11111111-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'active-one', 'A1', '{}', null),
  ('22222222-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'bob-trashed', 'BT', '{}', now()),
  ('22222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'bob-active', 'BA', '{}', null);
-- a fork of T1 (owned by bob), plus links, share, invite and topic on T1
insert into public.boards (id, owner_id, slug, title, doc, forked_from) values
  ('22222222-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'fork-board', 'Fork', '{}', '11111111-0000-0000-0000-000000000001');
insert into public.board_links (from_board_id, to_board_id, label) values
  ('11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', 'out of T1'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'into T1'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003', 'unrelated');
insert into public.board_shares (board_id, user_id) values ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');
insert into public.board_share_invites (board_id, email) values ('11111111-0000-0000-0000-000000000001', 'x@test.dev');
insert into public.topics (slug, title) values ('t-one', 'Topic one');
insert into public.board_topics (board_id, topic_slug) values ('11111111-0000-0000-0000-000000000001', 't-one');

-- grants and definition
select is((select not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = 'public.empty_my_trash()'::regprocedure and a.grantee = 0)), true, 'empty_my_trash has no PUBLIC grant');
select is((select not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = 'public.delete_trashed_board(uuid)'::regprocedure and a.grantee = 0)), true, 'delete_trashed_board has no PUBLIC grant');
select is(has_function_privilege('anon', 'public.empty_my_trash()', 'execute'), false, 'anon cannot execute empty_my_trash');
select is(has_function_privilege('anon', 'public.delete_trashed_board(uuid)', 'execute'), false, 'anon cannot execute delete_trashed_board');
select is(has_function_privilege('authenticated', 'public.empty_my_trash()', 'execute'), true, 'authenticated can execute empty_my_trash');
select is(has_function_privilege('authenticated', 'public.delete_trashed_board(uuid)', 'execute'), true, 'authenticated can execute delete_trashed_board');
select is((select count(*)::int from pg_proc where oid in ('public.empty_my_trash()'::regprocedure, 'public.delete_trashed_board(uuid)'::regprocedure) and prosecdef and proconfig @> array['search_path=""']), 2, 'both are security definer with a pinned search_path');
select is(has_table_privilege('authenticated', 'public.boards', 'delete'), false, 'authenticated still has no DELETE on boards');

-- anon denied at the grant
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select throws_ok($$select public.empty_my_trash()$$, '42501', null, 'anon is denied empty_my_trash');
select throws_ok($$select public.delete_trashed_board('11111111-0000-0000-0000-000000000001')$$, '42501', null, 'anon is denied delete_trashed_board');
reset role;

-- authenticated without a sub: auth.uid() is null
select set_config('request.jwt.claims', '{"role":"authenticated"}', true); set local role authenticated;
select throws_ok($$select public.empty_my_trash()$$, '28000', 'not authenticated', 'null auth.uid() raises in empty_my_trash');
select throws_ok($$select public.delete_trashed_board('11111111-0000-0000-0000-000000000001')$$, '28000', 'not authenticated', 'null auth.uid() raises in delete_trashed_board');
reset role;

-- alice, delete_trashed_board: active, foreign and nonexistent return false
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select is(public.delete_trashed_board('11111111-0000-0000-0000-000000000003'), false, 'an active board is not deleted (false)');
select is(public.delete_trashed_board('22222222-0000-0000-0000-000000000001'), false, 'a foreign trashed board is not deleted (false)');
select is(public.delete_trashed_board('99999999-0000-0000-0000-000000000009'), false, 'a nonexistent id returns false');
reset role;
select is((select count(*)::int from public.boards), 6, 'nothing was deleted by the false calls');

-- a board restored before the call survives
update public.boards set deleted_at = null where id = '11111111-0000-0000-0000-000000000002';
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select is(public.delete_trashed_board('11111111-0000-0000-0000-000000000002'), false, 'a restored board is not deleted');
-- delete one trashed board (T1): true, with cascades
select is(public.delete_trashed_board('11111111-0000-0000-0000-000000000001'), true, 'own trashed board is deleted (true)');
reset role;
select is((select count(*)::int from public.boards where id = '11111111-0000-0000-0000-000000000001'), 0, 'T1 is gone');
select is((select count(*)::int from public.board_links where from_board_id = '11111111-0000-0000-0000-000000000001' or to_board_id = '11111111-0000-0000-0000-000000000001'), 0, 'links in both directions are gone');
select is((select count(*)::int from public.board_shares where board_id = '11111111-0000-0000-0000-000000000001')
        + (select count(*)::int from public.board_share_invites where board_id = '11111111-0000-0000-0000-000000000001')
        + (select count(*)::int from public.board_topics where board_id = '11111111-0000-0000-0000-000000000001'), 0, 'shares, invites and topics are gone');
select is((select forked_from from public.boards where id = '22222222-0000-0000-0000-000000000003'), null, 'the fork survives with forked_from null');

-- empty_my_trash: a board restored before the call survives (T2 was restored above; alice has no trashed boards)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select is(public.empty_my_trash(), '{}'::uuid[], 'a restored board is not returned by empty_my_trash');
reset role;
select is((select count(*)::int from public.boards where id = '11111111-0000-0000-0000-000000000002'), 1, 'the restored board still exists after empty_my_trash');

-- trash T2 again plus a new T3 for alice; bob empties his own trash only
insert into public.boards (id, owner_id, slug, title, doc, deleted_at) values
  ('11111111-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'trashed-three', 'T3', '{}', now());
update public.boards set deleted_at = now() where id = '11111111-0000-0000-0000-000000000002';
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
select is(public.empty_my_trash(), array['22222222-0000-0000-0000-000000000001']::uuid[], 'bob only deletes his own trashed board');
reset role;
select is((select count(*)::int from public.boards where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001' and deleted_at is not null), 2, 'alice trashed boards are untouched by bob');

-- alice empties: multi-id return, only her trashed boards go
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select is((select array_agg(x order by x) from unnest(public.empty_my_trash()) x),
  array['11111111-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000004']::uuid[], 'returns every deleted id');
select is(public.empty_my_trash(), '{}'::uuid[], 'an empty trash returns an empty array');
reset role;
select is((select array_agg(id order by id) from public.boards), array[
  '11111111-0000-0000-0000-000000000003',
  '22222222-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003']::uuid[],
  'alice active board and bob''s remaining boards are untouched');

select * from finish();
rollback;
