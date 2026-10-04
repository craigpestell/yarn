import { SAMPLE_DOC, SAMPLE_TITLE } from './editor/sample'
import { loadSaved, startAutosave } from './editor/persist'
import { useBoard } from './editor/store'

/** Load the saved board (or the sample) and start autosave. Never overwrites an unloadable saved board without a backup. */
export function boot(): () => void {
  const store = useBoard.getState()
  const saved = loadSaved()
  if (saved.kind === 'ok') {
    store.loadBoard(saved.title, saved.doc)
  } else {
    store.loadBoard(SAMPLE_TITLE, SAMPLE_DOC)
    if (saved.kind === 'corrupt') {
      store.reportInfo(
        saved.backupKey
          ? `Your saved board could not be loaded. A backup copy was kept in this browser under "${saved.backupKey}".`
          : 'Your saved board could not be loaded and could not be backed up, so autosave is paused to protect it.',
      )
      if (!saved.backupKey) return () => {}
    }
  }
  return startAutosave(useBoard, undefined, (t) => useBoard.getState().reportError(t))
}
