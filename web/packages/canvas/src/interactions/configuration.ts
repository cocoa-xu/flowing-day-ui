import type { FdCanvasRect } from '../geometry.js'
import type { FdAnyGraphNode, FdGraphElementID } from '../graph/model.js'
import type { FdGraphResizeHandle, FdGraphSnappingStrategy } from './arrangement.js'

export type FdGraphSelectionBehavior = 'none' | 'single' | 'multiple'
export type FdGraphMarqueeBehavior = 'disabled' | 'intersects' | 'contains'
export type FdGraphGridRoundingPolicy = 'nearest' | 'down' | 'up' | 'towardZero' | 'awayFromZero'
export type FdGraphFrameUpdateBehavior = 'intent' | 'local'
export type FdGraphCanvasTool = 'select' | 'pan'

export interface FdGraphNodeSizeConstraints {
  readonly minimumWidth?: number
  readonly minimumHeight?: number
  readonly maximumWidth?: number
  readonly maximumHeight?: number
}

export interface FdResolvedGraphNodeSizeConstraints {
  readonly minimumWidth: number
  readonly minimumHeight: number
  readonly maximumWidth?: number
  readonly maximumHeight?: number
}

export type FdGraphNodeInteractionAdmission =
  | { readonly kind: 'deny' }
  | { readonly kind: 'allowAll' }
  | { readonly kind: 'allowOnly'; readonly nodeIDs: ReadonlySet<FdGraphElementID> }

export interface FdGraphNodeDragAdmissionRequest {
  readonly anchorNode: FdAnyGraphNode
  readonly selectedNodes: readonly FdAnyGraphNode[]
  readonly candidateNodes: readonly FdAnyGraphNode[]
  readonly snapshotID: string | number
}

export interface FdGraphNodeResizeAdmissionRequest extends FdGraphNodeDragAdmissionRequest {
  readonly baseFrames: ReadonlyMap<FdGraphElementID, FdCanvasRect>
  readonly handle: FdGraphResizeHandle
}

export interface FdGraphGridConfiguration {
  readonly enabled?: boolean
  readonly width?: number
  readonly height?: number
  readonly originX?: number
  readonly originY?: number
  readonly snapsX?: boolean
  readonly snapsY?: boolean
  readonly rounding?: FdGraphGridRoundingPolicy
}

export interface FdGraphSnappingConfiguration {
  readonly enabled?: boolean
  readonly alignment?: boolean
  readonly equalSpacing?: boolean
  readonly equalSize?: boolean
  readonly grid?: FdGraphGridConfiguration
  readonly acquisitionDistance?: number
  readonly releaseDistance?: number
  readonly searchRadius?: number
  readonly maximumCandidates?: number
  readonly showsGuides?: boolean
  readonly guideOffset?: number
}

export interface FdGraphCanvasInteractionConfiguration {
  readonly selection?: FdGraphSelectionBehavior
  readonly marquee?: FdGraphMarqueeBehavior
  readonly nodeDragging?: boolean
  readonly multipleNodeDragging?: boolean
  readonly nodeResizing?: boolean
  readonly groupResizing?: boolean
  readonly minimumNodeWidth?: number
  readonly minimumNodeHeight?: number
  readonly nodeSizeConstraints?: (node: FdAnyGraphNode) => FdGraphNodeSizeConstraints | undefined
  readonly frameUpdates?: FdGraphFrameUpdateBehavior
  readonly marqueeMinimumDistance?: number
  readonly snapping?: FdGraphSnappingConfiguration
  readonly snappingStrategy?: FdGraphSnappingStrategy
  readonly admitNodeDrag?: (
    request: FdGraphNodeDragAdmissionRequest,
  ) => FdGraphNodeInteractionAdmission
  readonly admitNodeResize?: (
    request: FdGraphNodeResizeAdmissionRequest,
  ) => FdGraphNodeInteractionAdmission
}

export interface FdResolvedGraphGridConfiguration {
  readonly enabled: boolean
  readonly width: number
  readonly height: number
  readonly originX: number
  readonly originY: number
  readonly snapsX: boolean
  readonly snapsY: boolean
  readonly rounding: FdGraphGridRoundingPolicy
}

export interface FdResolvedGraphSnappingConfiguration {
  readonly enabled: boolean
  readonly alignment: boolean
  readonly equalSpacing: boolean
  readonly equalSize: boolean
  readonly grid: FdResolvedGraphGridConfiguration
  readonly acquisitionDistance: number
  readonly releaseDistance: number
  readonly searchRadius: number
  readonly maximumCandidates: number
  readonly showsGuides: boolean
  readonly guideOffset: number
}

export interface FdResolvedGraphCanvasInteractionConfiguration {
  readonly selection: FdGraphSelectionBehavior
  readonly marquee: FdGraphMarqueeBehavior
  readonly nodeDragging: boolean
  readonly multipleNodeDragging: boolean
  readonly nodeResizing: boolean
  readonly groupResizing: boolean
  readonly minimumNodeWidth: number
  readonly minimumNodeHeight: number
  readonly nodeSizeConstraints: (node: FdAnyGraphNode) => FdResolvedGraphNodeSizeConstraints
  readonly frameUpdates: FdGraphFrameUpdateBehavior
  readonly marqueeMinimumDistance: number
  readonly snapping: FdResolvedGraphSnappingConfiguration
  readonly snappingStrategy?: FdGraphSnappingStrategy
  readonly admitNodeDrag: (
    request: FdGraphNodeDragAdmissionRequest,
  ) => FdGraphNodeInteractionAdmission
  readonly admitNodeResize: (
    request: FdGraphNodeResizeAdmissionRequest,
  ) => FdGraphNodeInteractionAdmission
}

