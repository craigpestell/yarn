# 006 Widget dialog: Inspector and read-only Detail view in a modal

Status: done

## Context

Today the Inspector is an `<aside aria-label="Inspector">` beside the canvas; it is open iff store `selection` resolves (`Inspector.tsx`, `store.ts` activateWidget/activateEdge/addWidget/deleteWidget/stageClick). It narrows the canvas by 300px and there is no way to read a widget in full: node components clip text (`.note`, `.paper`, `.wanted`, `.polaroid`).

Terminology: **Inspector** = the edit part (fields, SourcesEditor, WidgetLinkEditor, Delete). **Detail view** = new read-only part. **Widget dialog** = the large modal wrapping both.

Item 12 of `001-yarns-v2-foundation.md` ("no per-type editors or modals") meant no per-widget-type designs, not "no modals". This issue rewords it to "one generic inspector for every widget type; no per-type editors" and updates line 27 ("New widget opens the inspector") to say the widget dialog. Both Inspector and Detail view stay generic, driven by the same field table (`FIELDS`, `shared/schema.ts:66-109`) and shared renderers; no bespoke per-type layouts.

This also covers backlog "Widget detail overlay + follow board link": following a board link is just the existing LinkChip-style anchor. It deliberately supersedes 005 AC 4/5 ("no test rewrites"); the test changes below are accepted.

## Acceptance Criteria

1. Opening: a non-drag click, or Enter/Space on a focused widget or yarn, or adding a widget, opens the widget dialog (`role="dialog"`, `aria-modal="true"`, named by a heading from `widgetLabel`, not "Inspector"). A drag, resize-handle release, arrow-key nudge, Delete on a focused node, and any click in connect mode do not open it.
2. Content: for a widget, the dialog shows the Detail view (full unclipped text per type, image via `PhotoImage` when present, status, sources as text with https/http links `rel="noopener noreferrer" target="_blank"` and title/license/attribution, linked board as a plain anchor or "Board unavailable" `role=note`) and the Inspector with all existing fields and behaviour. Detail view uses plain text (no labels), so `getByLabelText('Text')` stays unambiguous. A yarn opens a compact dialog with no Detail view (colour, endpoints, Delete yarn).
3. Modal behaviour: focus moves in on open (new widget: first editable field; otherwise the dialog heading/close control); Tab and Shift+Tab are trapped across all focusable controls; background is `inert`/`aria-hidden`; Escape closes the dialog only (does not fire cancelConnect or close toolbar menus); backdrop click closes; body does not scroll behind; dialog scrolls internally; two columns on wide screens (Detail left, Inspector right), stacked on narrow (Detail first).
4. Focus protocol: Close and Escape = `select(null)` + `requestFocus(id)` (focus returns to the node); Delete widget ends focus on `.canvas`; exactly one mechanism restores focus (the Canvas `requestFocus` effect), with no race against `addWidget`'s request.
5. Existing behaviour kept: title-edit Escape, connect-mode Escape, Inspector editing, `link-editor.test.tsx` (an exported edit-part component renders standalone without the modal), single `role=alert` in the link editor; the canvas no longer narrows on selection.
6. Quality: axe passes on `document.body` with the dialog open and closed; `npm test`, `npm run typecheck`, `npm run build:verify` green; no new dependency; no `any`; Detail view takes plain props (widget, link view), no editor store, so it can be reused in the reader later.

## Assumptions to confirm

1. Yarns also open the dialog, compact, with no Detail view.
2. Triggers as in AC 1; connect mode never opens it.
3. Hand-rolled modal primitive in `src/components/ui/` (portal, labelledby, focus trap, inert), no Radix/focus-trap dependency. Native `<dialog>` only if jsdom support is verified; state the choice in the PR.
4. Layout and initial-focus rule as in AC 3.
5. Dialog name from `widgetLabel` heading.
6. Reader (`/b/:slug`) out of scope.
7. Linked board follows via existing LinkChip logic (`recordNavigation`); no new behaviour. Risk: LeaveGuard/unsaved-changes interplay when an owner follows the link.
8. Escape = one action only; backdrop click closes.
9. Test rewrites accepted (see Brief).
10. New files under `src/components/widget-dialog/`.

## Out of scope

Reader mode; editing images (WantedNode ignores `image`, Inspector cannot set images); changing delete-without-confirm; new link-follow behaviour; replacing `ConfirmDialog`; per-type designs.

## Brief

Files to change:
- New `src/components/ui/dialog.tsx` (modal primitive), `src/components/widget-dialog/{WidgetDialog,DetailView,detail-fields}.tsx`; split `src/editor/Inspector.tsx` (~155 lines) into the edit part (still exported, standalone) and the wrapper; `src/App.tsx` (mount dialog, drop `<aside>` from `.workspace`, Escape ownership at lines 16-22); `src/editor/Canvas.tsx` (requestFocus effect guard at ~134; click/Enter/Space open path; check `useDrag` click swallow and `ResizeHandle` release); `src/styles.css` (remove `.inspector`/`.workspace` panel rules); `src/tailwind.css` (`@source` only if files land outside `src/components/`; drop the Inspector.tsx entry if it moves); `docs/issues/001-yarns-v2-foundation.md` (reword item 12, line 27).
- Reuse: `PhotoImage` (PhotoNode.tsx, https only), `readableText` (geometry.ts), `widgetLabel` (docOps.ts), LinkChip logic, `LinksContext`. Do not use legacy `.note/.paper/.wanted/.polaroid/.link-chip` classes inside the `tw` tree (unlayered, they clip and beat Tailwind).

Data/props: no schema or store-shape change expected. Detail view props `{ widget, link }`; sources are untrusted, rendered as text only.

CLAUDE.md quality bar: Tailwind/shadcn-style for new UI with `cn()` and `@/` imports; portalled root carries the `tw` class itself and uses z-index >= 50 (above `.publish-panel`/menu 20, `.confirm-backdrop` 50); keep roles, names and one focus ring (global `:focus-visible`); strict TS, no `any`; zod at boundaries (no new boundary); pure layout code untouched; small tested files; no third-party runtime requests.

Tests to change: `test/editor/app.test.tsx` role queries at 37, 57, 86, 221 (complementary to dialog); 31-42 (inert background may break the `node()` helper); 162-171 (focus after add lands inside the dialog); 234-243 (axe on `document.body`); keep 61-80 (connect Escape) and 92-130 (title Escape) passing. `test/app/link-editor.test.tsx` keeps rendering the edit part standalone.

Verification:
- AC 1, 5: app and canvas tests for each trigger and non-trigger (drag, resize, nudge, connect), plus existing suites, via `npm test`.
- AC 2: new DetailView tests per widget type (text, image, sources links, board anchor/"Board unavailable"), yarn compact case; `npm test`.
- AC 3, 4: new tests for focus-in, trap, inert, Escape-only, backdrop, Close returns focus to node, Delete ends on `.canvas`; `npm test`.
- AC 6: axe open/closed in `npm test`; `npm run typecheck`; `npm run build:verify`.
- Real-browser check (jsdom has no CSS): `npm run dev`, dialog for each widget type and a yarn at about 1280px and 375px, z-order over publish panel and menus, internal scroll, long text unclipped; screenshots in the PR.

---
Done 2026-10-05: implemented on feat/widget-dialog. Verified with npm test, typecheck, build:verify and a real-browser check at 1280px and 375px. Not covered: publish panel z-order, photo with image, LeaveGuard when following a board link with unsaved edits.
