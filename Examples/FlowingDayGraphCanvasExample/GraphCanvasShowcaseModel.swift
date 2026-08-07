import CoreGraphics
import FlowingDayGraphCanvas
import FlowingDayGraphComposition
import FlowingDayGraphCore
import FlowingDayGraphLayout
import Foundation

enum ShowcaseGraphSchema: FlowingGraphSchema {
  typealias NodeID = String
  typealias NodeValue = String
  typealias PortID = String
  typealias PortValue = String
  typealias EdgeID = String
  typealias EdgeValue = String
}

enum ShowcaseCanvasSchema: FlowingGraphCanvasSchema {
  typealias DocumentID = String
  typealias GraphID = String
  typealias EntryPointID = String
  typealias LinkID = String
  typealias LinkValue = String
  typealias GraphSchema = ShowcaseGraphSchema
}

enum ShowcaseLayoutStyle: String, CaseIterable, Identifiable {
  case dag = "DAG"
  case cyclic = "Cyclic"
  case mixed = "Mixed"

  var id: Self { self }
}

enum ShowcasePresentationStyle: String, CaseIterable, Identifiable {
  case collapsed = "Collapsed"
  case inline = "Inline"
  case focused = "Focused"

  var id: Self { self }
}

@MainActor
final class GraphCanvasShowcaseModel: ObservableObject {
  typealias Document = FlowingGraphDocument<ShowcaseCanvasSchema>
  typealias Presentation = FlowingGraphPresentation<ShowcaseCanvasSchema>
  typealias Content = FlowingGraphCanvasContent<ShowcaseCanvasSchema>
  typealias ElementID = FlowingGraphCompositionElementID<ShowcaseCanvasSchema>
  typealias AccessibilitySnapshot = FlowingGraphCanvasAccessibilitySnapshot<ElementID>
  typealias InstancePath = FlowingGraphInstancePath<String, String>

  @Published private(set) var document: Document
  @Published private(set) var projectionState: FlowingGraphProjectionState<ShowcaseCanvasSchema>
  @Published private(set) var presentation: Presentation?
  @Published private(set) var content: Content?
  @Published private(set) var accessibilitySnapshot: AccessibilitySnapshot?
  @Published private(set) var searchIndex: FlowingGraphCanvasSearchIndex<ElementID>?
  @Published private(set) var breadcrumb: [FlowingGraphBreadcrumbSegment<ShowcaseCanvasSchema>] = []
  @Published private(set) var layoutStyle = ShowcaseLayoutStyle.dag
  @Published private(set) var presentationStyle = ShowcasePresentationStyle.collapsed
  @Published private(set) var lastEvent = "Ready"
  @Published private(set) var errorMessage: String?

  private var externalPortOrder = ["input", "output"]
  private var externalPortValues = [
    "input": "Input",
    "output": "Output",
  ]
  private var bindingOrder = ["input", "output"]
  private var bindings: [String: FlowingGraphEndpoint<ShowcaseGraphSchema>] = [
    "input": .port(FlowingGraphPortKey(nodeID: "input", portID: "input")),
    "output": .port(FlowingGraphPortKey(nodeID: "output", portID: "output")),
  ]
  private var placementOffsets: [ElementID: CGSize] = [:]
  private var nodeSizes: [ElementID: CGSize] = [:]
  private var edgeEndpointOverrides:
    [String: [String: FlowingGraphEdgeEndpoints<ShowcaseGraphSchema>]] = [:]
  private var additionalEdges: [String: [FlowingGraphEdge<ShowcaseGraphSchema>]] = [:]
  private var nextConnectionID = 1
  private var layoutStateRevision = FlowingLayoutRevision()
  private let layoutIdentities = ShowcaseLayoutIdentities()

  init() {
    document = ShowcaseDocumentFactory.document(
      layoutStyle: .dag,
      externalPortOrder: externalPortOrder,
      externalPortValues: externalPortValues,
      bindingOrder: bindingOrder,
      bindings: bindings
    )
    projectionState = FlowingGraphProjectionState(entryPointID: "main")
    refreshProjection()
  }

  var bindingRows: [(external: String, internalEndpoint: String?)] {
    externalPortOrder.map {
      ($0, bindings[$0].map(Self.endpointDescription))
    }
  }

