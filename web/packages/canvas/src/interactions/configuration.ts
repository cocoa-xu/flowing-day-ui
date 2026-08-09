import type { FdAnyGraphNode } from '../graph/model.js'
import type { FdGraphSnappingStrategy } from './arrangement.js'

export type FdGraphSelectionBehavior = 'none' | 'single' | 'multiple'
export type FdGraphMarqueeBehavior = 'disabled' | 'intersects' | 'contains'
export type FdGraphGridRoundingPolicy = 'nearest' | 'down' | 'up'
export type FdGraphFrameUpdateBehavior = 'intent' | 'local'
export type FdGraphCanvasTool = 'select' | 'pan'

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
  readonly grid?: FdGraphGridConfiguration
  readonly acquisitionDistance?: number
  readonly releaseDistance?: number
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
  readonly frameUpdates?: FdGraphFrameUpdateBehavior
  readonly snapping?: FdGraphSnappingConfiguration
  readonly snappingStrategy?: FdGraphSnappingStrategy
  readonly canDragNodes?: (nodes: readonly FdAnyGraphNode[]) => boolean
  readonly canResizeNodes?: (nodes: readonly FdAnyGraphNode[]) => boolean
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
  readonly grid: FdResolvedGraphGridConfiguration
  readonly acquisitionDistance: number
  readonly releaseDistance: number
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
  readonly frameUpdates: FdGraphFrameUpdateBehavior
  readonly snapping: FdResolvedGraphSnappingConfiguration
  readonly snappingStrategy?: FdGraphSnappingStrategy
  readonly canDragNodes: (nodes: readonly FdAnyGraphNode[]) => boolean
  readonly canResizeNodes: (nodes: readonly FdAnyGraphNode[]) => boolean
}

const positive = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive`)
  return value
}

export function resolveGraphCanvasInteractionConfiguration(
  configuration: FdGraphCanvasInteractionConfiguration,
): FdResolvedGraphCanvasInteractionConfiguration {
  const acquisitionDistance = configuration.snapping?.acquisitionDistance ?? 6
  const releaseDistance = configuration.snapping?.releaseDistance ?? 10
  if (releaseDistance < acquisitionDistance) {
    throw new RangeError('snap release distance must not be smaller than acquisition distance')
  }
  return {
    selection: configuration.selection ?? 'multiple',
    marquee: configuration.marquee ?? 'intersects',
    nodeDragging: configuration.nodeDragging ?? true,
    multipleNodeDragging: configuration.multipleNodeDragging ?? true,
    nodeResizing: configuration.nodeResizing ?? true,
    groupResizing: configuration.groupResizing ?? true,
    minimumNodeWidth: positive(configuration.minimumNodeWidth ?? 40, 'minimum node width'),
    minimumNodeHeight: positive(configuration.minimumNodeHeight ?? 32, 'minimum node height'),
    frameUpdates: configuration.frameUpdates ?? 'intent',
    ...(configuration.snappingStrategy ? { snappingStrategy: configuration.snappingStrategy } : {}),
    snapping: {
      enabled: configuration.snapping?.enabled ?? true,
      alignment: configuration.snapping?.alignment ?? true,
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
    },
    canDragNodes: configuration.canDragNodes ?? (() => true),
    canResizeNodes: configuration.canResizeNodes ?? (() => true),
  }
}
