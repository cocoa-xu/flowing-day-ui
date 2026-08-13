import type { FdCanvasPoint, FdCanvasRect, FdCanvasSize } from '../geometry.js'
import { FdGraphCanvasAnchor } from '../graph/content.js'
import type {
  FdGraphCanvasInteractionModifier,
  FdGraphCanvasResizeEdges,
} from '../graph/interaction-policy.js'
import { FdGraphEdgeRoute, type FdGraphEdgePathSegment } from '../layout/pipeline.js'
import { type FdGraphCanvasGeometryAxis, FdGraphCanvasResizeBehavior } from './arrangement.js'

export class FdGraphCanvasTransientGeometry {
  private constructor() {}

  static resizing(
    frame: FdCanvasRect,
    edges: FdGraphCanvasResizeEdges,
    translation: FdCanvasSize,
    modifiers?: ReadonlySet<FdGraphCanvasInteractionModifier>,
  ): FdCanvasRect
  static resizing(
    frame: FdCanvasRect,
    edges: FdGraphCanvasResizeEdges,
    translation: FdCanvasSize,
    behavior: FdGraphCanvasResizeBehavior,
  ): FdCanvasRect
  static resizing(
    anchor: FdGraphCanvasAnchor,
    source: FdCanvasRect,
    destination: FdCanvasRect,
  ): FdGraphCanvasAnchor
  static resizing(
    frame: FdCanvasRect,
    source: FdCanvasRect,
    destination: FdCanvasRect,
  ): FdCanvasRect
  static resizing(
    first: FdCanvasRect | FdGraphCanvasAnchor,
    second: FdGraphCanvasResizeEdges | FdCanvasRect,
    third: FdCanvasSize | FdCanvasRect,
    fourth?: ReadonlySet<FdGraphCanvasInteractionModifier> | FdGraphCanvasResizeBehavior,
  ): FdCanvasRect | FdGraphCanvasAnchor {
    if (fourth === undefined && !isResizeEdges(second)) {
      return 'position' in first
        ? resizeAnchor(first, second, third as FdCanvasRect)
        : resizeFrameBetweenBounds(first, second, third as FdCanvasRect)
    }
    const edges = second as FdGraphCanvasResizeEdges
    const translation = third as FdCanvasSize
    if (fourth === undefined || isModifierSet(fourth)) {
      const modifiers = fourth ?? new Set<FdGraphCanvasInteractionModifier>()
      const preservesAspectRatio = modifiers.has('preserveResizeAspectRatio')
      const hasHorizontalEdge = edges.has('leading') || edges.has('trailing')
      const hasVerticalEdge = edges.has('top') || edges.has('bottom')
      const aspectRatioDrivingAxis = preservesAspectRatio
        ? hasHorizontalEdge && hasVerticalEdge
          ? this.dominantAxis(translation, first as FdCanvasRect)
          : hasHorizontalEdge
            ? 'horizontal'
            : 'vertical'
        : undefined
      return resizeFrame(
        first as FdCanvasRect,
        edges,
        translation,
        new FdGraphCanvasResizeBehavior({
          preservesAspectRatio,
          resizesFromCenter: modifiers.has('resizeFromCenter'),
          ...(aspectRatioDrivingAxis ? { aspectRatioDrivingAxis } : {}),
        }),
      )
    }
    return resizeFrame(first as FdCanvasRect, edges, translation, fourth)
  }

  static constrainingToDominantAxis(translation: FdCanvasSize): FdCanvasSize {
    return this.constraining(translation, this.dominantAxis(translation))
  }

  static dominantAxis(
    translation: FdCanvasSize,
    relativeTo?: FdCanvasSize,
  ): FdGraphCanvasGeometryAxis {
    const horizontal = normalizedChange(translation.width, relativeTo?.width)
    const vertical = normalizedChange(translation.height, relativeTo?.height)
    return horizontal >= vertical ? 'horizontal' : 'vertical'
  }

  static constraining(translation: FdCanvasSize, axis: FdGraphCanvasGeometryAxis): FdCanvasSize {
    return axis === 'horizontal'
      ? { width: translation.width, height: 0 }
      : { width: 0, height: translation.height }
  }

  static scaling<ID>(
    frames: ReadonlyMap<ID, FdCanvasRect>,
    source: FdCanvasRect,
    destination: FdCanvasRect,
  ): ReadonlyMap<ID, FdCanvasRect> {
    return new Map(
      [...frames].map(([id, frame]) => [id, resizeFrameBetweenBounds(frame, source, destination)]),
    )
  }

  static deforming(
    route: FdGraphEdgeRoute,
    firstEndpointDelta: FdCanvasSize,
    secondEndpointDelta: FdCanvasSize,
  ): FdGraphEdgeRoute {
    const segmentCount = route.segments.length
    if (segmentCount === 0) {
      return new FdGraphEdgeRoute(translated(route.start, firstEndpointDelta), [])
    }
    const segments = route.segments.map((segment, index): FdGraphEdgePathSegment => {
      const startProgress = index / segmentCount
      const endProgress = (index + 1) / segmentCount
      if (segment.kind === 'line') {
        return {
          kind: 'line',
          end: translated(
            segment.end,
            interpolatedDelta(firstEndpointDelta, secondEndpointDelta, endProgress),
          ),
        }
      }
      if (segment.kind === 'quadratic') {
        return {
          kind: 'quadratic',
          control: translated(
            segment.control,
            interpolatedDelta(
              firstEndpointDelta,
              secondEndpointDelta,
              (startProgress + endProgress) / 2,
            ),
          ),
          end: translated(
            segment.end,
            interpolatedDelta(firstEndpointDelta, secondEndpointDelta, endProgress),
          ),
        }
      }
      const interval = endProgress - startProgress
      return {
        kind: 'cubic',
        control1: translated(
          segment.control1,
          interpolatedDelta(firstEndpointDelta, secondEndpointDelta, startProgress + interval / 3),
        ),
        control2: translated(
          segment.control2,
          interpolatedDelta(
            firstEndpointDelta,
            secondEndpointDelta,
            startProgress + (interval * 2) / 3,
          ),
        ),
        end: translated(
          segment.end,
          interpolatedDelta(firstEndpointDelta, secondEndpointDelta, endProgress),
        ),
      }
    })
    return new FdGraphEdgeRoute(translated(route.start, firstEndpointDelta), segments)
  }
}

