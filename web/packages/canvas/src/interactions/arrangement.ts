import type { FdCanvasPoint, FdCanvasRect, FdCanvasSize } from '../geometry.js'
import { unionCanvasRects } from '../geometry.js'
import type { FdGraphElementID } from '../graph/model.js'
import type {
  FdGraphGridRoundingPolicy,
  FdResolvedGraphSnappingConfiguration,
} from './configuration.js'

export type FdGraphGuideAxis = 'horizontal' | 'vertical'
export type FdGraphGuideKind = 'alignment' | 'equalSpacing' | 'equalSize' | 'grid' | 'resize'
export type FdGraphAlignment =
  | 'left'
  | 'horizontalCenter'
  | 'right'
  | 'top'
  | 'verticalCenter'
  | 'bottom'
export type FdGraphDistribution = 'horizontal' | 'vertical'
export type FdGraphArrangementAction =
  | { readonly kind: 'align'; readonly alignment: FdGraphAlignment }
  | { readonly kind: 'distribute'; readonly distribution: FdGraphDistribution }
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
  readonly measurement?: number
}

interface FdGraphSnapAxisState {
  readonly anchor: FdGraphAnchor
  readonly target: number
  readonly kind: FdGraphGuideKind
  readonly candidateFrame?: FdCanvasRect
  readonly spacingReferenceFrames?: readonly FdCanvasRect[]
  readonly guideOffset?: number
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

export interface FdGraphTranslationSnapRequest {
  readonly movingBounds: FdCanvasRect
  readonly proposedTranslation: FdCanvasSize
  readonly candidates: readonly FdGraphSnapCandidate[]
  readonly configuration: FdResolvedGraphSnappingConfiguration
  readonly zoom: number
  readonly previous: FdGraphSnapState
}

export interface FdGraphResizeSnapRequest {
  readonly baseFrames: ReadonlyMap<FdGraphElementID, FdCanvasRect>
  readonly baseBounds: FdCanvasRect
  readonly proposedBounds: FdCanvasRect
  readonly proposedTranslation: FdCanvasSize
  readonly handle: FdGraphResizeHandle
  readonly candidates: readonly FdGraphSnapCandidate[]
  readonly configuration: FdResolvedGraphSnappingConfiguration
  readonly minimumSize: FdCanvasSize
  readonly zoom: number
  readonly previous: FdGraphSnapState
  readonly preservesAspectRatio: boolean
  readonly resizesFromCenter: boolean
}

export interface FdGraphResizeSnapResult extends FdGraphResizeResult {
  readonly guides: readonly FdGraphGuide[]
  readonly state: FdGraphSnapState
}

export interface FdGraphSnappingStrategy {
  readonly translation?: (request: FdGraphTranslationSnapRequest) => FdGraphTranslationSnapResult
  readonly resize?: (request: FdGraphResizeSnapRequest) => FdGraphResizeSnapResult
}

export interface FdGraphResizeResult {
  readonly bounds: FdCanvasRect
  readonly frames: ReadonlyMap<FdGraphElementID, FdCanvasRect>
}

export interface FdGraphNodeGeometry {
  readonly id: FdGraphElementID
  readonly frame: FdCanvasRect
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
        : rounding === 'towardZero'
          ? Math.trunc(scaled)
          : rounding === 'awayFromZero'
            ? scaled < 0
              ? Math.floor(scaled)
              : Math.ceil(scaled)
            : Math.round(scaled)
  return origin + rounded * spacing
}

interface AxisCandidate {
  readonly correction: number
  readonly state: FdGraphSnapAxisState
  readonly guides: readonly FdGraphGuide[]
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
      const snappedBounds =
        axis === 'x'
          ? { ...movingBounds, x: movingBounds.x + correction }
          : { ...movingBounds, y: movingBounds.y + correction }
      return {
        correction,
        state: previous,
        guides: guidesForState(axis, previous, snappedBounds, candidates),
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
            state: {
              anchor: movingAnchor,
              target,
              kind: 'alignment',
              candidateFrame: candidate.frame,
            },
          })
        }
      }
    }
  }

  if (configuration.equalSpacing) {
    const spacing = equalSpacingAxisCandidate(
      axis,
      movingBounds,
      candidates,
      configuration.acquisitionDistance / zoom,
      configuration.guideOffset / zoom,
    )
    if (spacing) consider(spacing)
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
  const snappedBounds =
    axis === 'x'
      ? { ...movingBounds, x: movingBounds.x + best.correction }
      : { ...movingBounds, y: movingBounds.y + best.correction }
  return {
    ...best,
    guides: guidesForState(axis, best.state, snappedBounds, candidates),
  }
}

