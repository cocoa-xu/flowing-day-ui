import FlowingDayCanvas
import FlowingDayGraphLayout
import Foundation

public enum FlowingGraphCanvasRenderingGeometry {
  public static func translated(
    _ anchor: FlowingGraphCanvasAnchor,
    by delta: CGSize
  ) -> FlowingGraphCanvasAnchor {
    FlowingGraphCanvasAnchor(
      position: CGPoint(
        x: anchor.position.x + delta.width,
        y: anchor.position.y + delta.height
      ),
      normal: anchor.normal
    )
  }

  public static func transformed(
    _ route: FlowingGraphEdgeRoute,
    by transform: FlowingCanvasTransform,
    relativeTo origin: CGPoint
  ) -> FlowingGraphEdgeRoute {
    func point(_ point: CGPoint) -> CGPoint {
      let transformed = transform.applying(to: point)
      return CGPoint(x: transformed.x - origin.x, y: transformed.y - origin.y)
    }

    return FlowingGraphEdgeRoute(
      start: point(route.start),
      segments: route.segments.map { segment in
        switch segment {
        case .line(let end):
          return .line(end: point(end))
        case .quadratic(let control, let end):
          return .quadratic(control: point(control), end: point(end))
        case .cubic(let control1, let control2, let end):
          return .cubic(
            control1: point(control1),
            control2: point(control2),
            end: point(end)
          )
        }
      }
    )
  }
}
