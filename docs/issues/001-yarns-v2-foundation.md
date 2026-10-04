# 001 Yarns v2 foundation

Status: M1-M4 done, pending Gate 2 review (M5-M7 pending)
Approved: 2026-10-03 (Gate 1). Scope of first build: M1-M2 only, then stop for review.

## Context

Yarns v1 (`/Users/craig/work/yarns`, read-only reference) is a conspiracy-board app: a corkboard with polaroid photos, sticky notes, wanted posters, lined paper, thumbtacks and red yarn. It has no backend, no keyboard access, hotlinked images, third-party fonts, and several known bugs. Yarns v2 is a fresh rebuild, not a port.

Stack (decided): React 19 + Vite + TypeScript SPA on Vercel (static, plus one function or edge middleware for per-board Open Graph meta). Supabase provides Postgres, Auth (email, Google, GitHub) and Storage. The SPA talks to Supabase directly and RLS enforces access. There is no custom API server. Rendering is SVG via xyflow (React Flow) with custom nodes and custom SVG yarn edges. zod schemas are shared between app and agent pipeline. Tests use vitest. Permanent Marker (OFL) is self-hosted. Ids are nanoid/uuid.

Not carried over: the old cork jpg and `charlie.png` (unknown rights). Textures are SVG/CSS.

Old visuals to re-create (SVG/foreignObject):
- Polaroid: 200x240 white frame, 140px image, Courier caption.
- Sticky note: 200x200, Permanent Marker, ruled lines, fold corner, default `#fef08a`.
- Wanted poster: 220x300, aged paper gradient, brown border, reward box.
- Lined paper: 250 wide.
- Yarn: `#e53e3e`, width 3, shadow.
- Selection: green `#22c55e` (source), orange `#f97316` (already connected).

Behaviors to preserve:
- Drag with an activation threshold.
- Connection mode: pick source, then target toggles the edge; stage click cancels.
- Pan on empty space; pointer-anchored wheel zoom clamped 0.1-3.
- Random rotation at creation (-10..10 photos, -5..5 others).
- New widget opens the inspector.
- Delete cascades edges.
- Inline title edit (Enter saves, Esc cancels, maxLength 50).
- JSON export/import kept as a backup feature.

Old bugs not to repeat: drag delta ignoring zoom; `Date.now()` ids; dangling edges drawing from origin; stale closures; editor copy going stale; no keyboard/a11y; unselectable edges; fixed stage size; Google Fonts request; hotlinked images; validation that only checks `Array.isArray`.

## Goal

Ship a v1 where signed-in users create, organize, publish and share sourced conspiracy boards. Boards can link to each other, appear in a topic index, and be drafted by an agent pipeline. A neutral public demo board proves it end to end.

## Non-goals (v1)

Real-time collaboration; augmentation overlays; moderation UI (admin uses the Supabase dashboard; footer contact email handles copyright takedowns); fork/duplicate-from-others (`forked_from` column reserved only); drawings/pen tool; auto-split notes (notes resize and scroll); Charlie mascot; rotation affecting edge anchors (rotation is cosmetic, edges anchor at the pin point). The Epstein board is never shipped as a seed; it is only a private test fixture.

## First buildable slice

The project is large. **M1-M2 (schema + zod, then auto-layout module + fixture tests) are the first buildable slice** and should be implemented and reviewed before anything else. They have no UI or Supabase runtime dependency.

## Acceptance Criteria

### Auth
1. A user can register (email), log in, log out, sign in with Google/GitHub, and reset a password. Verified by e2e/manual run against a local Supabase (`supabase start`).
2. Account deletion removes or anonymizes all owned boards. Verified by an SQL/integration test that checks no board rows remain readable with the deleted `owner_id`.

### Boards / RLS
3. Only `owner_id = auth.uid()` can insert/update/delete a board. Verified by pgTAP or vitest-against-local-Supabase tests with two users.
4. Reads: the owner sees everything; anonymous or other users see a public/unlisted board only via its published snapshot; a `board_shares` user gets read-only access to a private board; everyone else gets nothing. Tested per role.
5. Autosave is debounced and checks `revision`; a stale tab's save is rejected and cannot overwrite (unit test for the save function plus an RLS/RPC test).
6. My Boards grid shows client-rendered thumbnails (uploaded to Storage) and a visibility badge, and supports create, duplicate, rename, soft-delete and restore. Verified by component tests and a manual run.

