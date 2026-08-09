import type { FdCanvasRect, FdCanvasSize } from '../geometry.js'
import { unionCanvasRects } from '../geometry.js'
import type { FdGraphElementID } from '../graph/model.js'
import type {
  FdGraphGridRoundingPolicy,
  FdResolvedGraphSnappingConfiguration,
} from './configuration.js'

export type FdGraphGuideAxis = 'horizontal' | 'vertical'
export type FdGraphGuideKind = 'alignment' | 'grid' | 'resize'
export type FdGraphResizeHandle =
  | 'top'
  | 'topRight'
  | 'right'
  | 'bottomRight'
  | 'bottom'
  | 'bottomLeft'
  | 'left'
  | 'topLeft'

type FdGraphAnchor = 'minimum' | 'center' | 'maximum'
const graphAnchors: readonly FdGraphAnchor[] = ['minimum', 'center', 'maximum']

export interface FdGraphGuide {
  readonly axis: FdGraphGuideAxis
  readonly position: number
  readonly lowerBound: number
  readonly upperBound: number
  readonly kind: FdGraphGuideKind
}

interface FdGraphSnapAxisState {
  readonly anchor: FdGraphAnchor
  readonly target: number
  readonly kind: FdGraphGuideKind
}

export interface FdGraphSnapState {
  readonly x?: FdGraphSnapAxisState
  readonly y?: FdGraphSnapAxisState
}

export interface FdGraphSnapCandidate {
  readonly id: FdGraphElementID
  readonly frame: FdCanvasRect
}

export interface FdGraphTranslationSnapResult {
  readonly translation: FdCanvasSize
  readonly guides: readonly FdGraphGuide[]
  readonly state: FdGraphSnapState
}

export interface FdGraphResizeResult {
  readonly bounds: FdCanvasRect
  readonly frames: ReadonlyMap<FdGraphElementID, FdCanvasRect>
}

const axisAnchors = (minimum: number, length: number): Record<FdGraphAnchor, number> => ({
  minimum,
  center: minimum + length / 2,
  maximum: minimum + length,
})

const roundedGridValue = (
  value: number,
  origin: number,
  spacing: number,
  rounding: FdGraphGridRoundingPolicy,
): number => {
  const scaled = (value - origin) / spacing
  const rounded =
    rounding === 'down'
      ? Math.floor(scaled)
      : rounding === 'up'
        ? Math.ceil(scaled)
        : Math.round(scaled)
  return origin + rounded * spacing
}

interface AxisCandidate {
  readonly correction: number
  readonly state: FdGraphSnapAxisState
  readonly guide: FdGraphGuide
}

interface AxisCandidateSeed {
  readonly correction: number
  readonly state: FdGraphSnapAxisState
}

const axisCandidate = (
  axis: 'x' | 'y',
  movingBounds: FdCanvasRect,
  candidates: readonly FdGraphSnapCandidate[],
  configuration: FdResolvedGraphSnappingConfiguration,
  zoom: number,
  previous: FdGraphSnapAxisState | undefined,
): AxisCandidate | undefined => {
  const moving =
    axis === 'x'
      ? axisAnchors(movingBounds.x, movingBounds.width)
      : axisAnchors(movingBounds.y, movingBounds.height)
  if (previous) {
    const correction = previous.target - moving[previous.anchor]
    if (Math.abs(correction) * zoom <= configuration.releaseDistance) {
      return {
        correction,
        state: previous,
        guide: guideFor(axis, previous.target, movingBounds, candidates, previous.kind),
      }
    }
  }

  let best: AxisCandidateSeed | undefined
  const consider = (candidate: AxisCandidateSeed): void => {
    if (!best || Math.abs(candidate.correction) < Math.abs(best.correction)) best = candidate
  }
  if (configuration.alignment) {
    for (const candidate of candidates) {
      const anchors =
        axis === 'x'
          ? axisAnchors(candidate.frame.x, candidate.frame.width)
          : axisAnchors(candidate.frame.y, candidate.frame.height)
      for (const movingAnchor of graphAnchors) {
        for (const targetAnchor of graphAnchors) {
          const target = anchors[targetAnchor]
          const correction = target - moving[movingAnchor]
          if (Math.abs(correction) * zoom > configuration.acquisitionDistance) continue
          consider({
            correction,
            state: { anchor: movingAnchor, target, kind: 'alignment' },
          })
        }
      }
    }
  }

  const grid = configuration.grid
  if (grid.enabled && (axis === 'x' ? grid.snapsX : grid.snapsY)) {
    const spacing = axis === 'x' ? grid.width : grid.height
    const origin = axis === 'x' ? grid.originX : grid.originY
    for (const movingAnchor of graphAnchors) {
      const target = roundedGridValue(moving[movingAnchor], origin, spacing, grid.rounding)
      const correction = target - moving[movingAnchor]
      if (Math.abs(correction) * zoom > configuration.acquisitionDistance) continue
      consider({
        correction,
        state: { anchor: movingAnchor, target, kind: 'grid' },
      })
    }
  }
  if (!best) return undefined
  return {
    ...best,
    guide: guideFor(axis, best.state.target, movingBounds, candidates, best.state.kind),
  }
}

