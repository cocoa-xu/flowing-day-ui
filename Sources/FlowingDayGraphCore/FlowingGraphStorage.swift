public struct FlowingGraphElementChange<ID, Value> {
  public let id: ID
  public let oldValue: Value?
  public let newValue: Value?

  var inverted: Self {
    Self(id: id, oldValue: newValue, newValue: oldValue)
  }
}

extension FlowingGraphElementChange: Equatable where ID: Equatable, Value: Equatable {}
extension FlowingGraphElementChange: Sendable where ID: Sendable, Value: Sendable {}

public struct FlowingGraphOrderChange<ID: Hashable> {
  public let id: ID
  public let oldPosition: FlowingGraphOrderPosition<ID>?
  public let newPosition: FlowingGraphOrderPosition<ID>?

  var inverted: Self {
    Self(id: id, oldPosition: newPosition, newPosition: oldPosition)
  }
}

extension FlowingGraphOrderChange: Equatable {}
extension FlowingGraphOrderChange: Sendable where ID: Sendable {}

public struct FlowingGraphChangeSet<Schema: FlowingGraphSchema> {
  public let oldSnapshotID: FlowingGraphSnapshotID
  public let newSnapshotID: FlowingGraphSnapshotID
  public let nodeChanges: [FlowingGraphElementChange<Schema.NodeID, FlowingGraphNode<Schema>>]
  public let portChanges:
    [FlowingGraphElementChange<FlowingGraphPortKey<Schema>, FlowingGraphPort<Schema>>]
  public let edgeChanges: [FlowingGraphElementChange<Schema.EdgeID, FlowingGraphEdge<Schema>>]
  public let nodeOrderChanges: [FlowingGraphOrderChange<Schema.NodeID>]
  public let portOrderChanges: [FlowingGraphOrderChange<FlowingGraphPortKey<Schema>>]
  public let edgeOrderChanges: [FlowingGraphOrderChange<Schema.EdgeID>]

  public var isEmpty: Bool {
    nodeChanges.isEmpty && portChanges.isEmpty && edgeChanges.isEmpty && nodeOrderChanges.isEmpty
      && portOrderChanges.isEmpty && edgeOrderChanges.isEmpty
  }

  public func inverted() -> Self {
    Self(
      oldSnapshotID: newSnapshotID,
      newSnapshotID: oldSnapshotID,
      nodeChanges: nodeChanges.map(\.inverted),
      portChanges: portChanges.map(\.inverted),
      edgeChanges: edgeChanges.map(\.inverted),
      nodeOrderChanges: nodeOrderChanges.map(\.inverted),
      portOrderChanges: portOrderChanges.map(\.inverted),
      edgeOrderChanges: edgeOrderChanges.map(\.inverted)
    )
  }
}

extension FlowingGraphChangeSet: Sendable
where
  Schema.NodeID: Sendable,
  Schema.NodeValue: Sendable,
  Schema.PortID: Sendable,
  Schema.PortValue: Sendable,
  Schema.EdgeID: Sendable,
  Schema.EdgeValue: Sendable
{}

public enum FlowingGraphRemovalPolicy: Hashable, Sendable {
  case cascade
  case strict
}

public enum FlowingGraphMutationIssue<Schema: FlowingGraphSchema>: Equatable {
  case duplicateElement(FlowingGraphLocalElementID<Schema>)
  case unknownElement(FlowingGraphLocalElementID<Schema>)
  case unknownEndpoint(FlowingGraphEndpoint<Schema>)
  case incidentEdgesPreventRemoval(FlowingGraphLocalElementID<Schema>)
}

extension FlowingGraphMutationIssue: Sendable
where Schema.NodeID: Sendable, Schema.PortID: Sendable, Schema.EdgeID: Sendable {}

public enum FlowingGraphUpdateResult<Schema: FlowingGraphSchema> {
  case committed(FlowingGraphChangeSet<Schema>)
  case rejected(FlowingGraphMutationIssue<Schema>)
}

extension FlowingGraphUpdateResult: Sendable
where
  Schema.NodeID: Sendable,
  Schema.NodeValue: Sendable,
  Schema.PortID: Sendable,
  Schema.PortValue: Sendable,
  Schema.EdgeID: Sendable,
  Schema.EdgeValue: Sendable
{}

public struct FlowingGraph<Schema: FlowingGraphSchema> {
  public private(set) var snapshotID = FlowingGraphSnapshotID()
  public private(set) var localRevision: UInt64 = 0

  public init() {}

  fileprivate var nodesByID: [Schema.NodeID: FlowingGraphNode<Schema>] = [:]
  fileprivate var portsByKey: [FlowingGraphPortKey<Schema>: FlowingGraphPort<Schema>] = [:]
  fileprivate var edgesByID: [Schema.EdgeID: FlowingGraphEdge<Schema>] = [:]

  fileprivate var nodeOrder: [Schema.NodeID] = []
  fileprivate var portOrderByNodeID: [Schema.NodeID: [Schema.PortID]] = [:]
  fileprivate var edgeOrder: [Schema.EdgeID] = []
  fileprivate var edgeOrderIndex: [Schema.EdgeID: Int] = [:]