const equalSpacingAxisCandidate = (
  axis: 'x' | 'y',
  movingFrame: FdCanvasRect,
  candidates: readonly FdGraphSnapCandidate[],
  tolerance: number,
  guideOffset: number,
): AxisCandidateSeed | undefined => {
  const lower = (frame: FdCanvasRect): number => (axis === 'x' ? frame.x : frame.y)
  const length = (frame: FdCanvasRect): number => (axis === 'x' ? frame.width : frame.height)
  const upper = (frame: FdCanvasRect): number => lower(frame) + length(frame)
  const frames = candidates
    .map(({ frame }) => frame)
    .sort((first, second) => lower(first) - lower(second) || upper(first) - upper(second))
  if (frames.length < 2) return undefined
  const movingLower = lower(movingFrame)
  const movingUpper = upper(movingFrame)
  const before = frames.filter((frame) => upper(frame) <= movingLower + tolerance)
  const after = frames.filter((frame) => lower(frame) >= movingUpper - tolerance)
  const results: AxisCandidateSeed[] = []
  const add = (target: number, references: readonly FdCanvasRect[]): void => {
    const correction = target - movingLower
    if (Math.abs(correction) > tolerance) return
    results.push({
      correction,
      state: {
        anchor: 'minimum',
        target,
        kind: 'equalSpacing',
        spacingReferenceFrames: references,
        guideOffset,
      },
    })
  }
  const previous = before.at(-1)
  const next = after[0]
  if (previous && next) {
    const available = lower(next) - upper(previous) - length(movingFrame)
    if (available >= 0) add(upper(previous) + available / 2, [previous, next])
  }
  const beforeChain = nearestEqualSpacingChain(before, lower, upper, tolerance, true)
  const beforeLast = beforeChain?.at(-1)
  if (beforeChain && beforeLast)
    add(upper(beforeLast) + chainGap(beforeChain, lower, upper), beforeChain)
  const afterChain = nearestEqualSpacingChain(after, lower, upper, tolerance, false)
  const afterFirst = afterChain?.[0]
  if (afterChain && afterFirst) {
    add(lower(afterFirst) - chainGap(afterChain, lower, upper) - length(movingFrame), afterChain)
  }
  return results.reduce<AxisCandidateSeed | undefined>(
    (best, candidate) =>
      !best || Math.abs(candidate.correction) < Math.abs(best.correction) ? candidate : best,
    undefined,
  )
}

const nearestEqualSpacingChain = (
  frames: readonly FdCanvasRect[],
  lower: (frame: FdCanvasRect) => number,
  upper: (frame: FdCanvasRect) => number,
  tolerance: number,
  fromEnd: boolean,
): readonly FdCanvasRect[] | undefined => {
  if (frames.length < 2) return undefined
  let pairIndex = -1
  if (fromEnd) {
    for (let index = frames.length - 2; index >= 0; index -= 1) {
      const first = frames[index]
      const second = frames[index + 1]
      if (first && second && upper(first) <= lower(second)) {
        pairIndex = index
        break
      }
    }
  } else {
    pairIndex = frames.findIndex((frame, index) => {
      const next = frames[index + 1]
      return next !== undefined && upper(frame) <= lower(next)
    })
  }
  if (pairIndex < 0) return undefined
  const first = frames[pairIndex]
  const second = frames[pairIndex + 1]
  if (!first || !second) return undefined
  const gap = lower(second) - upper(first)
  let lowerIndex = pairIndex
  let upperIndex = pairIndex + 1
  while (lowerIndex > 0) {
    const previous = frames[lowerIndex - 1]
    const current = frames[lowerIndex]
    if (!previous || !current) break
    const candidateGap = lower(current) - upper(previous)
    if (candidateGap < 0 || Math.abs(candidateGap - gap) > tolerance) break
    lowerIndex -= 1
  }
  while (upperIndex + 1 < frames.length) {
    const current = frames[upperIndex]
    const next = frames[upperIndex + 1]
    if (!current || !next) break
    const candidateGap = lower(next) - upper(current)
    if (candidateGap < 0 || Math.abs(candidateGap - gap) > tolerance) break
    upperIndex += 1
  }
  return frames.slice(lowerIndex, upperIndex + 1)
}

