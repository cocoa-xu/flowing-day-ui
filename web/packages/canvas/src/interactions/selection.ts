import type { FdCanvasPoint } from '../geometry.js'
import { canvasRectContains, canvasRectsIntersect, type FdCanvasRect } from '../geometry.js'
import type { FdAnyGraphNode, FdGraphElementID } from '../graph/model.js'
import {
  defaultGraphEdgeGeometryResolver,
  type FdGraphCubicEdgeGeometry,
  graphCubicEdgePoint,
} from '../rendering/edge-geometry.js'
import type { FdGraphMarqueeBehavior, FdGraphSelectionBehavior } from './configuration.js'

export type FdGraphSelectionMode = 'replace' | 'extend' | 'toggle'

export function graphSelectionMode(
  shiftKey: boolean,
  metaKey: boolean,
  controlKey: boolean,
): FdGraphSelectionMode {
  if (metaKey || controlKey) return 'toggle'
  if (shiftKey) return 'extend'
  return 'replace'
}

export function resolveGraphSelection(
  selection: ReadonlySet<FdGraphElementID>,
  nodeID: FdGraphElementID,
  mode: FdGraphSelectionMode,
  behavior: FdGraphSelectionBehavior,
): Set<FdGraphElementID> {
  if (behavior === 'none') return new Set()
  if (behavior === 'single' || mode === 'replace') return new Set([nodeID])
  const result = new Set(selection)
  if (mode === 'toggle' && result.has(nodeID)) result.delete(nodeID)
  else result.add(nodeID)
  return result
}

export function resolveGraphMarqueeSelection(
  initialSelection: ReadonlySet<FdGraphElementID>,
  nodes: readonly FdAnyGraphNode[],
  marquee: FdCanvasRect,
  mode: FdGraphSelectionMode,
  behavior: FdGraphSelectionBehavior,
  marqueeBehavior: FdGraphMarqueeBehavior,
): Set<FdGraphElementID> {
  if (behavior === 'none' || marqueeBehavior === 'disabled') return new Set(initialSelection)
  const matches = nodes
    .filter((node) =>
      marqueeBehavior === 'contains'
        ? canvasRectContains(marquee, node.frame)
        : canvasRectsIntersect(marquee, node.frame),
    )
    .map(({ id }) => id)
  if (behavior === 'single') return new Set(matches.slice(0, 1))
  if (mode === 'replace') return new Set(matches)
  const result = new Set(initialSelection)
  for (const id of matches) {
    if (mode === 'toggle' && result.has(id)) result.delete(id)
    else result.add(id)
  }
  return result
}

export function graphEdgeDistance(
  point: FdCanvasPoint,
  source: FdCanvasPoint,
  target: FdCanvasPoint,
  segmentCount = 16,
): number {
  return graphCubicEdgeDistance(
    point,
    defaultGraphEdgeGeometryResolver({
      edge: { id: 'hit-test', source: { nodeID: 'source' }, target: { nodeID: 'target' } },
      source,
      target,
    }),
    segmentCount,
  )
}

export function graphCubicEdgeDistance(
  point: FdCanvasPoint,
  geometry: FdGraphCubicEdgeGeometry,
  segmentCount = 16,
): number {
  if (!Number.isInteger(segmentCount) || segmentCount <= 0) {
    throw new RangeError('edge hit-test segment count must be a positive integer')
  }
  let minimumDistance = Number.POSITIVE_INFINITY
  let previous = geometry.start
  for (let index = 1; index <= segmentCount; index += 1) {
    const progress = index / segmentCount
    const current = graphCubicEdgePoint(geometry, progress)
    minimumDistance = Math.min(minimumDistance, pointToSegmentDistance(point, previous, current))
    previous = current
  }
  return minimumDistance
}

const pointToSegmentDistance = (
  point: FdCanvasPoint,
  start: FdCanvasPoint,
  end: FdCanvasPoint,
): number => {
  const width = end.x - start.x
  const height = end.y - start.y
  const lengthSquared = width * width + height * height
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const progress = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * width + (point.y - start.y) * height) / lengthSquared),
  )
  return Math.hypot(point.x - (start.x + width * progress), point.y - (start.y + height * progress))
}