  func search(_ query: String) -> [FlowingGraphCanvasSearchResult<ElementID>] {
    searchIndex?.search(query, limit: 12) ?? []
  }

  func recordJump(to title: String) {
    lastEvent = "Jumped to \(title)"
  }

  func selectLayout(_ style: ShowcaseLayoutStyle) {
    guard layoutStyle != style else { return }
    layoutStyle = style
    rebuildDocument()
    lastEvent = "Selected \(style.rawValue) layout"
  }

  func selectPresentation(_ style: ShowcasePresentationStyle) {
    switch style {
    case .collapsed:
      returnToRootIfNeeded()
      sendProjection(.setExpansion(.collapsed, at: rootSite))
    case .inline:
      returnToRootIfNeeded()
      sendProjection(.setExpansion(.expanded, at: rootSite))
    case .focused:
      if projectionState.focusPath.components.isEmpty {
        sendProjection(.drillIn(at: rootSite))
      }
    }
  }

  func navigate(to focusPath: InstancePath) {
    do {
      projectionState = try FlowingGraphNavigator(document: document).navigate(
        from: projectionState,
        to: focusPath
      )
      refreshProjection()
      lastEvent = "Navigated to breadcrumb"
    } catch {
      fail(error)
    }
  }

  func toggleBinding(_ portID: String) {
    guard let presentation else { return }
    let action: FlowingGraphDocumentEditAction<ShowcaseCanvasSchema>
    let externalPort = FlowingGraphPortKey<ShowcaseGraphSchema>(
      nodeID: "subgraph",
      portID: portID
    )
    if bindings[portID] != nil {
      action = .removeInterfaceBinding(
        linkID: "subgraph-link",
        externalPort: externalPort
      )
    } else {
      let internalEndpoint: FlowingGraphEndpoint<ShowcaseGraphSchema> =
        portID == "input"
        ? .port(FlowingGraphPortKey(nodeID: "input", portID: "input"))
        : .port(FlowingGraphPortKey(nodeID: "output", portID: "output"))
      action = .createInterfaceBinding(
        linkID: "subgraph-link",
        binding: FlowingSubgraphInterfaceBinding(
          externalPort: externalPort,
          internalEndpoint: internalEndpoint
        ),
        position: .last
      )
    }
    send(
      .documentEdit(
        FlowingGraphDocumentEditIntent(
          baseDocumentSnapshotID: presentation.documentSnapshotID,
          action: action
        )
      )
    )
  }

  func send(_ intent: FlowingGraphEditorIntent<ShowcaseCanvasSchema>) {
    switch intent {
    case .projection(let intent):
      apply(intent)
    case .documentEdit(let intent):
      apply(intent)
    case .inspection(let intent):
      apply(intent)
    }
  }

