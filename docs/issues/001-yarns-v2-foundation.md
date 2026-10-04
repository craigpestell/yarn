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
