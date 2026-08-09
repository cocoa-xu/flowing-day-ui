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

  const options: AxisCandidate[] = []
  if (configuration.alignment) {
    for (const candidate of candidates) {
      const anchors =
        axis === 'x'
          ? axisAnchors(candidate.frame.x, candidate.frame.width)
          : axisAnchors(candidate.frame.y, candidate.frame.height)
      for (const movingAnchor of Object.keys(moving) as FdGraphAnchor[]) {
        for (const target of Object.values(anchors)) {
          const correction = target - moving[movingAnchor]
          if (Math.abs(correction) * zoom > configuration.acquisitionDistance) continue
          options.push({
            correction,
            state: { anchor: movingAnchor, target, kind: 'alignment' },
            guide: guideFor(axis, target, movingBounds, candidates, 'alignment'),
          })
        }
      }
    }
  }

  const grid = configuration.grid
  if (grid.enabled && (axis === 'x' ? grid.snapsX : grid.snapsY)) {
    const spacing = axis === 'x' ? grid.width : grid.height
    const origin = axis === 'x' ? grid.originX : grid.originY
    for (const movingAnchor of Object.keys(moving) as FdGraphAnchor[]) {
      const target = roundedGridValue(moving[movingAnchor], origin, spacing, grid.rounding)
      const correction = target - moving[movingAnchor]
      if (Math.abs(correction) * zoom > configuration.acquisitionDistance) continue
      options.push({
        correction,
        state: { anchor: movingAnchor, target, kind: 'grid' },
        guide: guideFor(axis, target, movingBounds, [], 'grid'),
      })
    }
  }
  return options.sort(
    (first, second) => Math.abs(first.correction) - Math.abs(second.correction),
  )[0]
}

const guideFor = (
  axis: 'x' | 'y',
  position: number,
  movingBounds: FdCanvasRect,
  candidates: readonly FdGraphSnapCandidate[],
  kind: FdGraphGuideKind,
): FdGraphGuide => {
  const related = candidates.filter(({ frame }) => {
    const anchors =
      axis === 'x'
        ? Object.values(axisAnchors(frame.x, frame.width))
        : Object.values(axisAnchors(frame.y, frame.height))
    return anchors.some((value) => Math.abs(value - position) < 0.001)
  })
  const lower =
    axis === 'x'
      ? Math.min(movingBounds.y, ...related.map(({ frame }) => frame.y))
      : Math.min(movingBounds.x, ...related.map(({ frame }) => frame.x))
  const upper =
    axis === 'x'
      ? Math.max(
          movingBounds.y + movingBounds.height,
          ...related.map(({ frame }) => frame.y + frame.height),
        )
      : Math.max(
          movingBounds.x + movingBounds.width,
          ...related.map(({ frame }) => frame.x + frame.width),
        )
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