  func send(_ intent: FlowingGraphCanvasInteractionIntent<ShowcaseCanvasSchema>) {
    switch intent {
    case .nodeDragCompleted(let drag):
      guard drag.basePresentationSnapshotID == presentation?.snapshotID,
        drag.baseLayoutInputID == content?.id
      else {
        return
      }
      for nodeID in drag.nodeIDs {
        let current = placementOffsets[nodeID, default: .zero]
        placementOffsets[nodeID] = CGSize(
          width: current.width + drag.translation.width,
          height: current.height + drag.translation.height
        )
      }
      layoutStateRevision = FlowingLayoutRevision()
      refreshLayout()
      lastEvent = "Applied node placement intent"
    case .nodeResizeCompleted(let resize):
      guard resize.basePresentationSnapshotID == presentation?.snapshotID,
        resize.baseLayoutInputID == content?.id,
        let presentation,
        let content
      else {
        return
      }
      var requestedFrames: [ElementID: CGRect] = [:]
      for change in resize.changes {
        guard let localID = presentation.nodes.first(where: { $0.id == change.nodeID })?.localID,
          let baseFrame = content.frame(for: localID)
        else {
          return
        }
        let requestedFrame = CGRect(
          x: baseFrame.minX + change.originTranslation.width,
          y: baseFrame.minY + change.originTranslation.height,
          width: baseFrame.width + change.sizeDelta.width,
          height: baseFrame.height + change.sizeDelta.height
        )
        guard requestedFrame.width > 0, requestedFrame.height > 0 else { return }
        requestedFrames[change.nodeID] = requestedFrame
      }
      for (nodeID, frame) in requestedFrames {
        nodeSizes[nodeID] = frame.size
      }
      layoutStateRevision = FlowingLayoutRevision()
      refreshLayout()
      for (nodeID, requestedFrame) in requestedFrames {
        guard let localID = presentation.nodes.first(where: { $0.id == nodeID })?.localID,
          let resolvedFrame = self.content?.frame(for: localID)
        else {
          return
        }
        let current = placementOffsets[nodeID, default: .zero]
        placementOffsets[nodeID] = CGSize(
          width: current.width + requestedFrame.minX - resolvedFrame.minX,
          height: current.height + requestedFrame.minY - resolvedFrame.minY
        )
      }
      layoutStateRevision = FlowingLayoutRevision()
      refreshLayout()
      lastEvent = "Applied node resize intent"
    case .nodeArrangementRequested(let arrangement):
      guard arrangement.basePresentationSnapshotID == presentation?.snapshotID,
        arrangement.baseLayoutInputID == content?.id
      else {
        return
      }
      for (nodeID, translation) in arrangement.translations {
        let current = placementOffsets[nodeID, default: .zero]
        placementOffsets[nodeID] = CGSize(
          width: current.width + translation.width,
          height: current.height + translation.height
        )
      }
      layoutStateRevision = FlowingLayoutRevision()
      refreshLayout()
      lastEvent = "Applied node arrangement intent"
    case .connectionCompleted(let connection):
      apply(connection)
    case .connectionCancelled(let cancellation):
      switch cancellation.reason {
      case .cancelled:
        lastEvent = "Cancelled connection editing"
      case .noTarget:
        lastEvent = "Connection needs a target"
      case .invalidTarget(let feedback):
        lastEvent = feedback.message ?? "Connection target is unavailable"
      }
    case .elementAction(let elementIntent):
      guard elementIntent.basePresentationSnapshotID == presentation?.snapshotID else { return }
      handleElementAction(elementIntent)
    }
  }

  func validateConnection(
    _ request: FlowingGraphCanvasConnectionValidationRequest<ShowcaseCanvasSchema>
  ) -> FlowingGraphCanvasConnectionValidation {
    guard let target = definitionEndpoint(for: request.targetPortID) else {
      return .invalid(.init(message: "Choose a visible port"))
    }
    let fixedElementID = request.origin.fixedElementID
    guard fixedElementID != request.targetPortID,
      let fixed = definitionEndpoint(for: fixedElementID),
      fixed.graphID == target.graphID
    else {
      return .invalid(.init(message: "Choose another port in this graph"))
    }
    return .valid
  }

  func title(for segment: FlowingGraphBreadcrumbSegment<ShowcaseCanvasSchema>) -> String {
    switch segment.source {
    case .entryPoint(_, let name):
      name
    case .subgraph(let linkID, _):
      document.subgraphLinks.first { $0.id == linkID }?.value ?? "Subgraph"
    }
  }

  private var rootSite: FlowingGraphInstanceNodeAddress<String, String> {
    FlowingGraphInstanceNodeAddress(
      instance: FlowingGraphInstanceAddress(path: .root, graphID: "root"),
      nodeID: "subgraph"
    )
  }

  private func sendProjection(
    _ action: FlowingGraphProjectionAction<ShowcaseCanvasSchema>
  ) {
    guard let presentation else { return }
    send(
      .projection(
        FlowingGraphProjectionIntent(
          basePresentationSnapshotID: presentation.snapshotID,
          action: action
        )
      )
    )
  }

  private func returnToRootIfNeeded() {
    while !projectionState.focusPath.components.isEmpty {
      sendProjection(.drillOut)
    }
  }