  fileprivate var directedOutgoingEdgeIDsByNodeID: [Schema.NodeID: [Schema.EdgeID]] = [:]
  fileprivate var directedIncomingEdgeIDsByNodeID: [Schema.NodeID: [Schema.EdgeID]] = [:]
  fileprivate var undirectedEdgeIDsByNodeID: [Schema.NodeID: [Schema.EdgeID]] = [:]
  fileprivate var incidentEdgeIDsByNodeID: [Schema.NodeID: [Schema.EdgeID]] = [:]
  fileprivate var incidentEdgeIDsByEndpoint: [FlowingGraphEndpoint<Schema>: [Schema.EdgeID]] = [:]

  public var nodes: [FlowingGraphNode<Schema>] {
    nodeOrder.compactMap { nodesByID[$0] }
  }

  public var ports: [FlowingGraphPort<Schema>] {
    nodeOrder.flatMap { nodeID in
      portOrderByNodeID[nodeID, default: []].compactMap { portID in
        portsByKey[FlowingGraphPortKey(nodeID: nodeID, portID: portID)]
      }
    }
  }

  public var edges: [FlowingGraphEdge<Schema>] {
    edgeOrder.compactMap { edgesByID[$0] }
  }

  public var nodeIDs: [Schema.NodeID] {
    nodeOrder
  }

  public var portKeys: [FlowingGraphPortKey<Schema>] {
    ports.map(\.key)
  }

  public var edgeIDs: [Schema.EdgeID] {
    edgeOrder
  }

  public var isEmpty: Bool {
    nodesByID.isEmpty && portsByKey.isEmpty && edgesByID.isEmpty
  }

  public var nodeCount: Int {
    nodesByID.count
  }

  public var portCount: Int {
    portsByKey.count
  }

  public var edgeCount: Int {
    edgesByID.count
  }

  public func node(id: Schema.NodeID) -> FlowingGraphNode<Schema>? {
    nodesByID[id]
  }

  public func port(key: FlowingGraphPortKey<Schema>) -> FlowingGraphPort<Schema>? {
    portsByKey[key]
  }

  public func ports(nodeID: Schema.NodeID) -> [FlowingGraphPort<Schema>] {
    portOrderByNodeID[nodeID, default: []].compactMap { portID in
      portsByKey[FlowingGraphPortKey(nodeID: nodeID, portID: portID)]
    }
  }

  public func edge(id: Schema.EdgeID) -> FlowingGraphEdge<Schema>? {
    edgesByID[id]
  }

  public func incidentEdgeIDs(nodeID: Schema.NodeID) -> [Schema.EdgeID] {
    incidentEdgeIDsByNodeID[nodeID, default: []]
  }

  public func incidentEdgeIDs(endpoint: FlowingGraphEndpoint<Schema>) -> [Schema.EdgeID] {
    incidentEdgeIDsByEndpoint[endpoint, default: []]
  }

  public func outgoingEdgeIDs(nodeID: Schema.NodeID) -> [Schema.EdgeID] {
    mergedEdgeIDs(
      directedOutgoingEdgeIDsByNodeID[nodeID, default: []],
      undirectedEdgeIDsByNodeID[nodeID, default: []]
    )
  }

  public func incomingEdgeIDs(nodeID: Schema.NodeID) -> [Schema.EdgeID] {
    mergedEdgeIDs(
      directedIncomingEdgeIDsByNodeID[nodeID, default: []],
      undirectedEdgeIDsByNodeID[nodeID, default: []]
    )
  }

  public mutating func update(
    _ body: (inout FlowingGraphTransaction<Schema>) -> Void
  ) -> FlowingGraphUpdateResult<Schema> {
    let original = self
    var transaction = FlowingGraphTransaction(graph: self)
    body(&transaction)

    if let issue = transaction.issue {
      return .rejected(issue)
    }

    guard transaction.hasChanges else {
      return .committed(
        FlowingGraphChangeSet(
          oldSnapshotID: snapshotID,
          newSnapshotID: snapshotID,
          nodeChanges: [],
          portChanges: [],
          edgeChanges: [],
          nodeOrderChanges: [],
          portOrderChanges: [],
          edgeOrderChanges: []
        )
      )
    }

    transaction.finalizeIndices()
    var next = transaction.graph
    assert(next.hasConsistentStorage)
    let nextSnapshotID = FlowingGraphSnapshotID()
    next.snapshotID = nextSnapshotID
    next.localRevision &+= 1
    let changeSet = transaction.changeSet(
      from: original,
      newSnapshotID: nextSnapshotID
    )
    guard !changeSet.isEmpty else {
      return .committed(
        FlowingGraphChangeSet(
          oldSnapshotID: snapshotID,
          newSnapshotID: snapshotID,
          nodeChanges: [],
          portChanges: [],
          edgeChanges: [],
          nodeOrderChanges: [],
          portOrderChanges: [],
          edgeOrderChanges: []
        )
      )
    }
    self = next
    return .committed(changeSet)
  }

  private func mergedEdgeIDs(
    _ first: [Schema.EdgeID],
    _ second: [Schema.EdgeID]
  ) -> [Schema.EdgeID] {
    var result: [Schema.EdgeID] = []
    result.reserveCapacity(first.count + second.count)
    var firstIndex = 0
    var secondIndex = 0

    while firstIndex < first.count, secondIndex < second.count {
      if edgeOrderIndex[first[firstIndex], default: .max]
        < edgeOrderIndex[second[secondIndex], default: .max]
      {
        result.append(first[firstIndex])
        firstIndex += 1
      } else {
        result.append(second[secondIndex])
        secondIndex += 1
      }
    }
    result.append(contentsOf: first[firstIndex...])
    result.append(contentsOf: second[secondIndex...])
    return result
  }

