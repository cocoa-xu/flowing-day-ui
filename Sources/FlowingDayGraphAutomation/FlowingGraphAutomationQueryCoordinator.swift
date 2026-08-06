import FlowingDayGraphCollaboration
import FlowingDayGraphComposition
import FlowingDayGraphCore

private struct FlowingGraphAutomationSnapshotEntry<
  Schema: FlowingGraphCollaborationSchema,
  Failure: Error & Equatable & Sendable
>: Sendable {
  typealias Snapshot = FlowingCollaborationSnapshot<
    Schema.DocumentID,
    FlowingGraphCollaborationState<Schema>,
    Failure
  >

  let snapshot: Snapshot
  let definitionsByID: [Schema.GraphID: FlowingGraphDefinition<Schema>]
  let entryPointsByID: [Schema.EntryPointID: FlowingGraphEntryPoint<Schema>]
  let linksByID: [Schema.LinkID: FlowingSubgraphLink<Schema>]

  init(snapshot: Snapshot) {
    self.snapshot = snapshot
    definitionsByID = Dictionary(
      uniqueKeysWithValues: snapshot.state.document.definitions.map { ($0.id, $0) }
    )
    entryPointsByID = Dictionary(
      uniqueKeysWithValues: snapshot.state.document.entryPoints.map { ($0.id, $0) }
    )
    linksByID = Dictionary(
      uniqueKeysWithValues: snapshot.state.document.subgraphLinks.map { ($0.id, $0) }
    )
  }
}

private struct FlowingGraphAutomationCursor<Schema: FlowingGraphCollaborationSchema>:
  Sendable
{
  let participantID: FlowingParticipantID
  let scopeID: FlowingAutomationAuthorizationScopeID
  let snapshotID: FlowingAutomationSnapshotID<Schema.DocumentID>
  let query: FlowingGraphAutomationQuery<Schema>
  let sessionID: FlowingCollaborationSessionID
  let provenance: FlowingCollaborationProvenance
  let pageSize: Int
  let expiresAt: UInt64
  let elements: [FlowingGraphCollaborationElement<Schema>]
  var nextIndex: Int
}

public actor FlowingGraphAutomationQueryCoordinator<
  Schema: FlowingGraphCollaborationSchema,
  Failure: Error & Equatable & Sendable
