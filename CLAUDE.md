# Yarns v2

Conspiracy-board app. Spec: `docs/issues/001-yarns-v2-foundation.md`. v1 at `/Users/craig/work/yarns` is read-only reference.

## Commands
- `npm test` (vitest), `npm run typecheck` (tsc --noEmit), `npm run build`.

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
