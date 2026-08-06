import CoreGraphics
import FlowingDayGraphComposition
import FlowingDayGraphCore
import Foundation

public struct FlowingGraphCollaborationReducer<Schema: FlowingGraphCollaborationSchema>:
  FlowingCollaborationReducer
{
  public typealias OperationSchema = FlowingGraphCollaborationOperationSchema<Schema>
  public typealias State = FlowingGraphCollaborationState<Schema>
  public typealias Failure = FlowingGraphCollaborationFailure<Schema>

  public let identity = FlowingCollaborationReducerIdentity(
    id: UUID(uuidString: "74D8A66C-1BC5-4717-9BCE-2CE593458598")!,
    revision: 1
  )
  public let limits: FlowingCollaborationLimits

  public init(limits: FlowingCollaborationLimits = .standard) {
    self.limits = limits
  }

  public func applying(
    _ envelope: FlowingCollaborationOperationEnvelope<OperationSchema>,
    to state: State
  ) -> Result<State, Failure> {
    var next = state
    var dirtyGraphIDs: Set<Schema.GraphID> = []
    do {
      for (commandIndex, command) in envelope.commands.enumerated() {
        try next.apply(
          command,
          operationID: envelope.operationID,
          commandIndex: commandIndex,
          maximumSequenceKeyBytes: limits.maximumSequenceKeyBytes,
          dirtyGraphIDs: &dirtyGraphIDs
        )
      }
      try next.finishTransaction(dirtyGraphIDs: dirtyGraphIDs)
      return .success(next)
    } catch {
      return .failure(error)
    }
  }
}

