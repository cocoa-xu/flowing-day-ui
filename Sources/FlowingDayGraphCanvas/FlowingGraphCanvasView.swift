import FlowingDayCanvas
import FlowingDayGraphComposition
import FlowingDayGraphLayout
import SwiftUI

public struct FlowingGraphCanvas<
  Schema: FlowingGraphCanvasSchema,
  Background: View,
  NodeContent: View,
  EdgeContent: View,
  PortContent: View,
  Decorations: View,
  Overlays: View
>: View {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>
  public typealias LocalElementID = FlowingGraphPresentationLocalElementID<Schema>

  private let content: FlowingGraphCanvasContent<Schema>
  private let sessionID: FlowingGraphCanvasSessionID
  @Binding private var session: FlowingGraphCanvasSessionState<Schema>
  private let configuration: FlowingGraphCanvasConfiguration
  private let contentInsets: EdgeInsets
  private let contentChangeBehavior: FlowingCanvasContentChangeBehavior
  private let command: FlowingGraphCanvasSessionCommand<Schema>?
  private let nodeCapabilities: FlowingGraphCanvasNodeCapabilityMap<Schema>
  private let admitNodeDrag:
    @MainActor (FlowingGraphCanvasNodeDragAdmissionRequest<Schema>) ->
    FlowingGraphCanvasNodeDragAdmission<Schema>
  private let isAdditiveSelectionActive: @MainActor () -> Bool
  private let onSmartMagnify:
    (FlowingGraphCanvasSmartMagnifyContext<Schema>) -> FlowingCanvasViewportAction
  private let onViewportChange: (FlowingCanvasViewport, FlowingCanvasViewportChangePhase) -> Void
  private let onIntent: (FlowingGraphCanvasInteractionIntent<Schema>) -> Void
  private let background: (FlowingCanvasRenderContext) -> Background
  private let nodeContent:
    (FlowingGraphPresentationNode<Schema>, FlowingGraphCanvasNodeContext<Schema>) -> NodeContent
  private let edgeContent:
    (FlowingGraphPresentationEdge<Schema>, FlowingGraphCanvasEdgeContext<Schema>) -> EdgeContent
  private let portContent:
    (FlowingGraphPresentationPort<Schema>, FlowingGraphCanvasPortContext<Schema>) -> PortContent
  private let decorations: (FlowingGraphCanvasWorldContext<Schema>) -> Decorations
  private let overlays: (FlowingGraphCanvasOverlayContext<Schema>) -> Overlays

  @State private var canvasRequest: FlowingCanvasRequest?
  @State private var handledCommandID: UUID?
  @State private var rejectedNodeDragID: ElementID?

  public init(
    content: FlowingGraphCanvasContent<Schema>,
    sessionID: FlowingGraphCanvasSessionID,
    session: Binding<FlowingGraphCanvasSessionState<Schema>>,
    configuration: FlowingGraphCanvasConfiguration = .init(),
    contentInsets: EdgeInsets = .init(),
    contentChangeBehavior: FlowingCanvasContentChangeBehavior = .preserveViewport,
    command: FlowingGraphCanvasSessionCommand<Schema>? = nil,
    nodeCapabilities: FlowingGraphCanvasNodeCapabilityMap<Schema> = .init(),
    admitNodeDrag:
      @escaping @MainActor (FlowingGraphCanvasNodeDragAdmissionRequest<Schema>) ->
      FlowingGraphCanvasNodeDragAdmission<Schema> = { _ in .allowAll },
    isAdditiveSelectionActive: @escaping @MainActor () -> Bool = {
      FlowingGraphCanvasPlatformInput.isAdditiveSelectionActive
    },
    onSmartMagnify:
      @escaping (FlowingGraphCanvasSmartMagnifyContext<Schema>) ->
      FlowingCanvasViewportAction = { context in
        context.standardAction(focusedZoom: 1, fitPadding: 48)
      },
    onViewportChange:
      @escaping (FlowingCanvasViewport, FlowingCanvasViewportChangePhase) -> Void = {
        _, _ in
      },
    onIntent: @escaping (FlowingGraphCanvasInteractionIntent<Schema>) -> Void = { _ in },
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
      @escaping (FlowingGraphCanvasWorldContext<Schema>) -> Decorations,
    @ViewBuilder overlays:
      @escaping (FlowingGraphCanvasOverlayContext<Schema>) -> Overlays
  ) {
    self.content = content
    self.sessionID = sessionID
    _session = session
    self.configuration = configuration
    self.contentInsets = contentInsets
    self.contentChangeBehavior = contentChangeBehavior
    self.command = command
    self.nodeCapabilities = nodeCapabilities
    self.admitNodeDrag = admitNodeDrag
    self.isAdditiveSelectionActive = isAdditiveSelectionActive
    self.onSmartMagnify = onSmartMagnify
    self.onViewportChange = onViewportChange
    self.onIntent = onIntent
    self.background = background
    nodeContent = node
    edgeContent = edge
    portContent = port
    self.decorations = decorations
    self.overlays = overlays
  }

  public var body: some View {
    FlowingCanvas(
      viewport: $session.viewport,
      configuration: configuration.canvas,
      contentRect: content.contentBounds,
      contentID: content.id,
      contentInsets: contentInsets,
      contentChangeBehavior: contentChangeBehavior,
      interactionMode: session.tool == .pan ? .pan : .content,
      request: canvasRequest,
      onContentDragChanged: updateMarquee,
      onContentDragEnded: commitMarquee,
      onSmartMagnify: handleSmartMagnify,
      onViewportChange: onViewportChange
    ) { context in
      background(context)
    } world: { context in
      graphLayer(context: context)
    } overlays: { proxy in
      overlays(
        FlowingGraphCanvasOverlayContext(
          sessionID: sessionID,
          content: content,
          session: session,
          proxy: proxy
        )
      )
      if let marquee = session.marquee {
        marqueeOverlay(marquee.rect)
      }
    }
    .onAppear {
      reconcileSession()
      handleCommand(command)
    }
    .onChange(of: content.id) { _ in
      reconcileSession()
    }
    .onChange(of: command) { newCommand in
      handleCommand(newCommand)
    }
    .onChange(of: session.tool) { _ in
      session.marquee = nil
      session.transientNodeDrag = nil
      rejectedNodeDragID = nil
    }
  }

  private func graphLayer(context: FlowingCanvasRenderContext) -> some View {
    FlowingCanvasWorldLayer(context: context) { surface in
      let slice = visibleSlice(in: context.renderWorldRect)
      ZStack(alignment: .topLeading) {
        ForEach(slice.edgeIDs, id: \.self) { edgeID in
          edgeView(edgeID, context: context, surface: surface)
        }
        ForEach(slice.nodeIDs, id: \.self) { nodeID in
          nodeView(nodeID, context: context, surface: surface)
        }
        ForEach(slice.portIDs, id: \.self) { portID in
          portView(portID, context: context, surface: surface)
        }
        decorations(
          FlowingGraphCanvasWorldContext(
            content: content,
            session: session,
            renderContext: context,
            surface: surface
          )
        )
      }
    }
  }

  @ViewBuilder
  private func nodeView(
    _ localID: LocalElementID,
    context: FlowingCanvasRenderContext,
    surface: FlowingCanvasRenderSurface
  ) -> some View {
    if let node = content.node(for: localID),
      let baseFrame = content.frame(for: localID)
    {
      let elementID = node.id
      let delta = translation(for: localID)
      let frame = baseFrame.offsetBy(dx: delta.width, dy: delta.height)
      let renderedFrame = surface.localTransform.applying(to: frame)
      let capabilities = nodeCapabilities.capabilities(for: elementID)
      let nodeContext = FlowingGraphCanvasNodeContext(
        elementID: elementID,
        localID: localID,
        baseFrame: baseFrame,
        frame: frame,
        renderedFrame: renderedFrame,
        renderScale: context.zoom,
        isSelected: session.selection.contains(elementID),
        isHovered: session.hoveredElementID == elementID,
        isBeingDragged: session.transientNodeDrag?.nodeIDs.contains(elementID) == true,
        capabilities: capabilities,
        actions: actions(for: elementID)
      )
      nodeContent(node, nodeContext)
        .frame(width: renderedFrame.width, height: renderedFrame.height)
        .position(x: renderedFrame.midX, y: renderedFrame.midY)
        .contentShape(Rectangle())
        .allowsHitTesting(session.tool == .select)
        .gesture(nodeDragGesture(elementID: elementID))
        .onTapGesture {
          select(elementID, mode: nil)
        }
        .onHover { isHovering in
          setHovered(elementID, isHovering: isHovering)
        }
        .accessibilityElement(children: .contain)
        .accessibilitySortPriority(
          Double(
            content.presentation.nodes.count - (content.nodePresentationOrder(for: localID) ?? 0)
          )
        )
    }
  }

  @ViewBuilder
  private func portView(
    _ localID: LocalElementID,
    context: FlowingCanvasRenderContext,
    surface: FlowingCanvasRenderSurface
  ) -> some View {
    if let port = content.port(for: localID),
      let nodeLocalID = content.nodeLocalID(for: localID),
      let baseAnchor = content.anchor(for: localID)
    {
      let elementID = port.id
      let delta = translation(for: nodeLocalID)
      let anchor = FlowingGraphCanvasAnchor(
        position: translated(baseAnchor.position, by: delta),
        normal: baseAnchor.normal
      )
      let renderedPosition = surface.localTransform.applying(to: anchor.position)
      let portContext = FlowingGraphCanvasPortContext(
        elementID: elementID,
        localID: localID,
        nodeLocalID: nodeLocalID,
        anchor: anchor,
        renderedPosition: renderedPosition,
        renderScale: context.zoom,
        isSelected: session.selection.contains(elementID),
        isHovered: session.hoveredElementID == elementID,
        actions: actions(for: elementID)
      )
      portContent(port, portContext)
        .position(renderedPosition)
        .allowsHitTesting(session.tool == .select)
        .onTapGesture {
          select(elementID, mode: nil)
        }
        .onHover { isHovering in
          setHovered(elementID, isHovering: isHovering)
        }
    }
  }

  @ViewBuilder
  private func edgeView(
    _ localID: LocalElementID,
    context: FlowingCanvasRenderContext,
    surface: FlowingCanvasRenderSurface
  ) -> some View {
    if let edge = content.edge(for: localID),
      let baseRoute = content.route(for: localID),
      let anchors = content.edgeAnchors(for: localID),
      let endpointNodeIDs = content.endpointNodeLocalIDs(for: localID)
    {
      let firstDelta = translation(for: endpointNodeIDs.first)
      let secondDelta = translation(for: endpointNodeIDs.second)
      let isTransient = firstDelta != .zero || secondDelta != .zero
      let worldRoute =
        isTransient
        ? FlowingGraphCanvasTransientGeometry.deforming(
          baseRoute,
          firstEndpointDelta: firstDelta,
          secondEndpointDelta: secondDelta
        )
        : baseRoute
      let resolvedAnchors = FlowingGraphCanvasEdgeAnchors(
        first: FlowingGraphCanvasRenderingGeometry.translated(anchors.first, by: firstDelta),
        second: FlowingGraphCanvasRenderingGeometry.translated(anchors.second, by: secondDelta),
        isDirected: anchors.isDirected
      )
      let worldPadding = configuration.edgeRenderPadding / context.zoom
      let worldFrame = worldRoute.conservativeBounds.insetBy(
        dx: -worldPadding,
        dy: -worldPadding
      )
      let renderedFrame = surface.localTransform.applying(to: worldFrame)
      let renderedRoute = FlowingGraphCanvasRenderingGeometry.transformed(
        worldRoute,
        by: surface.localTransform,
        relativeTo: renderedFrame.origin
      )
      let edgeContext = FlowingGraphCanvasEdgeContext(
        elementID: edge.id,
        localID: localID,
        worldRoute: worldRoute,
        renderedRoute: renderedRoute,
        anchors: resolvedAnchors,
        worldFrame: worldFrame,
        renderedFrame: renderedFrame,
        renderScale: context.zoom,
        isSelected: session.selection.contains(edge.id),
        isHovered: session.hoveredElementID == edge.id,
        isTransient: isTransient,
        actions: actions(for: edge.id)
      )
      edgeContent(edge, edgeContext)
        .frame(width: renderedFrame.width, height: renderedFrame.height)
        .position(x: renderedFrame.midX, y: renderedFrame.midY)
        .allowsHitTesting(session.tool == .select)
    }
  }

  private func visibleSlice(in rect: CGRect) -> (
    nodeIDs: [LocalElementID],
    edgeIDs: [LocalElementID],
    portIDs: [LocalElementID]
  ) {
    let slice = content.renderSlice(intersecting: rect)
    var nodeIDs = slice.nodeIDs
    var edgeIDs = slice.edgeIDs
    if let drag = activeNodeDrag, drag.translation != .zero {
      var knownNodeIDs = Set(nodeIDs)
      var knownEdgeIDs = Set(edgeIDs)
      let sourceRect = rect.offsetBy(
        dx: -drag.translation.width,
        dy: -drag.translation.height
      )
      let translatedSlice = content.renderSlice(intersecting: sourceRect)
      for nodeID in translatedSlice.nodeIDs where isBeingDragged(nodeID) {
        if knownNodeIDs.insert(nodeID).inserted {
          nodeIDs.append(nodeID)
        }
        for edgeID in content.incidentEdgeLocalIDs(of: nodeID) {
          if knownEdgeIDs.insert(edgeID).inserted {
            edgeIDs.append(edgeID)
          }
        }
      }
    }
    let portIDs = nodeIDs.flatMap(content.portLocalIDs)
    return (nodeIDs, edgeIDs, portIDs)
  }

  private var activeNodeDrag: FlowingGraphCanvasTransientNodeDrag<Schema>? {
    guard let drag = session.transientNodeDrag,
      drag.basePresentationSnapshotID == content.presentation.snapshotID
    else {
      return nil
    }
    return drag
  }

  private func isBeingDragged(_ nodeLocalID: LocalElementID) -> Bool {
    guard let elementID = content.elementID(for: nodeLocalID) else { return false }
    return activeNodeDrag?.nodeIDs.contains(elementID) == true
  }

  private func translation(for nodeLocalID: LocalElementID) -> CGSize {
    isBeingDragged(nodeLocalID) ? activeNodeDrag?.translation ?? .zero : .zero
  }

  private func nodeDragGesture(elementID: ElementID) -> some Gesture {
    DragGesture(minimumDistance: configuration.canvas.dragMinimumDistance)
      .onChanged { value in
        guard session.tool == .select else { return }
        guard rejectedNodeDragID != elementID else { return }
        if activeNodeDrag?.nodeID != elementID {
          guard
            let request = FlowingGraphCanvasNodeDragResolver.request(
              anchorNodeID: elementID,
              selection: session.selection,
              presentation: content.presentation,
              mode: configuration.nodeDraggingMode,
              capabilities: nodeCapabilities
            )
          else {
            rejectedNodeDragID = elementID
            return
          }
          let admittedNodeIDs = FlowingGraphCanvasNodeDragResolver.admittedNodeIDs(
            for: request,
            admission: admitNodeDrag(request)
          )
          guard !admittedNodeIDs.isEmpty else {
            rejectedNodeDragID = elementID
            return
          }
          if !session.selection.contains(elementID) {
            session.selection = [elementID]
          }
          session.focusedElementID = elementID
          session.transientNodeDrag = FlowingGraphCanvasTransientNodeDrag(
            nodeID: elementID,
            nodeIDs: admittedNodeIDs,
            basePresentationSnapshotID: content.presentation.snapshotID
          )
        }
        session.transientNodeDrag?.translation = CGSize(
          width: value.translation.width / session.viewport.transform.zoom,
          height: value.translation.height / session.viewport.transform.zoom
        )
      }
      .onEnded { _ in
        defer { rejectedNodeDragID = nil }
        guard let drag = session.transientNodeDrag,
          drag.nodeID == elementID,
          drag.basePresentationSnapshotID == content.presentation.snapshotID
        else {
          return
        }
        onIntent(
          .nodeDragCompleted(
            FlowingGraphCanvasNodeDragIntent(
              nodeID: drag.nodeID,
              nodeIDs: drag.nodeIDs,
              basePresentationSnapshotID: drag.basePresentationSnapshotID,
              translation: drag.translation
            )
          )
        )
        if session.transientNodeDrag == drag {
          session.transientNodeDrag = nil
        }
      }
  }

  private func updateMarquee(_ context: FlowingCanvasDragContext) {
    session.marquee = FlowingGraphCanvasMarquee(
      startLocation: context.startLocation,
      location: context.location
    )
  }

  private func commitMarquee(_ context: FlowingCanvasDragContext) {
    defer { session.marquee = nil }
    let distance = hypot(context.translation.width, context.translation.height)
    guard distance >= configuration.marqueeMinimumDistance else { return }
    var worldRect = CGRect(
      x: min(context.worldStartLocation.x, context.worldLocation.x),
      y: min(context.worldStartLocation.y, context.worldLocation.y),
      width: abs(context.worldLocation.x - context.worldStartLocation.x),
      height: abs(context.worldLocation.y - context.worldStartLocation.y)
    )
    let minimumWorldDimension = 1 / session.viewport.transform.zoom
    if worldRect.width == 0 {
      worldRect = worldRect.insetBy(dx: -minimumWorldDimension / 2, dy: 0)
    }
    if worldRect.height == 0 {
      worldRect = worldRect.insetBy(dx: 0, dy: -minimumWorldDimension / 2)
    }
    let elementIDs = Set(
      content.nodeLocalIDs(intersecting: worldRect).compactMap(content.elementID)
    )
    let command: FlowingGraphCanvasSelectionCommand<Schema> =
      isAdditiveSelectionActive() ? .add(elementIDs) : .replace(elementIDs)
    FlowingGraphCanvasSessionReducer.apply(command, to: &session.selection)
  }

  private func handleSmartMagnify(
    _ canvasContext: FlowingCanvasSmartMagnifyContext
  ) -> FlowingCanvasViewportAction {
    let localID = nearestNodeLocalID(to: canvasContext.worldLocation)
    let elementID = localID.flatMap(content.elementID)
    let context = FlowingGraphCanvasSmartMagnifyContext<Schema>(
      canvas: canvasContext,
      nearestNodeID: elementID,
      nearestNodeFrame: localID.flatMap(resolvedNodeFrame),
      focusedElementID: session.focusedElementID,
      focusedElementBounds: session.focusedElementID.flatMap(resolvedBounds)
    )
    return onSmartMagnify(context)
  }

  private func actions(
    for elementID: ElementID
  ) -> FlowingGraphCanvasElementActions<Schema> {
    FlowingGraphCanvasElementActions(
      select: { mode in
        select(elementID, mode: mode)
      },
      send: { action in
        onIntent(
          .elementAction(
            FlowingGraphCanvasElementActionIntent(
              action: action,
              elementID: elementID,
              basePresentationSnapshotID: content.presentation.snapshotID
            )
          )
        )
      }
    )
  }

  private func select(
    _ elementID: ElementID,
    mode requestedMode: FlowingGraphCanvasSelectionMode?
  ) {
    let mode = requestedMode ?? (isAdditiveSelectionActive() ? .toggle : .replace)
    let command: FlowingGraphCanvasSelectionCommand<Schema>
    switch mode {
    case .replace:
      command = .replace([elementID])
    case .additive:
      command = .add([elementID])
    case .toggle:
      command = .toggle([elementID])
    }
    FlowingGraphCanvasSessionReducer.apply(command, to: &session.selection)
    session.focusedElementID = elementID
  }

  private func setHovered(_ elementID: ElementID, isHovering: Bool) {
    if isHovering {
      session.hoveredElementID = elementID
    } else if session.hoveredElementID == elementID {
      session.hoveredElementID = nil
    }
  }

  private func reconcileSession() {
    session.selection.formIntersection(content.elementIDs)
    if let focusedElementID = session.focusedElementID,
      !content.contains(focusedElementID)
    {
      session.focusedElementID = nil
    }
    if let hoveredElementID = session.hoveredElementID,
      !content.contains(hoveredElementID)
    {
      session.hoveredElementID = nil
    }
    if session.transientNodeDrag?.basePresentationSnapshotID != content.presentation.snapshotID {
      session.transientNodeDrag = nil
    }
  }

  private func handleCommand(_ command: FlowingGraphCanvasSessionCommand<Schema>?) {
    guard let command,
      command.targets(sessionID),
      handledCommandID != command.id
    else {
      return
    }
    handledCommandID = command.id
    switch command.action {
    case .focus(let elementID, let zoom):
      guard let bounds = resolvedBounds(for: elementID) else { return }
      session.focusedElementID = elementID
      canvasRequest = FlowingCanvasRequest(
        id: command.id,
        action: .focus(rect: bounds, zoom: zoom),
        animated: command.animated
      )
    case .pan(let worldPoint, let viewportPoint, let zoom):
      let action: FlowingCanvasViewportAction
      if let viewportPoint {
        action = .anchor(
          worldPoint: worldPoint,
          viewportPoint: viewportPoint,
          zoom: zoom ?? session.viewport.transform.zoom
        )
      } else {
        action = .focus(
          rect: CGRect(origin: worldPoint, size: .zero),
          zoom: zoom
        )
      }
      canvasRequest = FlowingCanvasRequest(
        id: command.id,
        action: action,
        animated: command.animated
      )
    case .restoreViewport(let transform):
      canvasRequest = FlowingCanvasRequest(
        id: command.id,
        action: .anchor(
          worldPoint: .zero,
          viewportPoint: CGPoint(
            x: transform.offset.width,
            y: transform.offset.height
          ),
          zoom: transform.zoom
        ),
        animated: command.animated
      )
    case .select(let selectionCommand):
      FlowingGraphCanvasSessionReducer.apply(
        filtered(selectionCommand),
        to: &session.selection
      )
    case .fit(let scope, let padding, let maximumZoom):
      guard let bounds = bounds(for: scope) else { return }
      canvasRequest = FlowingCanvasRequest(
        id: command.id,
        action: .fit(rect: bounds, padding: padding, maximumZoom: maximumZoom),
        animated: command.animated
      )
    case .inspect(let elementID):
      guard content.contains(elementID) else { return }
      onIntent(
        .elementAction(
          FlowingGraphCanvasElementActionIntent(
            action: .inspect,
            elementID: elementID,
            basePresentationSnapshotID: content.presentation.snapshotID
          )
        )
      )
    }
  }

  private func filtered(
    _ command: FlowingGraphCanvasSelectionCommand<Schema>
  ) -> FlowingGraphCanvasSelectionCommand<Schema> {
    switch command {
    case .replace(let ids):
      return .replace(ids.filter(content.contains))
    case .add(let ids):
      return .add(ids.filter(content.contains))
    case .remove(let ids):
      return .remove(ids.filter(content.contains))
    case .toggle(let ids):
      return .toggle(ids.filter(content.contains))
    case .clear:
      return .clear
    }
  }

  private func bounds(
    for scope: FlowingGraphCanvasFitScope<Schema>
  ) -> CGRect? {
    switch scope {
    case .presentation:
      return content.contentBounds
    case .selection:
      return resolvedBounds(for: session.selection)
    case .elements(let ids):
      return resolvedBounds(for: ids)
    }
  }

  private func resolvedBounds(for elementIDs: Set<ElementID>) -> CGRect? {
    elementIDs.compactMap(resolvedBounds).reduce(nil) { bounds, next in
      bounds?.union(next) ?? next
    }
  }

  private func resolvedBounds(for elementID: ElementID) -> CGRect? {
    guard let localID = content.localID(for: elementID) else { return nil }
    if let frame = resolvedNodeFrame(localID) {
      return frame
    }
    if let anchor = content.anchor(for: localID),
      let nodeID = content.nodeLocalID(for: localID)
    {
      return CGRect(
        origin: translated(anchor.position, by: translation(for: nodeID)),
        size: .zero
      )
    }
    guard let route = resolvedEdgeRoute(localID) else { return nil }
    return route.conservativeBounds
  }

  private func resolvedNodeFrame(_ localID: LocalElementID) -> CGRect? {
    guard let frame = content.frame(for: localID) else { return nil }
    let delta = translation(for: localID)
    return frame.offsetBy(dx: delta.width, dy: delta.height)
  }

  private func resolvedEdgeRoute(_ localID: LocalElementID) -> FlowingGraphEdgeRoute? {
    guard let route = content.route(for: localID),
      let endpoints = content.endpointNodeLocalIDs(for: localID)
    else {
      return nil
    }
    let firstDelta = translation(for: endpoints.first)
    let secondDelta = translation(for: endpoints.second)
    guard firstDelta != .zero || secondDelta != .zero else { return route }
    return FlowingGraphCanvasTransientGeometry.deforming(
      route,
      firstEndpointDelta: firstDelta,
      secondEndpointDelta: secondDelta
    )
  }

  private func nearestNodeLocalID(to point: CGPoint) -> LocalElementID? {
    let draggedNodeIDs = Set(
      activeNodeDrag?.nodeIDs.compactMap(content.localID) ?? []
    )
    guard !draggedNodeIDs.isEmpty else {
      return content.nearestNodeLocalID(to: point)
    }
    let draggedNodeID = draggedNodeIDs.min { first, second in
      let firstDistance = resolvedNodeFrame(first).map {
        squaredDistance(from: point, to: $0)
      } ?? .greatestFiniteMagnitude
      let secondDistance = resolvedNodeFrame(second).map {
        squaredDistance(from: point, to: $0)
      } ?? .greatestFiniteMagnitude
      return firstDistance < secondDistance
    }
    guard let draggedNodeID, let draggedFrame = resolvedNodeFrame(draggedNodeID) else {
      return content.nearestNodeLocalID(to: point, excluding: draggedNodeIDs)
    }
    let indexedNodeID = content.nearestNodeLocalID(
      to: point,
      excluding: draggedNodeIDs
    )
    guard let indexedNodeID,
      let indexedFrame = content.frame(for: indexedNodeID)
    else {
      return draggedNodeID
    }
    return squaredDistance(from: point, to: draggedFrame)
      <= squaredDistance(from: point, to: indexedFrame)
      ? draggedNodeID
      : indexedNodeID
  }

  private func marqueeOverlay(_ rect: CGRect) -> some View {
    Rectangle()
      .fill(Color.accentColor.opacity(0.08))
      .overlay {
        Rectangle()
          .stroke(
            Color.accentColor.opacity(0.72),
            style: StrokeStyle(lineWidth: 1, dash: [4, 3])
          )
      }
      .frame(width: rect.width, height: rect.height)
      .position(x: rect.midX, y: rect.midY)
      .allowsHitTesting(false)
  }
}

