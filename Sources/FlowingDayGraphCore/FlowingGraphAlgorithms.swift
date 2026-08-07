public enum FlowingGraphTraversalDirection: Hashable, Sendable {
  case outgoing
  case incoming
  case incident
}

public struct FlowingGraphTraversalPolicy: Hashable, Sendable {
  public var direction: FlowingGraphTraversalDirection
  public var includesUndirected: Bool

  public init(
    direction: FlowingGraphTraversalDirection,
    includesUndirected: Bool
  ) {
    self.direction = direction
    self.includesUndirected = includesUndirected
  }

  public static let outgoing = Self(direction: .outgoing, includesUndirected: true)
  public static let incoming = Self(direction: .incoming, includesUndirected: true)
  public static let incident = Self(direction: .incident, includesUndirected: true)
}

public struct FlowingGraphPath<Schema: FlowingGraphSchema> {
  public let nodeIDs: [Schema.NodeID]
  public let edgeIDs: [Schema.EdgeID]

  public init(nodeIDs: [Schema.NodeID], edgeIDs: [Schema.EdgeID]) {
    self.nodeIDs = nodeIDs
    self.edgeIDs = edgeIDs
  }
}

extension FlowingGraphPath: Equatable {}
extension FlowingGraphPath: Sendable
where Schema.NodeID: Sendable, Schema.EdgeID: Sendable {}

public enum FlowingDAGUndirectedEdgePolicy: Hashable, Sendable {
  case reject
}

public struct FlowingDAGValidationConfiguration: Hashable, Sendable {
  public var undirectedEdgePolicy: FlowingDAGUndirectedEdgePolicy

  public init(undirectedEdgePolicy: FlowingDAGUndirectedEdgePolicy = .reject) {
    self.undirectedEdgePolicy = undirectedEdgePolicy
  }
}

public enum FlowingDAGValidationIssue<Schema: FlowingGraphSchema>: Equatable {
  case cycle(edgePath: [Schema.EdgeID])
  case undirectedEdges([Schema.EdgeID])
}

extension FlowingDAGValidationIssue: Sendable where Schema.EdgeID: Sendable {}

public struct FlowingDAGView<Schema: FlowingGraphSchema> {
  public let graph: FlowingGraph<Schema>
  public let configuration: FlowingDAGValidationConfiguration
  public let topologicalNodeIDs: [Schema.NodeID]

  public var snapshotID: FlowingGraphSnapshotID {
    graph.snapshotID
  }
}

extension FlowingDAGView: Sendable
where
  Schema.NodeID: Sendable,
  Schema.NodeValue: Sendable,
  Schema.PortID: Sendable,
  Schema.PortValue: Sendable,
  Schema.EdgeID: Sendable,
  Schema.EdgeValue: Sendable
{}

public enum FlowingDAGValidationResult<Schema: FlowingGraphSchema> {
  case valid(FlowingDAGView<Schema>)
  case invalid(FlowingDAGValidationIssue<Schema>)
}

extension FlowingDAGValidationResult: Sendable
where
  Schema.NodeID: Sendable,
  Schema.NodeValue: Sendable,
  Schema.PortID: Sendable,
  Schema.PortValue: Sendable,
  Schema.EdgeID: Sendable,
  Schema.EdgeValue: Sendable
{}

extension FlowingGraph {
  public func reachableNodeIDs(
    from start: Schema.NodeID,
    policy: FlowingGraphTraversalPolicy = .outgoing,
    includesStart: Bool = true
  ) -> [Schema.NodeID] {
    guard node(id: start) != nil else { return [] }

    var discovered: Set<Schema.NodeID> = [start]
    var result: [Schema.NodeID] = []
    var stack: [Schema.NodeID] = [start]

    while let current = stack.popLast() {
      if includesStart || current != start {
        result.append(current)
      }
      let neighbors = traversalSteps(from: current, policy: policy).map(\.nodeID)
      for neighbor in neighbors.reversed() where discovered.insert(neighbor).inserted {
        stack.append(neighbor)
      }
    }

    return result
  }

  public func descendantNodeIDs(
    of nodeID: Schema.NodeID,
    includesStart: Bool = false
  ) -> [Schema.NodeID] {
    reachableNodeIDs(
      from: nodeID,
      policy: FlowingGraphTraversalPolicy(
        direction: .outgoing,
        includesUndirected: false
      ),
      includesStart: includesStart
    )
  }

