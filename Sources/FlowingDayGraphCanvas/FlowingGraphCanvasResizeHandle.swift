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