  private func apply(_ intent: FlowingGraphProjectionIntent<ShowcaseCanvasSchema>) {
    guard intent.basePresentationSnapshotID == presentation?.snapshotID else { return }
    do {
      let navigator = try FlowingGraphNavigator(document: document)
      switch intent.action {
      case .setExpansion(let expansion, let site):
        var expandedSites = projectionState.expandedSites
        switch expansion {
        case .collapsed:
          expandedSites.remove(site)
        case .expanded:
          expandedSites.insert(site)
        }
        projectionState = FlowingGraphProjectionState(
          entryPointID: projectionState.entryPointID,
          focusPath: projectionState.focusPath,
          expandedSites: expandedSites
        )
      case .drillIn(let site):
        projectionState = try navigator.drillIn(from: projectionState, at: site)
      case .drillOut:
        guard let parent = try navigator.drillOut(from: projectionState) else { return }
        projectionState = parent
      }
      refreshProjection()
      lastEvent = "Applied projection intent"
    } catch {
      fail(error)
    }
  }

  private func apply(_ intent: FlowingGraphDocumentEditIntent<ShowcaseCanvasSchema>) {
    guard intent.baseDocumentSnapshotID == document.snapshotID else { return }
    switch intent.action {
    case .createInterfaceBinding(let linkID, let binding, let position):
      guard linkID == "subgraph-link" else { return }
      let portID = binding.externalPort.portID
      bindings[portID] = binding.internalEndpoint
      moveBinding(portID, to: position)
    case .removeInterfaceBinding(let linkID, let externalPort):
      guard linkID == "subgraph-link" else { return }
      bindings.removeValue(forKey: externalPort.portID)
      bindingOrder.removeAll { $0 == externalPort.portID }
    case .updateInterfaceBinding(let linkID, let binding):
      guard linkID == "subgraph-link" else { return }
      bindings[binding.externalPort.portID] = binding.internalEndpoint
    case .addExternalPort(let linkID, let portID, let value, let position):
      guard linkID == "subgraph-link", externalPortValues[portID] == nil else { return }
      externalPortValues[portID] = value
      insert(portID, in: &externalPortOrder, at: position)
    case .removeExternalPort(let linkID, let portID):
      guard linkID == "subgraph-link" else { return }
      externalPortValues.removeValue(forKey: portID)
      externalPortOrder.removeAll { $0 == portID }
      bindingOrder.removeAll { $0 == portID }
      bindings.removeValue(forKey: portID)
    case .reorderExternalPort(let linkID, let portID, let position):
      guard linkID == "subgraph-link", externalPortValues[portID] != nil else { return }
      insert(portID, in: &externalPortOrder, at: position)
    }
    rebuildDocument()
    lastEvent = "Applied document editing intent"
  }

  private func apply(_ intent: FlowingGraphInspectionIntent<ShowcaseCanvasSchema>) {
    switch intent {
    case .definition(let snapshotID, let graphID):
      guard snapshotID == document.snapshotID else { return }
      lastEvent = "Inspected definition \(graphID)"
    case .instance(let documentID, let presentationID, let address):
      guard documentID == document.snapshotID,
        presentationID == presentation?.snapshotID
      else { return }
      lastEvent = "Inspected instance \(address.graphID)"
    }
  }

  private func apply(
    _ intent: FlowingGraphCanvasConnectionCompletionIntent<ShowcaseCanvasSchema>
  ) {
    guard intent.basePresentationSnapshotID == presentation?.snapshotID,
      intent.baseLayoutInputID == content?.id
    else {
      return
    }
    switch intent.operation {
    case .create(let sourcePortID, let targetPortID):
      guard let source = definitionEndpoint(for: sourcePortID),
        let target = definitionEndpoint(for: targetPortID),
        source.graphID == target.graphID
      else {
        return
      }
      let edgeID = "connection-\(nextConnectionID)"
      nextConnectionID += 1
      additionalEdges[source.graphID, default: []].append(
        FlowingGraphEdge(
          id: edgeID,
          endpoints: .directed(source: source.endpoint, target: target.endpoint),
          value: "Connection"
        )
      )
      lastEvent = "Created connection"
    case .reconnect(let edgeID, let endpoint, let targetPortID):
      guard case .source(let address, _) = edgeID,
        case .edge(let definitionEdgeID) = address.elementID,
        let target = definitionEndpoint(for: targetPortID),
        target.graphID == address.graphID,
        let current = currentEndpoints(graphID: address.graphID, edgeID: definitionEdgeID)
      else {
        return
      }
      let next: FlowingGraphEdgeEndpoints<ShowcaseGraphSchema>
      switch current {
      case .directed(let source, let targetEndpoint):
        next =
          endpoint == .first
          ? .directed(source: target.endpoint, target: targetEndpoint)
          : .directed(source: source, target: target.endpoint)
      case .undirected(let first, let second):
        next =
          endpoint == .first
          ? .undirected(target.endpoint, second)
          : .undirected(first, target.endpoint)
      }
      edgeEndpointOverrides[address.graphID, default: [:]][definitionEdgeID] = next
      lastEvent = "Reconnected edge endpoint"
    }
    rebuildDocument()
  }

