import SwiftUI

public struct FlowingGraphCanvasResizeHandle<Content: View>: View {
  private let edges: FlowingGraphCanvasResizeEdges
  private let actions: FlowingGraphCanvasNodeResizeActions
  private let minimumDistance: CGFloat
  private let content: Content

  public init(
    edges: FlowingGraphCanvasResizeEdges,
    actions: FlowingGraphCanvasNodeResizeActions,
    minimumDistance: CGFloat = 0,
    @ViewBuilder content: () -> Content
  ) {
    precondition(edges.isValid)
    precondition(minimumDistance >= 0 && minimumDistance.isFinite)
    self.edges = edges
    self.actions = actions
    self.minimumDistance = minimumDistance
    self.content = content()
  }

  public var body: some View {
    content
      .contentShape(Rectangle())
      .highPriorityGesture(
        DragGesture(minimumDistance: minimumDistance)
          .onChanged { value in
            actions.update(edges: edges, renderedTranslation: value.translation)
          }
          .onEnded { _ in
            actions.end()
          },
        including: actions.isEnabled ? .all : .none
      )
      .onDisappear(perform: actions.cancel)
  }
}

public struct FlowingGraphCanvasResizeHandles<Handle: View>: View {
  private let actions: FlowingGraphCanvasNodeResizeActions
  private let minimumDistance: CGFloat
  private let handle: (FlowingGraphCanvasResizeEdges) -> Handle

  public init(
    actions: FlowingGraphCanvasNodeResizeActions,
    minimumDistance: CGFloat = 0,
    @ViewBuilder handle: @escaping (FlowingGraphCanvasResizeEdges) -> Handle
  ) {
    precondition(minimumDistance >= 0 && minimumDistance.isFinite)
    self.actions = actions
    self.minimumDistance = minimumDistance
    self.handle = handle
  }

  public var body: some View {
    GeometryReader { proxy in
      ZStack {
        ForEach(FlowingGraphCanvasResizeEdges.standardHandles, id: \.rawValue) { edges in
          let point = position(for: edges)
          FlowingGraphCanvasResizeHandle(
            edges: edges,
            actions: actions,
            minimumDistance: minimumDistance
          ) {
            handle(edges)
          }
          .position(
            x: proxy.size.width * point.x,
            y: proxy.size.height * point.y
          )
        }
      }
    }
  }

  private func position(for edges: FlowingGraphCanvasResizeEdges) -> UnitPoint {
    UnitPoint(
      x: edges.contains(.leading) ? 0 : edges.contains(.trailing) ? 1 : 0.5,
      y: edges.contains(.top) ? 0 : edges.contains(.bottom) ? 1 : 0.5
    )
  }
}