> {
  public typealias Snapshot = FlowingCollaborationSnapshot<
    Schema.DocumentID,
    FlowingGraphCollaborationState<Schema>,
    Failure
  >

  public let limits: FlowingGraphAutomationLimits

  private var snapshots:
    [FlowingAutomationSnapshotID<Schema.DocumentID>:
      FlowingGraphAutomationSnapshotEntry<Schema, Failure>] = [:]
  private var snapshotOrder: [FlowingAutomationSnapshotID<Schema.DocumentID>] = []
  private var cursors: [FlowingAutomationCursorID: FlowingGraphAutomationCursor<Schema>] = [:]
  private let auditSink: any FlowingAutomationAuditSink

  public init(
    limits: FlowingGraphAutomationLimits = .standard,
    auditSink: any FlowingAutomationAuditSink = FlowingNoOpAutomationAuditSink()
  ) {
    self.limits = limits
    self.auditSink = auditSink
  }

  @discardableResult
  public func publish(
    _ snapshot: Snapshot,
    at currentTick: UInt64
  ) throws -> FlowingAutomationSnapshotID<Schema.DocumentID> {
    purgeExpiredCursors(at: currentTick)
    let snapshotID = FlowingAutomationSnapshotID(snapshot)
    if snapshots[snapshotID] != nil {
      return snapshotID
    }

    while snapshots.count >= limits.maximumRetainedSnapshots {
      guard let candidate = snapshotOrder.first(where: { !isPinned($0) }) else {
        throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>
          .retainedSnapshotLimitExceeded(maximum: limits.maximumRetainedSnapshots)
      }
      snapshots.removeValue(forKey: candidate)
      snapshotOrder.removeAll { $0 == candidate }
    }

    snapshots[snapshotID] = FlowingGraphAutomationSnapshotEntry(snapshot: snapshot)
    snapshotOrder.append(snapshotID)
    return snapshotID
  }

  public func invalidate(
    _ snapshotID: FlowingAutomationSnapshotID<Schema.DocumentID>
  ) {
    snapshots.removeValue(forKey: snapshotID)
    snapshotOrder.removeAll { $0 == snapshotID }
    cursors = cursors.filter { $0.value.snapshotID != snapshotID }
  }

  public func metadata<Authorizer: FlowingGraphAutomationReadAuthorizer<Schema>>(
    for snapshotID: FlowingAutomationSnapshotID<Schema.DocumentID>,
    context: FlowingAutomationAccessContext,
    provenance: FlowingCollaborationProvenance = .unspecified,
    authorizer: Authorizer
  ) throws -> FlowingGraphAutomationSnapshotMetadata<Schema.DocumentID> {
    guard let entry = snapshots[snapshotID] else {
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>.unknownSnapshot(
        snapshotID
      )
    }
    switch authorizer.authorizeSnapshot(snapshotID, context: context) {
    case .allow:
      break
    case .deny(let code):
      auditSink.record(
        FlowingAutomationAuditEvent(
          subject: .snapshot,
          action: .snapshotRead,
          outcome: .denied(code: code),
          participantID: context.participantID,
          sessionID: context.sessionID,
          provenance: provenance,
          version: snapshotID.version
        )
      )
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>.unauthorized(code: code)
    }
    auditSink.record(
      FlowingAutomationAuditEvent(
        subject: .snapshot,
        action: .snapshotRead,
        outcome: .succeeded,
        participantID: context.participantID,
        sessionID: context.sessionID,
        provenance: provenance,
        version: snapshotID.version
      )
    )
    return FlowingGraphAutomationSnapshotMetadata(
      snapshotID: snapshotID,
      operationCount: entry.snapshot.operationOrder.count,
      pendingOperationCount: entry.snapshot.pendingOperations.count,
      auditEntryCount: entry.snapshot.audit.count
    )
  }

  public func openQuery<Authorizer: FlowingGraphAutomationReadAuthorizer<Schema>>(
    _ request: FlowingGraphAutomationQueryRequest<Schema>,
    context: FlowingAutomationAccessContext,
    at currentTick: UInt64,
    authorizer: Authorizer
  ) throws -> FlowingAutomationCursorID {
    let cursorID = FlowingAutomationCursorID()
    purgeExpiredCursors(at: currentTick)
    guard let snapshot = snapshots[request.snapshotID] else {
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>.unknownSnapshot(
        request.snapshotID
      )
    }
    guard request.pageSize > 0, request.pageSize <= limits.maximumPageSize else {
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>.invalidPageSize(
        maximum: limits.maximumPageSize,
        actual: request.pageSize
      )
    }
    switch authorizer.authorize(
      request.query,
      snapshotID: request.snapshotID,
      context: context
    ) {
    case .allow:
      break
    case .deny(let code):
      auditSink.record(
        FlowingAutomationAuditEvent(
          subject: .cursor(cursorID),
          action: .queryOpened,
          outcome: .denied(code: code),
          participantID: context.participantID,
          sessionID: context.sessionID,
          provenance: request.provenance,
          version: request.snapshotID.version
        )
      )
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>.unauthorized(code: code)
    }

    let participantCursorCount = cursors.values.reduce(into: 0) {
      if $1.participantID == context.participantID { $0 += 1 }
    }
    guard participantCursorCount < limits.maximumCursorsPerParticipant else {
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>
        .participantCursorLimitExceeded(maximum: limits.maximumCursorsPerParticipant)
    }
    let participantPinnedSnapshots = Set(
      cursors.values.lazy
        .filter { $0.participantID == context.participantID }
        .map(\.snapshotID)
    )
    guard participantPinnedSnapshots.contains(request.snapshotID)
      || participantPinnedSnapshots.count < limits.maximumPinnedSnapshotsPerParticipant
    else {
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>
        .participantPinnedSnapshotLimitExceeded(
          maximum: limits.maximumPinnedSnapshotsPerParticipant
        )
    }

    let elements = try queryElements(request.query, in: snapshot)
    let (expiry, overflow) = currentTick.addingReportingOverflow(limits.cursorTimeToLive)
    cursors[cursorID] = FlowingGraphAutomationCursor(
      participantID: context.participantID,
      scopeID: context.scopeID,
      snapshotID: request.snapshotID,
      query: request.query,
      sessionID: context.sessionID,
      provenance: request.provenance,
      pageSize: request.pageSize,
      expiresAt: overflow ? UInt64.max : expiry,
      elements: elements,
      nextIndex: 0
    )
    auditSink.record(
      FlowingAutomationAuditEvent(
        subject: .cursor(cursorID),
        action: .queryOpened,
        outcome: .succeeded,
        participantID: context.participantID,
        sessionID: context.sessionID,
        provenance: request.provenance,
        version: request.snapshotID.version
      )
    )
    return cursorID
  }

  public func nextPage<
    Authorizer: FlowingGraphAutomationReadAuthorizer<Schema>,
    Projector: FlowingGraphAutomationValueProjector<Schema>
  >(
    cursorID: FlowingAutomationCursorID,
    context: FlowingAutomationAccessContext,
    at currentTick: UInt64,
    authorizer: Authorizer,
    projector: Projector
  ) throws -> FlowingGraphAutomationQueryPage<Schema, Projector.Payload> {
    purgeExpiredCursors(at: currentTick)
    guard var cursor = cursors[cursorID],
      let snapshot = snapshots[cursor.snapshotID]
    else {
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>.staleCursor
    }
    guard cursor.participantID == context.participantID else {
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>.cursorParticipantMismatch
    }
    guard cursor.scopeID == context.scopeID else {
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>.authorizationScopeChanged
    }
    switch authorizer.authorize(
      cursor.query,
      snapshotID: cursor.snapshotID,
      context: context
    ) {
    case .allow:
      break
    case .deny(let code):
      cursors.removeValue(forKey: cursorID)
      auditSink.record(
        FlowingAutomationAuditEvent(
          subject: .cursor(cursorID),
          action: .queryPageRead,
          outcome: .denied(code: code),
          participantID: context.participantID,
          sessionID: cursor.sessionID,
          provenance: cursor.provenance,
          version: cursor.snapshotID.version
        )
      )
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>.unauthorized(code: code)
    }

    var records: [FlowingGraphAutomationRecord<Schema, Projector.Payload>] = []
    records.reserveCapacity(cursor.pageSize)
    while cursor.nextIndex < cursor.elements.count, records.count < cursor.pageSize {
      let element = cursor.elements[cursor.nextIndex]
      cursor.nextIndex += 1
      let access = authorizer.access(
        to: element,
        snapshotID: cursor.snapshotID,
        context: context
      )
      guard access != .deny else { continue }
      if let record = record(
        for: element,
        access: access,
        snapshot: snapshot,
        context: context,
        projector: projector
      ) {
        records.append(record)
      }
    }

    let nextCursorID: FlowingAutomationCursorID?
    if cursor.nextIndex < cursor.elements.count {
      cursors[cursorID] = cursor
      nextCursorID = cursorID
    } else {
      cursors.removeValue(forKey: cursorID)
      nextCursorID = nil
    }
    auditSink.record(
      FlowingAutomationAuditEvent(
        subject: .cursor(cursorID),
        action: .queryPageRead,
        outcome: .succeeded,
        participantID: context.participantID,
        sessionID: cursor.sessionID,
        provenance: cursor.provenance,
        version: cursor.snapshotID.version
      )
    )
    return FlowingGraphAutomationQueryPage(
      snapshotID: cursor.snapshotID,
      records: records,
      nextCursorID: nextCursorID
    )
  }

  public func closeQuery(
    _ cursorID: FlowingAutomationCursorID,
    participantID: FlowingParticipantID
  ) throws {
    guard let cursor = cursors[cursorID] else { return }
    guard cursor.participantID == participantID else {
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>.cursorParticipantMismatch
    }
    cursors.removeValue(forKey: cursorID)
    auditSink.record(
      FlowingAutomationAuditEvent(
        subject: .cursor(cursorID),
        action: .queryClosed,
        outcome: .succeeded,
        participantID: participantID,
        sessionID: cursor.sessionID,
        provenance: cursor.provenance,
        version: cursor.snapshotID.version
      )
    )
  }

  public func purgeExpiredCursors(at currentTick: UInt64) {
    cursors = cursors.filter { $0.value.expiresAt > currentTick }
  }

  private func isPinned(
    _ snapshotID: FlowingAutomationSnapshotID<Schema.DocumentID>
  ) -> Bool {
    cursors.values.contains { $0.snapshotID == snapshotID }
  }

  private func queryElements(
    _ query: FlowingGraphAutomationQuery<Schema>,
    in snapshot: FlowingGraphAutomationSnapshotEntry<Schema, Failure>
  ) throws -> [FlowingGraphCollaborationElement<Schema>] {
    switch query {
    case .elements(let query):
      return try listedElements(query, in: snapshot.snapshot.state.document)
    case .traversal(let query):
      return try traversedElements(query, in: snapshot)
    }
  }

  private func listedElements(
    _ query: FlowingGraphAutomationElementQuery<Schema>,
    in document: FlowingGraphDocument<Schema>
  ) throws -> [FlowingGraphCollaborationElement<Schema>] {
    var elements: [FlowingGraphCollaborationElement<Schema>] = []
    var work = 0

    func inspect() throws {
      work += 1
      guard work <= limits.maximumQueryWork else {
        throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>
          .queryWorkLimitExceeded(maximum: limits.maximumQueryWork)
      }
    }

    func append(_ element: FlowingGraphCollaborationElement<Schema>) throws {
      guard elements.count < limits.maximumQueryResults else {
        throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>
          .queryResultLimitExceeded(maximum: limits.maximumQueryResults)
      }
      elements.append(element)
    }

    if query.kinds.contains(.definition) {
      for definition in document.definitions {
        try inspect()
        guard query.graphIDs?.contains(definition.id) != false else { continue }
        try append(.definition(definition.id))
      }
    }
    if query.kinds.contains(.entryPoint) {
      for entryPoint in document.entryPoints {
        try inspect()
        guard query.graphIDs?.contains(entryPoint.graphID) != false else { continue }
        try append(.entryPoint(entryPoint.id))
      }
    }
    if query.kinds.contains(.subgraphLink) {
      for link in document.subgraphLinks {
        try inspect()
        guard query.graphIDs?.contains(link.site.graphID) != false else { continue }
        try append(.subgraphLink(link.id))
      }
    }
    let includesGraphElements = !query.kinds.isDisjoint(with: [.node, .port, .edge])
    guard includesGraphElements else { return elements }
    for definition in document.definitions {
      try inspect()
      guard query.graphIDs?.contains(definition.id) != false else { continue }
      if query.kinds.contains(.node) {
        for nodeID in definition.graph.nodeIDs {
          try inspect()
          try append(.graphElement(graphID: definition.id, elementID: .node(nodeID)))
        }
      }
      if query.kinds.contains(.port) {
        for key in definition.graph.portKeys {
          try inspect()
          try append(.graphElement(graphID: definition.id, elementID: .port(key)))
        }
      }
      if query.kinds.contains(.edge) {
        for edgeID in definition.graph.edgeIDs {
          try inspect()
          try append(.graphElement(graphID: definition.id, elementID: .edge(edgeID)))
        }
      }
    }
    return elements
  }

  private func traversedElements(
    _ query: FlowingGraphAutomationTraversalQuery<Schema>,
    in snapshot: FlowingGraphAutomationSnapshotEntry<Schema, Failure>
  ) throws -> [FlowingGraphCollaborationElement<Schema>] {
    guard query.maximumDepth >= 0,
      query.maximumDepth <= limits.maximumTraversalDepth
    else {
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>.invalidTraversalDepth(
        maximum: limits.maximumTraversalDepth,
        actual: query.maximumDepth
      )
    }
    guard !query.startNodeIDs.isEmpty else {
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>.emptyTraversalStart
    }
    guard let definition = snapshot.definitionsByID[query.graphID] else {
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>.unknownGraph
    }
    let graph = definition.graph
    guard query.startNodeIDs.allSatisfy({ graph.node(id: $0) != nil }) else {
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>.unknownStartNode
    }

    var discovered = Set(query.startNodeIDs)
    var selectedEdgeIDs: Set<Schema.GraphSchema.EdgeID> = []
    var queue = query.startNodeIDs.map { ($0, 0) }
    var queueIndex = 0
    var work = query.startNodeIDs.count
    try checkWork(work)

    while queueIndex < queue.count {
      let (nodeID, depth) = queue[queueIndex]
      queueIndex += 1
      guard depth < query.maximumDepth else { continue }
      for step in traversalSteps(from: nodeID, graph: graph, policy: query.policy) {
        work += 1
        try checkWork(work)
        selectedEdgeIDs.insert(step.edgeID)
        if discovered.insert(step.nodeID).inserted {
          guard discovered.count <= limits.maximumQueryResults else {
            throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>
              .queryResultLimitExceeded(maximum: limits.maximumQueryResults)
          }
          queue.append((step.nodeID, depth + 1))
        }
      }
    }

    var elements: [FlowingGraphCollaborationElement<Schema>] = []
    if query.includedKinds.contains(.definition) {
      elements.append(.definition(query.graphID))
    }
    if query.includedKinds.contains(.node) {
      for nodeID in graph.nodeIDs where discovered.contains(nodeID) {
        elements.append(.graphElement(graphID: query.graphID, elementID: .node(nodeID)))
      }
    }
    if query.includedKinds.contains(.port) {
      for key in graph.portKeys where discovered.contains(key.nodeID) {
        elements.append(.graphElement(graphID: query.graphID, elementID: .port(key)))
      }
    }
    if query.includedKinds.contains(.edge) {
      for edgeID in graph.edgeIDs where selectedEdgeIDs.contains(edgeID) {
        elements.append(.graphElement(graphID: query.graphID, elementID: .edge(edgeID)))
      }
    }
    guard elements.count <= limits.maximumQueryResults else {
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>
        .queryResultLimitExceeded(maximum: limits.maximumQueryResults)
    }
    return elements
  }

  private func checkWork(_ work: Int) throws {
    guard work <= limits.maximumQueryWork else {
      throw FlowingGraphAutomationQueryIssue<Schema.DocumentID>
        .queryWorkLimitExceeded(maximum: limits.maximumQueryWork)
    }
  }

  private func traversalSteps(
    from nodeID: Schema.GraphSchema.NodeID,
    graph: FlowingGraph<Schema.GraphSchema>,
    policy: FlowingGraphTraversalPolicy
  ) -> [(nodeID: Schema.GraphSchema.NodeID, edgeID: Schema.GraphSchema.EdgeID)] {
    let edgeIDs: [Schema.GraphSchema.EdgeID]
    switch policy.direction {
    case .outgoing:
      edgeIDs = graph.outgoingEdgeIDs(nodeID: nodeID)
    case .incoming:
      edgeIDs = graph.incomingEdgeIDs(nodeID: nodeID)
    case .incident:
      edgeIDs = graph.incidentEdgeIDs(nodeID: nodeID)
    }
    var steps: [(Schema.GraphSchema.NodeID, Schema.GraphSchema.EdgeID)] = []
    steps.reserveCapacity(edgeIDs.count)
    for edgeID in edgeIDs {
      guard let edge = graph.edge(id: edgeID),
        let neighbor = neighbor(
          of: nodeID,
          across: edge.endpoints,
          policy: policy
        )
      else { continue }
      steps.append((neighbor, edgeID))
    }
    return steps
  }

  private func neighbor(
    of nodeID: Schema.GraphSchema.NodeID,
    across endpoints: FlowingGraphEdgeEndpoints<Schema.GraphSchema>,
    policy: FlowingGraphTraversalPolicy
  ) -> Schema.GraphSchema.NodeID? {
    switch endpoints {
    case .directed(let source, let target):
      let sourceID = endpointNodeID(source)
      let targetID = endpointNodeID(target)
      switch policy.direction {
      case .outgoing where sourceID == nodeID:
        return targetID
      case .incoming where targetID == nodeID:
        return sourceID
      case .incident where sourceID == nodeID:
        return targetID
      case .incident where targetID == nodeID:
        return sourceID
      default:
        return nil
      }
    case .undirected(let first, let second):
      guard policy.includesUndirected else { return nil }
      let firstID = endpointNodeID(first)
      let secondID = endpointNodeID(second)
      if firstID == nodeID { return secondID }
      if secondID == nodeID { return firstID }
      return nil
    }
  }

  private func endpointNodeID(
    _ endpoint: FlowingGraphEndpoint<Schema.GraphSchema>
  ) -> Schema.GraphSchema.NodeID {
    switch endpoint {
    case .node(let nodeID):
      nodeID
    case .port(let key):
      key.nodeID
    }
  }

  private func record<Projector: FlowingGraphAutomationValueProjector<Schema>>(
    for element: FlowingGraphCollaborationElement<Schema>,
    access: FlowingGraphAutomationElementAccess,
    snapshot: FlowingGraphAutomationSnapshotEntry<Schema, Failure>,
    context: FlowingAutomationAccessContext,
    projector: Projector
  ) -> FlowingGraphAutomationRecord<Schema, Projector.Payload>? {
    let isFull = access == .full
    switch element {
    case .definition(let id):
      guard snapshot.definitionsByID[id] != nil else { return nil }
      return .definition(id: id)
    case .entryPoint(let id):
      guard let entryPoint = snapshot.entryPointsByID[id] else { return nil }
      return .entryPoint(
        id: id,
        name: isFull ? .value(entryPoint.name) : .redacted,
        graphID: entryPoint.graphID,
        isDefault: snapshot.snapshot.state.document.defaultEntryPointID == id
      )
    case .subgraphLink(let id):
      guard let link = snapshot.linksByID[id] else { return nil }
      let value: FlowingGraphAutomationDisclosure<Projector.Payload> = isFull
        ? .value(projector.linkPayload(link.value, linkID: id, context: context))
        : .redacted
      return .subgraphLink(
        id: id,
        site: link.site,
        ownership: link.ownership,
        targetGraphID: link.targetGraphID,
        interface: link.interface,
        value: value
      )
    case .graphElement(let graphID, let elementID):
      guard let graph = snapshot.definitionsByID[graphID]?.graph else { return nil }
      switch elementID {
      case .node(let nodeID):
        guard let node = graph.node(id: nodeID) else { return nil }
        let value: FlowingGraphAutomationDisclosure<Projector.Payload> = isFull
          ? .value(
            projector.nodePayload(
              node.value,
              graphID: graphID,
              nodeID: nodeID,
              context: context
            )
          )
          : .redacted
        return .node(graphID: graphID, nodeID: nodeID, value: value)
      case .port(let key):
        guard let port = graph.port(key: key) else { return nil }
        let value: FlowingGraphAutomationDisclosure<Projector.Payload> = isFull
          ? .value(
            projector.portPayload(
              port.value,
              graphID: graphID,
              key: key,
              context: context
            )
          )
          : .redacted
        return .port(graphID: graphID, key: key, value: value)
      case .edge(let edgeID):
        guard let edge = graph.edge(id: edgeID) else { return nil }
        let value: FlowingGraphAutomationDisclosure<Projector.Payload> = isFull
          ? .value(
            projector.edgePayload(
              edge.value,
              graphID: graphID,
              edgeID: edgeID,
              context: context
            )
          )
          : .redacted
        return .edge(
          graphID: graphID,
          edgeID: edgeID,
          endpoints: edge.endpoints,
          value: value
        )
      }
    }
  }
}
