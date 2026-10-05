# Yarns v2

Conspiracy-board app. Spec: `docs/issues/001-yarns-v2-foundation.md`. v1 at `/Users/craig/work/yarns` is read-only reference.

## Stack
Vite 8 (Rolldown), React 19, TypeScript 7 strict, zustand, @xyflow/react, zod, Supabase, vitest, Tailwind v4, shadcn/ui.

## Commands
- `npm test` (vitest), `npm run typecheck` (tsc --noEmit), `npm run build`.
- Before a PR: `npm test`, `npm run typecheck`, `npm run build:verify`; for DB changes also `supabase test db --local`.

## Styling
- Tailwind and shadcn/ui for new and migrated UI (`src/components/ui/`); plain CSS (`src/styles.css`) stays for the board canvas.
- No global preflight: `src/tailwind.css` imports theme and utilities only; migrated roots get the scoped `tw` class.
- Use `cn()` from `@/lib/utils` and `@/` imports.
- Tailwind scans only the `@source` entries in `src/tailwind.css` (auto-detection is off, since it picked up words from CSS and docs). Anything under `src/components/` is covered; when a file outside it starts using Tailwind classes, add an `@source` line for it or its utilities will not be generated.
- Migrate a component fully and remove its legacy rules (unlayered legacy CSS beats Tailwind); do not mix.
- Keep roles, accessible names and focus behaviour; one focus ring (the global `:focus-visible`).
- `components.json` is hand-written; lucide, tw-animate-css and a dark variant are not installed, and `--primary` is a light stone, so any future `shadcn add` component needs manual review.
- jsdom applies no CSS: check visual changes in a real browser.

## Supabase
- Deny-by-default grants. Security definer functions set `search_path = ''`; revoke from public, anon, authenticated, then grant explicitly.
- Never edit an applied migration. Run `supabase db push --dry-run` before `--yes`. Never `supabase db reset` on the linked remote.
- Service role key only in `agents/`.

## Flow
- Feature branch in a git worktree; PRs target `main` and are opened ready for review (not draft).
- Never push to `main`, never force-push; the user merges.

## Quality bar
- Strict TypeScript, no `any`.
- zod at every boundary (DB reads, import, agents). Schemas live in `shared/schema.ts`.
- Layout and convert modules are pure and deterministic (seeded RNG, no Date/Math.random).
- Ids come from nanoid/uuid only, never `Date.now()`.
- No third-party runtime requests (fonts, images are self-hosted or licensed).
- No secrets in the client bundle; service role key is for `/agents` only.
- Accessibility checks on the editor.
- Keep files small and tested.
- `test/fixtures/private/` is gitignored and never bundled. The Epstein board is a test fixture only, never a seed.