const chainGap = (
  frames: readonly FdCanvasRect[],
  lower: (frame: FdCanvasRect) => number,
  upper: (frame: FdCanvasRect) => number,
): number => {
  if (frames.length < 2) return 0
  let total = 0
  for (let index = 0; index < frames.length - 1; index += 1) {
    const current = frames[index]
    const next = frames[index + 1]
    if (current && next) total += lower(next) - upper(current)
  }
  return total / (frames.length - 1)
}

const guidesForState = (
  axis: 'x' | 'y',
  state: FdGraphSnapAxisState,
  movingFrame: FdCanvasRect,
  candidates: readonly FdGraphSnapCandidate[],
): readonly FdGraphGuide[] => {
  if (state.kind === 'equalSpacing') {
    return spacingGuides(
      axis,
      movingFrame,
      state.spacingReferenceFrames ?? [],
      state.guideOffset ?? 0,
    )
  }
  return [
    guideFor(
      axis,
      state.target,
      movingFrame,
      state.candidateFrame ? [{ id: '', frame: state.candidateFrame }] : candidates,
      state.kind,
    ),
  ]
}

const spacingGuides = (
  axis: 'x' | 'y',
  movingFrame: FdCanvasRect,
  referenceFrames: readonly FdCanvasRect[],
  guideOffset: number,
): readonly FdGraphGuide[] => {
  const lower = (frame: FdCanvasRect): number => (axis === 'x' ? frame.x : frame.y)
  const length = (frame: FdCanvasRect): number => (axis === 'x' ? frame.width : frame.height)
  const upper = (frame: FdCanvasRect): number => lower(frame) + length(frame)
  const crossUpper = (frame: FdCanvasRect): number =>
    axis === 'x' ? frame.y + frame.height : frame.x + frame.width
  const frames = [...referenceFrames, movingFrame].sort((a, b) => lower(a) - lower(b))
  if (frames.length < 2) return []
  const position = Math.max(...frames.map(crossUpper)) + guideOffset
  const guides: FdGraphGuide[] = []
  for (let index = 0; index < frames.length - 1; index += 1) {
    const first = frames[index]
    const second = frames[index + 1]
    if (!first || !second) continue
    const minimum = upper(first)
    const maximum = lower(second)
    if (maximum < minimum) continue
    guides.push({
      axis: axis === 'x' ? 'horizontal' : 'vertical',
      position,
      lowerBound: minimum,
      upperBound: maximum,
      kind: 'equalSpacing',
      measurement: maximum - minimum,
    })
  }
  return guides
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
  const effectiveCandidates = candidates.slice(0, configuration.maximumCandidates)
  const proposedBounds = {
    ...movingBounds,
    x: movingBounds.x + proposedTranslation.width,
    y: movingBounds.y + proposedTranslation.height,
  }
  const x = axisCandidate('x', proposedBounds, effectiveCandidates, configuration, zoom, previous.x)
  const y = axisCandidate('y', proposedBounds, effectiveCandidates, configuration, zoom, previous.y)
  return {
    translation: {
      width: proposedTranslation.width + (x?.correction ?? 0),
      height: proposedTranslation.height + (y?.correction ?? 0),
    },
    guides: configuration.showsGuides ? [...(x?.guides ?? []), ...(y?.guides ?? [])] : [],
    state: { ...(x ? { x: x.state } : {}), ...(y ? { y: y.state } : {}) },
  }
}