const guideFor = (
  axis: 'x' | 'y',
  position: number,
  movingBounds: FdCanvasRect,
  candidates: readonly FdGraphSnapCandidate[],
  kind: FdGraphGuideKind,
): FdGraphGuide => {
  let lower = axis === 'x' ? movingBounds.y : movingBounds.x
  let upper =
    axis === 'x' ? movingBounds.y + movingBounds.height : movingBounds.x + movingBounds.width
  for (const { frame } of candidates) {
    const anchors =
      axis === 'x' ? axisAnchors(frame.x, frame.width) : axisAnchors(frame.y, frame.height)
    if (!graphAnchors.some((anchor) => Math.abs(anchors[anchor] - position) < 0.001)) continue
    lower = Math.min(lower, axis === 'x' ? frame.y : frame.x)
    upper = Math.max(upper, axis === 'x' ? frame.y + frame.height : frame.x + frame.width)
  }
  return {
    axis: axis === 'x' ? 'vertical' : 'horizontal',
    position,
    lowerBound: lower,
    upperBound: upper,
    kind,
  }
}

export function snapGraphTranslation(
  movingBounds: FdCanvasRect,
  proposedTranslation: FdCanvasSize,
  candidates: readonly FdGraphSnapCandidate[],
  configuration: FdResolvedGraphSnappingConfiguration,
  zoom: number,
  previous: FdGraphSnapState = {},
): FdGraphTranslationSnapResult {
  if (!configuration.enabled) return { translation: proposedTranslation, guides: [], state: {} }
  const proposedBounds = {
    ...movingBounds,
    x: movingBounds.x + proposedTranslation.width,
    y: movingBounds.y + proposedTranslation.height,
  }
  const x = axisCandidate('x', proposedBounds, candidates, configuration, zoom, previous.x)
  const y = axisCandidate('y', proposedBounds, candidates, configuration, zoom, previous.y)
  return {
    translation: {
      width: proposedTranslation.width + (x?.correction ?? 0),
      height: proposedTranslation.height + (y?.correction ?? 0),
    },
    guides: [x?.guide, y?.guide].filter((guide): guide is FdGraphGuide => guide !== undefined),
    state: { ...(x ? { x: x.state } : {}), ...(y ? { y: y.state } : {}) },
  }
}

export function graphSelectionBounds(
  frames: ReadonlyMap<FdGraphElementID, FdCanvasRect>,
): FdCanvasRect | undefined {
  let bounds: FdCanvasRect | undefined
  for (const frame of frames.values()) bounds = unionCanvasRects(bounds, frame)
  return bounds
}

export function resizeGraphBounds(
  bounds: FdCanvasRect,
  handle: FdGraphResizeHandle,
  translation: FdCanvasSize,
  minimumSize: FdCanvasSize,
  preservesAspectRatio: boolean,
  resizesFromCenter: boolean,
): FdCanvasRect {
  const movesLeft = handle.includes('Left') || handle === 'left'
  const movesRight = handle.includes('Right') || handle === 'right'
  const movesTop = handle.startsWith('top')
  const movesBottom = handle.startsWith('bottom')
  let left = bounds.x + (movesLeft ? translation.width : 0)
  let right = bounds.x + bounds.width + (movesRight ? translation.width : 0)
  let top = bounds.y + (movesTop ? translation.height : 0)
  let bottom = bounds.y + bounds.height + (movesBottom ? translation.height : 0)
  if (resizesFromCenter) {
    if (movesLeft) right -= translation.width
    if (movesRight) left -= translation.width
    if (movesTop) bottom -= translation.height
    if (movesBottom) top -= translation.height
  }
  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2
  let width = Math.max(right - left, minimumSize.width)
  let height = Math.max(bottom - top, minimumSize.height)
  if (preservesAspectRatio && bounds.height > 0) {
    const ratio = bounds.width / bounds.height
    if (Math.abs(width / bounds.width - 1) >= Math.abs(height / bounds.height - 1))
      height = width / ratio
    else width = height * ratio
  }
  if (movesLeft && !movesRight) left = right - width
  else if (movesRight && !movesLeft) right = left + width
  else {
    left = centerX - width / 2
    right = centerX + width / 2
  }
  if (movesTop && !movesBottom) top = bottom - height
  else if (movesBottom && !movesTop) bottom = top + height
  else {
    top = centerY - height / 2
    bottom = centerY + height / 2
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function scaleGraphFrames(
  frames: ReadonlyMap<FdGraphElementID, FdCanvasRect>,
  sourceBounds: FdCanvasRect,
  targetBounds: FdCanvasRect,
): ReadonlyMap<FdGraphElementID, FdCanvasRect> {
  const scaleX = sourceBounds.width === 0 ? 1 : targetBounds.width / sourceBounds.width
  const scaleY = sourceBounds.height === 0 ? 1 : targetBounds.height / sourceBounds.height
  return new Map(
    [...frames].map(([id, frame]) => [
      id,
      {
        x: targetBounds.x + (frame.x - sourceBounds.x) * scaleX,
        y: targetBounds.y + (frame.y - sourceBounds.y) * scaleY,
        width: frame.width * scaleX,
        height: frame.height * scaleY,
      },
    ]),
  )
}
