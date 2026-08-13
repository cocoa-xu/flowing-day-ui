import type { FdCanvasPoint } from '../geometry.js'
import type { FdAnyGraphEdge } from '../graph/model.js'
import { type FdGraphEdgePathSegment, FdGraphEdgeRoute } from '../layout/pipeline.js'

export interface FdGraphArrowGeometry {
  readonly tip: FdCanvasPoint
  readonly baseCenter: FdCanvasPoint
  readonly baseLeading: FdCanvasPoint
  readonly baseTrailing: FdCanvasPoint
}

export interface FdGraphCubicEdgeGeometry {
  readonly start: FdCanvasPoint
  readonly control1: FdCanvasPoint
  readonly control2: FdCanvasPoint
  readonly end: FdCanvasPoint
  readonly targetArrow?: FdGraphArrowGeometry
}

export interface FdGraphEdgeGeometry {
  readonly route: FdGraphEdgeRoute
  readonly targetArrow?: FdGraphArrowGeometry
}

export interface FdGraphEdgeGeometryInput {
  readonly edge: FdAnyGraphEdge
  readonly source: FdCanvasPoint
  readonly target: FdCanvasPoint
}

export type FdGraphEdgeGeometryResolver = (input: FdGraphEdgeGeometryInput) => FdGraphEdgeGeometry

export interface FdGraphCubicEdgeGeometryConfiguration {
  readonly direction?: 'horizontal' | 'vertical' | 'automatic'
  readonly controlDistanceRatio?: number
  readonly minimumControlDistance?: number
  readonly maximumControlDistance?: number
}

const defaultConfiguration = {
  direction: 'horizontal',
  controlDistanceRatio: 0.45,
  minimumControlDistance: 48,
  maximumControlDistance: Number.POSITIVE_INFINITY,
} as const

export function graphCubicEdgeGeometryResolver(
  configuration: FdGraphCubicEdgeGeometryConfiguration = {},
): FdGraphEdgeGeometryResolver {
  const resolved = {
    direction: configuration.direction ?? defaultConfiguration.direction,
    controlDistanceRatio:
      configuration.controlDistanceRatio ?? defaultConfiguration.controlDistanceRatio,
    minimumControlDistance:
      configuration.minimumControlDistance ?? defaultConfiguration.minimumControlDistance,
    maximumControlDistance:
      configuration.maximumControlDistance ?? defaultConfiguration.maximumControlDistance,
  }
  if (!Number.isFinite(resolved.controlDistanceRatio) || resolved.controlDistanceRatio < 0)
    throw new RangeError('control distance ratio must be nonnegative')
  if (!Number.isFinite(resolved.minimumControlDistance) || resolved.minimumControlDistance < 0)
    throw new RangeError('minimum control distance must be nonnegative')
  if (
    Number.isNaN(resolved.maximumControlDistance) ||
    resolved.maximumControlDistance < resolved.minimumControlDistance
  )
    throw new RangeError('maximum control distance must not be less than the minimum')

  return ({ edge, source, target }) => {
    const direction = resolveDirection(resolved.direction, source, target)
    const axis = unitAxis(direction, source, target)
    const decoration = edge.style?.targetDecoration
    const arrow = decoration
      ? {
          gap: nonnegativeFinite(decoration.gap ?? 3, 'arrow gap'),
          length: nonnegativeFinite(decoration.length ?? 7, 'arrow length'),
          width: nonnegativeFinite(decoration.width ?? 6, 'arrow width'),
        }
      : undefined
    const tip = arrow ? subtract(target, multiply(axis, arrow.gap)) : target
    const end = arrow ? subtract(tip, multiply(axis, arrow.length)) : target
    const primaryDistance =
      direction === 'horizontal' ? Math.abs(end.x - source.x) : Math.abs(end.y - source.y)
    const controlDistance = Math.min(
      Math.max(primaryDistance * resolved.controlDistanceRatio, resolved.minimumControlDistance),
      resolved.maximumControlDistance,
    )
    const control = multiply(axis, controlDistance)
    return {
      route: new FdGraphEdgeRoute(source, [
        {
          kind: 'cubic',
          control1: add(source, control),
          control2: subtract(end, control),
          end,
        },
      ]),
      ...(arrow ? { targetArrow: arrowGeometry(end, tip, axis, arrow.width) } : {}),
    }
  }
}

export const defaultGraphEdgeGeometryResolver = graphCubicEdgeGeometryResolver()

export function graphCubicEdgePoint(
  geometry: FdGraphCubicEdgeGeometry,
  progress: number,
): FdCanvasPoint {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1)
    throw new RangeError('edge progress must be between zero and one')
  const inverse = 1 - progress
  return {
    x:
      inverse ** 3 * geometry.start.x +
      3 * inverse ** 2 * progress * geometry.control1.x +
      3 * inverse * progress ** 2 * geometry.control2.x +
      progress ** 3 * geometry.end.x,
    y:
      inverse ** 3 * geometry.start.y +
      3 * inverse ** 2 * progress * geometry.control1.y +
      3 * inverse * progress ** 2 * geometry.control2.y +
      progress ** 3 * geometry.end.y,
  }
}

