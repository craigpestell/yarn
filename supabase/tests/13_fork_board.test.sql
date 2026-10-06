-- pgTAP: fork_board / get_fork_source. Run with 'supabase test db'.
begin;
select plan(51);
insert into auth.users (id, email, email_confirmed_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.dev', now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@test.dev', now()),
  ('cccccccc-0000-0000-0000-000000000003', 'carol@test.dev', now()),
  ('dddddddd-0000-0000-0000-000000000004', 'dave@test.dev', now()),
  ('eeeeeeee-0000-0000-0000-000000000005', 'eve@test.dev', now());
insert into auth.users (id, email) values ('ffffffff-0000-0000-0000-000000000006', 'unconfirmed@test.dev'); -- email not confirmed

-- Source S (alice, public). Live doc differs from the published snapshot on purpose.
insert into public.boards (id, owner_id, slug, title, visibility, doc, published_doc, published_revision, published_title, published_links, revision) values (
  '11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'source-board', 'LIVE TITLE', 'public',
  '{"version":1,"widgets":[{"id":"w1","type":"note","data":{"text":"LIVE DOC TEXT"}}],"edges":[]}',
  '{"version":1,"widgets":[
     {"id":"w1","type":"photo","data":{"title":"a","image":"abc-uid/pic.png"},"sources":[{"url":"https://e.test/s","retrievedAt":"2026-01-01T00:00:00Z","license":"CC-BY","attribution":"Someone"}]},
     {"id":"w2","type":"photo","data":{"title":"b","image":"https://img.test/b.jpg"}},
     {"id":"w3","type":"wanted","data":{"name":"n","image":"abc-uid/wanted.png"}},
     {"id":"w4","type":"note","data":{"text":"PUBLISHED TEXT","color":"#fef08a"}}],
    "edges":[{"id":"e1","source":"w1","target":"w2","color":"#e53e3e"}]}',
  3, 'Published title',
  jsonb_build_array(
    jsonb_build_object('id', '90000000-0000-0000-0000-000000000001', 'from_widget_id', 'w1', 'to_board_id', '22222222-0000-0000-0000-000000000001', 'label', 'ok link', 'pinned_revision', null),
    jsonb_build_object('id', '90000000-0000-0000-0000-000000000002', 'from_widget_id', 'w2', 'to_board_id', '22222222-0000-0000-0000-000000000002', 'label', 'private target', 'pinned_revision', null),
    jsonb_build_object('id', '90000000-0000-0000-0000-000000000003', 'from_widget_id', 'w3', 'to_board_id', '22222222-0000-0000-0000-000000000003', 'label', 'deleted target', 'pinned_revision', null),
    jsonb_build_object('id', '90000000-0000-0000-0000-000000000004', 'from_widget_id', 'w4', 'to_board_id', '11111111-0000-0000-0000-000000000001', 'label', 'self', 'pinned_revision', null),
    jsonb_build_object('id', '90000000-0000-0000-0000-000000000005', 'from_widget_id', 'wX', 'to_board_id', '22222222-0000-0000-0000-000000000001', 'label', 'no such widget', 'pinned_revision', null)), 7);
-- link targets: T1 public, T2 private (secret title), T3 public but soft-deleted
insert into public.boards (id, owner_id, slug, title, visibility, doc, published_doc, published_revision, published_title, deleted_at) values
  ('22222222-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003', 't1-open', 'T1', 'public', '{}', '{}', 0, 'T1', null),
  ('22222222-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003', 't2-private', 'SECRET TITLE', 'private', '{}', '{}', 0, 'SECRET TITLE', null),
  ('22222222-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000003', 't3-deleted', 'T3', 'public', '{}', '{}', 0, 'T3', now());
