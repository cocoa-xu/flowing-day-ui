import type { FdGraphCanvasAccessibilityConfiguration } from '../accessibility/configuration.js'
import {
  type FdCanvasConfiguration,
  resolveCanvasConfiguration,
} from '../configuration.js'
import type { FdCanvasPoint, FdCanvasSize } from '../geometry.js'
import type { FdGraphKeyboardSelectionBehavior } from '../interactions/keyboard.js'
import type { FdGraphRenderingBackendPreference } from '../rendering/backend.js'

export type FdGraphCanvasNodeDraggingMode = 'disabled' | 'single' | 'multiple'

export interface FdGraphCanvasNodeResizingConfiguration {
  readonly isEnabled: boolean
  readonly minimumSize?: FdCanvasSize
}

export interface FdGraphCanvasConnectionEditingConfiguration {
  readonly isEnabled: boolean
  readonly allowsReconnection?: boolean
  readonly targetHitRadius?: number
  readonly sourceHitPadding?: number
  readonly minimumDragDistance?: number
  readonly rendersDefaultPreview?: boolean
}

export type FdGraphCanvasGridAxis = 'x' | 'y'
export type FdGraphCanvasGridRoundingPolicy =
  | 'nearest'
  | 'down'
  | 'up'
  | 'towardZero'
  | 'awayFromZero'

export interface FdGraphCanvasGridSubdivisions {
  readonly x?: number
  readonly y?: number
}

export interface FdGraphCanvasGridConfiguration {
  readonly origin?: FdCanvasPoint
  readonly majorCellSize: FdCanvasSize
  readonly subdivisions?: FdGraphCanvasGridSubdivisions
  readonly enabledAxes?: ReadonlySet<FdGraphCanvasGridAxis>
  readonly roundingPolicy?: FdGraphCanvasGridRoundingPolicy
}

export type FdGraphCanvasSnapTarget = 'alignment' | 'grid' | 'equalSpacing' | 'equalSize'

export interface FdGraphCanvasSnappingConfiguration {
  readonly isEnabled: boolean
  readonly targets?: ReadonlySet<FdGraphCanvasSnapTarget>
  readonly tolerance?: number
  readonly searchRadius?: number
  readonly maximumCandidates?: number
  readonly grid?: FdGraphCanvasGridConfiguration
  readonly showsGuides?: boolean
  readonly guideOffset?: number
  readonly releaseTolerance?: number
}

export interface FdGraphCanvasKeyboardNavigationConfiguration {
  readonly isEnabled?: boolean
  readonly selectionBehavior?: FdGraphKeyboardSelectionBehavior
  readonly keepsFocusedNodeVisible?: boolean
}

export interface FdGraphCanvasKeyboardNudgingConfiguration {
  readonly isEnabled?: boolean
  readonly step?: number
  readonly largeStep?: number
}

export interface FdGraphCanvasConfiguration {
  readonly renderingBackend?: FdGraphRenderingBackendPreference
  readonly canvas?: Partial<FdCanvasConfiguration>
  readonly edgeRenderPadding?: number
  readonly marqueeMinimumDistance?: number
  readonly nodeDraggingMode?: FdGraphCanvasNodeDraggingMode
  readonly nodeResizing?: FdGraphCanvasNodeResizingConfiguration
  readonly connectionEditing?: FdGraphCanvasConnectionEditingConfiguration
  readonly snapping?: FdGraphCanvasSnappingConfiguration
  readonly rendersDefaultGuides?: boolean
  readonly allowsArrangementCommands?: boolean
  readonly keyboardNavigation?: FdGraphCanvasKeyboardNavigationConfiguration
  readonly keyboardNudging?: FdGraphCanvasKeyboardNudgingConfiguration
  readonly accessibility?: FdGraphCanvasAccessibilityConfiguration
}

export interface FdResolvedGraphCanvasConfiguration {
  readonly renderingBackend: FdGraphRenderingBackendPreference
  readonly canvas: FdCanvasConfiguration
  readonly edgeRenderPadding: number
  readonly marqueeMinimumDistance: number
  readonly nodeDraggingMode: FdGraphCanvasNodeDraggingMode
  readonly nodeResizing: Required<FdGraphCanvasNodeResizingConfiguration>
  readonly connectionEditing: Required<FdGraphCanvasConnectionEditingConfiguration>
  readonly snapping: Omit<Required<FdGraphCanvasSnappingConfiguration>, 'grid'> & {
    readonly grid?: FdGraphCanvasGridConfiguration
  }
  readonly rendersDefaultGuides: boolean
  readonly allowsArrangementCommands: boolean
  readonly keyboardNavigation: Required<FdGraphCanvasKeyboardNavigationConfiguration>
  readonly keyboardNudging: Required<FdGraphCanvasKeyboardNudgingConfiguration>
  readonly accessibility: FdGraphCanvasAccessibilityConfiguration
}

