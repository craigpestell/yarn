import type { Edge, EdgeProps, EdgeTypes } from '@xyflow/react'
import { yarnPath } from '../geometry'

export type YarnEdgeType = Edge<{ color: string }, 'yarn'>

/** Red yarn (width 3) with a soft shadow and a wide invisible hit area. Endpoints are the pin points. */
export function YarnEdge({ sourceX, sourceY, targetX, targetY, selected, data }: EdgeProps<YarnEdgeType>) {
  const d = yarnPath(sourceX, sourceY, targetX, targetY)
  return (
    <g className="yarn">
      {selected && <path d={d} fill="none" stroke="#1d4ed8" strokeWidth={9} strokeOpacity={0.35} strokeLinecap="round" />}
      <path d={d} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={3} strokeLinecap="round" transform="translate(2 4)" />
      <path className="yarn-main" d={d} fill="none" stroke={data?.color ?? '#e53e3e'} strokeWidth={3} strokeLinecap="round" />
      <path d={d} fill="none" stroke="transparent" strokeWidth={16} />
    </g>
  )
}

export const edgeTypes: EdgeTypes = { yarn: YarnEdge }