private func translated(_ point: CGPoint, by delta: CGSize) -> CGPoint {
  CGPoint(x: point.x + delta.width, y: point.y + delta.height)
}

private func squaredDistance(from point: CGPoint, to rect: CGRect) -> CGFloat {
  let dx = max(rect.minX - point.x, 0, point.x - rect.maxX)
  let dy = max(rect.minY - point.y, 0, point.y - rect.maxY)
  return dx * dx + dy * dy
}

extension FlowingGraphCanvas where PortContent == EmptyView {
  public init(
    content: FlowingGraphCanvasContent<Schema>,
    sessionID: FlowingGraphCanvasSessionID,
    session: Binding<FlowingGraphCanvasSessionState<Schema>>,
    configuration: FlowingGraphCanvasConfiguration = .init(),
    contentInsets: EdgeInsets = .init(),
    contentChangeBehavior: FlowingCanvasContentChangeBehavior = .preserveViewport,
    command: FlowingGraphCanvasSessionCommand<Schema>? = nil,
    nodeCapabilities: FlowingGraphCanvasNodeCapabilityMap<Schema> = .init(),
    admitNodeDrag:
      @escaping @MainActor (FlowingGraphCanvasNodeDragAdmissionRequest<Schema>) ->
      FlowingGraphCanvasNodeDragAdmission<Schema> = { _ in .allowAll },
    isAdditiveSelectionActive: @escaping @MainActor () -> Bool = {
      FlowingGraphCanvasPlatformInput.isAdditiveSelectionActive
    },
    onSmartMagnify:
      @escaping (FlowingGraphCanvasSmartMagnifyContext<Schema>) ->
      FlowingCanvasViewportAction = { context in
        context.standardAction(focusedZoom: 1, fitPadding: 48)
      },
    onViewportChange:
      @escaping (FlowingCanvasViewport, FlowingCanvasViewportChangePhase) -> Void = {
        _, _ in
      },
    onIntent: @escaping (FlowingGraphCanvasInteractionIntent<Schema>) -> Void = { _ in },
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
    @ViewBuilder decorations:
      @escaping (FlowingGraphCanvasWorldContext<Schema>) -> Decorations,
    @ViewBuilder overlays:
      @escaping (FlowingGraphCanvasOverlayContext<Schema>) -> Overlays
  ) {
    self.init(
      content: content,
      sessionID: sessionID,
      session: session,
      configuration: configuration,
      contentInsets: contentInsets,
      contentChangeBehavior: contentChangeBehavior,
      command: command,
      nodeCapabilities: nodeCapabilities,
      admitNodeDrag: admitNodeDrag,
      isAdditiveSelectionActive: isAdditiveSelectionActive,
      onSmartMagnify: onSmartMagnify,
      onViewportChange: onViewportChange,
      onIntent: onIntent,
      background: background,
      node: node,
      edge: edge,
      port: { _, _ in EmptyView() },
      decorations: decorations,
      overlays: overlays
    )
  }
}

