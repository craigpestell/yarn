import { create } from 'zustand'
import { DocSchema, LIMITS, type Doc, type WidgetType } from '../../shared/schema'
import { exportBoard, parseBoard, TITLE_MAX, TitleSchema } from './boardIO'
import {
  addWidget,
  makeWidget,
  moveWidget,
  patchEdge,
  patchWidget,
  removeEdge,
  removeWidget,
  resizeWidget,
  toggleEdge,
} from './docOps'
import { SAMPLE_DOC, SAMPLE_TITLE } from './sample'

export type Selection = { kind: 'widget' | 'edge'; id: string }
export interface ConnectState {
  active: boolean
  source: string | null
}
const IDLE: ConnectState = { active: false, source: null }

export interface BoardState {
  title: string
  doc: Doc
  selection: Selection | null
  connect: ConnectState
  /** Visible alert text (role=alert). */
  error: string | null
  /** Visible non-error notice (role=status). */
  info: string | null
  /** One-shot focus request consumed by the Canvas: a widget/edge id or 'canvas'. */
  focus: { target: string; seq: number } | null
  busy: boolean
  /** Bumped whenever the whole board changes (load, import, organize) so the Canvas refits. */
  fitSeq: number
  loadBoard: (title: string, raw: unknown) => boolean
  setTitle: (title: string) => boolean
  addWidget: (type: WidgetType, rng?: () => number) => void
  moveBy: (id: string, dx: number, dy: number) => void
  resizeTo: (id: string, w: number, h: number) => void
  patchWidget: (id: string, patch: { data?: Record<string, unknown> } & Record<string, unknown>) => void
  patchEdge: (id: string, color: string) => void
  deleteWidget: (id: string) => void
  deleteEdge: (id: string) => void
  deleteSelection: () => void
  select: (sel: Selection | null) => void
  activateWidget: (id: string) => void
  activateEdge: (id: string) => void
  toggleConnectMode: () => void
  cancelConnect: () => void
  stageClick: () => void
  exportJson: () => string
  importJson: (text: string) => boolean
  clearError: () => void
  clearInfo: () => void
  reportError: (text: string) => void
  reportInfo: (text: string) => void
  requestFocus: (target: string) => void
  organize: () => Promise<void>
}

/** Place new widgets on a gentle staircase so they do not stack exactly. */
const spawnPoint = (n: number) => ({ x: 100 + (n % 8) * 40, y: 100 + (n % 8) * 30 })

/** True when the selection points at a widget or yarn that exists, i.e. the widget dialog is actually open. */
export const isDialogOpen = (s: Pick<BoardState, 'doc' | 'selection'>): boolean => {
  const sel = s.selection
  if (!sel) return false
  return (sel.kind === 'widget' ? s.doc.widgets : s.doc.edges).some((x) => x.id === sel.id)
}