extension FlowingGraphCollaborationState {
  fileprivate mutating func apply(
    _ command: FlowingGraphCollaborationCommand<Schema>,
    operationID: FlowingCollaborationOperationID,
    commandIndex: Int,
    maximumSequenceKeyBytes: Int,
    dirtyGraphIDs: inout Set<Schema.GraphID>
  ) throws(FlowingGraphCollaborationFailure<Schema>) {
    switch command {
    case .insertDefinition(let id, let position):
      try validate(
        position,
        operationID: operationID,
        commandIndex: commandIndex,
        maximumBytes: maximumSequenceKeyBytes,
        existing: definitionPositions.values
      )
      let element = FlowingGraphCollaborationElement<Schema>.definition(id)
      try requireInsertable(
        element,
        exists: document.definitions.contains { $0.id == id },
        tombstoned: tombstonedDefinitions.contains(id)
      )
      var definitions = document.definitions
      definitions.append(FlowingGraphDefinition(id: id, graph: .init()))
      definitionPositions[id] = position
      nodePositions[id] = [:]
      portPositions[id] = [:]
      edgePositions[id] = [:]
      replaceDocument(definitions: definitions)

    case .removeDefinition(let id):
      let element = FlowingGraphCollaborationElement<Schema>.definition(id)
      try requireExisting(
        element,
        exists: document.definitions.contains { $0.id == id },
        tombstoned: tombstonedDefinitions.contains(id)
      )
      tombstonedDefinitions.insert(id)
      definitionPositions.removeValue(forKey: id)
      nodePositions.removeValue(forKey: id)
      portPositions.removeValue(forKey: id)
      edgePositions.removeValue(forKey: id)
      tombstonedGraphElements.removeValue(forKey: id)
      sharedNodePlacements = sharedNodePlacements.filter { $0.key.graphID != id }
      replaceDocument(definitions: document.definitions.filter { $0.id != id })

    case .reorderDefinition(let id, let position):
      try requireExisting(
        .definition(id),
        exists: document.definitions.contains { $0.id == id },
        tombstoned: tombstonedDefinitions.contains(id)
      )
      try validate(
        position,
        operationID: operationID,
        commandIndex: commandIndex,
        maximumBytes: maximumSequenceKeyBytes,
        existing: definitionPositions.filter { $0.key != id }.values
      )
      definitionPositions[id] = position

    case .insertEntryPoint(let entryPoint, let position):
      try validate(
        position,
        operationID: operationID,
        commandIndex: commandIndex,
        maximumBytes: maximumSequenceKeyBytes,
        existing: entryPointPositions.values
      )
      let element = FlowingGraphCollaborationElement<Schema>.entryPoint(entryPoint.id)
      try requireInsertable(
        element,
        exists: document.entryPoints.contains { $0.id == entryPoint.id },
        tombstoned: tombstonedEntryPoints.contains(entryPoint.id)
      )
      entryPointPositions[entryPoint.id] = position
      replaceDocument(entryPoints: document.entryPoints + [entryPoint])

    case .updateEntryPoint(let entryPoint):
      let index = try entryPointIndex(entryPoint.id)
      var entryPoints = document.entryPoints
      entryPoints[index] = entryPoint
      replaceDocument(entryPoints: entryPoints)

    case .removeEntryPoint(let id):
      _ = try entryPointIndex(id)
      tombstonedEntryPoints.insert(id)
      entryPointPositions.removeValue(forKey: id)
      replaceDocument(entryPoints: document.entryPoints.filter { $0.id != id })

    case .reorderEntryPoint(let id, let position):
      _ = try entryPointIndex(id)
      try validate(
        position,
        operationID: operationID,
        commandIndex: commandIndex,
        maximumBytes: maximumSequenceKeyBytes,
        existing: entryPointPositions.filter { $0.key != id }.values
      )
      entryPointPositions[id] = position

    case .setDefaultEntryPoint(let id):
      _ = try entryPointIndex(id)
      replaceDocument(defaultEntryPointID: id)

    case .insertSubgraphLink(let link, let position):
      try validate(
        position,
        operationID: operationID,
        commandIndex: commandIndex,
        maximumBytes: maximumSequenceKeyBytes,
        existing: subgraphLinkPositions.values
      )
      let element = FlowingGraphCollaborationElement<Schema>.subgraphLink(link.id)
      try requireInsertable(
        element,
        exists: document.subgraphLinks.contains { $0.id == link.id },
        tombstoned: tombstonedSubgraphLinks.contains(link.id)
      )
      subgraphLinkPositions[link.id] = position
      replaceDocument(subgraphLinks: document.subgraphLinks + [link])

    case .updateSubgraphLink(let link):
      let index = try subgraphLinkIndex(link.id)
      var links = document.subgraphLinks
      links[index] = link
      replaceDocument(subgraphLinks: links)

    case .removeSubgraphLink(let id):
      _ = try subgraphLinkIndex(id)
      tombstonedSubgraphLinks.insert(id)
      subgraphLinkPositions.removeValue(forKey: id)
      replaceDocument(subgraphLinks: document.subgraphLinks.filter { $0.id != id })

    case .reorderSubgraphLink(let id, let position):
      _ = try subgraphLinkIndex(id)
      try validate(
        position,
        operationID: operationID,
        commandIndex: commandIndex,
        maximumBytes: maximumSequenceKeyBytes,
        existing: subgraphLinkPositions.filter { $0.key != id }.values
      )
      subgraphLinkPositions[id] = position

    case .insertNode(let graphID, let node, let position):
      let element = graphElement(graphID, .node(node.id))
      let graph = try graph(graphID)
      try requireInsertable(
        element,
        exists: graph.node(id: node.id) != nil,
        tombstoned: isTombstoned(graphID, .node(node.id))
      )
      try validate(
        position,
        operationID: operationID,
        commandIndex: commandIndex,
        maximumBytes: maximumSequenceKeyBytes,
        existing: nodePositions[graphID, default: [:]].values
      )
      try mutateGraph(graphID) { $0.insert(node) }
      nodePositions[graphID, default: [:]][node.id] = position
      dirtyGraphIDs.insert(graphID)

    case .updateNode(let graphID, let node):
      try requireGraphElement(graphID, .node(node.id))
      try mutateGraph(graphID) { $0.update(node) }

    case .compareAndSetNode(let graphID, let expected, let replacement):
      let element = graphElement(graphID, .node(expected.id))
      try requireGraphElement(graphID, .node(expected.id))
      guard expected.id == replacement.id,
        try graph(graphID).node(id: expected.id) == expected
      else {
        throw FlowingGraphCollaborationFailure<Schema>.compareAndSetConflict(element)
      }
      try mutateGraph(graphID) { $0.update(replacement) }

    case .removeNode(let graphID, let id):
      let graph = try graph(graphID)
      try requireGraphElement(graphID, .node(id))
      let ports = graph.ports(nodeID: id).map(\.key)
      let edges = graph.incidentEdgeIDs(nodeID: id)
      try mutateGraph(graphID) { $0.removeNode(id: id) }
      tombstone(graphID, .node(id))
      nodePositions[graphID]?.removeValue(forKey: id)
      sharedNodePlacements.removeValue(
        forKey: FlowingGraphDefinitionNodeAddress(graphID: graphID, nodeID: id)
      )
      for key in ports {
        tombstone(graphID, .port(key))
        portPositions[graphID]?.removeValue(forKey: key)
      }
      for edgeID in edges {
        tombstone(graphID, .edge(edgeID))
        edgePositions[graphID]?.removeValue(forKey: edgeID)
      }
      dirtyGraphIDs.insert(graphID)

    case .reorderNode(let graphID, let id, let position):
      try requireGraphElement(graphID, .node(id))
      try validate(
        position,
        operationID: operationID,
        commandIndex: commandIndex,
        maximumBytes: maximumSequenceKeyBytes,
        existing: nodePositions[graphID, default: [:]].filter { $0.key != id }.values
      )
      nodePositions[graphID, default: [:]][id] = position
      dirtyGraphIDs.insert(graphID)

    case .insertPort(let graphID, let port, let position):
      let element = graphElement(graphID, .port(port.key))
      let graph = try graph(graphID)
      try requireInsertable(
        element,
        exists: graph.port(key: port.key) != nil,
        tombstoned: isTombstoned(graphID, .port(port.key))
      )
      let positions = portPositions[graphID, default: [:]].filter {
        $0.key.nodeID == port.key.nodeID
      }.values
      try validate(
        position,
        operationID: operationID,
        commandIndex: commandIndex,
        maximumBytes: maximumSequenceKeyBytes,
        existing: positions
      )
      try mutateGraph(graphID) { $0.insert(port) }
      portPositions[graphID, default: [:]][port.key] = position
      dirtyGraphIDs.insert(graphID)

    case .updatePort(let graphID, let port):
      try requireGraphElement(graphID, .port(port.key))
      try mutateGraph(graphID) { $0.update(port) }

    case .removePort(let graphID, let key):
      let graph = try graph(graphID)
      try requireGraphElement(graphID, .port(key))
      let edges = graph.incidentEdgeIDs(endpoint: .port(key))
      try mutateGraph(graphID) { $0.removePort(key: key) }
      tombstone(graphID, .port(key))
      portPositions[graphID]?.removeValue(forKey: key)
      for edgeID in edges {
        tombstone(graphID, .edge(edgeID))
        edgePositions[graphID]?.removeValue(forKey: edgeID)
      }
      dirtyGraphIDs.insert(graphID)

    case .reorderPort(let graphID, let key, let position):
      try requireGraphElement(graphID, .port(key))
      let positions = portPositions[graphID, default: [:]].filter {
        $0.key.nodeID == key.nodeID && $0.key != key
      }.values
      try validate(
        position,
        operationID: operationID,
        commandIndex: commandIndex,
        maximumBytes: maximumSequenceKeyBytes,
        existing: positions
      )
      portPositions[graphID, default: [:]][key] = position
      dirtyGraphIDs.insert(graphID)

    case .insertEdge(let graphID, let edge, let position):
      let element = graphElement(graphID, .edge(edge.id))
      let graph = try graph(graphID)
      try requireInsertable(
        element,
        exists: graph.edge(id: edge.id) != nil,
        tombstoned: isTombstoned(graphID, .edge(edge.id))
      )
      try validate(
        position,
        operationID: operationID,
        commandIndex: commandIndex,
        maximumBytes: maximumSequenceKeyBytes,
        existing: edgePositions[graphID, default: [:]].values
      )
      try mutateGraph(graphID) { $0.insert(edge) }
      edgePositions[graphID, default: [:]][edge.id] = position
      dirtyGraphIDs.insert(graphID)

    case .updateEdge(let graphID, let edge):
      try requireGraphElement(graphID, .edge(edge.id))
      try mutateGraph(graphID) { $0.update(edge) }

    case .removeEdge(let graphID, let id):
      try requireGraphElement(graphID, .edge(id))
      try mutateGraph(graphID) { $0.removeEdge(id: id) }
      tombstone(graphID, .edge(id))
      edgePositions[graphID]?.removeValue(forKey: id)
      dirtyGraphIDs.insert(graphID)

    case .reorderEdge(let graphID, let id, let position):
      try requireGraphElement(graphID, .edge(id))
      try validate(
        position,
        operationID: operationID,
        commandIndex: commandIndex,
        maximumBytes: maximumSequenceKeyBytes,
        existing: edgePositions[graphID, default: [:]].filter { $0.key != id }.values
      )
      edgePositions[graphID, default: [:]][id] = position
      dirtyGraphIDs.insert(graphID)

    case .setSharedNodePlacement(let address, let position):
      try requireNode(address)
      try validatePlacement(position, address: address)
      sharedNodePlacements[address] = position

    case .translateSharedNodePlacement(let address, let delta):
      try requireNode(address)
      guard delta.width.isFinite, delta.height.isFinite else {
        throw FlowingGraphCollaborationFailure<Schema>.nonFinitePlacement(address)
      }
      let current = sharedNodePlacements[address, default: .zero]
      let next = CGPoint(
        x: current.x + delta.width,
        y: current.y + delta.height
      )
      try validatePlacement(next, address: address)
      sharedNodePlacements[address] = next

    case .clearSharedNodePlacement(let address):
      try requireNode(address)
      sharedNodePlacements.removeValue(forKey: address)

    case .compareAndSetSharedNodePlacement(let address, let expected, let replacement):
      try requireNode(address)
      if let expected {
        try validatePlacement(expected, address: address)
      }
      if let replacement {
        try validatePlacement(replacement, address: address)
      }
      guard sharedNodePlacements[address] == expected else {
        throw FlowingGraphCollaborationFailure<Schema>.placementConflict(address)
      }
      sharedNodePlacements[address] = replacement
    }
  }