extension FlowingGraphCanvas
where PortContent == EmptyView, Decorations == EmptyView, Overlays == EmptyView {
  public init(
    content: FlowingGraphCanvasContent<Schema>,
    sessionID: FlowingGraphCanvasSessionID,
    session: Binding<FlowingGraphCanvasSessionState<Schema>>,
    configuration: FlowingGraphCanvasConfiguration = .init(),
    contentInsets: EdgeInsets = .init(),
    contentChangeBehavior: FlowingCanvasContentChangeBehavior = .preserveViewport,
    command: FlowingGraphCanvasSessionCommand<Schema>? = nil,
    nodeCapabilities: FlowingGraphCanvasNodeCapabilityMap<Schema> = .init(),
    admitNodeDrag:
      @escaping @MainActor (FlowingGraphCanvasNodeDragAdmissionRequest<Schema>) ->
      FlowingGraphCanvasNodeDragAdmission<Schema> = { _ in .allowAll },
    isAdditiveSelectionActive: @escaping @MainActor () -> Bool = {
      FlowingGraphCanvasPlatformInput.isAdditiveSelectionActive
    },
    onSmartMagnify:
      @escaping (FlowingGraphCanvasSmartMagnifyContext<Schema>) ->
      FlowingCanvasViewportAction = { context in
        context.standardAction(focusedZoom: 1, fitPadding: 48)
      },
    onViewportChange:
      @escaping (FlowingCanvasViewport, FlowingCanvasViewportChangePhase) -> Void = {
        _, _ in
      },
    onIntent: @escaping (FlowingGraphCanvasInteractionIntent<Schema>) -> Void = { _ in },
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
  ) {
    self.init(
      content: content,
      sessionID: sessionID,
      session: session,
      configuration: configuration,
      contentInsets: contentInsets,
      contentChangeBehavior: contentChangeBehavior,
      command: command,
      nodeCapabilities: nodeCapabilities,
      admitNodeDrag: admitNodeDrag,
      isAdditiveSelectionActive: isAdditiveSelectionActive,
      onSmartMagnify: onSmartMagnify,
      onViewportChange: onViewportChange,
      onIntent: onIntent,
      background: background,
      node: node,
      edge: edge,
      decorations: { _ in EmptyView() },
      overlays: { _ in EmptyView() }
    )
  }
}