  fileprivate mutating func addToIndices(_ edge: FlowingGraphEdge<Schema>) {
    let endpoints = edge.endpoints.endpointList
    let nodeIDs = Set(endpoints.map(\.nodeID))

    for endpoint in Set(endpoints) {
      incidentEdgeIDsByEndpoint[endpoint, default: []].append(edge.id)
    }
    for nodeID in nodeIDs {
      incidentEdgeIDsByNodeID[nodeID, default: []].append(edge.id)
    }

    switch edge.endpoints {
    case .directed(let source, let target):
      directedOutgoingEdgeIDsByNodeID[source.nodeID, default: []].append(edge.id)
      directedIncomingEdgeIDsByNodeID[target.nodeID, default: []].append(edge.id)
    case .undirected:
      for nodeID in nodeIDs {
        undirectedEdgeIDsByNodeID[nodeID, default: []].append(edge.id)
      }
    }
  }

  fileprivate mutating func rebuildEdgeOrderIndex() {
    edgeOrderIndex = Dictionary(
      uniqueKeysWithValues: edgeOrder.enumerated().map { ($1, $0) }
    )
  }

  fileprivate mutating func resortEdgeIndices() {
    let rank = edgeOrderIndex
    directedOutgoingEdgeIDsByNodeID.sortValues(using: rank)
    directedIncomingEdgeIDsByNodeID.sortValues(using: rank)
    undirectedEdgeIDsByNodeID.sortValues(using: rank)
    incidentEdgeIDsByNodeID.sortValues(using: rank)
    incidentEdgeIDsByEndpoint.sortValues(using: rank)
  }

  fileprivate mutating func removeStaleEdgeIndices() {
    let retainedEdgeIDs = Set(edgesByID.keys)
    edgeOrder.removeAll { !retainedEdgeIDs.contains($0) }
    directedOutgoingEdgeIDsByNodeID.retainValues(in: retainedEdgeIDs)
    directedIncomingEdgeIDsByNodeID.retainValues(in: retainedEdgeIDs)
    undirectedEdgeIDsByNodeID.retainValues(in: retainedEdgeIDs)
    incidentEdgeIDsByNodeID.retainValues(in: retainedEdgeIDs)
    incidentEdgeIDsByEndpoint.retainValues(in: retainedEdgeIDs)
  }

  fileprivate mutating func finalizeUpdatedEdgeIndices(
    directedOutgoingNodeIDs: Set<Schema.NodeID>,
    directedIncomingNodeIDs: Set<Schema.NodeID>,
    undirectedNodeIDs: Set<Schema.NodeID>,
    incidentNodeIDs: Set<Schema.NodeID>,
    incidentEndpoints: Set<FlowingGraphEndpoint<Schema>>
  ) {
    let edges = edgesByID
    directedOutgoingEdgeIDsByNodeID.retainUniqueValues(
      for: directedOutgoingNodeIDs
    ) { nodeID, edgeID in
      guard case .directed(let source, _) = edges[edgeID]?.endpoints else {
        return false
      }
      return source.nodeID == nodeID
    }
    directedIncomingEdgeIDsByNodeID.retainUniqueValues(
      for: directedIncomingNodeIDs
    ) { nodeID, edgeID in
      guard case .directed(_, let target) = edges[edgeID]?.endpoints else {
        return false
      }
      return target.nodeID == nodeID
    }
    undirectedEdgeIDsByNodeID.retainUniqueValues(
      for: undirectedNodeIDs
    ) { nodeID, edgeID in
      guard case .undirected(let first, let second) = edges[edgeID]?.endpoints else {
        return false
      }
      return first.nodeID == nodeID || second.nodeID == nodeID
    }
    incidentEdgeIDsByNodeID.retainUniqueValues(for: incidentNodeIDs) {
      nodeID, edgeID in
      guard let edge = edges[edgeID] else { return false }
      return edge.endpoints.endpointList.contains { $0.nodeID == nodeID }
    }
    incidentEdgeIDsByEndpoint.retainUniqueValues(for: incidentEndpoints) {
      endpoint, edgeID in
      edges[edgeID]?.endpoints.endpointList.contains(endpoint) == true
    }

    let rank = edgeOrderIndex
    directedOutgoingEdgeIDsByNodeID.sortValues(
      using: rank,
      for: directedOutgoingNodeIDs
    )
    directedIncomingEdgeIDsByNodeID.sortValues(
      using: rank,
      for: directedIncomingNodeIDs
    )
    undirectedEdgeIDsByNodeID.sortValues(using: rank, for: undirectedNodeIDs)
    incidentEdgeIDsByNodeID.sortValues(using: rank, for: incidentNodeIDs)
    incidentEdgeIDsByEndpoint.sortValues(using: rank, for: incidentEndpoints)
  }

  fileprivate mutating func removeStaleNodeOrder() {
    let retainedNodeIDs = Set(nodesByID.keys)
    nodeOrder.removeAll { !retainedNodeIDs.contains($0) }
  }

  fileprivate mutating func removeStalePortOrder(nodeIDs: Set<Schema.NodeID>) {
    for nodeID in nodeIDs {
      guard nodesByID[nodeID] != nil else {
        portOrderByNodeID.removeValue(forKey: nodeID)
        continue
      }
      portOrderByNodeID[nodeID]?.removeAll { portID in
        portsByKey[FlowingGraphPortKey(nodeID: nodeID, portID: portID)] == nil
      }
    }
  }

