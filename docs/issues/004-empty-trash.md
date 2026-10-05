# 004 Empty trash

Status: done

## Context

On My boards the Trash section lists soft-deleted boards with Restore only. They leave the trash by the 30-day purge (`purge_trashed_boards`, cron) or account deletion; the owner cannot remove them sooner. Craig's request: "the site needs the ability to 'empty' the trash". This issue adds "Empty trash" (all) and "Delete forever" (one board), both permanent, behind an in-page confirmation.

Why RPCs: `boards` has no client DELETE grant by design (`20261003000002_rls.sql`: `grant select`, `insert (...)`, `update (title, visibility, deleted_at)`). The grant stays closed; deletion goes through owner-scoped security-definer functions, like `delete_my_account`. Local main may lag origin/main (fork migration `20261007000001` and explore are not in this checkout).

## Decisions, revisable at Gate 1

1. `empty_my_trash()`, no args, security definer, `search_path = ''`. Deletes only rows with `owner_id = auth.uid() and deleted_at is not null`, returns `uuid[]` of deleted ids (count = its length). `auth.uid()` null raises `28000` as in `delete_my_account`. Revoke all from public, anon, authenticated, then grant execute to authenticated only. No DELETE grant on `boards`.
2. `delete_trashed_board(p_id uuid)`: same guards (`id = p_id`, owner, trashed), returns boolean (true if a row was deleted). A missing, active or someone else's board returns false (neutral, no oracle). Same grants. Included as the natural unit; revisable.
3. UI, My boards Trash section: "Empty trash" button (hidden when trash is empty) and "Delete forever" per item next to Restore. Both open an in-page confirmation (`role="alertdialog"`, labelled and described, focus moved in, Escape/Cancel returns focus to the trigger; not `window.confirm`) stating how many boards will be permanently deleted and that this cannot be undone. Errors in the existing `role="alert"`; buttons disabled while busy; list reloads after.
4. Thumbnails: after the DB call succeeds, best-effort `storage.remove` of `<uid>/<id>.png` and `<uid>/pub-<id>.png` for the returned ids. SQL cannot delete Storage objects (see `purge_trash` note). Per the `removeAllThumbnails` note `remove()` can succeed while deleting nothing under RLS, so this is not verified, never throws, never surfaces an error and never blocks the reload.
5. Cascades (all `on delete cascade` per `20261003000001_schema.sql` / `20261005000001`): `board_links` rows where the board is `from_board_id` or `to_board_id` (other boards' link rows pointing at it vanish; their widgets stay in the doc and render the existing "unavailable" placeholder, no change); `board_shares`; `board_share_invites`; `board_topics`. Forks: `forked_from` is `on delete set null` (fork 002), so forks survive. Trashed public boards are already hidden from Explore and Topics.
6. No rate limit (owner-scoped). Concurrency: the delete re-checks `deleted_at is not null` in the same statement, so a board restored after the list loaded is not deleted (the client's "N boards" is advisory; the confirmation copy says "currently in the trash").
7. Tests: pgTAP, api, BoardsPage with axe, thumbnail best-effort. New migration after `20261008000001` (confirm on origin/main); pgTAP file after `14_explore`.

## Acceptance Criteria

1. `empty_my_trash()` deletes exactly the caller's trashed boards and returns their ids; the caller's active boards and every other user's boards (trashed or not) are untouched. pgTAP.
2. `delete_trashed_board(id)` deletes only the caller's trashed board and returns true; for an active, foreign or nonexistent id it returns false and deletes nothing. A board restored before the call survives both functions. pgTAP.
3. Both functions are executable by `authenticated` only (anon and public denied), run with a pinned `search_path`, and raise on null `auth.uid()`; `authenticated` still has no DELETE on `boards`. pgTAP.
4. Deleting removes the board's `board_links` (both directions), shares, invites and topics; a fork of a deleted board remains with `forked_from` null. pgTAP.
5. UI: "Empty trash" shows only when trash is non-empty; "Delete forever" appears per item. Each opens an alertdialog with the count and an irreversible warning, with focus trapped in and restored on cancel; confirming calls the right RPC and reloads; failure shows `role="alert"`; controls are disabled while busy; axe clean in the closed and open states. BoardsPage tests.
6. After a successful delete the client requests removal of both thumbnail paths for each returned id; a failing or throwing `remove()` produces no error message and the list still reloads. api/hook tests with `fakeClient`.

## Out of scope

Changes to account deletion or the 30-day auto purge, undo, bulk select of individual trashed items, admin tools, deleting live boards directly, a client DELETE grant on `boards`, server-side Storage cleanup.

## Brief

Files to change:
- New migration (e.g. `20261009000001_empty_trash.sql`; check next free timestamp on origin/main): both functions, explicit revoke-then-grant per the rule at the end of `20261003000002_rls.sql`.
- New pgTAP `supabase/tests/15_empty_trash.test.sql` (confirm number on origin/main), modelled on `04_account_deletion` and `12_m6_agent_drafts` for grants and auth impersonation.
- `src/boards/api.ts` (or new `src/boards/trash.ts` to keep files small): `emptyTrash`, `deleteTrashedBoard`, zod-parsed results (`z.array(z.string().uuid())`, `z.boolean()`), `BoardsError` via `fail`. `src/boards/thumbnails.ts`: `removeBoardThumbnails(client, ownerId, ids)`, never throws.
- `src/boards/useBoards.ts`: `emptyTrash` and `deleteForever` actions through `run`, thumbnail cleanup after success. `src/pages/BoardsPage.tsx` plus a small `src/boards/ConfirmDialog.tsx` (or `TrashSection.tsx`) for the dialog.
- Tests: extend `test/app/fakeClient.ts` rpc; add to `test/app/boards-page.test.tsx` and the api tests.

Data/props: no schema or column changes; new component props (`count`, `onConfirm`, `onCancel`, `busy`); RPC results are the new zod boundary types.

Quality bar (CLAUDE.md): strict TS, no `any`; zod at every RPC boundary; small, tested files; axe on the confirm flow; accessible dialog (no `window.confirm`); no service-role in `src` (existing vitest guard); no third-party requests.

Verification:
- AC 1-4: `supabase db reset`, then the pgTAP suite (same invocation as 001/002).
- AC 5: `npm test` (BoardsPage with axe, open and closed dialog states, focus and busy assertions).
- AC 6: `npm test` (api/hook tests, `bucket.remove` mocked to reject and to resolve empty).
- Overall: `npm run typecheck`, `npm run build` (`build:verify` for the bundle guard).

## Done note (2026-10-04)
Shipped on `feat/empty-trash`. Verifier PASS on all six criteria (pgTAP 372, vitest 467, typecheck, build:verify); validator no Critical/Important after one fix loop. AC5/AC6 are covered by jsdom and axe tests only; no real-browser check was run.