export const useBoard = create<BoardState>()((set, get) => ({
  title: SAMPLE_TITLE,
  doc: SAMPLE_DOC,
  selection: null,
  connect: IDLE,
  error: null,
  info: null,
  focus: null,
  busy: false,
  fitSeq: 0,

  loadBoard: (title, raw) => {
    const doc = DocSchema.safeParse(raw)
    const t = TitleSchema.safeParse(title)
    if (!doc.success || !t.success) {
      set({ error: 'Saved board data is invalid' })
      return false
    }
    set((s) => ({ title: t.data, doc: doc.data, selection: null, connect: IDLE, error: null, fitSeq: s.fitSeq + 1 }))
    return true
  },

  setTitle: (title) => {
    const t = TitleSchema.safeParse(title)
    if (!t.success) {
      set({ error: `Title must be 1-${TITLE_MAX} characters; the previous title was kept` })
      return false
    }
    set({ title: t.data })
    return true
  },

  addWidget: (type, rng = Math.random) => {
    if (get().doc.widgets.length >= LIMITS.widgets) {
      set({ error: `This board is full (${LIMITS.widgets} widgets maximum)` })
      return
    }
    const { x, y } = spawnPoint(get().doc.widgets.length)
    const w = makeWidget(type, x, y, rng)
    set((s) => ({
      doc: addWidget(s.doc, w),
      selection: { kind: 'widget', id: w.id },
      connect: IDLE,
      focus: { target: w.id, seq: (s.focus?.seq ?? 0) + 1 },
    }))
  },

  moveBy: (id, dx, dy) => set((s) => ({ doc: moveWidget(s.doc, id, dx, dy) })),
  resizeTo: (id, w, h) => set((s) => {
    const doc = resizeWidget(s.doc, id, w, h)
    return doc === s.doc ? s : { doc }
  }),
  patchWidget: (id, patch) =>
    set((s) => {
      const doc = patchWidget(s.doc, id, patch)
      return doc === s.doc ? { error: 'That change was rejected as invalid and was not applied' } : { doc }
    }),
  patchEdge: (id, color) => set((s) => ({ doc: patchEdge(s.doc, id, { color }) })),

  deleteWidget: (id) =>
    set((s) => ({
      doc: removeWidget(s.doc, id),
      selection: s.selection?.id === id ? null : s.selection,
      connect: s.connect.source === id ? { ...s.connect, source: null } : s.connect,
    })),
  deleteEdge: (id) =>
    set((s) => ({ doc: removeEdge(s.doc, id), selection: s.selection?.id === id ? null : s.selection })),
  deleteSelection: () => {
    const sel = get().selection
    if (!sel) return
    if (sel.kind === 'widget') get().deleteWidget(sel.id)
    else get().deleteEdge(sel.id)
  },

  select: (selection) => set({ selection }),

  activateWidget: (id) => {
    const { connect } = get()
    if (!connect.active) {
      set({ selection: { kind: 'widget', id } })
      return
    }
    if (connect.source === null) set({ connect: { active: true, source: id } })
    else if (connect.source === id) set({ connect: { active: true, source: null } })
    else
      set((s) => {
        const doc = toggleEdge(s.doc, connect.source ?? id, id)
        const next = { connect: { active: true, source: null } }
        return doc === s.doc ? { ...next, error: `Could not connect these widgets (yarn limit of ${LIMITS.edges} reached)` } : { ...next, doc }
      })
  },
  activateEdge: (id) => {
    if (!get().connect.active) set({ selection: { kind: 'edge', id } })
  },

  toggleConnectMode: () => set((s) => ({ connect: s.connect.active ? IDLE : { active: true, source: null } })),
  cancelConnect: () => set({ connect: IDLE }),
  stageClick: () => set((s) => ({ connect: IDLE, selection: s.connect.active ? s.selection : null })),

  exportJson: () => exportBoard(get().title, get().doc),
  importJson: (text) => {
    const r = parseBoard(text)
    if (!r.ok) {
      set({ error: r.error })
      return false
    }
    set((s) => ({ title: r.title ?? s.title, doc: r.doc, selection: null, connect: IDLE, error: null, fitSeq: s.fitSeq + 1 }))
    return true
  },
  clearError: () => set({ error: null }),
  clearInfo: () => set({ info: null }),
  reportError: (text) => set({ error: text }),
  reportInfo: (text) => set({ info: text }),
  requestFocus: (target) => set((s) => ({ focus: { target, seq: (s.focus?.seq ?? 0) + 1 } })),

  organize: async () => {
    if (get().busy) return
    set({ busy: true, error: null })
    try {
      const { autoOrganize } = await import('../../layout/autoOrganize')
      const result = await autoOrganize(get().doc, { seed: 1 })
      const pos = new Map(result.widgets.map((w) => [w.id, w]))
      // Merge positions into the current doc so edits made while laying out are not lost.
      set((s) => ({
        doc: { ...s.doc, widgets: s.doc.widgets.map((w) => { const p = pos.get(w.id); return p ? { ...w, x: p.x, y: p.y } : w }) },
        fitSeq: s.fitSeq + 1,
      }))
    } catch (e) {
      set({ error: `Auto-organize failed: ${e instanceof Error ? e.message : 'unknown error'}` })
    } finally {
      set({ busy: false })
    }
  },
}))