  public func ancestorNodeIDs(
    of nodeID: Schema.NodeID,
    includesStart: Bool = false
  ) -> [Schema.NodeID] {
    reachableNodeIDs(
      from: nodeID,
      policy: FlowingGraphTraversalPolicy(
        direction: .incoming,
        includesUndirected: false
      ),
      includesStart: includesStart
    )
  }

  public func shortestPath(
    from start: Schema.NodeID,
    to destination: Schema.NodeID,
    policy: FlowingGraphTraversalPolicy = .outgoing
  ) -> FlowingGraphPath<Schema>? {
    shortestPath(
      from: start,
      to: destination,
      policy: policy,
      excluding: []
    )
  }

  private func shortestPath(
    from start: Schema.NodeID,
    to destination: Schema.NodeID,
    policy: FlowingGraphTraversalPolicy,
    excluding excludedEdgeIDs: Set<Schema.EdgeID>
  ) -> FlowingGraphPath<Schema>? {
    guard node(id: start) != nil, node(id: destination) != nil else { return nil }
    if start == destination {
      return FlowingGraphPath(nodeIDs: [start], edgeIDs: [])
    }

    var visited: Set<Schema.NodeID> = [start]
    var parentByNodeID: [Schema.NodeID: (nodeID: Schema.NodeID, edgeID: Schema.EdgeID)] = [:]
    var queue: [Schema.NodeID] = [start]
    var index = 0

    while index < queue.count {
      let current = queue[index]
      index += 1

      for step in traversalSteps(from: current, policy: policy)
      where !excludedEdgeIDs.contains(step.edgeID) {
        guard visited.insert(step.nodeID).inserted else { continue }
        parentByNodeID[step.nodeID] = (current, step.edgeID)
        if step.nodeID == destination {
          return Self.path(
            from: start,
            to: destination,
            parents: parentByNodeID
          )
        }
        queue.append(step.nodeID)
      }
    }

    return nil
  }

  public func weaklyConnectedComponents() -> [[Schema.NodeID]] {
    var visited: Set<Schema.NodeID> = []
    var components: [[Schema.NodeID]] = []

    for start in nodeIDs where visited.insert(start).inserted {
      var component: [Schema.NodeID] = []
      var stack: [Schema.NodeID] = [start]

      while let current = stack.popLast() {
        component.append(current)
        let neighbors = traversalSteps(from: current, policy: .incident).map(\.nodeID)
        for neighbor in neighbors.reversed() where visited.insert(neighbor).inserted {
          stack.append(neighbor)
        }
      }
      components.append(component)
    }

    return components
  }

  public func stronglyConnectedComponents() -> [[Schema.NodeID]] {
    let forward = FlowingGraphTraversalPolicy(
      direction: .outgoing,
      includesUndirected: true
    )
    let reverse = FlowingGraphTraversalPolicy(
      direction: .incoming,
      includesUndirected: true
    )
    var visited: Set<Schema.NodeID> = []
    var finishOrder: [Schema.NodeID] = []

    for nodeID in nodeIDs where !visited.contains(nodeID) {
      depthFirstFinishOrder(
        from: nodeID,
        policy: forward,
        visited: &visited,
        finishOrder: &finishOrder
      )
    }

    visited.removeAll(keepingCapacity: true)
    var components: [[Schema.NodeID]] = []
    for start in finishOrder.reversed() where visited.insert(start).inserted {
      var component: [Schema.NodeID] = []
      var stack: [Schema.NodeID] = [start]
      while let current = stack.popLast() {
        component.append(current)
        let neighbors = traversalSteps(from: current, policy: reverse).map(\.nodeID)
        for neighbor in neighbors.reversed() where visited.insert(neighbor).inserted {
          stack.append(neighbor)
        }
      }
      components.append(component)
    }

    let rank = Dictionary(uniqueKeysWithValues: nodeIDs.enumerated().map { ($1, $0) })
    for index in components.indices {
      components[index].sort { rank[$0, default: .max] < rank[$1, default: .max] }
    }
    components.sort {
      rank[$0.first!, default: .max] < rank[$1.first!, default: .max]
    }
    return components
  }

  public func firstCycleEdgeIDs() -> [Schema.EdgeID]? {
    let components = stronglyConnectedComponents()
    var componentByNodeID: [Schema.NodeID: Int] = [:]
    componentByNodeID.reserveCapacity(nodeIDs.count)
    for (componentIndex, component) in components.enumerated() {
      for nodeID in component {
        componentByNodeID[nodeID] = componentIndex
      }
    }

    for edge in edges {
      guard case .directed(let source, let target) = edge.endpoints else { continue }
      if source.nodeID == target.nodeID {
        return [edge.id]
      }
      guard componentByNodeID[source.nodeID] == componentByNodeID[target.nodeID]
      else { continue }

      let returnPath = shortestPath(
        from: target.nodeID,
        to: source.nodeID,
        policy: .outgoing,
        excluding: [edge.id]
      )
      if let returnPath {
        return [edge.id] + returnPath.edgeIDs
      }
    }

    return firstUndirectedCycleEdgeIDs()
  }

