import CoreGraphics
import FlowingDayGraphComposition
import FlowingDayGraphCore
import FlowingDayGraphLayout
import Foundation

public protocol FlowingGraphCanvasSchema: FlowingGraphCompositionSchema
where
  DocumentID: Sendable,
  GraphID: Sendable,
  EntryPointID: Sendable,
  LinkID: Sendable,
  OccurrenceID: Sendable,
  GraphSchema.NodeID: Sendable,
  GraphSchema.PortID: Sendable,
  GraphSchema.EdgeID: Sendable
{}

public enum FlowingGraphCanvasLayoutSchema<
  Schema: FlowingGraphCanvasSchema
>: FlowingGraphLayoutSchema {
  public typealias NodeID = FlowingGraphPresentationLocalElementID<Schema>
  public typealias PortID = FlowingGraphPresentationLocalElementID<Schema>
  public typealias EdgeID = FlowingGraphPresentationLocalElementID<Schema>
}

public enum FlowingGraphCanvasContentIssue: Error, Equatable, Sendable {
  case duplicateCanonicalIdentity
  case duplicateLocalIdentity
  case invalidPortOwnership
  case invalidPresentationEndpoint
  case presentationSnapshotIdentityMismatch
  case layoutInputIdentityMismatch
  case layoutTopologyMismatch
  case renderIndexConstructionFailed
}

public struct FlowingGraphCanvasAnchor: Equatable, Sendable {
  public let position: CGPoint
  public let normal: CGVector

  public init(position: CGPoint, normal: CGVector = .zero) {
    self.position = position
    self.normal = normal
  }
}

public struct FlowingGraphCanvasEdgeAnchors: Equatable, Sendable {
  public let first: FlowingGraphCanvasAnchor
  public let second: FlowingGraphCanvasAnchor
  public let isDirected: Bool

  public init(
    first: FlowingGraphCanvasAnchor,
    second: FlowingGraphCanvasAnchor,
    isDirected: Bool
  ) {
    self.first = first
    self.second = second
    self.isDirected = isDirected
  }
}

public enum FlowingGraphCanvasLayoutAdapter {
  public static func topology<Schema: FlowingGraphCanvasSchema>(
    for presentation: FlowingGraphPresentation<Schema>
  ) throws -> FlowingGraphLayoutTopology<FlowingGraphCanvasLayoutSchema<Schema>> {
    let index = try FlowingGraphCanvasPresentationIndex(presentation: presentation)
    return try index.makeTopology(snapshotID: presentation.snapshotID)
  }
}

public struct FlowingGraphCanvasContent<Schema: FlowingGraphCanvasSchema> {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>
  public typealias LocalElementID = FlowingGraphPresentationLocalElementID<Schema>
  public typealias LayoutSchema = FlowingGraphCanvasLayoutSchema<Schema>

  public let presentation: FlowingGraphPresentation<Schema>
  public let layoutInput: FlowingGraphLayoutInput<LayoutSchema>
  public let layoutResult: FlowingGraphLayoutResult<LayoutSchema>

  private let renderIndex: FlowingGraphRenderIndex<LayoutSchema>
  private let canonicalIDByLocalID: [LocalElementID: ElementID]
  private let localIDByCanonicalID: [ElementID: LocalElementID]
  private let nodeByLocalID: [LocalElementID: FlowingGraphPresentationNode<Schema>]
  private let nodeOrderByLocalID: [LocalElementID: Int]
  private let portByLocalID: [LocalElementID: FlowingGraphPresentationPort<Schema>]
  private let edgeByLocalID: [LocalElementID: FlowingGraphPresentationEdge<Schema>]
  private let edgeByID: [LocalElementID: FlowingGraphLayoutEdge<LayoutSchema>]
  private let portAnchorByKey:
    [FlowingGraphLayoutPortKey<LayoutSchema>: FlowingGraphResolvedPortAnchor<LayoutSchema>]
  private let nodeLocalIDByPortLocalID: [LocalElementID: LocalElementID]
  private let portLocalIDsByNodeLocalID: [LocalElementID: [LocalElementID]]
  private let incidentEdgeIDsByNodeID: [LocalElementID: [LocalElementID]]