  private var hasConsistentStorage: Bool {
    guard Set(nodeOrder).count == nodeOrder.count,
      Set(nodeOrder) == Set(nodesByID.keys),
      Set(portOrderByNodeID.keys) == Set(nodesByID.keys),
      Set(edgeOrder).count == edgeOrder.count,
      Set(edgeOrder) == Set(edgesByID.keys)
    else { return false }

    for (nodeID, node) in nodesByID where node.id != nodeID {
      return false
    }
    for (edgeID, edge) in edgesByID where edge.id != edgeID {
      return false
    }

    var orderedPortKeys: [FlowingGraphPortKey<Schema>] = []
    orderedPortKeys.reserveCapacity(portsByKey.count)
    for nodeID in nodeOrder {
      let portIDs = portOrderByNodeID[nodeID, default: []]
      guard Set(portIDs).count == portIDs.count else { return false }
      orderedPortKeys.append(
        contentsOf: portIDs.map {
          FlowingGraphPortKey(nodeID: nodeID, portID: $0)
        }
      )
    }
    guard Set(orderedPortKeys) == Set(portsByKey.keys) else { return false }
    for (key, port) in portsByKey where port.key != key {
      return false
    }

    let expectedEdgeOrderIndex = Dictionary(
      uniqueKeysWithValues: edgeOrder.enumerated().map { ($1, $0) }
    )
    guard edgeOrderIndex == expectedEdgeOrderIndex else { return false }

    var rebuilt = self
    rebuilt.directedOutgoingEdgeIDsByNodeID = [:]
    rebuilt.directedIncomingEdgeIDsByNodeID = [:]
    rebuilt.undirectedEdgeIDsByNodeID = [:]
    rebuilt.incidentEdgeIDsByNodeID = [:]
    rebuilt.incidentEdgeIDsByEndpoint = [:]
    for edgeID in edgeOrder {
      guard let edge = edgesByID[edgeID],
        edge.endpoints.endpointList.allSatisfy(contains)
      else { return false }
      rebuilt.addToIndices(edge)
    }

    return directedOutgoingEdgeIDsByNodeID == rebuilt.directedOutgoingEdgeIDsByNodeID
      && directedIncomingEdgeIDsByNodeID == rebuilt.directedIncomingEdgeIDsByNodeID
      && undirectedEdgeIDsByNodeID == rebuilt.undirectedEdgeIDsByNodeID
      && incidentEdgeIDsByNodeID == rebuilt.incidentEdgeIDsByNodeID
      && incidentEdgeIDsByEndpoint == rebuilt.incidentEdgeIDsByEndpoint
  }

  private func contains(_ endpoint: FlowingGraphEndpoint<Schema>) -> Bool {
    switch endpoint {
    case .node(let nodeID):
      nodesByID[nodeID] != nil
    case .port(let key):
      portsByKey[key] != nil
    }
  }
}

extension FlowingGraph: Sendable
where
  Schema.NodeID: Sendable,
  Schema.NodeValue: Sendable,
  Schema.PortID: Sendable,
  Schema.PortValue: Sendable,
  Schema.EdgeID: Sendable,
  Schema.EdgeValue: Sendable
{}

public struct FlowingGraphTransaction<Schema: FlowingGraphSchema> {
  fileprivate var graph: FlowingGraph<Schema>
  fileprivate var issue: FlowingGraphMutationIssue<Schema>?
  fileprivate var touchedNodeIDs: Set<Schema.NodeID> = []
  fileprivate var touchedNodeIDOrder: [Schema.NodeID] = []
  fileprivate var touchedPortKeys: Set<FlowingGraphPortKey<Schema>> = []
  fileprivate var touchedPortKeyOrder: [FlowingGraphPortKey<Schema>] = []
  fileprivate var touchedEdgeIDs: Set<Schema.EdgeID> = []
  fileprivate var touchedEdgeIDOrder: [Schema.EdgeID] = []
  fileprivate var touchedNodeOrderIDs: Set<Schema.NodeID> = []
  fileprivate var touchedNodeOrderIDOrder: [Schema.NodeID] = []
  fileprivate var touchedPortOrderKeys: Set<FlowingGraphPortKey<Schema>> = []
  fileprivate var touchedPortOrderKeyOrder: [FlowingGraphPortKey<Schema>] = []
  fileprivate var touchedEdgeOrderIDs: Set<Schema.EdgeID> = []
  fileprivate var touchedEdgeOrderIDOrder: [Schema.EdgeID] = []
  fileprivate var nodeOrderNeedsFinalization = false
  fileprivate var portOrderNodeIDsNeedingFinalization: Set<Schema.NodeID> = []
  fileprivate var edgeIndicesNeedFinalization = false
  fileprivate var edgeRemovalsNeedFinalization = false
  fileprivate var edgeOrderNeedsFinalization = false
  fileprivate var dirtyDirectedOutgoingNodeIDs: Set<Schema.NodeID> = []
  fileprivate var dirtyDirectedIncomingNodeIDs: Set<Schema.NodeID> = []
  fileprivate var dirtyUndirectedNodeIDs: Set<Schema.NodeID> = []
  fileprivate var dirtyIncidentNodeIDs: Set<Schema.NodeID> = []
  fileprivate var dirtyIncidentEndpoints: Set<FlowingGraphEndpoint<Schema>> = []