const nonnegative = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must not be negative`)
  return value
}

const positive = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive`)
  return value
}

const positiveInteger = (value: number, name: string): number => {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${name} must be positive`)
  return value
}

export function resolveGraphCanvasConfiguration(
  configuration: FdGraphCanvasConfiguration = {},
): FdResolvedGraphCanvasConfiguration {
  const minimumSize = configuration.nodeResizing?.minimumSize ?? { width: 44, height: 32 }
  const step = positive(configuration.keyboardNudging?.step ?? 1, 'keyboard nudge step')
  const largeStep = positive(
    configuration.keyboardNudging?.largeStep ?? 10,
    'large keyboard nudge step',
  )
  if (largeStep < step) {
    throw new RangeError('large keyboard nudge step must not be smaller than the standard step')
  }
  const snapTolerance = nonnegative(configuration.snapping?.tolerance ?? 6, 'snap tolerance')
  const snapReleaseTolerance = nonnegative(
    configuration.snapping?.releaseTolerance ?? Math.max(snapTolerance, 10),
    'snap release tolerance',
  )
  if (snapReleaseTolerance < snapTolerance) {
    throw new RangeError('snap release tolerance must not be smaller than snap tolerance')
  }
  return {
    renderingBackend: configuration.renderingBackend ?? 'automatic',
    canvas: resolveCanvasConfiguration(configuration.canvas ?? {}),
    edgeRenderPadding: nonnegative(configuration.edgeRenderPadding ?? 12, 'edge render padding'),
    marqueeMinimumDistance: nonnegative(
      configuration.marqueeMinimumDistance ?? 2,
      'marquee minimum distance',
    ),
    nodeDraggingMode: configuration.nodeDraggingMode ?? 'single',
    nodeResizing: {
      isEnabled: configuration.nodeResizing?.isEnabled ?? false,
      minimumSize: {
        width: positive(minimumSize.width, 'minimum node width'),
        height: positive(minimumSize.height, 'minimum node height'),
      },
    },
    connectionEditing: {
      isEnabled: configuration.connectionEditing?.isEnabled ?? false,
      allowsReconnection: configuration.connectionEditing?.allowsReconnection ?? true,
      targetHitRadius: positive(
        configuration.connectionEditing?.targetHitRadius ?? 18,
        'connection target hit radius',
      ),
      sourceHitPadding: nonnegative(
        configuration.connectionEditing?.sourceHitPadding ?? 6,
        'connection source hit padding',
      ),
      minimumDragDistance: nonnegative(
        configuration.connectionEditing?.minimumDragDistance ?? 2,
        'connection minimum drag distance',
      ),
      rendersDefaultPreview: configuration.connectionEditing?.rendersDefaultPreview ?? true,
    },
    snapping: {
      isEnabled: configuration.snapping?.isEnabled ?? false,
      targets:
        configuration.snapping?.targets ??
        new Set<FdGraphCanvasSnapTarget>(['alignment', 'grid', 'equalSpacing', 'equalSize']),
      tolerance: snapTolerance,
      searchRadius: nonnegative(configuration.snapping?.searchRadius ?? 600, 'snap search radius'),
      maximumCandidates: positiveInteger(
        configuration.snapping?.maximumCandidates ?? 512,
        'maximum snap candidates',
      ),
      ...(configuration.snapping?.grid ? { grid: configuration.snapping.grid } : {}),
      showsGuides:
        configuration.snapping?.showsGuides ?? (configuration.snapping?.isEnabled ?? false),
      guideOffset: nonnegative(configuration.snapping?.guideOffset ?? 8, 'snap guide offset'),
      releaseTolerance: snapReleaseTolerance,
    },
    rendersDefaultGuides: configuration.rendersDefaultGuides ?? true,
    allowsArrangementCommands: configuration.allowsArrangementCommands ?? true,
    keyboardNavigation: {
      isEnabled: configuration.keyboardNavigation?.isEnabled ?? true,
      selectionBehavior: configuration.keyboardNavigation?.selectionBehavior ?? 'replace',
      keepsFocusedNodeVisible: configuration.keyboardNavigation?.keepsFocusedNodeVisible ?? true,
    },
    keyboardNudging: {
      isEnabled: configuration.keyboardNudging?.isEnabled ?? true,
      step,
      largeStep,
    },
    accessibility: configuration.accessibility ?? {},
  }
}