  private func firstUndirectedCycleEdgeIDs() -> [Schema.EdgeID]? {
    var visited: Set<Schema.NodeID> = []
    var active: Set<Schema.NodeID> = []
    var parentNodeByNodeID: [Schema.NodeID: Schema.NodeID] = [:]
    var parentEdgeByNodeID: [Schema.NodeID: Schema.EdgeID] = [:]

    for root in nodeIDs where !visited.contains(root) {
      var stack: [CycleEvent] = [
        .enter(nodeID: root, parentNodeID: nil, parentEdgeID: nil)
      ]

      while let event = stack.popLast() {
        switch event {
        case .enter(let nodeID, let parentNodeID, let parentEdgeID):
          guard visited.insert(nodeID).inserted else { continue }
          active.insert(nodeID)
          if let parentNodeID, let parentEdgeID {
            parentNodeByNodeID[nodeID] = parentNodeID
            parentEdgeByNodeID[nodeID] = parentEdgeID
          }

          stack.append(.exit(nodeID))
          let steps = traversalSteps(from: nodeID, policy: .incident)
            .filter(\.isUndirected)
          for step in steps.reversed() {
            stack.append(.traverse(from: nodeID, step: step))
          }

        case .traverse(let source, let step):
          if step.isUndirected, parentEdgeByNodeID[source] == step.edgeID {
            continue
          }
          if active.contains(step.nodeID) {
            return Self.cyclePath(
              from: source,
              to: step.nodeID,
              closingEdgeID: step.edgeID,
              parentNodeByNodeID: parentNodeByNodeID,
              parentEdgeByNodeID: parentEdgeByNodeID
            )
          }
          if !visited.contains(step.nodeID) {
            stack.append(
              .enter(
                nodeID: step.nodeID,
                parentNodeID: source,
                parentEdgeID: step.edgeID
              )
            )
          }

        case .exit(let nodeID):
          active.remove(nodeID)
        }
      }
    }

    return nil
  }

  public func validateDAG(
    configuration: FlowingDAGValidationConfiguration = .init()
  ) -> FlowingDAGValidationResult<Schema> {
    let undirectedEdgeIDs = edges.compactMap { edge -> Schema.EdgeID? in
      guard case .undirected = edge.endpoints else { return nil }
      return edge.id
    }
    switch configuration.undirectedEdgePolicy {
    case .reject where !undirectedEdgeIDs.isEmpty:
      return .invalid(.undirectedEdges(undirectedEdgeIDs))
    case .reject:
      break
    }

    var incomingCount = Dictionary(
      uniqueKeysWithValues: nodeIDs.map { ($0, 0) }
    )
    for edge in edges {
      guard case .directed(_, let target) = edge.endpoints else { continue }
      incomingCount[target.nodeID, default: 0] += 1
    }

    var ready: [Schema.NodeID] = []
    for nodeID in nodeIDs where incomingCount[nodeID] == 0 {
      ready.append(nodeID)
    }
    var readyIndex = 0
    var order: [Schema.NodeID] = []
    order.reserveCapacity(nodeIDs.count)
    let directedPolicy = FlowingGraphTraversalPolicy(
      direction: .outgoing,
      includesUndirected: false
    )

    while readyIndex < ready.count {
      let nodeID = ready[readyIndex]
      readyIndex += 1
      order.append(nodeID)

      for step in traversalSteps(from: nodeID, policy: directedPolicy) {
        incomingCount[step.nodeID, default: 0] -= 1
        if incomingCount[step.nodeID] == 0 {
          ready.append(step.nodeID)
        }
      }
    }

    guard order.count == nodeIDs.count else {
      guard let cycleEdgeIDs = firstCycleEdgeIDs() else {
        preconditionFailure("Cyclic graph did not produce a cycle diagnostic")
      }
      return .invalid(.cycle(edgePath: cycleEdgeIDs))
    }
    return .valid(
      FlowingDAGView(
        graph: self,
        configuration: configuration,
        topologicalNodeIDs: order
      )
    )
  }
}

