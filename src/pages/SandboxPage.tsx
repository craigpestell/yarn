import { useEffect } from 'react'
import { App } from '../App'
import { boot } from '../boot'

/** The logged-out localStorage sandbox editor at `/` (M3 behaviour, unchanged). */
export function SandboxPage() {
  useEffect(() => boot(), [])
  return <App />
}
