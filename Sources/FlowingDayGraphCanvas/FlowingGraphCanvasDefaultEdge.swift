import FlowingDayGraphLayout
import SwiftUI

public struct FlowingGraphCanvasDefaultEdgeStyle {
  public let color: Color
  public let selectedColor: Color
  public let lineWidth: CGFloat
  public let arrowLength: CGFloat
  public let hitWidth: CGFloat

  public init(
    color: Color = .secondary.opacity(0.65),
    selectedColor: Color = .accentColor,
    lineWidth: CGFloat = 1.25,
    arrowLength: CGFloat = 6,
    hitWidth: CGFloat = 12
  ) {
    precondition(lineWidth > 0 && lineWidth.isFinite)
    precondition(arrowLength > 0 && arrowLength.isFinite)
    precondition(hitWidth >= lineWidth && hitWidth.isFinite)
    self.color = color
    self.selectedColor = selectedColor
    self.lineWidth = lineWidth
    self.arrowLength = arrowLength
    self.hitWidth = hitWidth
  }
}

public struct FlowingGraphCanvasDefaultEdge<Schema: FlowingGraphCanvasSchema>: View {
  public let context: FlowingGraphCanvasEdgeContext<Schema>
  public let style: FlowingGraphCanvasDefaultEdgeStyle

  public init(
    context: FlowingGraphCanvasEdgeContext<Schema>,
    style: FlowingGraphCanvasDefaultEdgeStyle = .init()
  ) {
    self.context = context
    self.style = style
  }

  public var body: some View {
    let path = FlowingGraphCanvasEdgePath(route: context.renderedRoute)
    let color = context.isSelected ? style.selectedColor : style.color

    ZStack(alignment: .topLeading) {
      path
        .stroke(
          color,
          style: StrokeStyle(
            lineWidth: style.lineWidth,
            lineCap: .round,
            lineJoin: .round
          )
        )
      if context.anchors.isDirected,
        let arrow = FlowingGraphCanvasArrowGeometry(
          route: context.renderedRoute,
          length: style.arrowLength
        )
      {
        FlowingGraphCanvasArrowHead()
          .fill(color)
          .frame(width: style.arrowLength, height: style.arrowLength)
          .rotationEffect(arrow.angle)
          .position(arrow.position)
      }
      if context.isSelected && context.reconnectionActions.isEnabled {
        if context.reconnectionActions.isEnabled(for: .first) {
          reconnectHandle(.first)
        }
        if context.reconnectionActions.isEnabled(for: .second) {
          reconnectHandle(.second)
        }
      }
    }
    .contentShape(
      path.path().strokedPath(
        StrokeStyle(lineWidth: style.hitWidth, lineCap: .round, lineJoin: .round)
      )
    )
    .onTapGesture {
      context.actions.select()
    }
  }

  private func reconnectHandle(
    _ endpoint: FlowingGraphCanvasEdgeEndpoint
  ) -> some View {
    FlowingGraphCanvasEdgeReconnectHandle(
      endpoint: endpoint,
      actions: context.reconnectionActions
    ) {
      Circle()
        .fill(.background)
        .overlay {
          Circle().strokeBorder(style.selectedColor, lineWidth: 1.5)
        }
        .frame(width: 10, height: 10)
        .accessibilityLabel(
          endpoint == .first ? "Reconnect first endpoint" : "Reconnect second endpoint"
        )
    }
  }
}

private struct FlowingGraphCanvasEdgePath: Shape {
  let route: FlowingGraphEdgeRoute

  func path(in rect: CGRect) -> Path {
    path()
  }

  func path() -> Path {
    var path = Path()
    path.move(to: route.start)
    for segment in route.segments {
      switch segment {
      case .line(let end):
        path.addLine(to: end)
      case .quadratic(let control, let end):
        path.addQuadCurve(to: end, control: control)
      case .cubic(let control1, let control2, let end):
        path.addCurve(to: end, control1: control1, control2: control2)
      }
    }
    return path
  }
}

private struct FlowingGraphCanvasArrowGeometry {
  let position: CGPoint
  let angle: Angle

  init?(route: FlowingGraphEdgeRoute, length: CGFloat) {
    guard let segment = route.segments.last else { return nil }
    let endpoint: CGPoint
    let tangentOrigin: CGPoint
    switch segment {
    case .line(let end):
      endpoint = end
      tangentOrigin =
        route.segments.count == 1
        ? route.start
        : route.segments[route.segments.count - 2].end
    case .quadratic(let control, let end):
      endpoint = end
      tangentOrigin = control
    case .cubic(_, let control2, let end):
      endpoint = end
      tangentOrigin = control2
    }
    guard endpoint != tangentOrigin else { return nil }
    let radians = atan2(
      endpoint.y - tangentOrigin.y,
      endpoint.x - tangentOrigin.x
    )
    position = CGPoint(
      x: endpoint.x - cos(radians) * length / 2,
      y: endpoint.y - sin(radians) * length / 2
    )
    angle = .radians(radians + .pi / 2)
  }
}

private struct FlowingGraphCanvasArrowHead: Shape {
  func path(in rect: CGRect) -> Path {
    var path = Path()
    path.move(to: CGPoint(x: rect.midX, y: rect.minY))
    path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
    path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
    path.closeSubpath()
    return path
  }
}

extension FlowingGraphEdgePathSegment {
  fileprivate var end: CGPoint {
    switch self {
    case .line(let end), .quadratic(_, let end), .cubic(_, _, let end):
      end
    }
  }
}
