import type { FdCanvasRect } from './geometry.js'

export type FdCanvasInteractionMode = 'content' | 'pan'
export type FdCanvasViewportChangePhase = 'continuous' | 'ended'

export interface FdCanvasConfiguration {
  readonly initialZoom: number
  readonly focusedZoom: number
  readonly minimumZoom: number
  readonly maximumZoom: number
  readonly pinchSensitivity: number
  readonly discreteScrollMultiplier: number
  readonly renderOverscan: number
  readonly renderRetentionRatio: number
  readonly dragMinimumDistance: number
  readonly viewportAnimationDuration: number
  readonly smartMagnifyZoomTolerance: number
}

export const defaultCanvasConfiguration: FdCanvasConfiguration = {
  initialZoom: 1,
  focusedZoom: 1,
  minimumZoom: 0.25,
  maximumZoom: 4,
  pinchSensitivity: 1,
  discreteScrollMultiplier: 12,
  renderOverscan: 320,
  renderRetentionRatio: 0.45,
  dragMinimumDistance: 2,
  viewportAnimationDuration: 250,
  smartMagnifyZoomTolerance: 0.04,
}

export const resolveCanvasConfiguration = (
  configuration: Partial<FdCanvasConfiguration>,
): FdCanvasConfiguration => {
  const resolved = { ...defaultCanvasConfiguration, ...configuration }
  const positive = [
    resolved.initialZoom,
    resolved.focusedZoom,
    resolved.minimumZoom,
    resolved.maximumZoom,
    resolved.pinchSensitivity,
    resolved.discreteScrollMultiplier,
  ]
  if (positive.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new RangeError('canvas zoom and input values must be finite and positive')
  }
  if (resolved.minimumZoom > resolved.maximumZoom) {
    throw new RangeError('canvas zoom range is inverted')
  }
  if (!Number.isFinite(resolved.renderOverscan) || resolved.renderOverscan < 0) {
    throw new RangeError('render overscan must be finite and nonnegative')
  }
  if (
    !Number.isFinite(resolved.renderRetentionRatio) ||
    resolved.renderRetentionRatio < 0 ||
    resolved.renderRetentionRatio > 1
  ) {
    throw new RangeError('render retention ratio must be between zero and one')
  }
  if (!Number.isFinite(resolved.dragMinimumDistance) || resolved.dragMinimumDistance < 0) {
    throw new RangeError('drag minimum distance must be finite and nonnegative')
  }
  if (
    !Number.isFinite(resolved.viewportAnimationDuration) ||
    resolved.viewportAnimationDuration < 0
  ) {
    throw new RangeError('viewport animation duration must be finite and nonnegative')
  }
  if (
    !Number.isFinite(resolved.smartMagnifyZoomTolerance) ||
    resolved.smartMagnifyZoomTolerance < 0
  ) {
    throw new RangeError('smart magnify tolerance must be finite and nonnegative')
  }
  return resolved
}

export type FdCanvasContentChangeBehavior =
  | { readonly kind: 'preserveViewport' }
  | { readonly kind: 'center' }
  | {
      readonly kind: 'fit'
      readonly padding: number
      readonly maximumZoom?: number
    }

export type FdCanvasViewportAction =
  | {
      readonly kind: 'anchor'
      readonly worldPoint: { readonly x: number; readonly y: number }
      readonly viewportPoint: { readonly x: number; readonly y: number }
      readonly zoom: number
    }
  | { readonly kind: 'focus'; readonly rect: FdCanvasRect; readonly zoom?: number }
  | {
      readonly kind: 'fit'
      readonly rect: FdCanvasRect
      readonly padding: number
      readonly maximumZoom?: number
    }
  | { readonly kind: 'restore' }
  | { readonly kind: 'none' }

export interface FdCanvasRequest {
  readonly id: string | number
  readonly action: FdCanvasViewportAction
  readonly animated?: boolean
  readonly animationDuration?: number
}