### Publish / share
7. Publishing copies `doc` to `published_doc` and sets `published_revision`; later unpublished edits do not change what a reader fetches. Tested at DB level.
8. `/b/:slug` for a public or unlisted board returns Open Graph meta (title, thumbnail) from the middleware; private boards return generic meta with no title. Verified by an HTTP test of the function.

### Links
9. A widget can link to a child board (including another user's public/unlisted board) via `board_links`. A link to an inaccessible board renders an "unavailable" placeholder and the title is never sent to the client (RLS test plus a network-payload assertion).
10. A breadcrumb across owners is built from the navigation path. A backlinks list appears on a board and the owner can hide it.

### Index
11. `topics` (slug, title, summary, tags) are many-to-many with public boards; only the owner can tag their own public board. Topics can be browsed and searched. Tested via RLS and a search query test.

### Editor
12. Add, edit and delete widgets through one generic inspector (no per-type editors or modals). Drag respects zoom (unit test for delta/zoom). Pan/zoom are clamped 0.1-3.
13. Create yarn by connecting pins. Select and delete yarn directly. Duplicate pairs (either direction) are deduped. Deleting a widget cascades its edges.
14. Keyboard accessible: focus widgets and yarn, arrow-key nudge, Delete removes, Escape cancels connection. Verified by Testing Library keyboard tests plus an axe check.
15. Inline title edit: Enter saves, Esc cancels, maxLength 50. Stage is responsive (no fixed size).
16. JSON export/import round-trips and is zod-validated. Import of malformed or dangling-edge data is rejected with an error.

### Auto-organize
17. `autoOrganize(doc, {seed})` is a pure TS module: elkjs layered seed using widget boxes, grid snap, then a seeded swap/simulated-annealing pass scoring crossings + total edge length. Same input and seed give identical output.
18. On the converted Epstein fixture (8 photos, 5 notes, 2 posters, 3 papers, 16 connections), crossings after are <= before and strictly fewer, and no widget boxes overlap. Locked widgets do not move. Rotation is excluded from optimization and re-applied afterward. Fixture lives under `test/fixtures/private/` and is not bundled.

### Migration
19. `convertV1(boardData)` maps photos/notes/wantedPosters/papers/connections to the generic model: photo `url` -> `sources[]`/`sourceUrl`, `imageUrl` -> `image`. Drawings, `groupId`/`groupIndex` and `charlieImage` are ignored. Output passes the v2 zod schema (test against the fixture).

### Agents
20. `/agents` Node script (Claude Agent SDK) runs scout -> researcher -> claim classifier -> board builder -> validator -> auto-organize -> write DRAFT board. Each claim carries a source URL and retrieved date.
21. The validator fails on schema errors, dangling ids, unresolvable URLs, and images that are not licensed (prefers Wikimedia Commons with attribution; never hotlinks news photos). Unit-tested with good and bad boards.
22. One end-to-end run on a neutral topic writes a draft board as the curator account via the service-role key. A bundle grep confirms the key never appears in `dist/`.

### Deploy
23. Vercel deploy serves the SPA with SPA fallback, self-hosted font (no requests to fonts.googleapis.com), and the OG function. `npm run build`, `npm test` and `npm run typecheck` pass in CI. The public demo board is the neutral topic and contains no Epstein content.

## Brief

### Repo layout
```
/src
  app/ (routes, auth, providers)
  editor/ (Canvas, nodes/, edges/YarnEdge, Inspector, Toolbar)
  boards/ (MyBoards, thumbnails, autosave, publish)
  topics/ links/
  lib/ supabase.ts
/shared      schema.ts (zod, imported by app and /agents)
/layout      autoOrganize.ts, score.ts, rng.ts
/migrate     convertV1.ts
/agents      pipeline/ (scout, researcher, classifier, builder, validator), run.ts
/api         og.ts (Vercel function)
/supabase    migrations/*.sql, tests/*.sql
/test        fixtures/private/ (gitignored or excluded from build)
/docs/issues
```

### DB sketch
```sql
create table boards(
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  slug text unique not null, title text not null,
  visibility text not null default 'private' check (visibility in ('private','unlisted','public')),
  doc jsonb not null, revision int not null default 0,
  published_revision int, published_doc jsonb,
  deleted_at timestamptz, forked_from uuid  -- reserved, unused
);
create table board_shares(board_id uuid references boards on delete cascade, user_id uuid references auth.users on delete cascade, primary key(board_id,user_id));
create table board_links(id uuid primary key default gen_random_uuid(), from_board_id uuid not null references boards on delete cascade, from_widget_id text, to_board_id uuid not null references boards on delete cascade, label text, pinned_revision int);
create table topics(slug text primary key, title text not null, summary text, tags text[] default '{}');
create table board_topics(board_id uuid references boards on delete cascade, topic_slug text references topics, primary key(board_id,topic_slug));
```

### RLS outline
- boards write: `owner_id = auth.uid()`. Save goes through an RPC or `update ... where revision = :expected`, returning zero rows on a stale revision.
- Readers (non-owner): expose published data only. Use a view or RPC returning `published_doc` and never `doc`, so drafts do not leak. Applies to public/unlisted and to shares.
- board_links read: the row is visible if the from-board is readable. Target title is returned only through a join that is itself RLS-filtered, so null means "unavailable".
- board_topics write: owner of the board, and the board is public.
- Service role is used only by `/agents`.

### zod outline
```ts
Widget = {id, type: 'photo'|'note'|'wanted'|'paper', x,y,w,h, rotation,
  data: discriminated by type, sources: Source[], status?: enum, strokes?: unknown, locked?: boolean}
Source = {url, title?, retrievedAt, license?, attribution?}
Edge = {id, source, target, color}
Doc = {version, widgets, edges}.superRefine(
  unique ids, endpoints exist, no self-edges, unordered-pair dedupe)
```

### Quality bar (project CLAUDE.md does not exist yet; propose adding one with these)
Strict TS, no `any`; zod at every boundary (DB reads, import, agents); pure modules for layout/convert; ids from nanoid/uuid only; no third-party runtime requests; no secrets in client bundle; accessibility checks on the editor; keep files small and tested.

## Build Order

- **M1 Schema + zod** (first slice): `/shared/schema.ts`, migrations, RLS SQL, tests. Verify: `npm test` for schema/referential integrity; `supabase db reset` plus RLS tests.
- **M2 Auto-organize + fixture** (first slice): `/layout`, `/migrate/convertV1`, fixture tests (AC 17-19). Verify: `npm test`.
- **M3 Editor core:** xyflow canvas, widget nodes, yarn edges, inspector, keyboard, export/import (AC 12-16).
- **M4 Auth + My Boards:** auth flows, grid, thumbnails, autosave with revision check (AC 1-6).
- **M5 Publish, share, links, index:** snapshots, shares, board_links, breadcrumb, backlinks, topics, OG function (AC 7-11).
- **M6 Agents:** skeleton, validator, one e2e run on a neutral topic (AC 20-22).
- **M7 Deploy and demo:** Vercel, font, footer contact, neutral demo board, CI (AC 23).

## Risks

- elkjs bundle size and speed; run it lazily or in a worker.
- Annealing quality versus determinism; the seeded RNG and fixed iteration count mitigate this.
- RLS leaking drafts through column-level reads; mitigated by published-only views plus tests.
- Image licensing and takedown exposure; mitigated by the validator and a Commons-first policy.
- OAuth redirect config across local, preview and production.
- Agent cost and quality; v1 is a skeleton only.
- Client-side thumbnail rendering consistency across browsers.
- OG edge cache residual risk: `/b/:slug` and the preview image are cached at the edge for up to 10 seconds (`s-maxage=10`, no stale-while-revalidate). After unpublish or a switch to private, a title or thumbnail may still be served for that long. Accepted; shorter would defeat the cache.
- Email confirmation is a security control: invites match the caller's auth email only when `email_confirmed_at` is set. Production must keep email confirmations ON, and every enabled OAuth provider must return verified emails only; otherwise someone could register an unconfirmed account with a victim's address (or an unverified provider email) and claim their invites.
- A link from a published board to another user's unlisted board exposes that board's slug and title to readers of the published board (by design: the author chose to link it; the snapshot stores them).

## Open Questions

Resolved at Gate 1 (defaults accepted):
1. Curator account: a dedicated Supabase user created by a seed script; its id lives in the agent job's environment.
2. Demo topic: Dyatlov Pass incident, pending a sourcing check.
3. Soft-delete retention: 30 days, then a scheduled purge.
Also: board pages use `/b/:slug` for v1.

## Notes

2026-10-03: M1-M2 built, verified (typecheck, 52 vitest, 146 pgTAP on local Supabase) and validated (no Critical/Important). Migrations 000001-000002 applied to remote; 000003 (indexes, slug rules) committed but not yet pushed. Branch m1-m2-foundation.

2026-10-04: M4 built on branch m4-auth-boards (auth, My Boards, thumbnails, server autosave; AC 1-6). Decisions:
- New deps: @supabase/supabase-js, react-router. Client uses only the anon key; PKCE flow.
- Migrations 20261004000001 (delete_my_account) and 20261004000002 (private `thumbnails` bucket, owner-only RLS) are local only, not pushed. Storage forbids SQL deletes of objects, so the client removes thumbnails first and delete_my_account is not called if that fails.
- Thumbnails live at `<uid>/<boardId>.png`, rendered client-side (SVG to canvas) and uploaded only after a successful save; owner-only read, public-board access is an M5 follow-up.
- Autosave: debounced, single-flight, optimistic revision. stop()/flush() await the in-flight save and the queued follow-up; logout flushes before signOut; beforeunload guard while unsaved. A null from save_board is a conflict only when a session exists (otherwise "log in again"); after a lost response the server is re-read before declaring a conflict. The stored title is sent only if the user edited it (the editor caps titles at 50, the DB at 200).
- Account deletion lands on /login with a one-off notice.
- Fix loop 2: thumbnail scheduler captures the doc at schedule time and ignores schedule() after stop(); logout flush and stop() are bounded (8s) with a busy button and a "Log out anyway (discard unsaved edits)" option on failure or timeout; account deletion re-lists the Storage folder after remove() and refuses to call delete_my_account if files remain; reconcile checks the remembered lost payload (JSON-normalised compare) and re-sends current state on top; in-app navigation while offline/rejected/unauthenticated/conflict is blocked by a react-router `useBlocker` ("Stay" / "Leave anyway", so main.tsx uses a data router); a stopped autosave instance no longer reports status.
- Follow-ups (documented, not done in M4):
  - A `save_board` null with a locally valid but server-revoked session is still reported as a conflict, and an expired-token PostgREST error (`PGRST301`) becomes 'rejected' with no retry.
  - Title guard: editing the title and then typing the original text back still counts as touched, so a truncated 50-char editor title could overwrite a longer stored title (DB allows 200).
  - Account deletion is only partly atomic: if `delete_my_account` fails after thumbnails were removed, the thumbnails are gone until each board's next save. Also plan a service-role orphan purge for Storage.
Not verified: real OAuth (Google/GitHub providers are disabled locally), the email confirmation / password-reset round trip, end-to-end Storage upload and cleanup (Storage container not running locally; bucket/RLS covered by pgTAP only), PNG rasterisation in a real browser, keepalive save on pagehide (best effort only), and the 30-day purge of soft-deleted boards.

2026-10-05: M5 built on branch m5-publish (AC 7-11), not committed. Verified locally: typecheck, 242 vitest (run twice), build, 230 pgTAP on the local stack. Migration 20261005000001 is local only, not pushed. No new dependencies. Decisions:
- publish_board is now `publish_board(p_id, p_visibility default null)` (snapshot and visibility in one statement; invalid visibility returns null). Unpublish unchanged. Shares are managed by email through `share_board` / `list_board_shares` / `unshare_board` (owner only; see the fix-loop note below for how account enumeration is closed).
- Reader `/b/:slug`: the owner gets their live `doc` via the owner-only select and an edit link; everyone else uses `get_published_board` (published_doc only). Private, unshared and unknown boards render the identical "Board not found" page. Read-only canvas reuses the node/edge renderers with dragging disabled.
- OG: `api/og.ts` (Vercel function, `handleOg(request, {fetch, supabaseUrl, anonKey})` is pure) behind a `/b/:slug` rewrite in `vercel.json`. It calls the anon-only `get_board_og` RPC, injects meta into the SPA `index.html`, and also serves the thumbnail bytes (`?image=1`) because the bucket stays private. Private/unknown/malformed/upstream-failure all return the same generic title-less meta with status 200.
- Public thumbnails: a separate `<uid>/pub-<boardId>.png` object uploaded at publish time (so drafts never leak through a preview image), readable by anon via a storage policy backed by `is_published_thumbnail`; the live `<uid>/<boardId>.png` stays owner-only.
- Links: one link per widget (`set_widget_link`, replaces; refuses self links, unreadable or deleted targets). The inspector links to own boards or a pasted `/b/` URL (resolved with `resolve_board`). Non-owners only ever see the links snapshotted at publish; an unreadable target comes back with null title/slug and renders "Board unavailable".
- Breadcrumb: sessionStorage trail, zod-validated on every read, written when a link chip is followed (`recordNavigation`) and resolved on arrival (`resolveTrail`); back links truncate, loops are collapsed, tampered data is discarded. Backlinks: `get_backlinks` from published snapshots, lists public boards (or own/shared), never other people's unlisted boards; owner toggle is the new `boards.show_backlinks` column (owners always see it).
- Topics: `/topics` (browse + `search_topics` over title, summary, tags with escaped wildcards) and `/topics/:slug` (`list_topic_boards`). Owner tags only their own published public board from the publish panel (RLS unchanged from M1).
Deferred / not verified:
- Not verified end to end: the Vercel function on Vercel itself (rewrite + env `SUPABASE_URL`/`SUPABASE_ANON_KEY`, or the VITE_ equivalents, must be set; SPA fallback for other routes is M7), the Storage anon read of `pub-*.png` through the real Storage API (pgTAP covers the RLS policy only), PNG rasterisation in a real browser, and a manual browser run of the new pages.
- The "network payload" test runs a real supabase-js client against a fake PostgREST that mirrors the SQL rules; the true RLS guarantee is the pgTAP tests, not a live HTTP test.
- Orphan board_links rows for deleted widgets are not cleaned up (readers ignore them); they still count for backlinks until the target board is republished without them. Link chips do a full page load (sessionStorage carries the trail). Topic pages show no thumbnails. Topics are still curated by service role/dashboard; no UI to create them.

2026-10-05: M5 fix loop 1 (validator findings), still uncommitted and local only. Migration 20261005000001 was edited in place (never pushed; applied locally with a local `supabase db reset`).
- Email enumeration closed. Sharing is now an invite: `board_share_invites(board_id, email lowercase)` (RLS on, no grants, RPC only). `share_board` never looks at auth.users and answers true for every address (false only for non-owners, malformed addresses or the 100-invite cap); `list_board_shares` returns just the invited emails (trimmed and lowercased); new `unshare_board(board, email)`. Read access resolves at read time through `is_shared_with_me` (security definer, search_path pinned, no client grant): a board_shares row for the caller, or an invite matching the caller's own auth email. `can_read_board`, `list_shared_boards` and `get_backlinks` use it, so a user only gains boards invited to their own email. Side effects by design: an invite for an address that registers later starts working at registration, and the legacy `board_shares` table and its RLS are kept for existing rows. pgTAP 09 now proves a real and an unknown email look identical, the invite gives the real account access, nobody else (or anon) gets anything, revocation, and late registration.
- api/og.ts: replacer functions in String.replace (a title containing `$&`, `$'`, `` $` `` or `$$` is now literal); tests with those titles and `</title><script>` fail on the old code. Cache is `public, max-age=0, s-maxage=10` for page and image, no stale-while-revalidate (residual risk in Risks). `get_board_og` also returns visibility and the handler refuses anything not public/unlisted. og tests: private case uses an upstream that returns a titled private row, the tautological test is gone, GET is asserted to call handleOg.
- Published thumbnail is removed on unpublish, when publishing as private, and when the republish upload fails (best effort). pgTAP: another user cannot write `<owner uid>/pub-*`; anon never sees a private tagged board via `list_topic_boards` or `board_topics`.
- Deferred: removing the pub thumbnail is client side and best effort (the storage policy already hides it unless the board is public/unlisted); no server-side purge of orphaned invites for deleted boards beyond the cascade.

2026-10-05: M5 fix loop 2, still uncommitted and local only (migration 20261005000001 edited in place, local `supabase db reset`).
- `is_shared_with_me` now requires `u.id = auth.uid() and u.email_confirmed_at is not null` (backlinks, `can_read_board` and `list_shared_boards` all use it). pgTAP 09 (now 50 tests) proves an unconfirmed account with the invited email gets no access and no shared-list entry, and after confirmation (invite stored for `BOB@test.dev`/`Nobody@Test.dev`, differently cased) the real invitee gets access; a confirmed stranger with a different email gets nothing.
- Legacy `board_shares`: insert/delete revoked from authenticated (tests 01-08 still pass; select is kept for the existing "see own grant" policy and tests). Invites replace it.
- Wording: invite emails are trimmed and lowercased, not "as entered".
- Known limits of invites (deferred): no consent step (any signed-in owner can invite any address; the attacker-chosen published title appears in the invitee's shared list; plan accept/decline or a per-owner cap); the 100-per-board cap is not race-safe (count then insert); invited addresses are kept in plain text until the board is deleted (cascade).