  fileprivate var hasChanges: Bool {
    !touchedNodeIDs.isEmpty || !touchedPortKeys.isEmpty || !touchedEdgeIDs.isEmpty
      || !touchedNodeOrderIDs.isEmpty || !touchedPortOrderKeys.isEmpty
      || !touchedEdgeOrderIDs.isEmpty
  }

  public mutating func insert(_ node: FlowingGraphNode<Schema>) {
    guard issue == nil else { return }
    guard graph.nodesByID[node.id] == nil else {
      reject(.duplicateElement(.node(node.id)))
      return
    }
    if nodeOrderNeedsFinalization, touchedNodeIDs.contains(node.id) {
      finalizeIndices()
    }

    graph.nodesByID[node.id] = node
    graph.nodeOrder.append(node.id)
    graph.portOrderByNodeID[node.id] = []
    touchNode(node.id)
    touchNodeOrder(node.id)
  }

  public mutating func update(_ node: FlowingGraphNode<Schema>) {
    guard issue == nil else { return }
    guard graph.nodesByID[node.id] != nil else {
      reject(.unknownElement(.node(node.id)))
      return
    }

    graph.nodesByID[node.id] = node
    touchNode(node.id)
  }

  public mutating func insert(_ port: FlowingGraphPort<Schema>) {
    guard issue == nil else { return }
    guard graph.nodesByID[port.key.nodeID] != nil else {
      reject(.unknownElement(.node(port.key.nodeID)))
      return
    }
    guard graph.portsByKey[port.key] == nil else {
      reject(.duplicateElement(.port(port.key)))
      return
    }
    if portOrderNodeIDsNeedingFinalization.contains(port.key.nodeID),
      touchedPortKeys.contains(port.key)
    {
      finalizeIndices()
    }

    graph.portsByKey[port.key] = port
    graph.portOrderByNodeID[port.key.nodeID, default: []].append(port.key.portID)
    touchPort(port.key)
    touchPortOrder(port.key)
  }

  public mutating func update(_ port: FlowingGraphPort<Schema>) {
    guard issue == nil else { return }
    guard graph.portsByKey[port.key] != nil else {
      reject(.unknownElement(.port(port.key)))
      return
    }

    graph.portsByKey[port.key] = port
    touchPort(port.key)
  }

  public mutating func insert(_ edge: FlowingGraphEdge<Schema>) {
    guard issue == nil else { return }
    guard graph.edgesByID[edge.id] == nil else {
      reject(.duplicateElement(.edge(edge.id)))
      return
    }
    guard validate(edge.endpoints) else { return }
    if graph.edgeOrderIndex[edge.id] != nil {
      finalizeIndices()
    }

    graph.edgesByID[edge.id] = edge
    graph.edgeOrder.append(edge.id)
    graph.edgeOrderIndex[edge.id] = graph.edgeOrder.count - 1
    graph.addToIndices(edge)
    touchEdge(edge.id)
    touchEdgeOrder(edge.id)
  }

  public mutating func update(_ edge: FlowingGraphEdge<Schema>) {
    guard issue == nil else { return }
    guard let previous = graph.edgesByID[edge.id] else {
      reject(.unknownElement(.edge(edge.id)))
      return
    }
    guard validate(edge.endpoints) else { return }

    graph.edgesByID[edge.id] = edge
    if previous.endpoints != edge.endpoints {
      markEdgeIndicesDirty(for: previous)
      markEdgeIndicesDirty(for: edge)
      graph.addToIndices(edge)
      edgeIndicesNeedFinalization = true
    }
    touchEdge(edge.id)
  }

  public mutating func removeNode(
    id: Schema.NodeID,
    policy: FlowingGraphRemovalPolicy = .cascade
  ) {
    guard issue == nil else { return }
    guard graph.nodesByID[id] != nil else {
      reject(.unknownElement(.node(id)))
      return
    }
    finalizeEdgeIndices()

    let incidentEdgeIDs = graph.incidentEdgeIDsByNodeID[id, default: []].filter {
      graph.edgesByID[$0] != nil
    }
    if policy == .strict, !incidentEdgeIDs.isEmpty {
      reject(.incidentEdgesPreventRemoval(.node(id)))
      return
    }

    for edgeID in incidentEdgeIDs {
      removeEdgeUnchecked(id: edgeID)
    }
    for portID in graph.portOrderByNodeID[id, default: []] {
      let key = FlowingGraphPortKey<Schema>(nodeID: id, portID: portID)
      graph.portsByKey.removeValue(forKey: key)
      touchPort(key)
      touchPortOrder(key)
    }
    graph.portOrderByNodeID.removeValue(forKey: id)
    graph.nodesByID.removeValue(forKey: id)
    nodeOrderNeedsFinalization = true
    graph.incidentEdgeIDsByNodeID.removeValue(forKey: id)
    graph.directedOutgoingEdgeIDsByNodeID.removeValue(forKey: id)
    graph.directedIncomingEdgeIDsByNodeID.removeValue(forKey: id)
    graph.undirectedEdgeIDsByNodeID.removeValue(forKey: id)
    touchNode(id)
    touchNodeOrder(id)
  }

