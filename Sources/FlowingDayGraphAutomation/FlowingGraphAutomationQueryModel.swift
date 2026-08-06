import FlowingDayGraphCollaboration
import FlowingDayGraphComposition
import FlowingDayGraphCore

public enum FlowingGraphAutomationElementKind: Hashable, Sendable {
  case definition
  case entryPoint
  case subgraphLink
  case node
  case port
  case edge
}

public struct FlowingGraphAutomationElementQuery<Schema: FlowingGraphCollaborationSchema>:
  Hashable,
  Sendable
{
  public let kinds: Set<FlowingGraphAutomationElementKind>
  public let graphIDs: Set<Schema.GraphID>?

  public init(
    kinds: Set<FlowingGraphAutomationElementKind>,
    graphIDs: Set<Schema.GraphID>? = nil
  ) {
    self.kinds = kinds
    self.graphIDs = graphIDs
  }
}

public struct FlowingGraphAutomationTraversalQuery<Schema: FlowingGraphCollaborationSchema>:
  Hashable,
  Sendable
{
  public let graphID: Schema.GraphID
  public let startNodeIDs: [Schema.GraphSchema.NodeID]
  public let policy: FlowingGraphTraversalPolicy
  public let maximumDepth: Int
  public let includedKinds: Set<FlowingGraphAutomationElementKind>

  public init(
    graphID: Schema.GraphID,
    startNodeIDs: [Schema.GraphSchema.NodeID],
    policy: FlowingGraphTraversalPolicy = .outgoing,
    maximumDepth: Int,
    includedKinds: Set<FlowingGraphAutomationElementKind> = [.node, .port, .edge]
  ) {
    self.graphID = graphID
    self.startNodeIDs = startNodeIDs
    self.policy = policy
    self.maximumDepth = maximumDepth
    self.includedKinds = includedKinds
  }
}

public enum FlowingGraphAutomationQuery<Schema: FlowingGraphCollaborationSchema>:
  Hashable,
  Sendable
{
  case elements(FlowingGraphAutomationElementQuery<Schema>)
  case traversal(FlowingGraphAutomationTraversalQuery<Schema>)
}

public struct FlowingGraphAutomationQueryRequest<Schema: FlowingGraphCollaborationSchema>:
  Hashable,
  Sendable
{
  public let snapshotID: FlowingAutomationSnapshotID<Schema.DocumentID>
  public let query: FlowingGraphAutomationQuery<Schema>
  public let pageSize: Int
  public let provenance: FlowingCollaborationProvenance

  public init(
    snapshotID: FlowingAutomationSnapshotID<Schema.DocumentID>,
    query: FlowingGraphAutomationQuery<Schema>,
    pageSize: Int,
    provenance: FlowingCollaborationProvenance = .unspecified
  ) {
    self.snapshotID = snapshotID
    self.query = query
    self.pageSize = pageSize
    self.provenance = provenance
  }
}

public enum FlowingGraphAutomationReadDecision: Equatable, Sendable {
  case allow
  case deny(code: String)
}

public enum FlowingGraphAutomationElementAccess: Equatable, Sendable {
  case deny
  case metadataOnly
  case full
}

public protocol FlowingGraphAutomationReadAuthorizer<Schema>: Sendable {
  associatedtype Schema: FlowingGraphCollaborationSchema

  func authorizeSnapshot(
    _ snapshotID: FlowingAutomationSnapshotID<Schema.DocumentID>,
    context: FlowingAutomationAccessContext
  ) -> FlowingGraphAutomationReadDecision

  func authorize(
    _ query: FlowingGraphAutomationQuery<Schema>,
    snapshotID: FlowingAutomationSnapshotID<Schema.DocumentID>,
    context: FlowingAutomationAccessContext
  ) -> FlowingGraphAutomationReadDecision

  func access(
    to element: FlowingGraphCollaborationElement<Schema>,
    snapshotID: FlowingAutomationSnapshotID<Schema.DocumentID>,
    context: FlowingAutomationAccessContext
  ) -> FlowingGraphAutomationElementAccess
}

public extension FlowingGraphAutomationReadAuthorizer {
  func authorizeSnapshot(
    _ snapshotID: FlowingAutomationSnapshotID<Schema.DocumentID>,
    context: FlowingAutomationAccessContext
  ) -> FlowingGraphAutomationReadDecision {
    .deny(code: "snapshot_metadata_not_authorized")
  }
}

public struct FlowingAllowAllGraphAutomationReadAuthorizer<
  Schema: FlowingGraphCollaborationSchema
>: FlowingGraphAutomationReadAuthorizer {
  public init() {}

  public func authorize(
    _ query: FlowingGraphAutomationQuery<Schema>,
    snapshotID: FlowingAutomationSnapshotID<Schema.DocumentID>,
    context: FlowingAutomationAccessContext
  ) -> FlowingGraphAutomationReadDecision {
    .allow
  }

  public func authorizeSnapshot(
    _ snapshotID: FlowingAutomationSnapshotID<Schema.DocumentID>,
    context: FlowingAutomationAccessContext
  ) -> FlowingGraphAutomationReadDecision {
    .allow
  }

  public func access(
    to element: FlowingGraphCollaborationElement<Schema>,
    snapshotID: FlowingAutomationSnapshotID<Schema.DocumentID>,
    context: FlowingAutomationAccessContext
  ) -> FlowingGraphAutomationElementAccess {
    .full
  }
}