  public init(
    presentation: FlowingGraphPresentation<Schema>,
    layoutInput: FlowingGraphLayoutInput<LayoutSchema>,
    layoutResult: FlowingGraphLayoutResult<LayoutSchema>,
    renderIndexConfiguration: FlowingGraphRenderIndexConfiguration = .init()
  ) throws {
    guard presentation.snapshotID == layoutInput.id.presentationSnapshotID else {
      throw FlowingGraphCanvasContentIssue.presentationSnapshotIdentityMismatch
    }
    guard layoutInput.id == layoutResult.inputID else {
      throw FlowingGraphCanvasContentIssue.layoutInputIdentityMismatch
    }

    let index = try FlowingGraphCanvasPresentationIndex(presentation: presentation)
    let expectedTopology = try index.makeTopology(snapshotID: presentation.snapshotID)
    guard Self.matches(layoutInput.topology, expectedTopology) else {
      throw FlowingGraphCanvasContentIssue.layoutTopologyMismatch
    }

    let nextRenderIndex: FlowingGraphRenderIndex<LayoutSchema>
    do {
      nextRenderIndex = try FlowingGraphRenderIndex(
        input: layoutInput,
        result: layoutResult,
        configuration: renderIndexConfiguration
      )
    } catch {
      throw FlowingGraphCanvasContentIssue.renderIndexConstructionFailed
    }

    self.presentation = presentation
    self.layoutInput = layoutInput
    self.layoutResult = layoutResult
    renderIndex = nextRenderIndex
    canonicalIDByLocalID = index.canonicalIDByLocalID
    localIDByCanonicalID = index.localIDByCanonicalID
    nodeByLocalID = index.nodeByLocalID
    nodeOrderByLocalID = Dictionary(
      uniqueKeysWithValues: presentation.nodes.enumerated().map { ($1.localID, $0) }
    )
    portByLocalID = index.portByLocalID
    edgeByLocalID = index.edgeByLocalID
    nodeLocalIDByPortLocalID = index.nodeLocalIDByPortLocalID
    var nextPortLocalIDsByNodeLocalID: [LocalElementID: [LocalElementID]] = [:]
    for port in presentation.ports {
      guard let nodeID = index.nodeLocalIDByPortLocalID[port.localID] else { continue }
      nextPortLocalIDsByNodeLocalID[nodeID, default: []].append(port.localID)
    }
    portLocalIDsByNodeLocalID = nextPortLocalIDsByNodeLocalID
    edgeByID = Dictionary(
      uniqueKeysWithValues: layoutInput.topology.edges.map { ($0.id, $0) }
    )
    portAnchorByKey = Dictionary(
      uniqueKeysWithValues: layoutResult.resolvedPortAnchors.map { ($0.key, $0) }
    )

    var nextIncidentEdgeIDs: [LocalElementID: [LocalElementID]] = [:]
    for edge in layoutInput.topology.edges {
      for nodeID in Set(Self.nodeIDs(for: edge, topology: layoutInput.topology)) {
        nextIncidentEdgeIDs[nodeID, default: []].append(edge.id)
      }
    }
    incidentEdgeIDsByNodeID = nextIncidentEdgeIDs
  }

  public var id: FlowingLayoutInputID {
    layoutInput.id
  }

  public var contentBounds: CGRect {
    layoutResult.contentBounds
  }

  public var elementIDs: Set<ElementID> {
    Set(localIDByCanonicalID.keys)
  }

  public func contains(_ elementID: ElementID) -> Bool {
    localIDByCanonicalID[elementID] != nil
  }

  public func localID(for elementID: ElementID) -> LocalElementID? {
    localIDByCanonicalID[elementID]
  }

  public func elementID(for localID: LocalElementID) -> ElementID? {
    canonicalIDByLocalID[localID]
  }

  public func node(
    for localID: LocalElementID
  ) -> FlowingGraphPresentationNode<Schema>? {
    nodeByLocalID[localID]
  }

  public func port(
    for localID: LocalElementID
  ) -> FlowingGraphPresentationPort<Schema>? {
    portByLocalID[localID]
  }