const positive = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive`)
  return value
}

const nonnegative = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must not be negative`)
  return value
}

const positiveInteger = (value: number, name: string): number => {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${name} must be positive`)
  return value
}

const resolvedMaximum = (value: number | undefined, minimum: number, name: string) => {
  if (value === undefined) return undefined
  const maximum = positive(value, name)
  if (maximum < minimum) throw new RangeError(`${name} must not be smaller than its minimum`)
  return maximum
}

export function admittedGraphNodeIDs(
  request: FdGraphNodeDragAdmissionRequest,
  admission: FdGraphNodeInteractionAdmission,
): ReadonlySet<FdGraphElementID> {
  if (admission.kind === 'deny') return new Set()
  const candidates = new Set(request.candidateNodes.map(({ id }) => id))
  const admitted =
    admission.kind === 'allowAll'
      ? candidates
      : new Set([...admission.nodeIDs].filter((nodeID) => candidates.has(nodeID)))
  return admitted.has(request.anchorNode.id) ? admitted : new Set()
}

export function resolveGraphCanvasInteractionConfiguration(
  configuration: FdGraphCanvasInteractionConfiguration,
): FdResolvedGraphCanvasInteractionConfiguration {
  const acquisitionDistance = configuration.snapping?.acquisitionDistance ?? 6
  const releaseDistance = configuration.snapping?.releaseDistance ?? 10
  const snappingEnabled = configuration.snapping?.enabled ?? false
  if (releaseDistance < acquisitionDistance) {
    throw new RangeError('snap release distance must not be smaller than acquisition distance')
  }
  const minimumNodeWidth = positive(configuration.minimumNodeWidth ?? 44, 'minimum node width')
  const minimumNodeHeight = positive(configuration.minimumNodeHeight ?? 32, 'minimum node height')
  return {
    selection: configuration.selection ?? 'multiple',
    marquee: configuration.marquee ?? 'intersects',
    nodeDragging: configuration.nodeDragging ?? true,
    multipleNodeDragging: configuration.multipleNodeDragging ?? false,
    nodeResizing: configuration.nodeResizing ?? false,
    groupResizing: configuration.groupResizing ?? true,
    minimumNodeWidth,
    minimumNodeHeight,
    nodeSizeConstraints: (node) => {
      const constraints = configuration.nodeSizeConstraints?.(node)
      const resolvedMinimumWidth = positive(
        constraints?.minimumWidth ?? minimumNodeWidth,
        'minimum node width',
      )
      const resolvedMinimumHeight = positive(
        constraints?.minimumHeight ?? minimumNodeHeight,
        'minimum node height',
      )
      const maximumWidth = resolvedMaximum(
        constraints?.maximumWidth,
        resolvedMinimumWidth,
        'maximum node width',
      )
      const maximumHeight = resolvedMaximum(
        constraints?.maximumHeight,
        resolvedMinimumHeight,
        'maximum node height',
      )
      return {
        minimumWidth: resolvedMinimumWidth,
        minimumHeight: resolvedMinimumHeight,
        ...(maximumWidth === undefined ? {} : { maximumWidth }),
        ...(maximumHeight === undefined ? {} : { maximumHeight }),
      }
    },
    frameUpdates: configuration.frameUpdates ?? 'intent',
    marqueeMinimumDistance: nonnegative(
      configuration.marqueeMinimumDistance ?? 2,
      'marquee minimum distance',
    ),
    ...(configuration.snappingStrategy ? { snappingStrategy: configuration.snappingStrategy } : {}),
    snapping: {
      enabled: snappingEnabled,
      alignment: configuration.snapping?.alignment ?? true,
      equalSpacing: configuration.snapping?.equalSpacing ?? true,
      equalSize: configuration.snapping?.equalSize ?? true,
      grid: {
        enabled: configuration.snapping?.grid?.enabled ?? false,
        width: positive(configuration.snapping?.grid?.width ?? 24, 'grid width'),
        height: positive(configuration.snapping?.grid?.height ?? 24, 'grid height'),
        originX: configuration.snapping?.grid?.originX ?? 0,
        originY: configuration.snapping?.grid?.originY ?? 0,
        snapsX: configuration.snapping?.grid?.snapsX ?? true,
        snapsY: configuration.snapping?.grid?.snapsY ?? true,
        rounding: configuration.snapping?.grid?.rounding ?? 'nearest',
      },
      acquisitionDistance: positive(acquisitionDistance, 'snap acquisition distance'),
      releaseDistance: positive(releaseDistance, 'snap release distance'),
      searchRadius: nonnegative(configuration.snapping?.searchRadius ?? 600, 'snap search radius'),
      maximumCandidates: positiveInteger(
        configuration.snapping?.maximumCandidates ?? 512,
        'maximum snap candidates',
      ),
      showsGuides: configuration.snapping?.showsGuides ?? snappingEnabled,
      guideOffset: nonnegative(configuration.snapping?.guideOffset ?? 8, 'guide offset'),
    },
    admitNodeDrag: configuration.admitNodeDrag ?? (() => ({ kind: 'allowAll' })),
    admitNodeResize: configuration.admitNodeResize ?? (() => ({ kind: 'allowAll' })),
  }
}
