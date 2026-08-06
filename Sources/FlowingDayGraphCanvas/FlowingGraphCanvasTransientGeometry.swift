import CoreGraphics
import FlowingDayGraphLayout

public enum FlowingGraphCanvasTransientGeometry {
  public static func deforming(
    _ route: FlowingGraphEdgeRoute,
    firstEndpointDelta: CGSize,
    secondEndpointDelta: CGSize
  ) -> FlowingGraphEdgeRoute {
    let segmentCount = route.segments.count
    guard segmentCount > 0 else {
      return FlowingGraphEdgeRoute(
        start: translated(route.start, by: firstEndpointDelta),
        segments: []
      )
    }

    let count = CGFloat(segmentCount)
    let segments = route.segments.enumerated().map { index, segment in
      let startProgress = CGFloat(index) / count
      let endProgress = CGFloat(index + 1) / count
      switch segment {
      case let .line(end):
        return FlowingGraphEdgePathSegment.line(
          end: translated(
            end,
            by: interpolatedDelta(
              from: firstEndpointDelta,
              to: secondEndpointDelta,
              progress: endProgress
            )
          )
        )
      case let .quadratic(control, end):
        return FlowingGraphEdgePathSegment.quadratic(
          control: translated(
            control,
            by: interpolatedDelta(
              from: firstEndpointDelta,
              to: secondEndpointDelta,
              progress: (startProgress + endProgress) / 2
            )
          ),
          end: translated(
            end,
            by: interpolatedDelta(
              from: firstEndpointDelta,
              to: secondEndpointDelta,
              progress: endProgress
            )
          )
        )
      case let .cubic(control1, control2, end):
        let interval = endProgress - startProgress
        return FlowingGraphEdgePathSegment.cubic(
          control1: translated(
            control1,
            by: interpolatedDelta(
              from: firstEndpointDelta,
              to: secondEndpointDelta,
              progress: startProgress + interval / 3
            )
          ),
          control2: translated(
            control2,
            by: interpolatedDelta(
              from: firstEndpointDelta,
              to: secondEndpointDelta,
              progress: startProgress + interval * 2 / 3
            )
          ),
          end: translated(
            end,
            by: interpolatedDelta(
              from: firstEndpointDelta,
              to: secondEndpointDelta,
              progress: endProgress
            )
          )
        )
      }
    }
    return FlowingGraphEdgeRoute(
      start: translated(route.start, by: firstEndpointDelta),
      segments: segments
    )
  }

  private static func interpolatedDelta(
    from first: CGSize,
    to second: CGSize,
    progress: CGFloat
  ) -> CGSize {
    CGSize(
      width: first.width + (second.width - first.width) * progress,
      height: first.height + (second.height - first.height) * progress
    )
  }

  private static func translated(_ point: CGPoint, by delta: CGSize) -> CGPoint {
    CGPoint(x: point.x + delta.width, y: point.y + delta.height)
  }
}
