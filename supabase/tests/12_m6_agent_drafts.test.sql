-- pgTAP: an agent-written DRAFT (private, unpublished, owned by the curator, inserted by the
-- service role) is invisible to everyone but the curator. Run with 'supabase test db'.
begin;
select plan(10);
insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-0000000000c1', 'curator@yarns.invalid'),
  ('dddddddd-0000-0000-0000-0000000000d2', 'stranger@test.dev');
-- The agent inserts through the service role (bypasses RLS); the row is private with no snapshot.
set local role service_role;
select lives_ok($$insert into public.boards (owner_id, slug, title, doc, visibility) values
  ('cccccccc-0000-0000-0000-0000000000c1', 'agent-draft-abcd1234', 'Agent draft', '{"version":1,"widgets":[],"edges":[]}', 'private')$$,
  'service role can insert a draft as the curator');
reset role;
select is((select visibility from public.boards where slug = 'agent-draft-abcd1234'), 'private', 'draft is private');
select is((select published_doc from public.boards where slug = 'agent-draft-abcd1234'), null, 'draft has no published snapshot');

-- anonymous
set local role anon;
select is((select count(*)::int from public.public_boards where slug = 'agent-draft-abcd1234'), 0, 'anon cannot read the draft via public_boards');
select is((select count(*)::int from public.get_published_board('agent-draft-abcd1234')), 0, 'anon cannot read the draft via get_published_board');
select is((select count(*)::int from public.get_board_og('agent-draft-abcd1234') where title is not null), 0, 'anon gets no title from the OG function');
select throws_ok($$select count(*) from public.boards$$, '42501', null, 'anon has no direct select on boards');
reset role;

-- another signed-in user
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-0000000000d2","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.boards where slug = 'agent-draft-abcd1234'), 0, 'stranger cannot select the draft');
select is((select count(*)::int from public.get_published_board('agent-draft-abcd1234')), 0, 'stranger cannot read the draft via get_published_board');
reset role;

-- the curator sees it
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-0000000000c1","role":"authenticated"}', true); set local role authenticated;
select is((select count(*)::int from public.boards where slug = 'agent-draft-abcd1234'), 1, 'curator sees its own draft');
reset role;
select * from finish();
rollback;