export function graphCubicEdgePath(geometry: FdGraphCubicEdgeGeometry): string {
  return `M ${geometry.start.x} ${geometry.start.y} C ${geometry.control1.x} ${geometry.control1.y}, ${geometry.control2.x} ${geometry.control2.y}, ${geometry.end.x} ${geometry.end.y}`
}

export function graphEdgePath(geometry: FdGraphEdgeGeometry): string {
  const commands = [`M ${geometry.route.start.x} ${geometry.route.start.y}`]
  for (const segment of geometry.route.segments) {
    if (segment.kind === 'line') commands.push(`L ${segment.end.x} ${segment.end.y}`)
    else if (segment.kind === 'quadratic') {
      commands.push(
        `Q ${segment.control.x} ${segment.control.y}, ${segment.end.x} ${segment.end.y}`,
      )
    } else {
      commands.push(
        `C ${segment.control1.x} ${segment.control1.y}, ${segment.control2.x} ${segment.control2.y}, ${segment.end.x} ${segment.end.y}`,
      )
    }
  }
  return commands.join(' ')
}

export function graphEdgePoint(geometry: FdGraphEdgeGeometry, progress: number): FdCanvasPoint {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new RangeError('edge progress must be between zero and one')
  }
  const cubics = graphEdgeCubicSegments(geometry)
  if (cubics.length === 0) return geometry.route.start
  const scaled = progress * cubics.length
  const index = Math.min(Math.floor(scaled), cubics.length - 1)
  return graphCubicEdgePoint(cubics[index] as FdGraphCubicEdgeGeometry, scaled - index)
}

export function graphEdgeCubicSegments(
  geometry: FdGraphEdgeGeometry,
): readonly FdGraphCubicEdgeGeometry[] {
  const cubics: FdGraphCubicEdgeGeometry[] = []
  let start = geometry.route.start
  for (const segment of geometry.route.segments) {
    cubics.push(cubicSegment(start, segment))
    start = segment.end
  }
  return cubics
}

export function graphEdgeArrowGeometry(
  route: FdGraphEdgeRoute,
  length: number,
  width: number,
): FdGraphArrowGeometry | undefined {
  const final = graphEdgeCubicSegments({ route }).at(-1)
  if (!final) return undefined
  const tangent = subtract(final.end, final.control2)
  const tangentLength = Math.hypot(tangent.x, tangent.y)
  if (tangentLength === 0) return undefined
  const direction = multiply(tangent, 1 / tangentLength)
  const baseCenter = subtract(final.end, multiply(direction, length))
  return arrowGeometry(baseCenter, final.end, direction, width)
}

const cubicSegment = (
  start: FdCanvasPoint,
  segment: FdGraphEdgePathSegment,
): FdGraphCubicEdgeGeometry => {
  if (segment.kind === 'cubic') {
    return {
      start,
      control1: segment.control1,
      control2: segment.control2,
      end: segment.end,
    }
  }
  if (segment.kind === 'quadratic') {
    return {
      start,
      control1: add(start, multiply(subtract(segment.control, start), 2 / 3)),
      control2: add(segment.end, multiply(subtract(segment.control, segment.end), 2 / 3)),
      end: segment.end,
    }
  }
  const delta = subtract(segment.end, start)
  return {
    start,
    control1: add(start, multiply(delta, 1 / 3)),
    control2: add(start, multiply(delta, 2 / 3)),
    end: segment.end,
  }
}

const resolveDirection = (
  direction: FdGraphCubicEdgeGeometryConfiguration['direction'],
  source: FdCanvasPoint,
  target: FdCanvasPoint,
): 'horizontal' | 'vertical' => {
  if (direction === 'horizontal' || direction === 'vertical') return direction
  return Math.abs(target.x - source.x) >= Math.abs(target.y - source.y) ? 'horizontal' : 'vertical'
}

const unitAxis = (
  direction: 'horizontal' | 'vertical',
  source: FdCanvasPoint,
  target: FdCanvasPoint,
): FdCanvasPoint => {
  if (direction === 'horizontal') return { x: target.x >= source.x ? 1 : -1, y: 0 }
  return { x: 0, y: target.y >= source.y ? 1 : -1 }
}

const arrowGeometry = (
  baseCenter: FdCanvasPoint,
  tip: FdCanvasPoint,
  direction: FdCanvasPoint,
  width: number,
): FdGraphArrowGeometry => {
  const normal = { x: -direction.y, y: direction.x }
  const halfWidth = width / 2
  return {
    tip,
    baseCenter,
    baseLeading: add(baseCenter, multiply(normal, halfWidth)),
    baseTrailing: subtract(baseCenter, multiply(normal, halfWidth)),
  }
}

const add = (left: FdCanvasPoint, right: FdCanvasPoint): FdCanvasPoint => ({
  x: left.x + right.x,
  y: left.y + right.y,
})

const subtract = (left: FdCanvasPoint, right: FdCanvasPoint): FdCanvasPoint => ({
  x: left.x - right.x,
  y: left.y - right.y,
})

const multiply = (point: FdCanvasPoint, scalar: number): FdCanvasPoint => ({
  x: point.x * scalar,
  y: point.y * scalar,
})

const nonnegativeFinite = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be nonnegative`)
  return value
}