export function snapGraphTranslationRequest(
  request: FdGraphTranslationSnapRequest,
): FdGraphTranslationSnapResult {
  return snapGraphTranslation(
    request.movingBounds,
    request.proposedTranslation,
    request.candidates,
    request.configuration,
    request.zoom,
    request.previous,
  )
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

export function snapGraphResize(request: FdGraphResizeSnapRequest): FdGraphResizeSnapResult {
  if (!request.configuration.enabled) {
    return {
      bounds: request.proposedBounds,
      frames: scaleGraphFrames(request.baseFrames, request.baseBounds, request.proposedBounds),
      guides: [],
      state: {},
    }
  }
  const effectiveRequest = {
    ...request,
    candidates: request.candidates.slice(0, request.configuration.maximumCandidates),
  }
  const x = resizeAxisCandidate('x', effectiveRequest, request.previous.x)
  const y = resizeAxisCandidate('y', effectiveRequest, request.previous.y)
  const movesHorizontally =
    request.handle.includes('Right') ||
    request.handle.includes('Left') ||
    request.handle === 'right' ||
    request.handle === 'left'
  const movesVertically = request.handle.startsWith('top') || request.handle.startsWith('bottom')
  const bounds = resizeGraphBounds(
    request.baseBounds,
    request.handle,
    {
      width: request.proposedTranslation.width + (movesHorizontally ? (x?.correction ?? 0) : 0),
      height: request.proposedTranslation.height + (movesVertically ? (y?.correction ?? 0) : 0),
    },
    request.minimumSize,
    request.preservesAspectRatio,
    request.resizesFromCenter,
  )
  const guides = request.configuration.showsGuides
    ? [
        ...(x ? guidesForState('x', x.state, bounds, effectiveRequest.candidates) : []),
        ...(y ? guidesForState('y', y.state, bounds, effectiveRequest.candidates) : []),
        ...(movesHorizontally
          ? [dimensionGuide('x', bounds, request.configuration.guideOffset / request.zoom)]
          : []),
        ...(movesVertically
          ? [dimensionGuide('y', bounds, request.configuration.guideOffset / request.zoom)]
          : []),
      ]
    : []
  return {
    bounds,
    frames: scaleGraphFrames(request.baseFrames, request.baseBounds, bounds),
    guides,
    state: { ...(x ? { x: x.state } : {}), ...(y ? { y: y.state } : {}) },
  }
}

const resizeAxisCandidate = (
  axis: 'x' | 'y',
  request: FdGraphResizeSnapRequest,
  previous: FdGraphSnapAxisState | undefined,
): AxisCandidate | undefined => {
  const lowerEdge =
    axis === 'x'
      ? request.handle.includes('Left') || request.handle === 'left'
      : request.handle.startsWith('top')
  const upperEdge =
    axis === 'x'
      ? request.handle.includes('Right') || request.handle === 'right'
      : request.handle.startsWith('bottom')
  if (lowerEdge === upperEdge) return undefined
  const activePoint = resizeActivePoint(request.proposedBounds, request.handle)
  const pointBounds = { x: activePoint.x, y: activePoint.y, width: 0, height: 0 }
  const standard = axisCandidate(
    axis,
    pointBounds,
    request.candidates,
    { ...request.configuration, equalSpacing: false },
    request.zoom,
    previous,
  )
  if (!request.configuration.equalSize || previous?.kind === 'equalSize') return standard
  const movingValue = axis === 'x' ? activePoint.x : activePoint.y
  const center =
    axis === 'x'
      ? request.proposedBounds.x + request.proposedBounds.width / 2
      : request.proposedBounds.y + request.proposedBounds.height / 2
  const stationaryValue =
    axis === 'x'
      ? lowerEdge
        ? request.proposedBounds.x + request.proposedBounds.width
        : request.proposedBounds.x
      : lowerEdge
        ? request.proposedBounds.y + request.proposedBounds.height
        : request.proposedBounds.y
  let equalSize: AxisCandidate | undefined
  for (const candidate of request.candidates) {
    const length = axis === 'x' ? candidate.frame.width : candidate.frame.height
    const target = request.resizesFromCenter
      ? center + (lowerEdge ? -length / 2 : length / 2)
      : stationaryValue + (lowerEdge ? -length : length)
    const correction = target - movingValue
    if (Math.abs(correction) * request.zoom > request.configuration.acquisitionDistance) continue
    if (equalSize && Math.abs(equalSize.correction) <= Math.abs(correction)) continue
    const state: FdGraphSnapAxisState = {
      anchor: 'minimum',
      target,
      kind: 'equalSize',
      candidateFrame: candidate.frame,
    }
    equalSize = {
      correction,
      state,
      guides: guidesForState(axis, state, request.proposedBounds, request.candidates),
    }
  }
  if (!standard || (equalSize && Math.abs(equalSize.correction) < Math.abs(standard.correction))) {
    return equalSize
  }
  return standard
}

const dimensionGuide = (axis: 'x' | 'y', frame: FdCanvasRect, offset: number): FdGraphGuide =>
  axis === 'x'
    ? {
        axis: 'horizontal',
        position: frame.y + frame.height + offset,
        lowerBound: frame.x,
        upperBound: frame.x + frame.width,
        kind: 'resize',
        measurement: frame.width,
      }
    : {
        axis: 'vertical',
        position: frame.x + frame.width + offset,
        lowerBound: frame.y,
        upperBound: frame.y + frame.height,
        kind: 'resize',
        measurement: frame.height,
      }

const resizeActivePoint = (bounds: FdCanvasRect, handle: FdGraphResizeHandle): FdCanvasPoint => {
  const x =
    handle.includes('Left') || handle === 'left'
      ? bounds.x
      : handle.includes('Right') || handle === 'right'
        ? bounds.x + bounds.width
        : bounds.x + bounds.width / 2
  const y = handle.startsWith('top')
    ? bounds.y
    : handle.startsWith('bottom')
      ? bounds.y + bounds.height
      : bounds.y + bounds.height / 2
  return { x, y }
}

export function graphArrangementTranslations(
  nodes: readonly FdGraphNodeGeometry[],
  action: FdGraphArrangementAction,
): ReadonlyMap<FdGraphElementID, FdCanvasSize> {
  if (action.kind === 'align') return alignedTranslations(nodes, action.alignment)
  return distributedTranslations(nodes, action.distribution)
}

const alignedTranslations = (
  nodes: readonly FdGraphNodeGeometry[],
  alignment: FdGraphAlignment,
): ReadonlyMap<FdGraphElementID, FdCanvasSize> => {
  if (nodes.length < 2) return new Map()
  const bounds = nodes.reduce<FdCanvasRect | undefined>(
    (current, node) => unionCanvasRects(current, node.frame),
    undefined,
  )
  if (!bounds) return new Map()
  const result = new Map<FdGraphElementID, FdCanvasSize>()
  for (const node of nodes) {
    let translation: FdCanvasSize
    switch (alignment) {
      case 'left':
        translation = { width: bounds.x - node.frame.x, height: 0 }
        break
      case 'horizontalCenter':
        translation = {
          width: bounds.x + bounds.width / 2 - (node.frame.x + node.frame.width / 2),
          height: 0,
        }
        break
      case 'right':
        translation = {
          width: bounds.x + bounds.width - (node.frame.x + node.frame.width),
          height: 0,
        }
        break
      case 'top':
        translation = { width: 0, height: bounds.y - node.frame.y }
        break
      case 'verticalCenter':
        translation = {
          width: 0,
          height: bounds.y + bounds.height / 2 - (node.frame.y + node.frame.height / 2),
        }
        break
      case 'bottom':
        translation = {
          width: 0,
          height: bounds.y + bounds.height - (node.frame.y + node.frame.height),
        }
        break
    }
    if (translation.width !== 0 || translation.height !== 0) result.set(node.id, translation)
  }
  return result
}

const distributedTranslations = (
  nodes: readonly FdGraphNodeGeometry[],
  distribution: FdGraphDistribution,
): ReadonlyMap<FdGraphElementID, FdCanvasSize> => {
  if (nodes.length < 3) return new Map()
  const horizontal = distribution === 'horizontal'
  const sorted = nodes
    .map((node, index) => ({ node, index }))
    .sort((first, second) => {
      const firstValue = horizontal ? first.node.frame.x : first.node.frame.y
      const secondValue = horizontal ? second.node.frame.x : second.node.frame.y
      return firstValue - secondValue || first.index - second.index
    })
    .map(({ node }) => node)
  const first = sorted[0]
  const last = sorted.at(-1)
  if (!first || !last) return new Map()
  const minimum = horizontal ? first.frame.x : first.frame.y
  const maximum = horizontal ? last.frame.x + last.frame.width : last.frame.y + last.frame.height
  const totalLength = sorted.reduce(
    (total, node) => total + (horizontal ? node.frame.width : node.frame.height),
    0,
  )
  const gap = (maximum - minimum - totalLength) / (sorted.length - 1)
  const result = new Map<FdGraphElementID, FdCanvasSize>()
  let cursor = minimum
  for (const node of sorted) {
    const current = horizontal ? node.frame.x : node.frame.y
    const delta = cursor - current
    if (delta !== 0) {
      result.set(node.id, horizontal ? { width: delta, height: 0 } : { width: 0, height: delta })
    }
    cursor += (horizontal ? node.frame.width : node.frame.height) + gap
  }
  return result
}
