# 002 Fork a board

Status: done

## Context

A signed-in user viewing someone else's readable board at `/b/:slug` can click "Fork" to get a private, editable copy in their own account, with provenance back to the source. This differs from the existing Duplicate in My Boards, which is owner-only and copies the live `doc`; Fork copies only what the caller was allowed to read (the published snapshot).

Scope note: issue 001 lists "fork/duplicate-from-others (`forked_from` column reserved only)" as a v1 non-goal. This issue is an intentional scope expansion beyond that non-goal; 001 is not edited.

Risks driving the design: never expose the live `doc` to non-owners; a client-side fork lacks the `forked_from` grant and a server guard, so an RPC is used; shares and invite emails are PII and never copied; `board_topics` are not copied; links come from the `published_links` snapshot and are re-checked for readability so titles and slugs do not leak; Storage paths belong to the source owner and are unusable by the forker; thumbnails are never reused; there are no rate limits today.

## Decisions, revisable at Gate 1

1. Server: new security-definer RPC `fork_board(p_source_id uuid)` returning the new board id and slug. `search_path` pinned; revoke from public/anon, grant to `authenticated` only. It reads `published_doc`/`published_title` only (never live `doc`), requires `can_read_board`, `deleted_at is null` and `published_doc is not null`, and returns the same neutral not-found error for every failure (no oracle). Sets `forked_from`. The server generates a valid slug (`[a-z0-9-]{3,80}`, no `--`, not reserved) with collision retry.
2. New board: private, revision 0, no `published_*`, no shares/invites, no topics, default `show_backlinks`. Title `Fork of <published_title>`, capped at 200.
3. Widget links: carried over from `published_links` only where the forker can read the target and the target is not soft-deleted; others dropped; count capped; never link the new board to itself.
4. Storage-path image refs are stripped on fork (https refs kept). Sources, licence and attribution are preserved verbatim; the doc is not otherwise sanitised.
5. Provenance: the fork's editor/reader shows "Forked from <title>" (linked) only when the caller can read the source (title and slug via a read RPC in the `get_board_links` style), else "Forked from an unavailable board". Immediate parent only. Add FK `forked_from references boards on delete set null`. This is compatible with `delete_my_account` (deletes `auth.users`, cascading boards) and the trash purge (`delete from boards where deleted_at ...`): both only delete rows, and set null fires on the children. A fork surviving its deleted source is acceptable.
6. The owner viewing their own board sees no Fork button (Duplicate covers it). Signed-out users see a "Log in to fork" link.
7. Limit: per-user cap on boards created via fork (e.g. 20 per hour) enforced inside the RPC; no general board cap.
8. Client: render a new thumbnail with `renderThumbnailPng`, upload best effort to `<forker uid>/<new id>.png`, then navigate to `/edit/:id`. Errors are shown with `role="alert"`.
9. Tests: db-level (pgTAP) and unit where feasible; api tests with `fakeClient`/`fakeServer` (extend fakes for the new rpc); ReaderPage UI test with axe.

## Acceptance Criteria

1. A signed-in non-owner on a readable, published board sees "Fork"; clicking creates a private board owned by them (revision 0, no `published_*`, title `Fork of <published_title>` max 200, `forked_from` = source id) and navigates to `/edit/:newId`. The owner sees no Fork button; a signed-out user sees "Log in to fork". Tested in ReaderPage UI tests.
2. The fork's content comes only from `published_doc`: edits to the source's live `doc` after publish never appear. Sources, licence and attribution are verbatim; storage-path image refs are stripped and https refs kept. pgTAP.
3. Unreadable, private-unshared, unpublished, soft-deleted, unconfirmed-email-share, nonexistent and anon cases all return the identical neutral error and create no row. pgTAP, plus an anon/public-grant check (`fork_board` executable by `authenticated` only).
4. No shares, invites, topics or thumbnail are copied. Widget links are copied only when the forker can read the target and it is not deleted; at most the cap; never self-linked. pgTAP.
5. Provenance label shows the source title and link when readable, else "Forked from an unavailable board", with no title leak. Deleting the source or its owner (account delete, purge) leaves the fork intact with `forked_from` null. pgTAP and api test.
6. The per-user fork cap rejects the (N+1)th fork within the window with a generic error shown via `role="alert"`; a failed thumbnail upload does not block navigation. api and UI tests with axe clean.

## Out of scope

Fork-of-fork lineage display, fork counts, notifying the original author, licence selection, board-level author/licence fields, copying topics or shares, a general board cap.

## Brief

Files to change:
- New migration after `20261006000001` (e.g. `20261007000001_fork_board.sql`): FK on `forked_from`, `fork_board`, a provenance read RPC (e.g. `get_fork_source`), fork-rate bookkeeping (count by `forked_from is not null and created_at` window, if a created_at column exists; otherwise a small RPC-only table), explicit revoke-then-grant per the 000002 rule. New pgTAP file under `supabase/tests/`.
- `src/boards/api.ts` (or new `src/boards/fork.ts` to keep files small): `forkBoard` wrapper in the `src/publish/api.ts` style, zod-parsing the RPC result. `src/boards/useBoards.ts`/a small `useFork` hook: thumbnail best effort (as in duplicate), navigate.
- `src/pages/ReaderPage.tsx` header (lines ~75-79): Fork button / login link, provenance line; `src/reader/api.ts` to load the fork source.
- `shared/schema.ts`/`src/boards/schemas.ts`: fork RPC result schema and provenance schema (BoardFull currently has no `forked_from`; add only if the editor needs it).
- Tests: extend `test/app/fakeClient.ts` (rpc) and `test/app/fakeServer.ts` (route `fork_board` and the provenance rpc; it currently hardcodes `owner_id`), add to `boards.test.ts` and `reader.test.tsx`.

Quality bar (CLAUDE.md): strict TS, no `any`; zod on every RPC result; small files; axe check on the reader; no third-party requests; no service-role in `src` (the existing vitest guard must still pass); ids from uuid only.

Verification:
- AC 1, 6 UI: `npm test` (reader.test.tsx with axe).
- AC 2-5: `supabase db reset` then the pgTAP suite (same invocation as used for 001), including the grant check.
- AC 3, 5, 6 client paths: `npm test` api tests with fakes.
- Overall: `npm run typecheck`, `npm run build` (use `build:verify` for the bundle guard).

## Note 2026-10-04
Built, verified (442 tests, 310 pgTAP) and shipped as a draft PR. Known minors: fork cap resets when source purged (forked_from set null); provenance shown on reader page only. Production needs `supabase db push` for 20261007000001.
