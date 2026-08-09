import type { FdCanvasPoint } from '../geometry.js'
import { canvasRectContains, canvasRectsIntersect, type FdCanvasRect } from '../geometry.js'
import type { FdAnyGraphNode, FdGraphElementID } from '../graph/model.js'
import type { FdGraphMarqueeBehavior, FdGraphSelectionBehavior } from './configuration.js'

const graphEdgeControlRatio = 0.45
const graphEdgeMinimumControlDistance = 48

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
    .filter((node) => node.capabilities?.selectable !== false)
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
  if (!Number.isInteger(segmentCount) || segmentCount <= 0) {
    throw new RangeError('edge hit-test segment count must be a positive integer')
  }
  const horizontalDistance = Math.abs(target.x - source.x)
  const control = Math.max(
    horizontalDistance * graphEdgeControlRatio,
    graphEdgeMinimumControlDistance,
  )
  const direction = target.x >= source.x ? 1 : -1
  const firstControl = { x: source.x + control * direction, y: source.y }
  const secondControl = { x: target.x - control * direction, y: target.y }
  let minimumDistance = Number.POSITIVE_INFINITY
  let previous = source
  for (let index = 1; index <= segmentCount; index += 1) {
    const progress = index / segmentCount
    const remaining = 1 - progress
    const current = {
      x:
        remaining ** 3 * source.x +
        3 * remaining ** 2 * progress * firstControl.x +
        3 * remaining * progress ** 2 * secondControl.x +
        progress ** 3 * target.x,
      y:
        remaining ** 3 * source.y +
        3 * remaining ** 2 * progress * firstControl.y +
        3 * remaining * progress ** 2 * secondControl.y +
        progress ** 3 * target.y,
    }
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