public struct FlowingGraphAutomationSnapshotMetadata<
  DocumentID: Hashable & Sendable
>: Equatable, Sendable {
  public let snapshotID: FlowingAutomationSnapshotID<DocumentID>
  public let operationCount: Int
  public let pendingOperationCount: Int
  public let auditEntryCount: Int

  public init(
    snapshotID: FlowingAutomationSnapshotID<DocumentID>,
    operationCount: Int,
    pendingOperationCount: Int,
    auditEntryCount: Int
  ) {
    self.snapshotID = snapshotID
    self.operationCount = operationCount
    self.pendingOperationCount = pendingOperationCount
    self.auditEntryCount = auditEntryCount
  }
}

public protocol FlowingGraphAutomationValueProjector<Schema>: Sendable {
  associatedtype Schema: FlowingGraphCollaborationSchema
  associatedtype Payload: Sendable

  func nodePayload(
    _ value: Schema.GraphSchema.NodeValue,
    graphID: Schema.GraphID,
    nodeID: Schema.GraphSchema.NodeID,
    context: FlowingAutomationAccessContext
  ) -> Payload

  func portPayload(
    _ value: Schema.GraphSchema.PortValue,
    graphID: Schema.GraphID,
    key: FlowingGraphPortKey<Schema.GraphSchema>,
    context: FlowingAutomationAccessContext
  ) -> Payload

  func edgePayload(
    _ value: Schema.GraphSchema.EdgeValue,
    graphID: Schema.GraphID,
    edgeID: Schema.GraphSchema.EdgeID,
    context: FlowingAutomationAccessContext
  ) -> Payload

  func linkPayload(
    _ value: Schema.LinkValue,
    linkID: Schema.LinkID,
    context: FlowingAutomationAccessContext
  ) -> Payload
}

public enum FlowingGraphAutomationDisclosure<Payload: Sendable>: Sendable {
  case redacted
  case value(Payload)
}

public enum FlowingGraphAutomationRecord<
  Schema: FlowingGraphCollaborationSchema,
  Payload: Sendable
>: Sendable {
  case definition(id: Schema.GraphID)
  case entryPoint(
    id: Schema.EntryPointID,
    name: FlowingGraphAutomationDisclosure<String>,
    graphID: Schema.GraphID,
    isDefault: Bool
  )
  case subgraphLink(
    id: Schema.LinkID,
    site: FlowingGraphDefinitionNodeAddress<Schema.GraphID, Schema.GraphSchema.NodeID>,
    ownership: FlowingSubgraphOwnership,
    targetGraphID: Schema.GraphID,
    interface: FlowingSubgraphInterface<Schema>,
    value: FlowingGraphAutomationDisclosure<Payload>
  )
  case node(
    graphID: Schema.GraphID,
    nodeID: Schema.GraphSchema.NodeID,
    value: FlowingGraphAutomationDisclosure<Payload>
  )
  case port(
    graphID: Schema.GraphID,
    key: FlowingGraphPortKey<Schema.GraphSchema>,
    value: FlowingGraphAutomationDisclosure<Payload>
  )
  case edge(
    graphID: Schema.GraphID,
    edgeID: Schema.GraphSchema.EdgeID,
    endpoints: FlowingGraphEdgeEndpoints<Schema.GraphSchema>,
    value: FlowingGraphAutomationDisclosure<Payload>
  )
}

public struct FlowingGraphAutomationQueryPage<
  Schema: FlowingGraphCollaborationSchema,
  Payload: Sendable
>: Sendable {
  public let snapshotID: FlowingAutomationSnapshotID<Schema.DocumentID>
  public let records: [FlowingGraphAutomationRecord<Schema, Payload>]
  public let nextCursorID: FlowingAutomationCursorID?

  public init(
    snapshotID: FlowingAutomationSnapshotID<Schema.DocumentID>,
    records: [FlowingGraphAutomationRecord<Schema, Payload>],
    nextCursorID: FlowingAutomationCursorID?
  ) {
    self.snapshotID = snapshotID
    self.records = records
    self.nextCursorID = nextCursorID
  }
}

public enum FlowingGraphAutomationQueryIssue<DocumentID: Hashable & Sendable>:
  Error,
  Equatable,
  Sendable
{
  case unknownSnapshot(FlowingAutomationSnapshotID<DocumentID>)
  case staleCursor
  case cursorParticipantMismatch
  case authorizationScopeChanged
  case unauthorized(code: String)
  case invalidPageSize(maximum: Int, actual: Int)
  case invalidTraversalDepth(maximum: Int, actual: Int)
  case emptyTraversalStart
  case unknownGraph
  case unknownStartNode
  case queryResultLimitExceeded(maximum: Int)
  case queryWorkLimitExceeded(maximum: Int)
  case retainedSnapshotLimitExceeded(maximum: Int)
  case participantCursorLimitExceeded(maximum: Int)
  case participantPinnedSnapshotLimitExceeded(maximum: Int)
}