  public func edge(
    for localID: LocalElementID
  ) -> FlowingGraphPresentationEdge<Schema>? {
    edgeByLocalID[localID]
  }

  public func frame(for nodeLocalID: LocalElementID) -> CGRect? {
    layoutResult.frame(for: nodeLocalID)
  }

  public func nodePresentationOrder(for localID: LocalElementID) -> Int? {
    nodeOrderByLocalID[localID]
  }

  public func route(for edgeLocalID: LocalElementID) -> FlowingGraphEdgeRoute? {
    layoutResult.route(for: edgeLocalID)
  }

  public func anchor(for portLocalID: LocalElementID) -> FlowingGraphCanvasAnchor? {
    guard let nodeID = nodeLocalIDByPortLocalID[portLocalID],
      let entry = portAnchorByKey[
        FlowingGraphLayoutPortKey(nodeID: nodeID, portID: portLocalID)
      ]
    else {
      return nil
    }
    return FlowingGraphCanvasAnchor(position: entry.position, normal: entry.normal)
  }

  public func nodeLocalID(for portLocalID: LocalElementID) -> LocalElementID? {
    nodeLocalIDByPortLocalID[portLocalID]
  }

  public func portLocalIDs(of nodeLocalID: LocalElementID) -> [LocalElementID] {
    portLocalIDsByNodeLocalID[nodeLocalID, default: []]
  }

  public func incidentEdgeLocalIDs(of nodeLocalID: LocalElementID) -> [LocalElementID] {
    incidentEdgeIDsByNodeID[nodeLocalID, default: []]
  }

  public func edgeAnchors(
    for edgeLocalID: LocalElementID
  ) -> FlowingGraphCanvasEdgeAnchors? {
    guard let edge = edgeByID[edgeLocalID] else { return nil }
    switch edge.endpoints {
    case .directed(let source, let target):
      guard let first = anchor(for: source), let second = anchor(for: target) else {
        return nil
      }
      return FlowingGraphCanvasEdgeAnchors(
        first: first,
        second: second,
        isDirected: true
      )
    case .undirected(let firstEndpoint, let secondEndpoint):
      guard let first = anchor(for: firstEndpoint),
        let second = anchor(for: secondEndpoint)
      else {
        return nil
      }
      return FlowingGraphCanvasEdgeAnchors(
        first: first,
        second: second,
        isDirected: false
      )
    }
  }

  public func endpointNodeLocalIDs(
    for edgeLocalID: LocalElementID
  ) -> (first: LocalElementID, second: LocalElementID)? {
    guard let edge = edgeByID[edgeLocalID] else { return nil }
    switch edge.endpoints {
    case .directed(let source, let target):
      return (
        layoutInput.topology.nodeID(for: source),
        layoutInput.topology.nodeID(for: target)
      )
    case .undirected(let first, let second):
      return (
        layoutInput.topology.nodeID(for: first),
        layoutInput.topology.nodeID(for: second)
      )
    }
  }

  public func renderSlice(
    intersecting rect: CGRect
  ) -> FlowingGraphRenderSlice<LayoutSchema> {
    renderIndex.slice(intersecting: rect)
  }

  public func nearestNodeLocalID(
    to point: CGPoint,
    excluding excludedIDs: Set<LocalElementID> = []
  ) -> LocalElementID? {
    renderIndex.nearestNodeID(to: point, excluding: excludedIDs)
  }

  public func nodeLocalIDs(intersecting rect: CGRect) -> [LocalElementID] {
    renderIndex.slice(intersecting: rect).nodeIDs
  }

  public func bounds(for elementIDs: Set<ElementID>) -> CGRect? {
    elementIDs.compactMap(bounds).reduce(nil) { current, bounds in
      current?.union(bounds) ?? bounds
    }
  }

  public func bounds(for elementID: ElementID) -> CGRect? {
    guard let localID = localIDByCanonicalID[elementID] else { return nil }
    if let frame = layoutResult.frame(for: localID) {
      return frame
    }
    if let anchor = anchor(for: localID) {
      return CGRect(origin: anchor.position, size: .zero)
    }
    return layoutResult.route(for: localID)?.conservativeBounds
  }