  fileprivate mutating func finishTransaction(
    dirtyGraphIDs: Set<Schema.GraphID>
  ) throws(FlowingGraphCollaborationFailure<Schema>) {
    for graphID in dirtyGraphIDs {
      try normalizeGraphOrder(graphID)
    }
    let definitions = document.definitions.sorted {
      definitionPositions[$0.id]! < definitionPositions[$1.id]!
    }
    let entryPoints = document.entryPoints.sorted {
      entryPointPositions[$0.id]! < entryPointPositions[$1.id]!
    }
    let links = document.subgraphLinks.sorted {
      subgraphLinkPositions[$0.id]! < subgraphLinkPositions[$1.id]!
    }
    replaceDocument(
      entryPoints: entryPoints,
      definitions: definitions,
      subgraphLinks: links
    )
    let issues = FlowingGraphDocumentValidator.issues(in: document)
    guard issues.isEmpty else {
      throw FlowingGraphCollaborationFailure<Schema>.documentValidation(issues)
    }
  }

  private mutating func normalizeGraphOrder(
    _ graphID: Schema.GraphID
  ) throws(FlowingGraphCollaborationFailure<Schema>) {
    let graph = try graph(graphID)
    let nodes = graph.nodeIDs.sorted {
      nodePositions[graphID]![$0]! < nodePositions[graphID]![$1]!
    }
    let edges = graph.edgeIDs.sorted {
      edgePositions[graphID]![$0]! < edgePositions[graphID]![$1]!
    }
    let portsByNode = Dictionary(
      uniqueKeysWithValues: graph.nodeIDs.map { nodeID in
        let ports = graph.ports(nodeID: nodeID).map(\.key).sorted {
          portPositions[graphID]![$0]! < portPositions[graphID]![$1]!
        }
        return (nodeID, ports)
      })
    try mutateGraph(graphID) { transaction in
      for nodeID in nodes {
        transaction.moveNode(id: nodeID, to: .last)
      }
      for nodeID in nodes {
        for key in portsByNode[nodeID, default: []] {
          transaction.movePort(key: key, to: .last)
        }
      }
      for edgeID in edges {
        transaction.moveEdge(id: edgeID, to: .last)
      }
    }
  }