  private func handleElementAction(
    _ intent: FlowingGraphCanvasElementActionIntent<ShowcaseCanvasSchema>
  ) {
    guard case .source(let address, _) = intent.elementID else { return }
    switch intent.action {
    case .inspect:
      send(
        .inspection(
          .instance(
            documentSnapshotID: document.snapshotID,
            presentationSnapshotID: intent.basePresentationSnapshotID,
            address: FlowingGraphInstanceAddress(
              path: address.instancePath,
              graphID: address.graphID
            )
          )
        )
      )
    case .collapse:
      guard let site = instanceSite(from: address) else { return }
      sendProjection(.setExpansion(.collapsed, at: site))
    case .expand:
      guard let site = instanceSite(from: address) else { return }
      sendProjection(.setExpansion(.expanded, at: site))
    case .drillIn:
      guard let site = instanceSite(from: address) else { return }
      sendProjection(.drillIn(at: site))
    case .beginConnection:
      lastEvent = "Started an accessible connection"
    case .completeConnection:
      lastEvent = "Completed an accessible connection"
    case .cancelConnection:
      lastEvent = "Cancelled an accessible connection"
    }
  }

  private func instanceSite(
    from address: FlowingGraphElementAddress<String, ShowcaseGraphSchema>
  ) -> FlowingGraphInstanceNodeAddress<String, String>? {
    guard case .node(let nodeID) = address.elementID else { return nil }
    return FlowingGraphInstanceNodeAddress(
      instance: FlowingGraphInstanceAddress(
        path: address.instancePath,
        graphID: address.graphID
      ),
      nodeID: nodeID
    )
  }

  private func rebuildDocument() {
    document = ShowcaseDocumentFactory.document(
      layoutStyle: layoutStyle,
      externalPortOrder: externalPortOrder,
      externalPortValues: externalPortValues,
      bindingOrder: bindingOrder,
      bindings: bindings,
      edgeEndpointOverrides: edgeEndpointOverrides,
      additionalEdges: additionalEdges
    )
    refreshProjection()
  }

  private func definitionEndpoint(
    for elementID: ElementID
  ) -> (graphID: String, endpoint: FlowingGraphEndpoint<ShowcaseGraphSchema>)? {
    guard case .source(let address, _) = elementID else { return nil }
    switch address.elementID {
    case .node(let nodeID):
      return (address.graphID, .node(nodeID))
    case .port(let key):
      return (address.graphID, .port(key))
    case .edge:
      return nil
    }
  }

  private func currentEndpoints(
    graphID: String,
    edgeID: String
  ) -> FlowingGraphEdgeEndpoints<ShowcaseGraphSchema>? {
    edgeEndpointOverrides[graphID]?[edgeID]
      ?? additionalEdges[graphID]?.first(where: { $0.id == edgeID })?.endpoints
      ?? document.definitions.first(where: { $0.id == graphID })?.graph.edge(id: edgeID)?.endpoints
  }

  private func refreshProjection() {
    do {
      let projector = try FlowingGraphProjector(document: document)
      let nextPresentation = try projector.project(state: projectionState)
      presentation = nextPresentation
      breadcrumb = try FlowingGraphNavigator(document: document).breadcrumb(
        for: projectionState
      )
      updatePresentationStyle()
      refreshLayout()
      errorMessage = nil
    } catch {
      fail(error)
    }
  }

