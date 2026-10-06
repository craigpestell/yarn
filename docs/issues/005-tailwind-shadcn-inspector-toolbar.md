# 005 Tailwind v4 and shadcn/ui for the Inspector and editor toolbar

Status: done

## Context

All styling is one unlayered plain-CSS file (`src/styles.css`, 145 lines). Craig wants Tailwind CSS v4 and shadcn/ui adopted incrementally next to it, with no big-bang rewrite. First targets, wanted right away: (a) the widget configuration panel (the Inspector) and every component inside it, and (b) the buttons along the top (the editor toolbar). The board canvas (cork, SVG yarn, thumbtacks, polaroids, xyflow nodes) stays plain CSS and must look identical. `CLAUDE.md` (18 lines) is extended in the same change with the stack, Supabase security rules, the worktree/PR flow, test commands and the new styling conventions.

Current surface (read from the repo):
- Inspector: `src/editor/Inspector.tsx` (table-driven `FIELDS` for photo, note, wanted, paper; `<aside className="inspector" aria-label="Inspector">`; header h2 + Close; "Delete widget" / "Delete yarn" with `danger`; edge branch with a colour input), `src/editor/SourcesEditor.tsx` (`fieldset.sources`), `src/links/WidgetLinkEditor.tsx` (`fieldset.link-editor`, native select "Your boards", url input, buttons). Mounted in `src/App.tsx` inside `.workspace` beside `<main className="stage">`.
- Toolbar: `src/editor/Toolbar.tsx`, `<div className="toolbar" role="toolbar" aria-label="Board tools">` inside `.topbar` (dark `#292524`). Controls, in order:
  1. `Add ▾` menu button (`.menu > button`, `aria-haspopup="menu"`, `aria-expanded`); opens `.menu-list[role=menu]` with four `role=menuitem` buttons: Add photo, Add note, Add wanted poster, Add paper (each calls `addWidget(type)` and closes).
  2. `Connect yarn` (`.toolbar > button`, `aria-pressed`); toggles connect mode. Pressed style `#22c55e`.
  3. `Auto-organize` / `Organizing...` (`.toolbar > button`, `disabled={busy}`); runs the ELK layout.
  4. `Import / export ▾` menu button; menuitems "Export JSON" (downloads `board.json`) and "Import JSON" (clicks the hidden file input, `aria-label="Import JSON file"`, `hidden`).
  5. `span.hint[role=status]` while connect mode is active ("Pick the source/target widget (Esc cancels)"); text, not a button, but restyled with the toolbar.
  The Publish button (`.publish > button`) and title control also live in `.topbar` but are NOT the toolbar; they stay as is.
- `src/styles.css` couplings: shared button rule at line 11 (`.toolbar > button, .menu > button, .menu-list button, .inspector button, .error button`); global `:focus-visible` (3px `#2563eb`) at 27; panel rules at 31-42 and 111; `.field`, `.field.inline`, `.err`, `.danger` are also used by PublishPanel, TopicTags, SharePanel and AccountPage (`.page button.danger`, `.publish-panel button.danger`). Legacy unlayered CSS beats Tailwind's layered CSS, so any legacy `.inspector button` / `.field input` rule left in place would override new components inside the panel.

## Decisions, flagged for the user to confirm at Gate 1

