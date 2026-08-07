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
  @FocusState private var hasKeyboardFocus: Bool
  @AccessibilityFocusState private var accessibilityFocusedNodeID: ElementID?

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
      session.transientNodeResize = nil
      rejectedNodeDragID = nil
    }
    .onChange(of: accessibilityFocusedNodeID) { nodeID in
      guard configuration.accessibility.isEnabled, let nodeID else { return }
      session.focusedElementID = nodeID
    }
    .focusable(configuration.keyboardNavigation.isEnabled)
    .focused($hasKeyboardFocus)
    .onMoveCommand(perform: moveKeyboardFocus)
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
        ForEach(Array(activeGuides.enumerated()), id: \.offset) {
          _, guide in
          guideView(guide, surface: surface)
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
      let baseFrame = content.frame(for: localID),
      let frame = resolvedNodeFrame(localID)
    {
      let elementID = node.id
      let renderedFrame = surface.localTransform.applying(to: frame)
      let capabilities = nodeCapabilities.capabilities(for: elementID)
      let nodeContext = FlowingGraphCanvasNodeContext(
        elementID: elementID,
        localID: localID,
        baseFrame: baseFrame,
        frame: frame,
        renderedFrame: renderedFrame,
        renderScale: surface.localTransform.zoom,
        isSelected: session.selection.contains(elementID),
        isFocused: session.focusedElementID == elementID,
        isHovered: session.hoveredElementID == elementID,
        isBeingDragged: activeNodeDrag?.nodeIDs.contains(elementID) == true,
        isBeingResized: activeNodeResize?.nodeID == elementID,
        capabilities: capabilities,
        actions: actions(for: elementID),
        resizeActions: resizeActions(for: elementID, capabilities: capabilities)
      )
      renderedNode(
        nodeContent(node, nodeContext)
          .frame(width: renderedFrame.width, height: renderedFrame.height)
          .position(x: renderedFrame.midX, y: renderedFrame.midY),
        elementID: elementID,
        localID: localID,
        capabilities: capabilities
      )
    }
  }

  @ViewBuilder
  private func renderedNode<Node: View>(
    _ node: Node,
    elementID: ElementID,
    localID: LocalElementID,
    capabilities: FlowingGraphCanvasNodeCapabilities
  ) -> some View {
    if session.tool == .select {
      node
        .contentShape(Rectangle())
        .gesture(
          nodeDragGesture(elementID: elementID),
          including: nodeDragGestureMask(capabilities: capabilities)
        )
        .onTapGesture {
          select(elementID, mode: nil)
        }
        .onHover { isHovering in
          setHovered(elementID, isHovering: isHovering)
        }
        .modifier(
          FlowingGraphCanvasNodeAccessibility(
            isEnabled: configuration.accessibility.isEnabled,
            isSelected: session.selection.contains(elementID),
            providesSelectionAction: configuration.accessibility.providesSelectionAction,
            select: { select(elementID, mode: .replace) }
          )
        )
        .accessibilityFocused($accessibilityFocusedNodeID, equals: elementID)
        .accessibilitySortPriority(
          Double(
            content.presentation.nodes.count - (content.nodePresentationOrder(for: localID) ?? 0)
          )
        )
    } else {
      node
        .allowsHitTesting(false)
        .accessibilityHidden(true)
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
      let anchor = resolvedAnchor(baseAnchor, for: nodeLocalID)
      let renderedPosition = surface.localTransform.applying(to: anchor.position)
      let portContext = FlowingGraphCanvasPortContext(
        elementID: elementID,
        localID: localID,
        nodeLocalID: nodeLocalID,
        anchor: anchor,
        renderedPosition: renderedPosition,
        renderScale: surface.localTransform.zoom,
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
      let resolvedFirstAnchor = resolvedAnchor(anchors.first, for: endpointNodeIDs.first)
      let resolvedSecondAnchor = resolvedAnchor(anchors.second, for: endpointNodeIDs.second)
      let firstDelta = delta(from: anchors.first.position, to: resolvedFirstAnchor.position)
      let secondDelta = delta(from: anchors.second.position, to: resolvedSecondAnchor.position)
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
        first: resolvedFirstAnchor,
        second: resolvedSecondAnchor,
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
        renderScale: surface.localTransform.zoom,
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
    let slice = content.renderElementIDs(intersecting: rect)
    var nodeIDs = slice.nodeIDs
    var edgeIDs = slice.edgeIDs
    if let drag = activeNodeDrag, drag.translation != .zero {
      var knownNodeIDs = Set(nodeIDs)
      var knownEdgeIDs = Set(edgeIDs)
      let sourceRect = rect.offsetBy(
        dx: -drag.translation.width,
        dy: -drag.translation.height
      )
      let translatedSlice = content.renderElementIDs(intersecting: sourceRect)
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
    if let resize = activeNodeResize,
      resize.frame.intersects(rect),
      let nodeID = content.localID(for: resize.nodeID)
    {
      if !nodeIDs.contains(nodeID) {
        nodeIDs.append(nodeID)
      }
      for edgeID in content.incidentEdgeLocalIDs(of: nodeID) where !edgeIDs.contains(edgeID) {
        edgeIDs.append(edgeID)
      }
    }
    let portIDs = nodeIDs.flatMap(content.portLocalIDs)
    return (nodeIDs, edgeIDs, portIDs)
  }

  private var activeNodeDrag: FlowingGraphCanvasTransientNodeDrag<Schema>? {
    guard let drag = session.transientNodeDrag,
      drag.basePresentationSnapshotID == content.presentation.snapshotID,
      drag.baseLayoutInputID == content.id
    else {
      return nil
    }
    return drag
  }

  private var activeNodeResize: FlowingGraphCanvasTransientNodeResize<Schema>? {
    guard session.transientNodeDrag == nil,
      let resize = session.transientNodeResize,
      resize.basePresentationSnapshotID == content.presentation.snapshotID,
      resize.baseLayoutInputID == content.id
    else {
      return nil
    }
    return resize
  }

  private var activeGuides: [FlowingGraphCanvasGuide] {
    activeNodeResize?.guides ?? activeNodeDrag?.guides ?? []
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
        guard activeNodeResize == nil else { return }
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
          hasKeyboardFocus = true
          session.transientNodeDrag = FlowingGraphCanvasTransientNodeDrag(
            nodeID: elementID,
            nodeIDs: admittedNodeIDs,
            basePresentationSnapshotID: content.presentation.snapshotID,
            baseLayoutInputID: content.id,
            baseBounds: nodeBounds(for: admittedNodeIDs)
          )
        }
        let proposedTranslation = CGSize(
          width: value.translation.width / session.viewport.transform.zoom,
          height: value.translation.height / session.viewport.transform.zoom
        )
        guard let drag = session.transientNodeDrag else { return }
        let result = snap(drag: drag, proposedTranslation: proposedTranslation)
        session.transientNodeDrag?.translation = result.translation
        session.transientNodeDrag?.guides = result.guides
        session.transientNodeDrag?.snapState = result.snapState
      }
      .onEnded { _ in
        defer { rejectedNodeDragID = nil }
        guard let drag = session.transientNodeDrag,
          drag.nodeID == elementID,
          drag.basePresentationSnapshotID == content.presentation.snapshotID,
          drag.baseLayoutInputID == content.id
        else {
          return
        }
        onIntent(
          .nodeDragCompleted(
            FlowingGraphCanvasNodeDragIntent(
              nodeID: drag.nodeID,
              nodeIDs: drag.nodeIDs,
              basePresentationSnapshotID: drag.basePresentationSnapshotID,
              baseLayoutInputID: drag.baseLayoutInputID,
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
    hasKeyboardFocus = true
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

  private func resizeActions(
    for elementID: ElementID,
    capabilities: FlowingGraphCanvasNodeCapabilities
  ) -> FlowingGraphCanvasNodeResizeActions {
    let isEnabled =
      configuration.nodeResizing.isEnabled
      && capabilities.contains(.resizable)
    return FlowingGraphCanvasNodeResizeActions(
      isEnabled: isEnabled,
      update: { edges, renderedTranslation in
        updateNodeResize(
          elementID: elementID,
          edges: edges,
          renderedTranslation: renderedTranslation
        )
      },
      end: {
        endNodeResize(elementID: elementID)
      },
      cancel: {
        if session.transientNodeResize?.nodeID == elementID {
          session.transientNodeResize = nil
        }
      }
    )
  }

  private func updateNodeResize(
    elementID: ElementID,
    edges: FlowingGraphCanvasResizeEdges,
    renderedTranslation: CGSize
  ) {
    guard session.tool == .select,
      session.transientNodeDrag == nil,
      edges.isValid,
      let localID = content.localID(for: elementID),
      let baseFrame = content.frame(for: localID)
    else {
      return
    }
    if activeNodeResize?.nodeID != elementID || activeNodeResize?.edges != edges {
      session.transientNodeResize = FlowingGraphCanvasTransientNodeResize(
        nodeID: elementID,
        basePresentationSnapshotID: content.presentation.snapshotID,
        baseLayoutInputID: content.id,
        baseFrame: baseFrame,
        edges: edges
      )
      session.selection = [elementID]
      session.focusedElementID = elementID
      hasKeyboardFocus = true
    }
    guard let resize = activeNodeResize else { return }
    let zoom = session.viewport.transform.zoom
    let worldTranslation = CGSize(
      width: renderedTranslation.width / zoom,
      height: renderedTranslation.height / zoom
    )
    let proposedFrame = FlowingGraphCanvasTransientGeometry.resizing(
      resize.baseFrame,
      edges: resize.edges,
      translation: worldTranslation
    )
    let searchRadius = configuration.snapping.searchRadius / zoom
    let searchRect = proposedFrame.standardized.insetBy(
      dx: -searchRadius,
      dy: -searchRadius
    )
    let candidates =
      configuration.snapping.isEnabled
      ? snapCandidates(in: searchRect, excluding: [resize.nodeID])
      : []
    let result = FlowingGraphCanvasArrangement.resize(
      baseFrame: resize.baseFrame,
      proposedFrame: proposedFrame,
      edges: resize.edges,
      candidates: candidates,
      configuration: configuration.snapping,
      minimumSize: configuration.nodeResizing.minimumSize,
      zoom: zoom,
      snapState: resize.snapState
    )
    session.transientNodeResize?.frame = result.frame
    session.transientNodeResize?.guides = result.guides
    session.transientNodeResize?.snapState = result.snapState
  }

  private func endNodeResize(elementID: ElementID) {
    guard let resize = activeNodeResize, resize.nodeID == elementID else { return }
    if resize.frame != resize.baseFrame {
      onIntent(
        .nodeResizeCompleted(
          FlowingGraphCanvasNodeResizeIntent(
            nodeID: resize.nodeID,
            edges: resize.edges,
            originTranslation: CGSize(
              width: resize.frame.minX - resize.baseFrame.minX,
              height: resize.frame.minY - resize.baseFrame.minY
            ),
            sizeDelta: CGSize(
              width: resize.frame.width - resize.baseFrame.width,
              height: resize.frame.height - resize.baseFrame.height
            ),
            basePresentationSnapshotID: resize.basePresentationSnapshotID,
            baseLayoutInputID: resize.baseLayoutInputID
          )
        )
      )
    }
    if session.transientNodeResize == resize {
      session.transientNodeResize = nil
    }
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
    hasKeyboardFocus = true
    session.focusedElementID = elementID
  }

  private func moveKeyboardFocus(_ direction: MoveCommandDirection) {
    guard configuration.keyboardNavigation.isEnabled, session.tool == .select else {
      return
    }
    let candidates = content.presentation.nodes.compactMap {
      node -> FlowingGraphCanvasNavigationCandidate<ElementID>? in
      guard nodeCapabilities.capabilities(for: node.id).contains(.keyboardNavigable),
        let frame = resolvedNodeFrame(node.localID),
        let order = content.nodePresentationOrder(for: node.localID)
      else {
        return nil
      }
      return FlowingGraphCanvasNavigationCandidate(
        id: node.id,
        frame: frame,
        presentationOrder: order
      )
    }
    guard !candidates.isEmpty else { return }
    let current =
      candidates.first { $0.id == session.focusedElementID }
      ?? candidates.first { session.selection.contains($0.id) }
    guard let current else {
      focusNode(candidates[0])
      return
    }
    let navigationDirection: FlowingGraphCanvasNavigationDirection
    switch direction {
    case .up:
      navigationDirection = .up
    case .down:
      navigationDirection = .down
    case .left:
      navigationDirection = .left
    case .right:
      navigationDirection = .right
    @unknown default:
      return
    }
    guard
      let nodeID = FlowingGraphCanvasKeyboardNavigator.nextNodeID(
        from: current,
        direction: navigationDirection,
        candidates: candidates
      ), let candidate = candidates.first(where: { $0.id == nodeID })
    else {
      return
    }
    focusNode(candidate)
  }

  private func focusNode(
    _ candidate: FlowingGraphCanvasNavigationCandidate<ElementID>
  ) {
    session.focusedElementID = candidate.id
    accessibilityFocusedNodeID = candidate.id
    if configuration.keyboardNavigation.selectionBehavior == .replace {
      session.selection = [candidate.id]
    }
    guard configuration.keyboardNavigation.keepsFocusedNodeVisible,
      !session.viewport.visibleWorldRect.contains(candidate.frame)
    else {
      return
    }
    canvasRequest = FlowingCanvasRequest(
      action: .focus(
        rect: candidate.frame,
        zoom: session.viewport.transform.zoom
      )
    )
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
    if let drag = session.transientNodeDrag,
      drag.basePresentationSnapshotID != content.presentation.snapshotID
        || drag.baseLayoutInputID != content.id
    {
      session.transientNodeDrag = nil
    }
    if let resize = session.transientNodeResize,
      resize.basePresentationSnapshotID != content.presentation.snapshotID
        || resize.baseLayoutInputID != content.id
    {
      session.transientNodeResize = nil
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
    case .arrange(let action):
      guard configuration.allowsArrangementCommands,
        session.transientNodeDrag == nil,
        session.transientNodeResize == nil
      else {
        return
      }
      let nodes = content.presentation.nodes.compactMap {
        node -> FlowingGraphCanvasNodeGeometry<ElementID>? in
        guard session.selection.contains(node.id),
          nodeCapabilities.capabilities(for: node.id).contains(.arrangementParticipant),
          let frame = content.frame(for: node.localID)
        else {
          return nil
        }
        return FlowingGraphCanvasNodeGeometry(id: node.id, frame: frame)
      }
      let translations = FlowingGraphCanvasArrangement.translations(
        for: nodes,
        action: action
      )
      guard !translations.isEmpty else { return }
      onIntent(
        .nodeArrangementRequested(
          FlowingGraphCanvasNodeArrangementIntent(
            action: action,
            translations: translations,
            basePresentationSnapshotID: content.presentation.snapshotID,
            baseLayoutInputID: content.id
          )
        )
      )
    }
  }

  private func nodeBounds(for elementIDs: Set<ElementID>) -> CGRect? {
    elementIDs.compactMap { elementID in
      content.localID(for: elementID).flatMap(content.frame)
    }.reduce(nil) { bounds, frame in
      bounds?.union(frame) ?? frame
    }
  }

  private func nodeDragGestureMask(
    capabilities: FlowingGraphCanvasNodeCapabilities
  ) -> GestureMask {
    configuration.nodeDraggingMode != .disabled && capabilities.contains(.draggable)
      ? .gesture
      : .none
  }

  private func snap(
    drag: FlowingGraphCanvasTransientNodeDrag<Schema>,
    proposedTranslation: CGSize
  ) -> FlowingGraphCanvasSnapResult {
    guard configuration.snapping.isEnabled, let baseBounds = drag.baseBounds else {
      return FlowingGraphCanvasSnapResult(
        translation: proposedTranslation,
        guides: []
      )
    }
    let proposedBounds = baseBounds.offsetBy(
      dx: proposedTranslation.width,
      dy: proposedTranslation.height
    )
    let searchRadius = configuration.snapping.searchRadius / session.viewport.transform.zoom
    let searchRect = proposedBounds.insetBy(dx: -searchRadius, dy: -searchRadius)
    let candidates = snapCandidates(in: searchRect, excluding: drag.nodeIDs)
    return FlowingGraphCanvasArrangement.snap(
      movingBounds: baseBounds,
      proposedTranslation: proposedTranslation,
      candidates: candidates,
      configuration: configuration.snapping,
      zoom: session.viewport.transform.zoom,
      snapState: drag.snapState
    )
  }

  private func snapCandidates(
    in searchRect: CGRect,
    excluding excludedIDs: Set<ElementID>
  ) -> [FlowingGraphCanvasSnapCandidate<ElementID>] {
    content.nodeLocalIDs(intersecting: searchRect).lazy
      .filter { localID in
        guard let elementID = content.elementID(for: localID) else { return false }
        return !excludedIDs.contains(elementID)
          && nodeCapabilities.capabilities(for: elementID).contains(.arrangementParticipant)
      }
      .prefix(configuration.snapping.maximumCandidates)
      .compactMap { localID -> FlowingGraphCanvasSnapCandidate<ElementID>? in
        guard let elementID = content.elementID(for: localID),
          let frame = content.frame(for: localID)
        else {
          return nil
        }
        return FlowingGraphCanvasSnapCandidate(id: elementID, frame: frame)
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
        origin: resolvedAnchor(anchor, for: nodeID).position,
        size: .zero
      )
    }
    guard let route = resolvedEdgeRoute(localID) else { return nil }
    return route.conservativeBounds
  }

  private func resolvedNodeFrame(_ localID: LocalElementID) -> CGRect? {
    if let resize = activeNodeResize,
      content.localID(for: resize.nodeID) == localID
    {
      return resize.frame
    }
    guard let frame = content.frame(for: localID) else { return nil }
    let delta = translation(for: localID)
    return frame.offsetBy(dx: delta.width, dy: delta.height)
  }

  private func resolvedEdgeRoute(_ localID: LocalElementID) -> FlowingGraphEdgeRoute? {
    guard let route = content.route(for: localID),
      let endpoints = content.endpointNodeLocalIDs(for: localID),
      let anchors = content.edgeAnchors(for: localID)
    else {
      return nil
    }
    let firstDelta = delta(
      from: anchors.first.position,
      to: resolvedAnchor(anchors.first, for: endpoints.first).position
    )
    let secondDelta = delta(
      from: anchors.second.position,
      to: resolvedAnchor(anchors.second, for: endpoints.second).position
    )
    guard firstDelta != .zero || secondDelta != .zero else { return route }
    return FlowingGraphCanvasTransientGeometry.deforming(
      route,
      firstEndpointDelta: firstDelta,
      secondEndpointDelta: secondDelta
    )
  }

  private func resolvedAnchor(
    _ anchor: FlowingGraphCanvasAnchor,
    for nodeLocalID: LocalElementID
  ) -> FlowingGraphCanvasAnchor {
    let dragTranslation = translation(for: nodeLocalID)
    if dragTranslation != .zero {
      return FlowingGraphCanvasRenderingGeometry.translated(anchor, by: dragTranslation)
    }
    guard let resize = activeNodeResize,
      content.localID(for: resize.nodeID) == nodeLocalID
    else {
      return anchor
    }
    return FlowingGraphCanvasTransientGeometry.resizing(
      anchor,
      from: resize.baseFrame,
      to: resize.frame
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
      let firstDistance =
        resolvedNodeFrame(first).map {
          squaredDistance(from: point, to: $0)
        } ?? .greatestFiniteMagnitude
      let secondDistance =
        resolvedNodeFrame(second).map {
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

  private func guideView(
    _ guide: FlowingGraphCanvasGuide,
    surface: FlowingCanvasRenderSurface
  ) -> some View {
    let start: CGPoint
    let end: CGPoint
    switch guide.axis {
    case .horizontal:
      start = CGPoint(x: guide.lowerBound, y: guide.position)
      end = CGPoint(x: guide.upperBound, y: guide.position)
    case .vertical:
      start = CGPoint(x: guide.position, y: guide.lowerBound)
      end = CGPoint(x: guide.position, y: guide.upperBound)
    }
    let renderedStart = surface.localTransform.applying(to: start)
    let renderedEnd = surface.localTransform.applying(to: end)
    let renderedLength = hypot(
      renderedEnd.x - renderedStart.x,
      renderedEnd.y - renderedStart.y
    )
    let usesTicks =
      guide.kind == .equalSpacing || guide.kind == .equalSize
      || guide.kind == .resize
    return ZStack(alignment: .topLeading) {
      Path { path in
        path.move(to: renderedStart)
        path.addLine(to: renderedEnd)
        guard usesTicks else { return }
        addGuideTick(to: &path, at: renderedStart, axis: guide.axis)
        addGuideTick(to: &path, at: renderedEnd, axis: guide.axis)
      }
      .stroke(
        Color.accentColor.opacity(FlowingGraphCanvasGuideMetrics.lineOpacity),
        style: StrokeStyle(
          lineWidth: FlowingGraphCanvasGuideMetrics.lineWidth,
          dash: guide.kind == .grid ? FlowingGraphCanvasGuideMetrics.gridDash : []
        )
      )
      if let measurement = guide.measurement,
        renderedLength >= FlowingGraphCanvasGuideMetrics.minimumLabelLength
      {
        Text("\(measurement.rounded(), specifier: "%.0f")")
          .font(.system(size: FlowingGraphCanvasGuideMetrics.labelSize, weight: .medium))
          .foregroundStyle(.white)
          .padding(.horizontal, FlowingGraphCanvasGuideMetrics.labelHorizontalPadding)
          .padding(.vertical, FlowingGraphCanvasGuideMetrics.labelVerticalPadding)
          .background(Color.accentColor, in: Capsule())
          .position(
            x: (renderedStart.x + renderedEnd.x) / 2,
            y: (renderedStart.y + renderedEnd.y) / 2
          )
      }
    }
    .allowsHitTesting(false)
  }

  private func addGuideTick(
    to path: inout Path,
    at point: CGPoint,
    axis: FlowingGraphCanvasGuideAxis
  ) {
    let radius = FlowingGraphCanvasGuideMetrics.tickLength / 2
    switch axis {
    case .horizontal:
      path.move(to: CGPoint(x: point.x, y: point.y - radius))
      path.addLine(to: CGPoint(x: point.x, y: point.y + radius))
    case .vertical:
      path.move(to: CGPoint(x: point.x - radius, y: point.y))
      path.addLine(to: CGPoint(x: point.x + radius, y: point.y))
    }
  }
}

private func translated(_ point: CGPoint, by delta: CGSize) -> CGPoint {
  CGPoint(x: point.x + delta.width, y: point.y + delta.height)
}

private func delta(from start: CGPoint, to end: CGPoint) -> CGSize {
  CGSize(width: end.x - start.x, height: end.y - start.y)
}

private func squaredDistance(from point: CGPoint, to rect: CGRect) -> CGFloat {
  let dx = max(rect.minX - point.x, 0, point.x - rect.maxX)
  let dy = max(rect.minY - point.y, 0, point.y - rect.maxY)
  return dx * dx + dy * dy
}

private enum FlowingGraphCanvasGuideMetrics {
  static let lineWidth: CGFloat = 1
  static let lineOpacity = 0.84
  static let tickLength: CGFloat = 7
  static let gridDash: [CGFloat] = [3, 3]
  static let minimumLabelLength: CGFloat = 24
  static let labelSize: CGFloat = 9
  static let labelHorizontalPadding: CGFloat = 5
  static let labelVerticalPadding: CGFloat = 2
}

private struct FlowingGraphCanvasNodeAccessibility: ViewModifier {
  let isEnabled: Bool
  let isSelected: Bool
  let providesSelectionAction: Bool
  let select: () -> Void

  @ViewBuilder
  func body(content: Content) -> some View {
    if isEnabled {
      if providesSelectionAction {
        content
          .accessibilityElement(children: .contain)
          .accessibilityAddTraits(isSelected ? .isSelected : [])
          .accessibilityAction {
            select()
          }
      } else {
        content
          .accessibilityElement(children: .contain)
          .accessibilityAddTraits(isSelected ? .isSelected : [])
      }
    } else {
      content
        .accessibilityHidden(true)
    }
  }
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