  private func refreshLayout() {
    guard let presentation else { return }
    do {
      let nextContent = try ShowcaseLayoutBuilder.content(
        presentation: presentation,
        layoutStyle: layoutStyle,
        placementOffsets: placementOffsets,
        nodeSizes: nodeSizes,
        layoutStateRevision: layoutStateRevision,
        identities: layoutIdentities
      )
      content = nextContent
      accessibilitySnapshot = try nextContent.accessibilitySnapshot(
        canvasDescription: .init(
          label: "Graph Canvas",
          value: "\(presentation.nodes.count) nodes and \(presentation.edges.count) connections",
          hint: "Navigate nodes and connections, select elements, or move selected nodes."
        ),
        node: { node in
          .element(
            .init(
              label: node.value,
              value: node.value == "Subgraph" ? "Composite node" : "Graph node",
              hint: "Select or move this node.",
              roleDescription: "node",
              identifier: String(describing: node.id),
              actions: [
                .init(action: .inspect, label: "Inspect Node")
              ]
            )
          )
        },
        port: { port in
          .element(
            .init(
              label: port.value,
              hint: "Use this port to begin or complete a connection.",
              roleDescription: "port",
              identifier: String(describing: port.id),
              actions: [
                .init(action: .beginConnection, label: "Start Connection"),
                .init(action: .completeConnection, label: "Complete Connection"),
              ]
            )
          )
        },
        edge: { edge in
          .element(
            .init(
              label: edge.value,
              roleDescription: "connection",
              identifier: String(describing: edge.id),
              actions: [
                .init(action: .inspect, label: "Inspect Connection")
              ]
            )
          )
        }
      )
      searchIndex = try FlowingGraphCanvasSearchIndex(
        items: presentation.nodes.map {
          FlowingGraphCanvasSearchItem(
            id: $0.id,
            title: $0.value,
            subtitle: "Node",
            keywords: [String(describing: $0.address)],
            category: "Node"
          )
        }
          + presentation.ports.map {
            FlowingGraphCanvasSearchItem(
              id: $0.id,
              title: $0.value,
              subtitle: "Port",
              keywords: [String(describing: $0.address)],
              category: "Port"
            )
          }
          + presentation.edges.map {
            FlowingGraphCanvasSearchItem(
              id: $0.id,
              title: $0.value,
              subtitle: "Connection",
              keywords: [String(describing: $0.address)],
              category: "Edge"
            )
          }
      )
      errorMessage = nil
    } catch {
      accessibilitySnapshot = nil
      searchIndex = nil
      fail(error)
    }
  }

  private func updatePresentationStyle() {
    if !projectionState.focusPath.components.isEmpty {
      presentationStyle = .focused
    } else if projectionState.expandedSites.contains(rootSite) {
      presentationStyle = .inline
    } else {
      presentationStyle = .collapsed
    }
  }

  private func moveBinding(
    _ portID: String,
    to position: FlowingGraphOrderPosition<FlowingGraphPortKey<ShowcaseGraphSchema>>
  ) {
    let mapped: FlowingGraphOrderPosition<String>
    switch position {
    case .first: mapped = .first
    case .last: mapped = .last
    case .before(let key): mapped = .before(key.portID)
    case .after(let key): mapped = .after(key.portID)
    }
    insert(portID, in: &bindingOrder, at: mapped)
  }

  private func insert(
    _ value: String,
    in values: inout [String],
    at position: FlowingGraphOrderPosition<String>
  ) {
    values.removeAll { $0 == value }
    switch position {
    case .first:
      values.insert(value, at: 0)
    case .last:
      values.append(value)
    case .before(let sibling):
      values.insert(value, at: values.firstIndex(of: sibling) ?? values.endIndex)
    case .after(let sibling):
      let index = values.firstIndex(of: sibling).map { values.index(after: $0) }
      values.insert(value, at: index ?? values.endIndex)
    }
  }

  private func fail(_ error: any Error) {
    errorMessage = String(describing: error)
  }

  private static func endpointDescription(
    _ endpoint: FlowingGraphEndpoint<ShowcaseGraphSchema>
  ) -> String {
    switch endpoint {
    case .node(let nodeID):
      nodeID
    case .port(let key):
      "\(key.nodeID).\(key.portID)"
    }
  }
}
