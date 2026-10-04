import { useEffect } from 'react'
import { App } from '../App'
import { boot } from '../boot'
import { NavBar } from './NavBar'

/** The logged-out localStorage sandbox editor at `/` (M3 behaviour, unchanged). */
export function SandboxPage() {
  useEffect(() => boot(), [])
  return <App nav={<NavBar />} />
}