  public mutating func removePort(
    key: FlowingGraphPortKey<Schema>,
    policy: FlowingGraphRemovalPolicy = .cascade
  ) {
    guard issue == nil else { return }
    guard graph.portsByKey[key] != nil else {
      reject(.unknownElement(.port(key)))
      return
    }
    finalizeEdgeIndices()

    let endpoint = FlowingGraphEndpoint<Schema>.port(key)
    let incidentEdgeIDs = graph.incidentEdgeIDsByEndpoint[endpoint, default: []].filter {
      graph.edgesByID[$0] != nil
    }
    if policy == .strict, !incidentEdgeIDs.isEmpty {
      reject(.incidentEdgesPreventRemoval(.port(key)))
      return
    }

    for edgeID in incidentEdgeIDs {
      removeEdgeUnchecked(id: edgeID)
    }
    graph.portsByKey.removeValue(forKey: key)
    portOrderNodeIDsNeedingFinalization.insert(key.nodeID)
    touchPort(key)
    touchPortOrder(key)
  }

  public mutating func removeEdge(id: Schema.EdgeID) {
    guard issue == nil else { return }
    guard graph.edgesByID[id] != nil else {
      reject(.unknownElement(.edge(id)))
      return
    }
    removeEdgeUnchecked(id: id)
  }

  public mutating func moveNode(
    id: Schema.NodeID,
    to position: FlowingGraphOrderPosition<Schema.NodeID>
  ) {
    guard issue == nil else { return }
    guard graph.nodesByID[id] != nil else {
      reject(.unknownElement(.node(id)))
      return
    }
    guard validateNodeOrderPosition(position) else { return }
    finalizeIndices()

    graph.nodeOrder = Self.moving(id, in: graph.nodeOrder, to: position)
    touchNodeOrder(id)
  }

  public mutating func movePort(
    key: FlowingGraphPortKey<Schema>,
    to position: FlowingGraphOrderPosition<Schema.PortID>
  ) {
    guard issue == nil else { return }
    guard graph.portsByKey[key] != nil else {
      reject(.unknownElement(.port(key)))
      return
    }
    guard validatePortOrderPosition(position, nodeID: key.nodeID) else { return }
    finalizeIndices()

    let order = graph.portOrderByNodeID[key.nodeID, default: []]
    graph.portOrderByNodeID[key.nodeID] = Self.moving(key.portID, in: order, to: position)
    touchPortOrder(key)
  }

  public mutating func moveEdge(
    id: Schema.EdgeID,
    to position: FlowingGraphOrderPosition<Schema.EdgeID>
  ) {
    guard issue == nil else { return }
    guard graph.edgesByID[id] != nil else {
      reject(.unknownElement(.edge(id)))
      return
    }
    guard validateEdgeOrderPosition(position) else { return }
    finalizeIndices()

    graph.edgeOrder = Self.moving(id, in: graph.edgeOrder, to: position)
    edgeIndicesNeedFinalization = true
    edgeOrderNeedsFinalization = true
    touchEdgeOrder(id)
  }

  fileprivate func changeSet(
    from original: FlowingGraph<Schema>,
    newSnapshotID: FlowingGraphSnapshotID
  ) -> FlowingGraphChangeSet<Schema> {
    let oldNodePositions = Self.positions(
      for: touchedNodeOrderIDs,
      in: original.nodeOrder
    )
    let newNodePositions = Self.positions(
      for: touchedNodeOrderIDs,
      in: graph.nodeOrder
    )
    let oldPortPositions = Self.portPositions(
      for: touchedPortOrderKeys,
      in: original.portOrderByNodeID
    )
    let newPortPositions = Self.portPositions(
      for: touchedPortOrderKeys,
      in: graph.portOrderByNodeID
    )
    let oldEdgePositions = Self.positions(
      for: touchedEdgeOrderIDs,
      in: original.edgeOrder
    )
    let newEdgePositions = Self.positions(
      for: touchedEdgeOrderIDs,
      in: graph.edgeOrder
    )

    return FlowingGraphChangeSet(
      oldSnapshotID: original.snapshotID,
      newSnapshotID: newSnapshotID,
      nodeChanges: touchedNodeIDOrder.compactMap { id in
        let oldValue = original.nodesByID[id]
        let newValue = graph.nodesByID[id]
        guard oldValue != nil || newValue != nil else { return nil }
        return FlowingGraphElementChange(id: id, oldValue: oldValue, newValue: newValue)
      },
      portChanges: touchedPortKeyOrder.compactMap { key in
        let oldValue = original.portsByKey[key]
        let newValue = graph.portsByKey[key]
        guard oldValue != nil || newValue != nil else { return nil }
        return FlowingGraphElementChange(id: key, oldValue: oldValue, newValue: newValue)
      },
      edgeChanges: touchedEdgeIDOrder.compactMap { id in
        let oldValue = original.edgesByID[id]
        let newValue = graph.edgesByID[id]
        guard oldValue != nil || newValue != nil else { return nil }
        return FlowingGraphElementChange(id: id, oldValue: oldValue, newValue: newValue)
      },
      nodeOrderChanges: touchedNodeOrderIDOrder.compactMap { id in
        Self.orderChange(
          id: id,
          oldPosition: oldNodePositions[id],
          newPosition: newNodePositions[id]
        )
      },
      portOrderChanges: touchedPortOrderKeyOrder.compactMap { key in
        Self.orderChange(
          id: key,
          oldPosition: oldPortPositions[key],
          newPosition: newPortPositions[key]
        )
      },
      edgeOrderChanges: touchedEdgeOrderIDOrder.compactMap { id in
        Self.orderChange(
          id: id,
          oldPosition: oldEdgePositions[id],
          newPosition: newEdgePositions[id]
        )
      }
    )
  }