  private func validate<C: Collection>(
    _ position: FlowingCollaborationSequencePosition,
    operationID: FlowingCollaborationOperationID,
    commandIndex: Int,
    maximumBytes: Int,
    existing: C
  ) throws(FlowingGraphCollaborationFailure<Schema>)
  where C.Element == FlowingCollaborationSequencePosition {
    guard position.encodedByteCount <= maximumBytes else {
      throw FlowingGraphCollaborationFailure<Schema>.sequenceKeyLimitExceeded(
        maximum: maximumBytes,
        actual: position.encodedByteCount
      )
    }
    guard position.discriminator.operationID == operationID,
      position.discriminator.commandIndex == UInt32(commandIndex)
    else {
      throw FlowingGraphCollaborationFailure<Schema>.duplicatePosition
    }
    guard !existing.contains(position) else {
      throw FlowingGraphCollaborationFailure<Schema>.duplicatePosition
    }
  }

  private func requireInsertable(
    _ element: FlowingGraphCollaborationElement<Schema>,
    exists: Bool,
    tombstoned: Bool
  ) throws(FlowingGraphCollaborationFailure<Schema>) {
    if tombstoned {
      throw FlowingGraphCollaborationFailure<Schema>.tombstonedElement(element)
    }
    if exists {
      throw FlowingGraphCollaborationFailure<Schema>.duplicateElement(element)
    }
  }

