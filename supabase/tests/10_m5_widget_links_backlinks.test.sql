-- pgTAP: M5 widget links and backlinks (AC 9, 10). Titles of inaccessible targets are never returned.
begin;
select plan(20);
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.dev'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@test.dev'),
  ('cccccccc-0000-0000-0000-000000000003', 'carol@test.dev');
-- alice: hub (public, published), bob: pubB (public, published), unlB (unlisted, published), privB (private, published, secret title)
insert into public.boards (id, owner_id, slug, title, visibility, doc, published_doc, published_revision, published_title) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'hub', 'Hub', 'public', '{}', '{}', 0, 'Hub'),
  ('22222222-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'pub-b', 'Pub B', 'public', '{}', '{}', 0, 'Pub B'),
  ('22222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'unl-b', 'Unl B', 'unlisted', '{}', '{}', 0, 'Unl B'),
  ('22222222-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'priv-b', 'TOP SECRET TITLE', 'private', '{}', '{}', 0, 'TOP SECRET TITLE');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true); set local role authenticated;
select isnt(public.set_widget_link('11111111-0000-0000-0000-000000000001', 'w1', '22222222-0000-0000-0000-000000000001', 'to pub'), null, 'owner links a widget to another user''s public board');
select isnt(public.set_widget_link('11111111-0000-0000-0000-000000000001', 'w2', '22222222-0000-0000-0000-000000000002'), null, 'owner links to an unlisted board');
select is(public.set_widget_link('11111111-0000-0000-0000-000000000001', 'w3', '22222222-0000-0000-0000-000000000003'), null, 'cannot link to another user''s private board');
select is(public.set_widget_link('11111111-0000-0000-0000-000000000001', 'w4', '11111111-0000-0000-0000-000000000001'), null, 'cannot link a board to itself');
select isnt(public.set_widget_link('11111111-0000-0000-0000-000000000001', 'w1', '22222222-0000-0000-0000-000000000002'), null, 'setting again replaces the widget''s link');
select is((select count(*)::int from public.board_links where from_widget_id = 'w1'), 1, 'still one link for the widget');
select is(public.publish_board('11111111-0000-0000-0000-000000000001'), 0, 'publish snapshots links');
reset role;
-- bob links his public board to a private board of his own, then someone else reads it
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
select isnt(public.set_widget_link('22222222-0000-0000-0000-000000000001', 'x1', '22222222-0000-0000-0000-000000000003'), null, 'owner links to his own private board');
select is(public.set_widget_link('11111111-0000-0000-0000-000000000001', 'x2', '22222222-0000-0000-0000-000000000001'), null, 'cannot add links to another user''s board');
select is(public.publish_board('22222222-0000-0000-0000-000000000001'), 0, 'bob publishes');
reset role;

select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
select is((select to_title from public.get_board_links('22222222-0000-0000-0000-000000000001') where from_widget_id = 'x1'), null, 'inaccessible target title is null for a stranger');
select is((select count(*)::int from (select to_title, to_slug, label from public.get_board_links('22222222-0000-0000-0000-000000000001')) r where r::text like '%SECRET%'), 0, 'the secret title appears nowhere in the returned rows');
select is((select to_title from public.get_board_links('11111111-0000-0000-0000-000000000001') where from_widget_id = 'w1'), 'Unl B', 'accessible target title is returned');
-- backlinks: hub (public) links to unl-b; unl-b's viewer sees hub listed; pub-b has no public backlinks
select is((select count(*)::int from public.get_backlinks('22222222-0000-0000-0000-000000000002')), 1, 'backlinks list the linking public board');
select is((select title from public.get_backlinks('22222222-0000-0000-0000-000000000002')), 'Hub', 'backlink shows the published title');
select is((select count(*)::int from public.get_backlinks('22222222-0000-0000-0000-000000000003')), 0, 'backlinks of an unreadable board are empty');
reset role;

-- owner hides backlinks: strangers get nothing, the owner still sees them
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true); set local role authenticated;
select lives_ok($$update public.boards set show_backlinks = false where id = '22222222-0000-0000-0000-000000000002'$$, 'owner can hide backlinks');
select is((select count(*)::int from public.get_backlinks('22222222-0000-0000-0000-000000000002')), 1, 'owner still sees backlinks when hidden');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
select is((select count(*)::int from public.get_backlinks('22222222-0000-0000-0000-000000000002')), 0, 'hidden backlinks are not served to anon');
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true); set local role authenticated;
update public.boards set show_backlinks = true where id = '22222222-0000-0000-0000-000000000002';
reset role;
select is((select show_backlinks from public.boards where id = '22222222-0000-0000-0000-000000000002'), false, 'a stranger cannot change the toggle (RLS hides the row)');
select * from finish();
rollback;
