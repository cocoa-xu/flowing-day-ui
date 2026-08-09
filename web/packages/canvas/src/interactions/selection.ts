import { canvasRectContains, canvasRectsIntersect, type FdCanvasRect } from '../geometry.js'
import type { FdAnyGraphNode, FdGraphElementID } from '../graph/model.js'
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