-- unreadable sources: private published (not shared), public never published, soft-deleted, share to an unconfirmed email
insert into public.boards (id, owner_id, slug, title, visibility, doc, published_doc, published_revision, published_title, deleted_at) values
  ('33333333-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'priv-pub', 'P', 'private', '{}', '{"version":1,"widgets":[],"edges":[]}', 0, 'P', null),
  ('33333333-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'never-pub', 'N', 'public', '{}', null, null, null, null),
  ('33333333-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'trashed', 'D', 'public', '{}', '{"version":1,"widgets":[],"edges":[]}', 0, 'D', now()),
  ('33333333-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'shared-unconf', 'U', 'private', '{}', '{"version":1,"widgets":[],"edges":[]}', 0, 'U', null);
insert into public.board_share_invites (board_id, email) values ('33333333-0000-0000-0000-000000000004', 'unconfirmed@test.dev');
-- the source also has an invite, a topic and a share that must never be copied
insert into public.topics (slug, title) values ('t-one', 'Topic one');
insert into public.board_topics (board_id, topic_slug) values ('11111111-0000-0000-0000-000000000001', 't-one');
insert into public.board_share_invites (board_id, email) values ('11111111-0000-0000-0000-000000000001', 'secret-invitee@test.dev');
insert into public.board_shares (board_id, user_id) values ('11111111-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000004');

-- grants: executable by authenticated only
select is((select not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = 'public.fork_board(uuid)'::regprocedure and a.grantee = 0)), true, 'fork_board has no PUBLIC grant');
select is(has_function_privilege('anon', 'public.fork_board(uuid)', 'execute'), false, 'anon cannot execute fork_board');
select is(has_function_privilege('authenticated', 'public.fork_board(uuid)', 'execute'), true, 'authenticated can execute fork_board');
select is(has_function_privilege('anon', 'public.get_fork_source(uuid)', 'execute'), false, 'anon cannot execute get_fork_source');
select is(has_function_privilege('authenticated', 'public.get_fork_source(uuid)', 'execute'), true, 'authenticated can execute get_fork_source');
select is((select not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = 'public.get_fork_source(uuid)'::regprocedure and a.grantee = 0)), true, 'get_fork_source has no PUBLIC grant');
select is((select count(*)::int from pg_proc where oid in ('public.fork_board(uuid)'::regprocedure, 'public.get_fork_source(uuid)'::regprocedure) and prosecdef and proconfig @> array['search_path=""']), 2, 'both are security definer with a pinned search_path');

-- anon
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select throws_ok($$select * from public.fork_board('11111111-0000-0000-0000-000000000001')$$, '42501', null, 'anon is denied at the grant');
reset role;

-- bob: failures are all the same neutral error and create no row
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
select throws_ok($$select * from public.fork_board('33333333-0000-0000-0000-000000000001')$$, 'P0001', 'fork unavailable', 'private unshared');
select throws_ok($$select * from public.fork_board('33333333-0000-0000-0000-000000000002')$$, 'P0001', 'fork unavailable', 'unpublished');
select throws_ok($$select * from public.fork_board('33333333-0000-0000-0000-000000000003')$$, 'P0001', 'fork unavailable', 'soft-deleted');
select throws_ok($$select * from public.fork_board('99999999-0000-0000-0000-000000000009')$$, 'P0001', 'fork unavailable', 'nonexistent');
select throws_ok($$select * from public.fork_board(null)$$, 'P0001', 'fork unavailable', 'null id');
reset role;
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-000000000006","role":"authenticated"}', true); set local role authenticated;
select throws_ok($$select * from public.fork_board('33333333-0000-0000-0000-000000000004')$$, 'P0001', 'fork unavailable', 'share to an unconfirmed email');
reset role;
select is((select count(*)::int from public.boards where forked_from is not null), 0, 'no rows were created by the failures');

-- bob forks S
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.fork_board('11111111-0000-0000-0000-000000000001')), 1, 'bob forks the public board');
reset role;

