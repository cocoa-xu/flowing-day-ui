import type { FdCanvasPoint } from '../geometry.js'
import { canvasRectContains, canvasRectsIntersect, type FdCanvasRect } from '../geometry.js'
import type { FdAnyGraphNode, FdGraphElementID } from '../graph/model.js'
import {
  defaultGraphEdgeGeometryResolver,
  type FdGraphCubicEdgeGeometry,
  graphCubicEdgePoint,
  graphEdgeCubicSegments,
} from '../rendering/edge-geometry.js'
import type { FdGraphMarqueeBehavior, FdGraphSelectionBehavior } from './configuration.js'

export type FdGraphCanvasSelectionMode = 'replace' | 'additive' | 'toggle'

export class FdGraphCanvasMarqueeSelectionResolver {
  private constructor() {}

  static selection(
    baseSelection: ReadonlySet<FdGraphElementID>,
    candidates: ReadonlySet<FdGraphElementID>,
    mode: FdGraphCanvasSelectionMode,
  ): Set<FdGraphElementID> {
    if (mode === 'replace') return new Set(candidates)
    const selection = new Set(baseSelection)
    for (const elementID of candidates) {
      if (mode === 'toggle' && selection.has(elementID)) selection.delete(elementID)
      else selection.add(elementID)
    }
    return selection
  }
}

export class FdGraphCanvasMarqueeSelectionState {
  readonly initialSelection: ReadonlySet<FdGraphElementID>
  readonly mode: FdGraphCanvasSelectionMode
  private currentCandidates = new Set<FdGraphElementID>()
  private active = false

  constructor(initialSelection: ReadonlySet<FdGraphElementID>, mode: FdGraphCanvasSelectionMode) {
    this.initialSelection = new Set(initialSelection)
    this.mode = mode
  }

  get candidates(): ReadonlySet<FdGraphElementID> {
    return this.currentCandidates
  }

  get isActive(): boolean {
    return this.active
  }

  update(
    candidates: ReadonlySet<FdGraphElementID>,
    hasExceededMinimumDistance: boolean,
  ): Set<FdGraphElementID> {
    this.active ||= hasExceededMinimumDistance
    if (!this.active) return new Set(this.initialSelection)
    this.currentCandidates = new Set(candidates)
    return this.selection
  }

  get selection(): Set<FdGraphElementID> {
    if (!this.active) return new Set(this.initialSelection)
    return FdGraphCanvasMarqueeSelectionResolver.selection(
      this.initialSelection,
      this.currentCandidates,
      this.mode,
    )
  }
}

export class FdGraphCanvasMarquee {
  readonly startLocation: FdCanvasPoint
  readonly location: FdCanvasPoint

  constructor(startLocation: FdCanvasPoint, location: FdCanvasPoint) {
    this.startLocation = startLocation
    this.location = location
  }

  get rect(): FdCanvasRect {
    return {
      x: Math.min(this.startLocation.x, this.location.x),
      y: Math.min(this.startLocation.y, this.location.y),
      width: Math.abs(this.location.x - this.startLocation.x),
      height: Math.abs(this.location.y - this.startLocation.y),
    }
  }
}

export type FdGraphCanvasSelectionCommand<ElementID extends FdGraphElementID = FdGraphElementID> =
  | { readonly kind: 'replace'; readonly elementIDs: ReadonlySet<ElementID> }
  | { readonly kind: 'add'; readonly elementIDs: ReadonlySet<ElementID> }
  | { readonly kind: 'remove'; readonly elementIDs: ReadonlySet<ElementID> }
  | { readonly kind: 'toggle'; readonly elementIDs: ReadonlySet<ElementID> }
  | { readonly kind: 'clear' }

export class FdGraphCanvasSessionReducer {
  private constructor() {}

  static apply<ElementID extends FdGraphElementID>(
    command: FdGraphCanvasSelectionCommand<ElementID>,
    selection: Set<ElementID>,
  ): void {
    if (command.kind === 'clear') {
      selection.clear()
      return
    }
    if (command.kind === 'replace') {
      selection.clear()
      for (const elementID of command.elementIDs) selection.add(elementID)
      return
    }
    for (const elementID of command.elementIDs) {
      if (command.kind === 'remove') selection.delete(elementID)
      else if (command.kind === 'toggle' && selection.has(elementID)) selection.delete(elementID)
      else selection.add(elementID)
    }
  }
}

export function graphSelectionMode(
  shiftKey: boolean,
  metaKey: boolean,
  controlKey: boolean,
): FdGraphCanvasSelectionMode {
  if (metaKey || controlKey) return 'toggle'
  if (shiftKey) return 'additive'
  return 'replace'
}

export function resolveGraphSelection(
  selection: ReadonlySet<FdGraphElementID>,
  nodeID: FdGraphElementID,
  mode: FdGraphCanvasSelectionMode,
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
  mode: FdGraphCanvasSelectionMode,
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
  return FdGraphCanvasMarqueeSelectionResolver.selection(initialSelection, new Set(matches), mode)
}

export function graphEdgeDistance(
  point: FdCanvasPoint,
  source: FdCanvasPoint,
  target: FdCanvasPoint,
  segmentCount = 16,
): number {
  return Math.min(
    ...graphEdgeCubicSegments(
      defaultGraphEdgeGeometryResolver({
        edge: { id: 'hit-test', source: { nodeID: 'source' }, target: { nodeID: 'target' } },
        source,
        target,
      }),
    ).map((segment) => graphCubicEdgeDistance(point, segment, segmentCount)),
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