1. Preflight: import only `tailwindcss/theme.css` and `tailwindcss/utilities.css` (layered), not global preflight. Add only a minimal layered base reset scoped to the migrated components (Inspector root and toolbar root). Rationale: smallest blast radius on legacy unclassed headings, lists, fieldsets, anchors and the canvas.
2. Keep native `<select>` (Status, "Your boards"), Tailwind-styled; no Radix Select. Same for checkbox and colour inputs unless a Radix swap is clearly zero-risk to roles and labels. This keeps `test/app/link-editor.test.tsx` (`user.selectOptions`) working.
3. Legacy `.field`, `.err`, `.danger` and the shared button rule stay for PublishPanel, TopicTags, SharePanel, AccountPage, Boards/Explore and the error banner. Inspector and Toolbar stop using them, and the shared selector list is trimmed (drop `.toolbar > button`, `.menu > button`, `.menu-list button`, `.inspector button`; keep `.error button`). Other pages are not restyled here.
4. `CLAUDE.md` is extended in place, not replaced.
5. The Add and Import/export menus keep their current markup and behaviour (`role=menu`/`menuitem`, outside click and Escape), restyled with Tailwind classes. Radix DropdownMenu is out of scope.
6. `ConfirmDialog` to Radix AlertDialog is out of scope (separate follow-up).
7. shadcn's `body { @apply bg-background text-foreground }` snippet is dropped; shadcn CSS variables are defined once in a Tailwind entry file and used only by migrated components. The legacy global `:focus-visible` stays; migrated components use one focus ring style (no stacked double ring, see risks).

## Acceptance Criteria

1. Infra: Tailwind v4 via `@tailwindcss/vite` is installed and wired into `vite.config.ts` (peer range checked against the installed Vite); `@/*` maps to `src/*` in both `tsconfig.json` and `resolve.alias` (Vitest picks it up via `extends: true`); `components.json` exists; `src/lib/utils.ts` exports `cn()` (clsx + tailwind-merge); required deps added (class-variance-authority, clsx, tailwind-merge, lucide-react only if icons are chosen, tw-animate-css only if used, Radix only per component actually used).
2. Inspector restyle: the `<aside>` and every child (header, Close, all four widget field sets, Status select, checkbox/colour inputs, SourcesEditor, WidgetLinkEditor, edge colour branch, both Delete buttons, error text) are styled with Tailwind/shadcn-style components (`Button`, `Input`, `Textarea`, `Label`, etc. under `src/components/ui/`) and no longer depend on `.inspector*`, `.field`, `.err`, `.danger`, `.sources`, `.link-editor` rules. Unused legacy rules are removed; rules still used elsewhere remain.
3. Toolbar restyle: all five toolbar controls listed above (both menus, Connect yarn including its pressed state, Auto-organize including disabled/busy state, and the connect-mode hint) are restyled and legible on the dark top bar; the toolbar wraps cleanly at narrow widths.
4. Behaviour and accessibility unchanged: accessible names, roles, labels and landmarks are identical (complementary "Inspector", toolbar "Board tools", `menuitem`s, `aria-pressed`, `aria-expanded`, `getByLabelText('Text')`, native select options, single `role=alert` in the link editor); the `requestFocus` focus protocol is unchanged (Close returns focus to the widget, Delete widget to `.canvas`, `Canvas.tsx` ~133) and Escape handling in `App.tsx` still works.
5. Tests and gates: existing suites, including axe on the full App with the inspector open, pass with no test rewrites (additions only, each justified in the PR); `npm run typecheck`, `npm test`, `npm run build:verify` (bundle and font checks, no third-party runtime requests) are green; `test/agents/guard.test.ts` still passes.
6. Canvas untouched: the diff does not change canvas rules (`.react-flow`, `.widget`, `.art`, `.tack`, `.polaroid*`, `.note*`, `.wanted*`, `.paper*`, `.badge*`, `.link-chip`, edge/yarn styles), and a before/after screenshot comparison of the canvas shows no visual difference. Other pages (Boards, Account, Explore, Publish panel, topic tags, share panel, error/info banners) render identically.
7. `CLAUDE.md` is extended (see Brief) and still reads as short, scannable guidance.
8. Real-browser visual check (jsdom applies no CSS): editor with the panel open for each of photo, note, wanted and paper widgets, plus an edge selection, and the toolbar with both menus open and connect mode active, at desktop (about 1280 px) and narrow (about 375 px) widths; screenshots attached to the PR.

## Out of scope

