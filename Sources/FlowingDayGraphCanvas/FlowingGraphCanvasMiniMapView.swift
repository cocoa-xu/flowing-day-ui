import FlowingDayCanvas
import FlowingDayGraphComposition
import FlowingDayGraphCore
import FlowingDayGraphLayout
import SwiftUI

public struct FlowingGraphCanvasMiniMap<
  Schema: FlowingGraphCanvasSchema,
  Decorations: View
>: View {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  private struct ResolvedSnapshot {
    let inputID: FlowingLayoutInputID
    let snapshot: FlowingGraphMiniMapSnapshot<ElementID, ElementID>
  }

  private let content: FlowingGraphCanvasContent<Schema>
  private let viewportDriver: FlowingGraphMiniMapViewportDriver
  private let configuration: FlowingGraphMiniMapConfiguration
  private let style: FlowingGraphMiniMapStyle
  private let styleRevision: UInt64
  private let nodeStyleIndex: @Sendable (FlowingGraphMiniMapNode<ElementID>) -> Int
  private let decorations:
    (FlowingGraphMiniMapRenderingContext<ElementID, ElementID>) -> Decorations

  @State private var resolvedSnapshot: ResolvedSnapshot?

  public init(
    content: FlowingGraphCanvasContent<Schema>,
    viewportDriver: FlowingGraphMiniMapViewportDriver,
    configuration: FlowingGraphMiniMapConfiguration = .init(),
    style: FlowingGraphMiniMapStyle = .init(),
    styleRevision: UInt64 = 0,
    nodeStyleIndex:
      @escaping @Sendable (FlowingGraphMiniMapNode<ElementID>) -> Int = { _ in 0 },
    @ViewBuilder decorations:
      @escaping (
        FlowingGraphMiniMapRenderingContext<ElementID, ElementID>
      ) -> Decorations
  ) {
    self.content = content
    self.viewportDriver = viewportDriver
    self.configuration = configuration
    self.style = style
    self.styleRevision = styleRevision
    self.nodeStyleIndex = nodeStyleIndex
    self.decorations = decorations
  }

  public var body: some View {
    Group {
      if let resolvedSnapshot, resolvedSnapshot.inputID == content.id {
        FlowingGraphMiniMap(
          snapshot: resolvedSnapshot.snapshot,
          viewportDriver: viewportDriver,
          configuration: configuration,
          style: style,
          styleRevision: styleRevision,
          nodeStyleIndex: nodeStyleIndex,
          decorations: decorations
        )
      } else {
        Color.clear
          .frame(width: configuration.size.width, height: configuration.size.height)
          .allowsHitTesting(false)
      }
    }
    .task(id: content.id) {
      resolvedSnapshot = nil
      let inputID = content.id
      let source = content.miniMapSnapshotSource()
      let task = Task.detached(priority: .userInitiated) {
        try source.makeSnapshot()
      }
      do {
        let snapshot = try await withTaskCancellationHandler {
          try await task.value
        } onCancel: {
          task.cancel()
        }
        guard !Task.isCancelled, inputID == content.id else { return }
        resolvedSnapshot = ResolvedSnapshot(inputID: inputID, snapshot: snapshot)
      } catch {
        return
      }
    }
  }
}

extension FlowingGraphCanvasMiniMap {
  public init(
    content: FlowingGraphCanvasContent<Schema>,
    proxy: FlowingCanvasProxy,
    configuration: FlowingGraphMiniMapConfiguration = .init(),
    style: FlowingGraphMiniMapStyle = .init(),
    styleRevision: UInt64 = 0,
    nodeStyleIndex:
      @escaping @Sendable (FlowingGraphMiniMapNode<ElementID>) -> Int = { _ in 0 },
    @ViewBuilder decorations:
      @escaping (
        FlowingGraphMiniMapRenderingContext<ElementID, ElementID>
      ) -> Decorations
  ) {
    self.init(
      content: content,
      viewportDriver: FlowingGraphMiniMapViewportDriver(proxy: proxy),
      configuration: configuration,
      style: style,
      styleRevision: styleRevision,
      nodeStyleIndex: nodeStyleIndex,
      decorations: decorations
    )
  }
}

extension FlowingGraphCanvasMiniMap where Decorations == EmptyView {
  public init(
    content: FlowingGraphCanvasContent<Schema>,
    viewportDriver: FlowingGraphMiniMapViewportDriver,
    configuration: FlowingGraphMiniMapConfiguration = .init(),
    style: FlowingGraphMiniMapStyle = .init(),
    styleRevision: UInt64 = 0,
    nodeStyleIndex:
      @escaping @Sendable (FlowingGraphMiniMapNode<ElementID>) -> Int = { _ in 0 }
  ) {
    self.init(
      content: content,
      viewportDriver: viewportDriver,
      configuration: configuration,
      style: style,
      styleRevision: styleRevision,
      nodeStyleIndex: nodeStyleIndex,
      decorations: { _ in EmptyView() }
    )
  }

  public init(
    content: FlowingGraphCanvasContent<Schema>,
    proxy: FlowingCanvasProxy,
    configuration: FlowingGraphMiniMapConfiguration = .init(),
    style: FlowingGraphMiniMapStyle = .init(),
    styleRevision: UInt64 = 0,
    nodeStyleIndex:
      @escaping @Sendable (FlowingGraphMiniMapNode<ElementID>) -> Int = { _ in 0 }
  ) {
    self.init(
      content: content,
      viewportDriver: FlowingGraphMiniMapViewportDriver(proxy: proxy),
      configuration: configuration,
      style: style,
      styleRevision: styleRevision,
      nodeStyleIndex: nodeStyleIndex
    )
  }
}