  private func requireExisting(
    _ element: FlowingGraphCollaborationElement<Schema>,
    exists: Bool,
    tombstoned: Bool
  ) throws(FlowingGraphCollaborationFailure<Schema>) {
    if tombstoned {
      throw FlowingGraphCollaborationFailure<Schema>.tombstonedElement(element)
    }
    if !exists {
      throw FlowingGraphCollaborationFailure<Schema>.unknownElement(element)
    }
  }

  private func requireGraphElement(
    _ graphID: Schema.GraphID,
    _ elementID: FlowingGraphLocalElementID<Schema.GraphSchema>
  ) throws(FlowingGraphCollaborationFailure<Schema>) {
    let element = graphElement(graphID, elementID)
    let graph = try graph(graphID)
    let exists: Bool
    switch elementID {
    case .node(let id): exists = graph.node(id: id) != nil
    case .port(let key): exists = graph.port(key: key) != nil
    case .edge(let id): exists = graph.edge(id: id) != nil
    }
    try requireExisting(
      element,
      exists: exists,
      tombstoned: isTombstoned(graphID, elementID)
    )
  }

  private func requireNode(
    _ address: FlowingGraphDefinitionNodeAddress<Schema.GraphID, Schema.GraphSchema.NodeID>
  ) throws(FlowingGraphCollaborationFailure<Schema>) {
    try requireGraphElement(address.graphID, .node(address.nodeID))
  }

  private func validatePlacement(
    _ position: CGPoint,
    address: FlowingGraphDefinitionNodeAddress<Schema.GraphID, Schema.GraphSchema.NodeID>
  ) throws(FlowingGraphCollaborationFailure<Schema>) {
    guard position.x.isFinite, position.y.isFinite else {
      throw FlowingGraphCollaborationFailure<Schema>.nonFinitePlacement(address)
    }
  }

