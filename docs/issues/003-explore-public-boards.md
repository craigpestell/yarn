# 003 Explore public boards

Status: done

## Context

Today there is no way to discover other users' boards; Topics only lists boards tagged with topics. This issue adds a public `/explore` page where anyone (signed in or not) can browse published PUBLIC boards from all users, newest first, as cards with a thumbnail and the published title linking to `/b/:slug`.

Product risk for Craig to accept at Gate 1: Explore makes every public board title enumerable. There is no owner opt-out and no moderation or reporting yet. Boards that are unlisted, private, shared, trashed or unpublished never appear.

Not duplicated here: fork (002) is already merged on origin/main (local main may lag). The existing `public_boards` view is not used because it exposes `published_doc` and `owner_id` and has no sort column.

## Decisions, revisable at Gate 1

1. Visibility: only `visibility='public'`, `deleted_at is null`, `published_doc is not null`. Never unlisted, private, shared, trashed or unpublished.
2. New SQL RPC `list_public_boards(p_before_at timestamptz default null, p_before_id uuid default null, p_limit int default 24)` in the `list_topic_boards` style: `language sql stable security definer set search_path=''`, revoke from public/anon/authenticated, then grant to anon, authenticated. Returns ONLY `slug, published_title, published_at, id, thumbnail_path` (`owner_id||'/pub-'||id||'.png'`). Never returns `published_doc`, `doc` or a bare `owner_id`. Limit clamped to 1..48. Keyset pagination on `(published_at desc, id desc)`; client "Load more" button.
3. Sort key: new column `boards.published_at timestamptz`, set by `publish_board` when a board first becomes public (or becomes public again after being non-public), NOT bumped by plain republish while public; cleared on unpublish or when made non-public. Backfill existing public boards from `updated_at`. Partial index on `(published_at desc, id desc) where visibility='public' and deleted_at is null and published_doc is not null`. Clients cannot write `published_at` (no column grant).
4. Author is not shown (no profiles table).
5. Thumbnails: client signs the returned paths with `createSignedUrls` via a new helper that handles many owners, zod-parsed; failure yields an empty map and the placeholder; reuse the null-signedUrl tolerance. Boards without a pub thumbnail show the empty placeholder.
6. UI: new `src/explore/api.ts` + `schemas.ts`; `ExplorePage` following TopicsPage patterns (loading `role=status`, error `role=alert`, empty state, `ul` with aria-label); small read-only card (single link around the title; thumbnail decorative `alt=""` and not a duplicate tab stop); "Explore" link in NavBar next to Topics, visible to everyone; `/explore` is a public route. Add `explore` to the reserved slug list in the new migration.
7. Tests: pgTAP `14_explore`, api tests with `fakeClient`, ExplorePage tests with axe, nav test updates.

## Acceptance Criteria

1. Anon and signed-in users see the same list at `/explore`: only public, non-deleted, published boards, newest first by `published_at`; private, unlisted, shared, trashed and unpublished boards are excluded for both roles. pgTAP plus ExplorePage test.
2. `list_public_boards` returns exactly `slug, published_title, published_at, id, thumbnail_path` (no `doc`, `published_doc` or `owner_id` column); limit is clamped to 1..48; keyset pagination over `(published_at desc, id desc)` has no gaps or duplicates across ties; execute is granted to anon and authenticated only (not public). pgTAP.
3. `published_at` is set on first public publish and on re-becoming public, unchanged on republish while public, cleared on unpublish or non-public change, backfilled for existing public boards, and not writable by clients. pgTAP.
4. Cards show the signed thumbnail or the placeholder, and the title as a single link to `/b/:slug`; "Load more" appends the next page and disappears when exhausted; loading, error (`role=alert`) and empty states render; axe clean. ExplorePage tests.
5. The NavBar shows "Explore" next to Topics for signed-out and signed-in users; `explore` cannot be claimed as a slug. Nav tests plus pgTAP.
6. Anon can sign `pub-` thumbnail paths through the real Storage API against the local stack (verified manually and noted in the PR), or this is documented as unverified.

## Out of scope

Author names/profiles, search or filtering (including a topics filter), owner opt-out from Explore, moderation/reporting, likes.

## Brief

Files to change:
- New migration after `20261007000001` (check the next free timestamp on origin/main): add `published_at`, backfill, partial index, `create or replace publish_board` (first read the current definition in `20261005000001_m5_publish_links_topics.sql` and any later migration, and keep its behaviour), `list_public_boards`, reserved slug `explore`. Explicit revoke-then-grant on every function.
- New `supabase/tests/14_explore.test.sql` (fork added 13; confirm on origin/main), modelled on 09 and 11.
- New `src/explore/api.ts`, `src/explore/schemas.ts`, a many-owner signing helper (a sibling of `src/boards/thumbnails.ts`; `thumbnailUrls` signs only live owner paths so is not reused), `src/pages/ExplorePage.tsx`, a small read-only card reusing `board-card`, `thumb-link`, `thumb-empty` and `board-meta` classes, `src/routes.tsx` (public route next to `/topics`), NavBar link.
- Tests: `test/` api and ExplorePage tests (axe pattern from `topics.test.tsx`; `fakeClient` rpc and `createSignedUrls`), update nav tests.

Data/props: no change to existing props; `published_at` is the only new column; the RPC row zod schema is the new boundary type.

Quality bar (CLAUDE.md): strict TS with no `any`; zod at every RPC and storage boundary; small, tested files; no third-party runtime requests (confirm CSP `img-src` in `vercel.json`/`index.html` allows the Supabase storage origin already used for thumbnails); no service-role in `src`.

Verification:
- AC 1-3, 5 (slug): `supabase db reset`, then the pgTAP suite (same invocation as 001/002).
- AC 1, 4, 5: `npm test` (api, ExplorePage with axe, nav).
- AC 6: with the local stack running, publish a board with a thumbnail, then as anon call `createSignedUrls` on its `pub-` path.
- Overall: `npm run typecheck`, `npm run build` (`build:verify` for the bundle guard).

## Note 2026-10-04
Built, verified (453 tests, 343 pgTAP) and shipped as a draft PR. Deviation from Decision 3: `published_at` is maintained by a BEFORE INSERT/UPDATE trigger (`set_published_at`) rather than by replacing `publish_board`, because clients can write `visibility` directly and unpublish/other paths must also set or clear it. Behaviour is as specified. Known minors: a legacy trashed public board backfills to null and jumps to the top when restored; no retry button after an initial load error; no browser check was done.