  private func anchor(
    for endpoint: FlowingGraphLayoutEndpoint<LayoutSchema>
  ) -> FlowingGraphCanvasAnchor? {
    switch endpoint {
    case .node(let nodeID):
      guard let frame = layoutResult.frame(for: nodeID) else { return nil }
      return FlowingGraphCanvasAnchor(
        position: CGPoint(x: frame.midX, y: frame.midY)
      )
    case .port(let key):
      guard let entry = portAnchorByKey[key] else { return nil }
      return FlowingGraphCanvasAnchor(position: entry.position, normal: entry.normal)
    }
  }

  private static func matches(
    _ first: FlowingGraphLayoutTopology<LayoutSchema>,
    _ second: FlowingGraphLayoutTopology<LayoutSchema>
  ) -> Bool {
    first.snapshotID == second.snapshotID && first.nodeIDs == second.nodeIDs
      && first.ports.map(\.key) == second.ports.map(\.key) && first.edges == second.edges
      && first.containments == second.containments
  }

  private static func nodeIDs(
    for edge: FlowingGraphLayoutEdge<LayoutSchema>,
    topology: FlowingGraphLayoutTopology<LayoutSchema>
  ) -> [LocalElementID] {
    switch edge.endpoints {
    case .directed(let source, let target):
      return [topology.nodeID(for: source), topology.nodeID(for: target)]
    case .undirected(let first, let second):
      return [topology.nodeID(for: first), topology.nodeID(for: second)]
    }
  }
}

private struct FlowingGraphCanvasPresentationIndex<Schema: FlowingGraphCanvasSchema> {
  typealias ElementID = FlowingGraphCompositionElementID<Schema>
  typealias LocalElementID = FlowingGraphPresentationLocalElementID<Schema>
  typealias LayoutSchema = FlowingGraphCanvasLayoutSchema<Schema>

  let presentation: FlowingGraphPresentation<Schema>
  let canonicalIDByLocalID: [LocalElementID: ElementID]
  let localIDByCanonicalID: [ElementID: LocalElementID]
  let nodeByLocalID: [LocalElementID: FlowingGraphPresentationNode<Schema>]
  let portByLocalID: [LocalElementID: FlowingGraphPresentationPort<Schema>]
  let edgeByLocalID: [LocalElementID: FlowingGraphPresentationEdge<Schema>]
  let nodeLocalIDByPortLocalID: [LocalElementID: LocalElementID]

  init(presentation: FlowingGraphPresentation<Schema>) throws {
    self.presentation = presentation
    var nextCanonicalIDByLocalID: [LocalElementID: ElementID] = [:]
    var nextLocalIDByCanonicalID: [ElementID: LocalElementID] = [:]
    var nextNodeByLocalID: [LocalElementID: FlowingGraphPresentationNode<Schema>] = [:]
    var nextPortByLocalID: [LocalElementID: FlowingGraphPresentationPort<Schema>] = [:]
    var nextEdgeByLocalID: [LocalElementID: FlowingGraphPresentationEdge<Schema>] = [:]
    var nextNodeLocalIDByPortLocalID: [LocalElementID: LocalElementID] = [:]

    func register(id: ElementID, localID: LocalElementID) throws {
      guard nextCanonicalIDByLocalID.updateValue(id, forKey: localID) == nil else {
        throw FlowingGraphCanvasContentIssue.duplicateLocalIdentity
      }
      guard nextLocalIDByCanonicalID.updateValue(localID, forKey: id) == nil else {
        throw FlowingGraphCanvasContentIssue.duplicateCanonicalIdentity
      }
    }

    for node in presentation.nodes {
      try register(id: node.id, localID: node.localID)
      nextNodeByLocalID[node.localID] = node
    }
    for port in presentation.ports {
      try register(id: port.id, localID: port.localID)
      nextPortByLocalID[port.localID] = port
      guard case .source(let instanceHandle, let elementID, let occurrenceID) = port.localID,
        case .port(let key) = elementID
      else {
        throw FlowingGraphCanvasContentIssue.invalidPortOwnership
      }
      let nodeLocalID = LocalElementID.source(
        instanceHandle: instanceHandle,
        elementID: .node(key.nodeID),
        occurrenceID: occurrenceID
      )
      guard nextNodeByLocalID[nodeLocalID] != nil else {
        throw FlowingGraphCanvasContentIssue.invalidPortOwnership
      }
      nextNodeLocalIDByPortLocalID[port.localID] = nodeLocalID
    }
    for edge in presentation.edges {
      try register(id: edge.id, localID: edge.localID)
      nextEdgeByLocalID[edge.localID] = edge
    }
    for context in presentation.contextEdges {
      try register(id: context.id, localID: context.localID)
    }

    canonicalIDByLocalID = nextCanonicalIDByLocalID
    localIDByCanonicalID = nextLocalIDByCanonicalID
    nodeByLocalID = nextNodeByLocalID
    portByLocalID = nextPortByLocalID
    edgeByLocalID = nextEdgeByLocalID
    nodeLocalIDByPortLocalID = nextNodeLocalIDByPortLocalID
  }