  private func graphElement(
    _ graphID: Schema.GraphID,
    _ elementID: FlowingGraphLocalElementID<Schema.GraphSchema>
  ) -> FlowingGraphCollaborationElement<Schema> {
    .graphElement(graphID: graphID, elementID: elementID)
  }

  private func isTombstoned(
    _ graphID: Schema.GraphID,
    _ elementID: FlowingGraphLocalElementID<Schema.GraphSchema>
  ) -> Bool {
    tombstonedGraphElements[graphID, default: []].contains(elementID)
  }

  private mutating func tombstone(
    _ graphID: Schema.GraphID,
    _ elementID: FlowingGraphLocalElementID<Schema.GraphSchema>
  ) {
    tombstonedGraphElements[graphID, default: []].insert(elementID)
  }

  private func graph(
    _ id: Schema.GraphID
  ) throws(FlowingGraphCollaborationFailure<Schema>) -> FlowingGraph<Schema.GraphSchema> {
    guard !tombstonedDefinitions.contains(id) else {
      throw FlowingGraphCollaborationFailure<Schema>.tombstonedElement(.definition(id))
    }
    guard let definition = document.definitions.first(where: { $0.id == id }) else {
      throw FlowingGraphCollaborationFailure<Schema>.unknownElement(.definition(id))
    }
    return definition.graph
  }

  private mutating func mutateGraph(
    _ graphID: Schema.GraphID,
    _ body: (inout FlowingGraphTransaction<Schema.GraphSchema>) -> Void
  ) throws(FlowingGraphCollaborationFailure<Schema>) {
    guard let index = document.definitions.firstIndex(where: { $0.id == graphID }) else {
      throw FlowingGraphCollaborationFailure<Schema>.unknownElement(.definition(graphID))
    }
    var graph = document.definitions[index].graph
    switch graph.update(body) {
    case .committed:
      var definitions = document.definitions
      definitions[index] = FlowingGraphDefinition(id: graphID, graph: graph)
      replaceDocument(definitions: definitions)
    case .rejected(let issue):
      throw FlowingGraphCollaborationFailure<Schema>.graphMutation(
        graphID: graphID,
        issue: issue
      )
    }
  }

  private func entryPointIndex(
    _ id: Schema.EntryPointID
  ) throws(FlowingGraphCollaborationFailure<Schema>) -> Int {
    let element = FlowingGraphCollaborationElement<Schema>.entryPoint(id)
    try requireExisting(
      element,
      exists: document.entryPoints.contains { $0.id == id },
      tombstoned: tombstonedEntryPoints.contains(id)
    )
    return document.entryPoints.firstIndex { $0.id == id }!
  }

  private func subgraphLinkIndex(
    _ id: Schema.LinkID
  ) throws(FlowingGraphCollaborationFailure<Schema>) -> Int {
    let element = FlowingGraphCollaborationElement<Schema>.subgraphLink(id)
    try requireExisting(
      element,
      exists: document.subgraphLinks.contains { $0.id == id },
      tombstoned: tombstonedSubgraphLinks.contains(id)
    )
    return document.subgraphLinks.firstIndex { $0.id == id }!
  }

  private mutating func replaceDocument(
    defaultEntryPointID: Schema.EntryPointID? = nil,
    entryPoints: [FlowingGraphEntryPoint<Schema>]? = nil,
    definitions: [FlowingGraphDefinition<Schema>]? = nil,
    subgraphLinks: [FlowingSubgraphLink<Schema>]? = nil
  ) {
    document = FlowingGraphDocument(
      id: document.id,
      defaultEntryPointID: defaultEntryPointID ?? document.defaultEntryPointID,
      entryPoints: entryPoints ?? document.entryPoints,
      definitions: definitions ?? document.definitions,
      subgraphLinks: subgraphLinks ?? document.subgraphLinks
    )
  }
}