  private mutating func validate(_ endpoints: FlowingGraphEdgeEndpoints<Schema>) -> Bool {
    for endpoint in endpoints.endpointList where !contains(endpoint) {
      reject(.unknownEndpoint(endpoint))
      return false
    }
    return true
  }

  private func contains(_ endpoint: FlowingGraphEndpoint<Schema>) -> Bool {
    switch endpoint {
    case .node(let nodeID):
      graph.nodesByID[nodeID] != nil
    case .port(let key):
      graph.portsByKey[key] != nil
    }
  }

  private mutating func removeEdgeUnchecked(id: Schema.EdgeID) {
    guard graph.edgesByID.removeValue(forKey: id) != nil else { return }
    edgeIndicesNeedFinalization = true
    edgeRemovalsNeedFinalization = true
    touchEdge(id)
    touchEdgeOrder(id)
  }

  fileprivate mutating func finalizeIndices() {
    if nodeOrderNeedsFinalization {
      graph.removeStaleNodeOrder()
      nodeOrderNeedsFinalization = false
    }
    if !portOrderNodeIDsNeedingFinalization.isEmpty {
      graph.removeStalePortOrder(nodeIDs: portOrderNodeIDsNeedingFinalization)
      portOrderNodeIDsNeedingFinalization.removeAll(keepingCapacity: true)
    }
    finalizeEdgeIndices()
  }

  private mutating func finalizeEdgeIndices() {
    if edgeIndicesNeedFinalization {
      if edgeRemovalsNeedFinalization {
        graph.removeStaleEdgeIndices()
        graph.rebuildEdgeOrderIndex()
      }
      graph.finalizeUpdatedEdgeIndices(
        directedOutgoingNodeIDs: dirtyDirectedOutgoingNodeIDs,
        directedIncomingNodeIDs: dirtyDirectedIncomingNodeIDs,
        undirectedNodeIDs: dirtyUndirectedNodeIDs,
        incidentNodeIDs: dirtyIncidentNodeIDs,
        incidentEndpoints: dirtyIncidentEndpoints
      )
      if edgeOrderNeedsFinalization {
        graph.rebuildEdgeOrderIndex()
        graph.resortEdgeIndices()
      }
      edgeIndicesNeedFinalization = false
      edgeRemovalsNeedFinalization = false
      edgeOrderNeedsFinalization = false
      dirtyDirectedOutgoingNodeIDs.removeAll(keepingCapacity: true)
      dirtyDirectedIncomingNodeIDs.removeAll(keepingCapacity: true)
      dirtyUndirectedNodeIDs.removeAll(keepingCapacity: true)
      dirtyIncidentNodeIDs.removeAll(keepingCapacity: true)
      dirtyIncidentEndpoints.removeAll(keepingCapacity: true)
    }
  }

  private mutating func markEdgeIndicesDirty(
    for edge: FlowingGraphEdge<Schema>
  ) {
    let endpoints = Set(edge.endpoints.endpointList)
    dirtyIncidentEndpoints.formUnion(endpoints)
    dirtyIncidentNodeIDs.formUnion(endpoints.map(\.nodeID))
    switch edge.endpoints {
    case .directed(let source, let target):
      dirtyDirectedOutgoingNodeIDs.insert(source.nodeID)
      dirtyDirectedIncomingNodeIDs.insert(target.nodeID)
    case .undirected:
      dirtyUndirectedNodeIDs.formUnion(endpoints.map(\.nodeID))
    }
  }

  private mutating func validateNodeOrderPosition(
    _ position: FlowingGraphOrderPosition<Schema.NodeID>
  ) -> Bool {
    guard let target = position.targetID else { return true }
    guard graph.nodesByID[target] != nil else {
      reject(.unknownElement(.node(target)))
      return false
    }
    return true
  }

  private mutating func validatePortOrderPosition(
    _ position: FlowingGraphOrderPosition<Schema.PortID>,
    nodeID: Schema.NodeID
  ) -> Bool {
    guard let target = position.targetID else { return true }
    let key = FlowingGraphPortKey<Schema>(nodeID: nodeID, portID: target)
    guard graph.portsByKey[key] != nil else {
      reject(.unknownElement(.port(key)))
      return false
    }
    return true
  }

  private mutating func validateEdgeOrderPosition(
    _ position: FlowingGraphOrderPosition<Schema.EdgeID>
  ) -> Bool {
    guard let target = position.targetID else { return true }
    guard graph.edgesByID[target] != nil else {
      reject(.unknownElement(.edge(target)))
      return false
    }
    return true
  }

  private mutating func reject(_ issue: FlowingGraphMutationIssue<Schema>) {
    self.issue = issue
  }

  private mutating func touchNode(_ id: Schema.NodeID) {
    if touchedNodeIDs.insert(id).inserted {
      touchedNodeIDOrder.append(id)
    }
  }

  private mutating func touchPort(_ key: FlowingGraphPortKey<Schema>) {
    if touchedPortKeys.insert(key).inserted {
      touchedPortKeyOrder.append(key)
    }
  }

  private mutating func touchEdge(_ id: Schema.EdgeID) {
    if touchedEdgeIDs.insert(id).inserted {
      touchedEdgeIDOrder.append(id)
    }
  }

