import { useBlocker } from 'react-router'
import { isDiscarding } from './activeSave'

/**
 * Blocks in-app navigation while edits are known to be unsaveable (offline, rejected, session ended, conflict),
 * so they are not silently dropped. Requires a data router.
 */
export function LeaveGuard({ active }: { active: boolean }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => active && !isDiscarding() && currentLocation.pathname !== nextLocation.pathname)
  if (blocker.state !== 'blocked') return null
  return (
    <div className="error" role="alert">
      <span>Your latest edits to this board are not saved. If you leave now they will be lost.</span>
      <span className="actions">
        <button type="button" onClick={() => blocker.reset()}>Stay</button>
        <button type="button" onClick={() => blocker.proceed()}>Leave anyway</button>
      </span>
    </div>
  )
}
