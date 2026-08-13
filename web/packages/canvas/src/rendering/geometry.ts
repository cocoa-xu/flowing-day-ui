import type { FdCanvasPoint, FdCanvasSize, FdCanvasTransform } from '../geometry.js'
import { FdGraphCanvasAnchor } from '../graph/content.js'
import { type FdGraphEdgePathSegment, FdGraphEdgeRoute } from '../layout/pipeline.js'

export class FdGraphCanvasRenderingGeometry {
  private constructor() {}

  static translated(anchor: FdGraphCanvasAnchor, delta: FdCanvasSize): FdGraphCanvasAnchor {
    return new FdGraphCanvasAnchor(
      {
        x: anchor.position.x + delta.width,
        y: anchor.position.y + delta.height,
      },
      anchor.normal,
    )
  }

  static transformed(
    route: FdGraphEdgeRoute,
    transform: FdCanvasTransform,
    origin: FdCanvasPoint,
  ): FdGraphEdgeRoute {
    const point = (value: FdCanvasPoint): FdCanvasPoint => {
      const transformed = transform.applyPoint(value)
      return { x: transformed.x - origin.x, y: transformed.y - origin.y }
    }
    return new FdGraphEdgeRoute(
      point(route.start),
      route.segments.map((segment): FdGraphEdgePathSegment => {
        if (segment.kind === 'line') return { kind: 'line', end: point(segment.end) }
        if (segment.kind === 'quadratic') {
          return {
            kind: 'quadratic',
            control: point(segment.control),
            end: point(segment.end),
          }
        }
        return {
          kind: 'cubic',
          control1: point(segment.control1),
          control2: point(segment.control2),
          end: point(segment.end),
        }
      }),
    )
  }
}