  private mutating func touchNodeOrder(_ id: Schema.NodeID) {
    if touchedNodeOrderIDs.insert(id).inserted {
      touchedNodeOrderIDOrder.append(id)
    }
  }

  private mutating func touchPortOrder(_ key: FlowingGraphPortKey<Schema>) {
    if touchedPortOrderKeys.insert(key).inserted {
      touchedPortOrderKeyOrder.append(key)
    }
  }

  private mutating func touchEdgeOrder(_ id: Schema.EdgeID) {
    if touchedEdgeOrderIDs.insert(id).inserted {
      touchedEdgeOrderIDOrder.append(id)
    }
  }

  private static func moving<ID: Hashable>(
    _ id: ID,
    in order: [ID],
    to position: FlowingGraphOrderPosition<ID>
  ) -> [ID] {
    guard position.targetID != id else { return order }
    var result = order
    result.removeAll { $0 == id }

    switch position {
    case .first:
      result.insert(id, at: 0)
    case .last:
      result.append(id)
    case .before(let target):
      result.insert(id, at: result.firstIndex(of: target)!)
    case .after(let target):
      result.insert(id, at: result.firstIndex(of: target)! + 1)
    }
    return result
  }

  private static func orderChange<ID: Hashable>(
    id: ID,
    oldPosition: FlowingGraphOrderPosition<ID>?,
    newPosition: FlowingGraphOrderPosition<ID>?
  ) -> FlowingGraphOrderChange<ID>? {
    guard oldPosition != newPosition else { return nil }
    return FlowingGraphOrderChange(
      id: id,
      oldPosition: oldPosition,
      newPosition: newPosition
    )
  }

  private static func positions<ID: Hashable>(
    for requestedIDs: Set<ID>,
    in order: [ID]
  ) -> [ID: FlowingGraphOrderPosition<ID>] {
    guard !requestedIDs.isEmpty else { return [:] }
    var result: [ID: FlowingGraphOrderPosition<ID>] = [:]
    result.reserveCapacity(requestedIDs.count)
    var previous: ID?
    for id in order {
      if requestedIDs.contains(id) {
        result[id] = previous.map(FlowingGraphOrderPosition.after) ?? .first
      }
      previous = id
    }
    return result
  }

  private static func portPositions(
    for requestedKeys: Set<FlowingGraphPortKey<Schema>>,
    in orders: [Schema.NodeID: [Schema.PortID]]
  ) -> [FlowingGraphPortKey<Schema>: FlowingGraphOrderPosition<FlowingGraphPortKey<Schema>>] {
    guard !requestedKeys.isEmpty else { return [:] }
    let nodeIDs = Set(requestedKeys.map(\.nodeID))
    var result:
      [FlowingGraphPortKey<Schema>: FlowingGraphOrderPosition<FlowingGraphPortKey<Schema>>] = [:]
    result.reserveCapacity(requestedKeys.count)

    for nodeID in nodeIDs {
      var previous: FlowingGraphPortKey<Schema>?
      for portID in orders[nodeID, default: []] {
        let key = FlowingGraphPortKey<Schema>(nodeID: nodeID, portID: portID)
        if requestedKeys.contains(key) {
          result[key] = previous.map(FlowingGraphOrderPosition.after) ?? .first
        }
        previous = key
      }
    }
    return result
  }
}

extension FlowingGraphEndpoint {
  fileprivate var nodeID: Schema.NodeID {
    switch self {
    case .node(let nodeID):
      nodeID
    case .port(let key):
      key.nodeID
    }
  }
}

extension FlowingGraphEdgeEndpoints {
  fileprivate var endpointList: [FlowingGraphEndpoint<Schema>] {
    switch self {
    case .directed(let source, let target):
      [source, target]
    case .undirected(let first, let second):
      [first, second]
    }
  }
}

extension FlowingGraphOrderPosition {
  fileprivate var targetID: ID? {
    switch self {
    case .first, .last:
      nil
    case .before(let id), .after(let id):
      id
    }
  }
}

extension Dictionary {
  fileprivate mutating func sortValues<EdgeID: Hashable>(using rank: [EdgeID: Int])
  where Value == [EdgeID] {
    for key in Array(keys) {
      self[key]?.sort { rank[$0, default: .max] < rank[$1, default: .max] }
    }
  }

  fileprivate mutating func sortValues<EdgeID: Hashable>(
    using rank: [EdgeID: Int],
    for keys: Set<Key>
  ) where Value == [EdgeID] {
    for key in keys {
      self[key]?.sort { rank[$0, default: .max] < rank[$1, default: .max] }
    }
  }

  fileprivate mutating func retainValues<Element: Hashable>(in retainedValues: Set<Element>)
  where Value == [Element] {
    for key in Array(keys) {
      self[key]?.removeAll { !retainedValues.contains($0) }
      if self[key]?.isEmpty == true {
        removeValue(forKey: key)
      }
    }
  }

  fileprivate mutating func retainUniqueValues<Element: Hashable>(
    for keys: Set<Key>,
    where isIncluded: (Key, Element) -> Bool
  ) where Value == [Element] {
    for key in keys {
      var seen: Set<Element> = []
      self[key]?.removeAll { element in
        !isIncluded(key, element) || !seen.insert(element).inserted
      }
      if self[key]?.isEmpty == true {
        removeValue(forKey: key)
      }
    }
  }
}
