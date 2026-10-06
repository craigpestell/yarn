import { ReactFlowProvider } from '@xyflow/react'
import { useEffect, type ReactNode } from 'react'
import { WidgetDialog } from './components/widget-dialog/WidgetDialog'
import { Canvas } from './editor/Canvas'
import { TitleEdit } from './editor/TitleEdit'
import { Toolbar } from './editor/Toolbar'
import { useBoard } from './editor/store'
import './styles.css'

export function App({ nav, banner, tools }: { nav?: ReactNode; banner?: ReactNode; tools?: ReactNode } = {}) {
  const error = useBoard((s) => s.error)
  const clearError = useBoard((s) => s.clearError)
  const info = useBoard((s) => s.info)
  const clearInfo = useBoard((s) => s.clearInfo)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useBoard.getState().cancelConnect()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <ReactFlowProvider>
      <div className="app">
        {nav}
        <header className="topbar">
          <TitleEdit />
          <Toolbar />
          {tools}
        </header>
        {banner}
        {error && (
          <div className="error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={clearError}>Dismiss</button>
          </div>
        )}
        {info && (
          <div className="info" role="status">
            <span>{info}</span>
            <button type="button" onClick={clearInfo}>Dismiss</button>
          </div>
        )}
        <div className="workspace">
          <main className="stage">
            <Canvas />
          </main>
          <WidgetDialog />
        </div>
      </div>
    </ReactFlowProvider>
  )
}