extension FlowingGraphCanvas
where PortContent == EmptyView, Decorations == EmptyView {
  public init(
    content: FlowingGraphCanvasContent<Schema>,
    sessionID: FlowingGraphCanvasSessionID,
    session: Binding<FlowingGraphCanvasSessionState<Schema>>,
    configuration: FlowingGraphCanvasConfiguration = .init(),
    contentInsets: EdgeInsets = .init(),
    contentChangeBehavior: FlowingCanvasContentChangeBehavior = .preserveViewport,
    command: FlowingGraphCanvasSessionCommand<Schema>? = nil,
    nodeCapabilities: FlowingGraphCanvasNodeCapabilityMap<Schema> = .init(),
    admitNodeDrag:
      @escaping @MainActor (FlowingGraphCanvasNodeDragAdmissionRequest<Schema>) ->
      FlowingGraphCanvasNodeDragAdmission<Schema> = { _ in .allowAll },
    isAdditiveSelectionActive: @escaping @MainActor () -> Bool = {
      FlowingGraphCanvasPlatformInput.isAdditiveSelectionActive
    },
    onSmartMagnify:
      @escaping (FlowingGraphCanvasSmartMagnifyContext<Schema>) ->
      FlowingCanvasViewportAction = { context in
        context.standardAction(focusedZoom: 1, fitPadding: 48)
      },
    onViewportChange:
      @escaping (FlowingCanvasViewport, FlowingCanvasViewportChangePhase) -> Void = {
        _, _ in
      },
    onIntent: @escaping (FlowingGraphCanvasInteractionIntent<Schema>) -> Void = { _ in },
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
    @ViewBuilder overlays:
      @escaping (FlowingGraphCanvasOverlayContext<Schema>) -> Overlays
  ) {
    self.init(
      content: content,
      sessionID: sessionID,
      session: session,
      configuration: configuration,
      contentInsets: contentInsets,
      contentChangeBehavior: contentChangeBehavior,
      command: command,
      nodeCapabilities: nodeCapabilities,
      admitNodeDrag: admitNodeDrag,
      isAdditiveSelectionActive: isAdditiveSelectionActive,
      onSmartMagnify: onSmartMagnify,
      onViewportChange: onViewportChange,
      onIntent: onIntent,
      background: background,
      node: node,
      edge: edge,
      decorations: { _ in EmptyView() },
      overlays: overlays
    )
  }
}