  func makeTopology(
    snapshotID: FlowingGraphPresentationSnapshotID
  ) throws -> FlowingGraphLayoutTopology<LayoutSchema> {
    var nodeLocalIDsByInstanceHandle: [FlowingGraphInstanceHandle: [LocalElementID]] = [:]
    for node in presentation.nodes {
      guard case .source(let instanceHandle, _, _) = node.localID else { continue }
      nodeLocalIDsByInstanceHandle[instanceHandle, default: []].append(node.localID)
    }
    let containments = presentation.contextEdges.compactMap {
      context -> FlowingGraphLayoutContainment<LayoutSchema>? in
      guard case .expanded = context.state,
        let targetHandle = context.targetInstanceHandle
      else {
        return nil
      }
      let containerNodeID = LocalElementID.source(
        instanceHandle: context.sourceInstanceHandle,
        elementID: .node(context.site.nodeID),
        occurrenceID: nil
      )
      return FlowingGraphLayoutContainment(
        containerNodeID: containerNodeID,
        memberNodeIDs: nodeLocalIDsByInstanceHandle[targetHandle, default: []]
      )
    }
    return try FlowingGraphLayoutTopology(
      snapshotID: snapshotID,
      nodeIDs: presentation.nodes.map(\.localID),
      ports: try presentation.ports.map { port in
        guard let nodeID = nodeLocalIDByPortLocalID[port.localID] else {
          throw FlowingGraphCanvasContentIssue.invalidPortOwnership
        }
        return FlowingGraphLayoutPort(
          key: FlowingGraphLayoutPortKey(nodeID: nodeID, portID: port.localID)
        )
      },
      edges: try presentation.edges.map { edge in
        FlowingGraphLayoutEdge(
          id: edge.localID,
          endpoints: try layoutEndpoints(edge.endpoints)
        )
      },
      containments: containments
    )
  }

  private func layoutEndpoints(
    _ endpoints: FlowingGraphPresentationEdgeEndpoints<Schema>
  ) throws -> FlowingGraphLayoutEdgeEndpoints<LayoutSchema> {
    switch endpoints {
    case .directed(let source, let target):
      return .directed(
        source: try layoutEndpoint(source),
        target: try layoutEndpoint(target)
      )
    case .undirected(let first, let second):
      return .undirected(
        try layoutEndpoint(first),
        try layoutEndpoint(second)
      )
    }
  }

  private func layoutEndpoint(
    _ endpoint: FlowingGraphPresentationEndpoint<Schema>
  ) throws -> FlowingGraphLayoutEndpoint<LayoutSchema> {
    switch endpoint {
    case .node(let id):
      guard let localID = localIDByCanonicalID[id], nodeByLocalID[localID] != nil else {
        throw FlowingGraphCanvasContentIssue.invalidPresentationEndpoint
      }
      return .node(localID)
    case .port(let id):
      guard let localID = localIDByCanonicalID[id],
        portByLocalID[localID] != nil,
        let nodeID = nodeLocalIDByPortLocalID[localID]
      else {
        throw FlowingGraphCanvasContentIssue.invalidPresentationEndpoint
      }
      return .port(FlowingGraphLayoutPortKey(nodeID: nodeID, portID: localID))
    }
  }
}