Restyling PublishPanel, TopicTags, SharePanel, Account, Boards, Explore, reader, navbar, footer or banners; any canvas, node or yarn styling; Radix DropdownMenu or Select; ConfirmDialog/AlertDialog swap; global Tailwind preflight; dark mode (unless chosen below); adding a lint script; behaviour, schema or Supabase changes.

## Open questions for the user

1. Visual direction: keep the current warm stone/neutral palette and blue `#2563eb` focus ring (default), or a new look?
2. Dark mode: yes or no (default no; the top bar is already dark by design)?
3. Icons: lucide-react icons in toolbar buttons (adds a dependency, must keep accessible names), or text-only (default)?
4. Confirm decisions 1 to 7 above, especially no global preflight.

## Brief

Files to touch (ordering):
1. Infra: `package.json`, `vite.config.ts`, `tsconfig.json`, new `components.json`, new `src/lib/utils.ts`, new `src/tailwind.css` (theme + utilities imports, scoped base reset, shadcn vars) imported from the app entry beside `styles.css`. Confirm build and tests still pass before any component work.
2. `src/components/ui/` primitives, only those used (button, input, textarea, label, select-styled-native, fieldset/section helpers).
3. Inspector family: `Inspector.tsx`, `SourcesEditor.tsx`, `WidgetLinkEditor.tsx`; remove their legacy rules in `styles.css` in the same commit as each migration.
4. `Toolbar.tsx` (classes only; markup, roles and handlers unchanged), then trim line 11 selector list and `.toolbar`, `.menu`, `.menu-list`, `.hint` rules.
5. `CLAUDE.md`.

Data/props: none; at most a `className` passthrough on the primitives.

CLAUDE.md additions (in place):
- Stack: Vite 8 (Rolldown), React 19, TypeScript 7 strict, zustand, @xyflow/react, zod, Supabase, vitest, Tailwind v4, shadcn/ui.
- Supabase: deny-by-default grants; security definer functions set `search_path = ''`; revoke from public, anon, authenticated, then explicit grant; never edit an applied migration; `supabase db push --dry-run` before `--yes`; never `supabase db reset` on the linked remote; service role key only in `agents/`.
- Flow: feature branch in a git worktree; PRs against `main`, opened ready for review (not draft); never push to `main`; never force-push; the user merges.
- Tests: `npm test`, `npm run typecheck`, `npm run build:verify`, `supabase test db --local`.
- Styling: Tailwind and shadcn for new and migrated UI; plain CSS stays for the board canvas; no global preflight; use `cn()` and `@/` imports; migrate a component fully (remove its legacy rules) rather than mixing; keep roles, names and focus behaviour; check visually in a real browser.

Risks: Tailwind layered CSS loses to unlayered legacy rules (remove or scope them as each piece migrates); the legacy global `:focus-visible` can stack with shadcn `focus-visible:` rings (pick one); `.info button` relies on UA button look, so keep preflight off; Radix focus restore (if any Radix is used) can fight the Inspector `requestFocus` protocol; shadcn CLI may write a body style or a font, review its output (no third-party font or runtime requests); confirm `@tailwindcss/vite` supports the installed Vite.

Verification:
- AC 1, 5: `npm run typecheck`, `npm test`, `npm run build:verify`; inspect `dist` for no external URLs (covered by `check:bundle` and `check:fonts`).
- AC 2: `npm test` (Inspector, app and link-editor suites unchanged); `grep` for removed class names in `src` shows no remaining users.
- AC 3, 6, 8: `npm run dev`, then browser screenshots before/after at 1280 px and 375 px (panel open for each widget type and an edge; toolbar with menus and connect mode; canvas and Boards/Account pages for regression).
- AC 4: `test/editor/app.test.tsx` (roles, focus protocol, axe on full App with inspector open) and `test/app/link-editor.test.tsx`.
- AC 7: review the diff of `CLAUDE.md`.

Note (2026-10-04): shipped. Verifier AC 1-7 PASS, validator no Critical/Important; browser check by orchestrator.