const resizeFrame = (
  frame: FdCanvasRect,
  edges: FdGraphCanvasResizeEdges,
  translation: FdCanvasSize,
  behavior: FdGraphCanvasResizeBehavior,
): FdCanvasRect => {
  validateResizeEdges(edges)
  const fromCenter = behavior.resizesFromCenter ?? false
  let x = frame.x
  let y = frame.y
  let width = frame.width
  let height = frame.height
  if (edges.has('leading')) {
    x += translation.width
    width -= translation.width * (fromCenter ? 2 : 1)
  } else if (edges.has('trailing')) {
    if (fromCenter) x -= translation.width
    width += translation.width * (fromCenter ? 2 : 1)
  }
  if (edges.has('top')) {
    y += translation.height
    height -= translation.height * (fromCenter ? 2 : 1)
  } else if (edges.has('bottom')) {
    if (fromCenter) y -= translation.height
    height += translation.height * (fromCenter ? 2 : 1)
  }
  const result = { x, y, width, height }
  if (!behavior.preservesAspectRatio || frame.width <= 0 || frame.height <= 0) return result
  if (!behavior.aspectRatioDrivingAxis) {
    throw new RangeError('aspect-ratio resizing requires a driving axis')
  }
  const scale =
    behavior.aspectRatioDrivingAxis === 'horizontal'
      ? result.width / frame.width
      : result.height / frame.height
  return scaled(
    frame,
    scale,
    anchor(edges.has('leading'), edges.has('trailing'), fromCenter),
    anchor(edges.has('top'), edges.has('bottom'), fromCenter),
  )
}

const resizeAnchor = (
  anchorValue: FdGraphCanvasAnchor,
  source: FdCanvasRect,
  destination: FdCanvasRect,
): FdGraphCanvasAnchor => {
  const horizontal = source.width === 0 ? 0.5 : (anchorValue.position.x - source.x) / source.width
  const vertical = source.height === 0 ? 0.5 : (anchorValue.position.y - source.y) / source.height
  return new FdGraphCanvasAnchor(
    {
      x: destination.x + destination.width * horizontal,
      y: destination.y + destination.height * vertical,
    },
    anchorValue.normal,
  )
}

const resizeFrameBetweenBounds = (
  frame: FdCanvasRect,
  source: FdCanvasRect,
  destination: FdCanvasRect,
): FdCanvasRect => {
  const horizontalScale = source.width === 0 ? 1 : destination.width / source.width
  const verticalScale = source.height === 0 ? 1 : destination.height / source.height
  const horizontalPosition = source.width === 0 ? 0.5 : (frame.x - source.x) / source.width
  const verticalPosition = source.height === 0 ? 0.5 : (frame.y - source.y) / source.height
  return {
    x: destination.x + destination.width * horizontalPosition,
    y: destination.y + destination.height * verticalPosition,
    width: frame.width * horizontalScale,
    height: frame.height * verticalScale,
  }
}

const isResizeEdges = (
  value: FdGraphCanvasResizeEdges | FdCanvasRect,
): value is FdGraphCanvasResizeEdges => typeof (value as ReadonlySet<unknown>).has === 'function'

const isModifierSet = (
  value: ReadonlySet<FdGraphCanvasInteractionModifier> | FdGraphCanvasResizeBehavior,
): value is ReadonlySet<FdGraphCanvasInteractionModifier> =>
  typeof (value as ReadonlySet<unknown>).has === 'function'

const validateResizeEdges = (edges: FdGraphCanvasResizeEdges): void => {
  if (
    edges.size === 0 ||
    (edges.has('leading') && edges.has('trailing')) ||
    (edges.has('top') && edges.has('bottom'))
  ) {
    throw new RangeError('invalid resize edges')
  }
}

const normalizedChange = (delta: number, length?: number): number =>
  length === undefined || length === 0 ? Math.abs(delta) : Math.abs(delta / length)

const interpolatedDelta = (
  first: FdCanvasSize,
  second: FdCanvasSize,
  progress: number,
): FdCanvasSize => ({
  width: first.width + (second.width - first.width) * progress,
  height: first.height + (second.height - first.height) * progress,
})

const translated = (point: FdCanvasPoint, delta: FdCanvasSize): FdCanvasPoint => ({
  x: point.x + delta.width,
  y: point.y + delta.height,
})

const anchor = (lower: boolean, upper: boolean, fromCenter: boolean): number => {
  if (fromCenter || lower === upper) return 0.5
  return lower ? 1 : 0
}

const scaled = (
  frame: FdCanvasRect,
  scale: number,
  horizontalAnchor: number,
  verticalAnchor: number,
): FdCanvasRect => {
  const anchorPoint = {
    x: frame.x + frame.width * horizontalAnchor,
    y: frame.y + frame.height * verticalAnchor,
  }
  const width = frame.width * scale
  const height = frame.height * scale
  return {
    x: anchorPoint.x - width * horizontalAnchor,
    y: anchorPoint.y - height * verticalAnchor,
    width,
    height,
  }
}
