-- pgTAP: slug constraint tightening and FK indexes. Run with 'supabase test db'.
begin;
select plan(13);
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.dev');

select lives_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', 'my-board-2', 'T', '{}')$$, 'single hyphens are fine');
select lives_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', 'newsroom', 'T', '{}')$$, 'a slug merely containing a reserved word is fine');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', 'a--b', 'T', '{}')$$, '23514', null, 'consecutive hyphens rejected');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', 'my---board', 'T', '{}')$$, '23514', null, 'three hyphens rejected');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', '-ab', 'T', '{}')$$, '23514', null, 'leading hyphen rejected');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', 'ab-', 'T', '{}')$$, '23514', null, 'trailing hyphen rejected');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Upper', 'T', '{}')$$, '23514', null, 'uppercase rejected');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', 'new', 'T', '{}')$$, '23514', null, 'reserved slug new rejected');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', 'admin', 'T', '{}')$$, '23514', null, 'reserved slug admin rejected');
select throws_ok($$insert into public.boards (owner_id, slug, title, doc) values ('aaaaaaaa-0000-0000-0000-000000000001', 'topics', 'T', '{}')$$, '23514', null, 'reserved slug topics rejected');
select is((select convalidated from pg_constraint where conname = 'boards_slug_check'), true, 'slug constraint is validated');
select has_index('public', 'board_shares', 'board_shares_user_id_idx', 'board_shares(user_id) indexed');
select has_index('public', 'board_topics', 'board_topics_topic_slug_idx', 'board_topics(topic_slug) indexed');
select * from finish();
rollback;
