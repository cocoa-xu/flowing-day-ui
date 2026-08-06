import FlowingDayCanvas
import FlowingDayGraphCanvas
import FlowingDayGraphComposition
import FlowingDayGraphLayout
import SwiftUI

public enum FlowingGraphExportCanvasIssue: Error, Equatable, Sendable {
  case layoutInputIdentityMismatch
}

@MainActor
public struct FlowingGraphExportWorldContext<Schema: FlowingGraphCanvasSchema> {
  public let content: FlowingGraphCanvasContent<Schema>
  public let slice: FlowingGraphExportSlice<Schema>
  public let geometry: FlowingCanvasExportGeometry
  public let selection: Set<FlowingGraphCompositionElementID<Schema>>
  public let renderContext: FlowingCanvasRenderContext
  public let surface: FlowingCanvasRenderSurface
}

public struct FlowingGraphExportCanvas<
  Schema: FlowingGraphCanvasSchema,
  Background: View,
  NodeContent: View,
  EdgeContent: View,
  PortContent: View,
  Decorations: View
>: View {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>
  public typealias LocalElementID = FlowingGraphPresentationLocalElementID<Schema>

  private let content: FlowingGraphCanvasContent<Schema>
  private let slice: FlowingGraphExportSlice<Schema>
  private let geometry: FlowingCanvasExportGeometry
  private let selection: Set<ElementID>
  private let edgeRenderPadding: CGFloat
  private let background: (FlowingCanvasRenderContext) -> Background
  private let nodeContent:
    (FlowingGraphPresentationNode<Schema>, FlowingGraphCanvasNodeContext<Schema>) -> NodeContent
  private let edgeContent:
    (FlowingGraphPresentationEdge<Schema>, FlowingGraphCanvasEdgeContext<Schema>) -> EdgeContent
  private let portContent:
    (FlowingGraphPresentationPort<Schema>, FlowingGraphCanvasPortContext<Schema>) -> PortContent
  private let decorations: (FlowingGraphExportWorldContext<Schema>) -> Decorations

  public init(
    content: FlowingGraphCanvasContent<Schema>,
    slice: FlowingGraphExportSlice<Schema>,
    geometry: FlowingCanvasExportGeometry,
    selection: Set<ElementID> = [],
    edgeRenderPadding: CGFloat = 12,
    @ViewBuilder background: @escaping (FlowingCanvasRenderContext) -> Background,
    @ViewBuilder node:
      @escaping (
        FlowingGraphPresentationNode<Schema>,
        FlowingGraphCanvasNodeContext<Schema>
      ) -> NodeContent,
    @ViewBuilder edge:
      @escaping (
        FlowingGraphPresentationEdge<Schema>,
        FlowingGraphCanvasEdgeContext<Schema>
      ) -> EdgeContent,
    @ViewBuilder port:
      @escaping (
        FlowingGraphPresentationPort<Schema>,
        FlowingGraphCanvasPortContext<Schema>
      ) -> PortContent,
    @ViewBuilder decorations:
      @escaping (FlowingGraphExportWorldContext<Schema>) -> Decorations
  ) throws {
    guard content.id == slice.inputID else {
      throw FlowingGraphExportCanvasIssue.layoutInputIdentityMismatch
    }
    precondition(edgeRenderPadding >= 0 && edgeRenderPadding.isFinite)
    self.content = content
    self.slice = slice
    self.geometry = geometry
    self.selection = selection.intersection(slice.elementIDs)
    self.edgeRenderPadding = edgeRenderPadding
    self.background = background
    nodeContent = node
    edgeContent = edge
    portContent = port
    self.decorations = decorations
  }

  public var body: some View {
    let context = renderContext
    ZStack(alignment: .topLeading) {
      background(context)

      ForEach(slice.edgeLocalIDs, id: \.self) { localID in
        edgeView(localID, context: context)
      }
      ForEach(slice.nodeLocalIDs, id: \.self) { localID in
        nodeView(localID, context: context)
      }
      ForEach(slice.portLocalIDs, id: \.self) { localID in
        portView(localID, context: context)
      }
      FlowingCanvasWorldLayer(context: context) { surface in
        decorations(
          FlowingGraphExportWorldContext(
            content: content,
            slice: slice,
            geometry: geometry,
            selection: selection,
            renderContext: context,
            surface: surface
          )
        )
      }
    }
    .frame(width: geometry.outputSize.width, height: geometry.outputSize.height)
    .clipped()
    .allowsHitTesting(false)
  }

  private var renderContext: FlowingCanvasRenderContext {
    FlowingCanvasRenderContext(
      viewport: FlowingCanvasViewport(
        transform: geometry.worldTransform,
        size: geometry.outputSize,
        contentBounds: CGRect(origin: .zero, size: geometry.outputSize)
      ),
      renderWorldRect: geometry.exportBounds
    )
  }

  @ViewBuilder
  private func nodeView(
    _ localID: LocalElementID,
    context: FlowingCanvasRenderContext
  ) -> some View {
    if let node = content.node(for: localID),
      let frame = content.frame(for: localID)
    {
      let renderedFrame = context.transform.applying(to: frame)
      nodeContent(
        node,
        FlowingGraphCanvasNodeContext(
          elementID: node.id,
          localID: localID,
          baseFrame: frame,
          frame: frame,
          renderedFrame: renderedFrame,
          renderScale: context.zoom,
          isSelected: selection.contains(node.id),
          isHovered: false,
          isBeingDragged: false,
          actions: .disabled
        )
      )
      .frame(width: renderedFrame.width, height: renderedFrame.height)
      .position(x: renderedFrame.midX, y: renderedFrame.midY)
    }
  }

  @ViewBuilder
  private func portView(
    _ localID: LocalElementID,
    context: FlowingCanvasRenderContext
  ) -> some View {
    if let port = content.port(for: localID),
      let nodeLocalID = content.nodeLocalID(for: localID),
      let anchor = content.anchor(for: localID)
    {
      let renderedPosition = context.transform.applying(to: anchor.position)
      portContent(
        port,
        FlowingGraphCanvasPortContext(
          elementID: port.id,
          localID: localID,
          nodeLocalID: nodeLocalID,
          anchor: anchor,
          renderedPosition: renderedPosition,
          renderScale: context.zoom,
          isSelected: selection.contains(port.id),
          isHovered: false,
          actions: .disabled
        )
      )
      .position(renderedPosition)
    }
  }

  @ViewBuilder
  private func edgeView(
    _ localID: LocalElementID,
    context: FlowingCanvasRenderContext
  ) -> some View {
    if let edge = content.edge(for: localID),
      let route = content.route(for: localID),
      let anchors = content.edgeAnchors(for: localID)
    {
      let worldPadding = edgeRenderPadding / context.zoom
      let worldFrame = route.conservativeBounds.insetBy(
        dx: -worldPadding,
        dy: -worldPadding
      )
      let renderedFrame = context.transform.applying(to: worldFrame)
      let renderedRoute = FlowingGraphCanvasRenderingGeometry.transformed(
        route,
        by: context.transform,
        relativeTo: renderedFrame.origin
      )
      edgeContent(
        edge,
        FlowingGraphCanvasEdgeContext(
          elementID: edge.id,
          localID: localID,
          worldRoute: route,
          renderedRoute: renderedRoute,
          anchors: anchors,
          worldFrame: worldFrame,
          renderedFrame: renderedFrame,
          renderScale: context.zoom,
          isSelected: selection.contains(edge.id),
          isHovered: false,
          isTransient: false,
          actions: .disabled
        )
      )
      .frame(width: renderedFrame.width, height: renderedFrame.height)
      .position(x: renderedFrame.midX, y: renderedFrame.midY)
    }
  }
}

extension FlowingGraphExportCanvas where PortContent == EmptyView, Decorations == EmptyView {
  public init(
    content: FlowingGraphCanvasContent<Schema>,
    slice: FlowingGraphExportSlice<Schema>,
    geometry: FlowingCanvasExportGeometry,
    selection: Set<ElementID> = [],
    edgeRenderPadding: CGFloat = 12,
    @ViewBuilder background: @escaping (FlowingCanvasRenderContext) -> Background,
    @ViewBuilder node:
      @escaping (
        FlowingGraphPresentationNode<Schema>,
        FlowingGraphCanvasNodeContext<Schema>
      ) -> NodeContent,
    @ViewBuilder edge:
      @escaping (
        FlowingGraphPresentationEdge<Schema>,
        FlowingGraphCanvasEdgeContext<Schema>
      ) -> EdgeContent
  ) throws {
    try self.init(
      content: content,
      slice: slice,
      geometry: geometry,
      selection: selection,
      edgeRenderPadding: edgeRenderPadding,
      background: background,
      node: node,
      edge: edge,
      port: { _, _ in EmptyView() },
      decorations: { _ in EmptyView() }
    )
  }
}