select is((select count(*)::int from public.boards where forked_from = '11111111-0000-0000-0000-000000000001'), 1, 'one fork row');
select is((select owner_id from public.boards where forked_from = '11111111-0000-0000-0000-000000000001'), 'bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'owned by the forker');
select is((select title from public.boards where forked_from = '11111111-0000-0000-0000-000000000001'), 'Fork of Published title', 'title is Fork of <published_title>, not the live title');
select is((select visibility || revision::text from public.boards where forked_from = '11111111-0000-0000-0000-000000000001'), 'private0', 'private, revision 0');
select is((select published_doc is null and published_title is null and published_revision is null and published_links = '[]'::jsonb and deleted_at is null from public.boards where forked_from = '11111111-0000-0000-0000-000000000001'), true, 'no published_* state');
select matches((select slug from public.boards where forked_from = '11111111-0000-0000-0000-000000000001'), '^fork-[0-9a-f]{12}$', 'server-generated valid slug');
select is((select doc::text like '%LIVE DOC TEXT%' from public.boards where forked_from = '11111111-0000-0000-0000-000000000001'), false, 'live doc text never appears in the fork');
select is((select doc #>> '{widgets,3,data,text}' from public.boards where forked_from = '11111111-0000-0000-0000-000000000001'), 'PUBLISHED TEXT', 'content comes from published_doc');
select is((select doc #> '{widgets,0,data}' ? 'image' from public.boards where forked_from = '11111111-0000-0000-0000-000000000001'), false, 'storage-path image stripped (photo)');
select is((select doc #> '{widgets,2,data}' ? 'image' from public.boards where forked_from = '11111111-0000-0000-0000-000000000001'), false, 'storage-path image stripped (wanted)');
select is((select doc #>> '{widgets,1,data,image}' from public.boards where forked_from = '11111111-0000-0000-0000-000000000001'), 'https://img.test/b.jpg', 'https image kept');
select is((select doc #> '{widgets,0,sources}' from public.boards where forked_from = '11111111-0000-0000-0000-000000000001'),
  '[{"url":"https://e.test/s","retrievedAt":"2026-01-01T00:00:00Z","license":"CC-BY","attribution":"Someone"}]'::jsonb, 'sources, licence and attribution kept verbatim');
select is((select doc -> 'edges' from public.boards where forked_from = '11111111-0000-0000-0000-000000000001'), '[{"id":"e1","source":"w1","target":"w2","color":"#e53e3e"}]'::jsonb, 'edges kept');
select is((select count(*)::int from public.board_share_invites i join public.boards b on b.id = i.board_id where b.forked_from is not null), 0, 'no invites copied');
select is((select count(*)::int from public.board_shares i join public.boards b on b.id = i.board_id where b.forked_from is not null), 0, 'no shares copied');
select is((select count(*)::int from public.board_topics i join public.boards b on b.id = i.board_id where b.forked_from is not null), 0, 'no topics copied');
select is((select count(*)::int from public.board_links l join public.boards b on b.id = l.from_board_id where b.forked_from is not null), 1, 'only the readable, live, non-self link with an existing widget is copied');
select is((select l.to_board_id from public.board_links l join public.boards b on b.id = l.from_board_id where b.forked_from is not null), '22222222-0000-0000-0000-000000000001'::uuid, 'the copied link is the one to the readable target');
select is((select count(*)::int from public.board_links l join public.boards b on b.id = l.from_board_id where b.forked_from is not null and l.to_board_id = b.id), 0, 'never self-linked');

-- provenance
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
select is((select source_slug || '|' || source_title from public.get_fork_source((select id from public.boards where forked_from = '11111111-0000-0000-0000-000000000001'))), 'source-board|Published title', 'readable source: published title and slug');
select is((select count(*)::int from public.get_fork_source('11111111-0000-0000-0000-000000000001')), 0, 'a board that is not a fork has no provenance row');
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.get_fork_source((select id from public.boards where forked_from = '11111111-0000-0000-0000-000000000001'))), 0, 'a stranger cannot read the fork, so gets nothing');
reset role;
-- source turns private: label is unavailable and the title is not returned
update public.boards set visibility = 'private' where id = '11111111-0000-0000-0000-000000000001';
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
select is((select row(source_slug, source_title)::text from public.get_fork_source((select id from public.boards where forked_from = '11111111-0000-0000-0000-000000000001'))), '(,)', 'unreadable source: null slug and title');
select is((select count(*)::int from (select * from public.get_fork_source((select id from public.boards where forked_from = '11111111-0000-0000-0000-000000000001'))) r where r::text like '%Published title%'), 0, 'no title leak');
reset role;
update public.boards set visibility = 'public' where id = '11111111-0000-0000-0000-000000000001';

-- rate and link caps (eve)
insert into public.boards (id, owner_id, slug, title, visibility, doc, published_doc, published_revision, published_title, published_links)
select '44444444-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'many-links', 'M', 'public', '{}',
  jsonb_build_object('version', 1, 'edges', '[]'::jsonb, 'widgets', (select jsonb_agg(jsonb_build_object('id', 'w' || g, 'type', 'note', 'data', jsonb_build_object('text', 'x'))) from generate_series(1, 130) g)),
  0, 'M',
  (select jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'from_widget_id', 'w' || g, 'to_board_id', '22222222-0000-0000-0000-000000000001', 'label', null, 'pinned_revision', null)) from generate_series(1, 130) g);
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-000000000005","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.fork_board('44444444-0000-0000-0000-000000000001')), 1, 'eve forks the many-links board');
reset role;
select is((select count(*)::int from public.board_links l join public.boards b on b.id = l.from_board_id where b.owner_id = 'eeeeeeee-0000-0000-0000-000000000005'), 100, 'links are capped at 100');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-000000000005","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from (select public.fork_board('11111111-0000-0000-0000-000000000001') from generate_series(1, 19)) x), 19, 'eve reaches 20 forks in the window');
select throws_ok($$select * from public.fork_board('11111111-0000-0000-0000-000000000001')$$, 'P0001', 'fork unavailable', 'the 21st fork is rejected with the same neutral error');
reset role;
select is((select count(*)::int from public.boards where owner_id = 'eeeeeeee-0000-0000-0000-000000000005'), 20, 'no row created by the rejected fork');
-- the window slides: an old fork no longer counts
update public.boards set created_at = now() - interval '2 hours' where owner_id = 'eeeeeeee-0000-0000-0000-000000000005' and forked_from is not null;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-000000000005","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.fork_board('11111111-0000-0000-0000-000000000001')), 1, 'forks older than the window do not count');
reset role;

-- deleting the source (purge) or its owner (account delete) leaves the fork intact with forked_from null
update public.boards set deleted_at = now() - interval '31 days' where id = '11111111-0000-0000-0000-000000000001';
select is(public.purge_trashed_boards(), 1, 'purge removes the trashed source');
select is((select count(*)::int from public.boards where owner_id = 'bbbbbbbb-0000-0000-0000-000000000002' and forked_from is null), 1, 'bob''s fork survives with forked_from null');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.get_fork_source((select id from public.boards where owner_id = 'bbbbbbbb-0000-0000-0000-000000000002'))), 0, 'no provenance row once the source is gone');
reset role;
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select count(*)::int from public.boards where owner_id = 'eeeeeeee-0000-0000-0000-000000000005' and forked_from is null), 21, 'account deletion of the source owner leaves all of eve''s forks intact, forked_from null');
select is((select count(*)::int from public.boards where forked_from is not null), 0, 'no dangling forked_from');
select * from finish();
rollback;