extension FlowingGraph {
  fileprivate struct TraversalStep {
    let edgeID: Schema.EdgeID
    let nodeID: Schema.NodeID
    let isUndirected: Bool
  }

  fileprivate enum FinishEvent {
    case enter(Schema.NodeID)
    case exit(Schema.NodeID)
  }

  fileprivate enum CycleEvent {
    case enter(
      nodeID: Schema.NodeID,
      parentNodeID: Schema.NodeID?,
      parentEdgeID: Schema.EdgeID?
    )
    case traverse(from: Schema.NodeID, step: TraversalStep)
    case exit(Schema.NodeID)
  }

  fileprivate func traversalSteps(
    from nodeID: Schema.NodeID,
    policy: FlowingGraphTraversalPolicy
  ) -> [TraversalStep] {
    let candidateEdgeIDs: [Schema.EdgeID]
    switch policy.direction {
    case .outgoing:
      candidateEdgeIDs = outgoingEdgeIDs(nodeID: nodeID)
    case .incoming:
      candidateEdgeIDs = incomingEdgeIDs(nodeID: nodeID)
    case .incident:
      candidateEdgeIDs = incidentEdgeIDs(nodeID: nodeID)
    }

    return candidateEdgeIDs.compactMap { edgeID in
      guard let edge = edge(id: edgeID) else { return nil }
      switch edge.endpoints {
      case .directed(let source, let target):
        switch policy.direction {
        case .outgoing where source.nodeID == nodeID:
          return TraversalStep(edgeID: edgeID, nodeID: target.nodeID, isUndirected: false)
        case .incoming where target.nodeID == nodeID:
          return TraversalStep(edgeID: edgeID, nodeID: source.nodeID, isUndirected: false)
        case .incident where source.nodeID == nodeID:
          return TraversalStep(edgeID: edgeID, nodeID: target.nodeID, isUndirected: false)
        case .incident where target.nodeID == nodeID:
          return TraversalStep(edgeID: edgeID, nodeID: source.nodeID, isUndirected: false)
        default:
          return nil
        }

      case .undirected(let first, let second):
        guard policy.includesUndirected else { return nil }
        if first.nodeID == nodeID {
          return TraversalStep(edgeID: edgeID, nodeID: second.nodeID, isUndirected: true)
        }
        if second.nodeID == nodeID {
          return TraversalStep(edgeID: edgeID, nodeID: first.nodeID, isUndirected: true)
        }
        return nil
      }
    }
  }

  fileprivate func depthFirstFinishOrder(
    from start: Schema.NodeID,
    policy: FlowingGraphTraversalPolicy,
    visited: inout Set<Schema.NodeID>,
    finishOrder: inout [Schema.NodeID]
  ) {
    var stack: [FinishEvent] = [.enter(start)]
    while let event = stack.popLast() {
      switch event {
      case .enter(let nodeID):
        guard visited.insert(nodeID).inserted else { continue }
        stack.append(.exit(nodeID))
        let neighbors = traversalSteps(from: nodeID, policy: policy).map(\.nodeID)
        for neighbor in neighbors.reversed() where !visited.contains(neighbor) {
          stack.append(.enter(neighbor))
        }
      case .exit(let nodeID):
        finishOrder.append(nodeID)
      }
    }
  }

  fileprivate static func path(
    from start: Schema.NodeID,
    to destination: Schema.NodeID,
    parents: [Schema.NodeID: (nodeID: Schema.NodeID, edgeID: Schema.EdgeID)]
  ) -> FlowingGraphPath<Schema> {
    var nodeIDs: [Schema.NodeID] = [destination]
    var edgeIDs: [Schema.EdgeID] = []
    var current = destination

    while current != start {
      let parent = parents[current]!
      edgeIDs.append(parent.edgeID)
      current = parent.nodeID
      nodeIDs.append(current)
    }

    return FlowingGraphPath(
      nodeIDs: Array(nodeIDs.reversed()),
      edgeIDs: Array(edgeIDs.reversed())
    )
  }

  fileprivate static func cyclePath(
    from source: Schema.NodeID,
    to target: Schema.NodeID,
    closingEdgeID: Schema.EdgeID,
    parentNodeByNodeID: [Schema.NodeID: Schema.NodeID],
    parentEdgeByNodeID: [Schema.NodeID: Schema.EdgeID]
  ) -> [Schema.EdgeID] {
    var reversedPath = [closingEdgeID]
    var current = source
    while current != target {
      reversedPath.append(parentEdgeByNodeID[current]!)
      current = parentNodeByNodeID[current]!
    }
    return Array(reversedPath.reversed())
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
