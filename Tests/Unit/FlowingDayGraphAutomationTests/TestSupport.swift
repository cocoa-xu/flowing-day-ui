import FlowingDayGraphAutomation
import FlowingDayGraphCollaboration
import FlowingDayGraphComposition
import FlowingDayGraphCore
import Foundation
import XCTest

enum AutomationTestGraphSchema: FlowingGraphSchema {
  typealias NodeID = Int
  typealias NodeValue = String
  typealias PortID = Int
  typealias PortValue = String
  typealias EdgeID = Int
  typealias EdgeValue = String
}

enum AutomationTestSchema: FlowingGraphCollaborationSchema {
  typealias DocumentID = String
  typealias GraphID = Int
  typealias EntryPointID = Int
  typealias LinkID = Int
  typealias LinkValue = String
  typealias OccurrenceID = Never
  typealias GraphSchema = AutomationTestGraphSchema
}

typealias AutomationTestOperationSchema = FlowingGraphCollaborationOperationSchema<
  AutomationTestSchema
>
typealias AutomationTestReducer = FlowingGraphCollaborationReducer<AutomationTestSchema>
typealias AutomationTestReplica = FlowingCollaborationReplica<
  AutomationTestOperationSchema,
  AutomationTestReducer
>
typealias AutomationTestSnapshot = FlowingCollaborationSnapshot<
  String,
  FlowingGraphCollaborationState<AutomationTestSchema>,
  FlowingGraphCollaborationFailure<AutomationTestSchema>
>
typealias AutomationTestQueryCoordinator = FlowingGraphAutomationQueryCoordinator<
  AutomationTestSchema,
  FlowingGraphCollaborationFailure<AutomationTestSchema>
>

func automationUUID(_ value: Int) -> UUID {
  UUID(uuidString: String(format: "00000000-0000-0000-0000-%012X", value))!
}

func automationParticipant(_ value: Int) -> FlowingParticipantID {
  FlowingParticipantID(automationUUID(value))
}

func automationReplica(_ value: Int) -> FlowingReplicaID {
  FlowingReplicaID(automationUUID(value + 1_000))
}

func automationSession(_ value: Int) -> FlowingCollaborationSessionID {
  FlowingCollaborationSessionID(automationUUID(value + 2_000))
}

func automationContext(
  participant: Int = 1,
  session: Int = 1,
  scopeID: FlowingAutomationAuthorizationScopeID = .init(
    id: automationUUID(3_001),
    revision: 1
  )
) -> FlowingAutomationAccessContext {
  FlowingAutomationAccessContext(
    participantID: automationParticipant(participant),
    sessionID: automationSession(session),
    scopeID: scopeID
  )
}

func makeAutomationGraph(nodeCount: Int = 3) -> FlowingGraph<AutomationTestGraphSchema> {
  var graph = FlowingGraph<AutomationTestGraphSchema>()
  let result = graph.update { transaction in
    for nodeID in 1...nodeCount {
      transaction.insert(FlowingGraphNode(id: nodeID, value: "node-\(nodeID)"))
      transaction.insert(
        FlowingGraphPort(
          key: FlowingGraphPortKey(nodeID: nodeID, portID: 1),
          value: "port-\(nodeID)"
        )
      )
    }
    if nodeCount > 1 {
      for edgeID in 1..<nodeCount {
        transaction.insert(
          FlowingGraphEdge(
            id: edgeID,
            endpoints: .directed(
              source: .port(.init(nodeID: edgeID, portID: 1)),
              target: .port(.init(nodeID: edgeID + 1, portID: 1))
            ),
            value: "edge-\(edgeID)"
          )
        )
      }
    }
  }
  guard case .committed = result else {
    preconditionFailure("Invalid automation test graph")
  }
  return graph
}

func makeAutomationDocument(
  nodeCount: Int = 3
) -> FlowingGraphDocument<AutomationTestSchema> {
  FlowingGraphDocument(
    id: "document",
    defaultEntryPointID: 1,
    entryPoints: [.init(id: 1, name: "Main", graphID: 1)],
    definitions: [.init(id: 1, graph: makeAutomationGraph(nodeCount: nodeCount))],
    subgraphLinks: []
  )
}

func makeAutomationReplica(
  nodeCount: Int = 3,
  limits: FlowingCollaborationLimits = .standard
) throws -> AutomationTestReplica {
  let state = try FlowingGraphCollaborationState<AutomationTestSchema>(
    document: makeAutomationDocument(nodeCount: nodeCount)
  )
  return FlowingCollaborationReplica(
    documentID: "document",
    schemaVersion: .init(rawValue: 1),
    initialState: state,
    reducer: AutomationTestReducer(limits: limits),
    limits: limits
  )
}

struct AutomationStringProjector: FlowingGraphAutomationValueProjector {
  typealias Schema = AutomationTestSchema
  typealias Payload = String

  func nodePayload(
    _ value: String,
    graphID: Int,
    nodeID: Int,
    context: FlowingAutomationAccessContext
  ) -> String {
    value
  }

  func portPayload(
    _ value: String,
    graphID: Int,
    key: FlowingGraphPortKey<AutomationTestGraphSchema>,
    context: FlowingAutomationAccessContext
  ) -> String {
    value
  }

  func edgePayload(
    _ value: String,
    graphID: Int,
    edgeID: Int,
    context: FlowingAutomationAccessContext
  ) -> String {
    value
  }

  func linkPayload(
    _ value: String,
    linkID: Int,
    context: FlowingAutomationAccessContext
  ) -> String {
    value
  }
}

struct AutomationReadAuthorizer: FlowingGraphAutomationReadAuthorizer {
  typealias Schema = AutomationTestSchema

  let queryDecision: FlowingGraphAutomationReadDecision
  let elementAccess: FlowingGraphAutomationElementAccess

  init(
    queryDecision: FlowingGraphAutomationReadDecision = .allow,
    elementAccess: FlowingGraphAutomationElementAccess = .full
  ) {
    self.queryDecision = queryDecision
    self.elementAccess = elementAccess
  }

  func authorize(
    _ query: FlowingGraphAutomationQuery<AutomationTestSchema>,
    snapshotID: FlowingAutomationSnapshotID<String>,
    context: FlowingAutomationAccessContext
  ) -> FlowingGraphAutomationReadDecision {
    queryDecision
  }

  func access(
    to element: FlowingGraphCollaborationElement<AutomationTestSchema>,
    snapshotID: FlowingAutomationSnapshotID<String>,
    context: FlowingAutomationAccessContext
  ) -> FlowingGraphAutomationElementAccess {
    elementAccess
  }
}

enum AutomationTestIntent: Equatable, Sendable {
  case updateNode(id: Int, value: String)
  case insertNode(id: Int, value: String, after: Int?)
}

enum AutomationTestCompilerFailure: Error, Equatable, Sendable {
  case unknownAnchor(Int)
  case sequence(FlowingCollaborationSequenceIssue)
}

struct AutomationTestIntentCompiler: FlowingGraphAutomationIntentCompiler {
  typealias Schema = AutomationTestSchema
  typealias Intent = AutomationTestIntent
  typealias Failure = AutomationTestCompilerFailure

  func compile(
    _ intents: [AutomationTestIntent],
    operationID: FlowingCollaborationOperationID,
    snapshot: AutomationTestSnapshot
  ) -> Result<[FlowingGraphCollaborationCommand<AutomationTestSchema>], Failure> {
    let graphID = 1
    guard let graph = snapshot.state.document.definitions.first(where: { $0.id == graphID })?.graph
    else {
      return .failure(.unknownAnchor(graphID))
    }
    var nodeIDs = graph.nodeIDs
    var positions = Dictionary(
      uniqueKeysWithValues: nodeIDs.compactMap { nodeID in
        snapshot.state.nodePosition(graphID: graphID, nodeID: nodeID).map {
          (nodeID, $0)
        }
      }
    )
    var commands: [FlowingGraphCollaborationCommand<AutomationTestSchema>] = []
    commands.reserveCapacity(intents.count)

    for (commandIndex, intent) in intents.enumerated() {
      switch intent {
      case .updateNode(let id, let value):
        commands.append(.updateNode(graphID: graphID, node: .init(id: id, value: value)))
      case .insertNode(let id, let value, let anchor):
        let insertionIndex: Int
        if let anchor {
          guard let anchorIndex = nodeIDs.firstIndex(of: anchor) else {
            return .failure(.unknownAnchor(anchor))
          }
          insertionIndex = anchorIndex + 1
        } else {
          insertionIndex = 0
        }
        let lower = insertionIndex > 0 ? positions[nodeIDs[insertionIndex - 1]] : nil
        let upper = insertionIndex < nodeIDs.count ? positions[nodeIDs[insertionIndex]] : nil
        do {
          let position = try FlowingCollaborationSequence.position(
            between: lower,
            and: upper,
            discriminator: .init(
              operationID: operationID,
              commandIndex: UInt32(commandIndex)
            )
          )
          commands.append(
            .insertNode(
              graphID: graphID,
              node: .init(id: id, value: value),
              position: position
            )
          )
          nodeIDs.insert(id, at: insertionIndex)
          positions[id] = position
        } catch let issue as FlowingCollaborationSequenceIssue {
          return .failure(.sequence(issue))
        } catch {
          preconditionFailure("Unexpected sequence error")
        }
      }
    }
    return .success(commands)
  }
}

struct AutomationCommandPolicy: FlowingGraphAutomationCommandAuthorizer {
  typealias Schema = AutomationTestSchema
  typealias Intent = AutomationTestIntent

  let decision: FlowingGraphAutomationCommandPolicyDecision

  init(_ decision: FlowingGraphAutomationCommandPolicyDecision = .allowDirect) {
    self.decision = decision
  }

  func authorize(
    _ request: FlowingGraphAutomationCommandAuthorizationRequest<
      AutomationTestSchema, AutomationTestIntent
    >,
    at version: FlowingCausalVersion
  ) -> FlowingGraphAutomationCommandPolicyDecision {
    decision
  }
}

struct AutomationDenyCollaborationAuthorizer: FlowingCollaborationAuthorizer {
  typealias Schema = AutomationTestOperationSchema

  func authorize(
    _ envelope: FlowingCollaborationOperationEnvelope<AutomationTestOperationSchema>,
    at version: FlowingCausalVersion
  ) -> FlowingCollaborationAuthorizationDecision {
    .deny(code: "revoked")
  }
}

typealias AutomationTestCommandGateway = FlowingGraphAutomationCommandGateway<
  AutomationTestSchema,
  AutomationTestIntentCompiler
>
typealias AutomationTestCommandCoordinator = FlowingCollaborationCoordinator<
  AutomationTestOperationSchema,
  AutomationTestReducer
>

struct AutomationTestCommandFixture {
  let gateway: AutomationTestCommandGateway
  let collaboration: AutomationTestCommandCoordinator
}

func makeAutomationCommandFixture(
  limits: FlowingGraphAutomationLimits = .standard,
  auditSink: any FlowingAutomationAuditSink = FlowingNoOpAutomationAuditSink()
) throws -> AutomationTestCommandFixture {
  let coordinator = FlowingCollaborationCoordinator(
    replicaID: automationReplica(900),
    replica: try makeAutomationReplica()
  )
  return AutomationTestCommandFixture(
    gateway: FlowingGraphAutomationCommandGateway(
      collaboration: coordinator,
      compiler: AutomationTestIntentCompiler(),
      limits: limits,
      auditSink: auditSink
    ),
    collaboration: coordinator
  )
}

func makeAutomationCommandGateway(
  limits: FlowingGraphAutomationLimits = .standard,
  auditSink: any FlowingAutomationAuditSink = FlowingNoOpAutomationAuditSink()
) throws -> AutomationTestCommandGateway {
  try makeAutomationCommandFixture(
    limits: limits,
    auditSink: auditSink
  ).gateway
}

func automationDirectRequest(
  operationID: FlowingCollaborationOperationID,
  baseVersion: FlowingCausalVersion,
  intents: [AutomationTestIntent],
  participant: Int = 1,
  session: Int = 1
) -> FlowingGraphAutomationDirectRequest<AutomationTestSchema, AutomationTestIntent> {
  FlowingGraphAutomationDirectRequest(
    operationID: operationID,
    participantID: automationParticipant(participant),
    sessionID: automationSession(session),
    documentID: "document",
    baseVersion: baseVersion,
    schemaVersion: .init(rawValue: 1),
    provenance: .init(
      origin: .agent,
      originLabel: "automation-test",
      correlationID: automationUUID(Int(operationID.counter) + 8_000)
    ),
    intents: intents
  )
}

func automationElementQuery(
  kinds: Set<FlowingGraphAutomationElementKind>,
  pageSize: Int,
  snapshotID: FlowingAutomationSnapshotID<String>
) -> FlowingGraphAutomationQueryRequest<AutomationTestSchema> {
  FlowingGraphAutomationQueryRequest(
    snapshotID: snapshotID,
    query: .elements(.init(kinds: kinds)),
    pageSize: pageSize
  )
}

func automationLimits(
  maximumRetainedSnapshots: Int = 32,
  maximumCursorsPerParticipant: Int = 16,
  maximumPinnedSnapshotsPerParticipant: Int = 4,
  cursorTimeToLive: UInt64 = 300,
  maximumPageSize: Int = 1_000,
  maximumQueryResults: Int = 100_000,
  maximumQueryWork: Int = 1_000_000,
  maximumTraversalDepth: Int = 256,
  maximumIntentsPerRequest: Int = 1_024,
  maximumCommandHistory: Int = 1_000_000,
  maximumProposals: Int = 1_000,
  maximumProposalIntents: Int = 10_000,
  maximumSessionEndpoints: Int = 10_000,
  maximumSessionRequestHistory: Int = 100_000,
  maximumActiveTasksPerParticipant: Int = 32,
  maximumRetainedTasks: Int = 10_000,
  maximumProgressEventsPerTask: Int = 1_000
) -> FlowingGraphAutomationLimits {
  FlowingGraphAutomationLimits(
    maximumRetainedSnapshots: maximumRetainedSnapshots,
    maximumCursorsPerParticipant: maximumCursorsPerParticipant,
    maximumPinnedSnapshotsPerParticipant: maximumPinnedSnapshotsPerParticipant,
    cursorTimeToLive: cursorTimeToLive,
    maximumPageSize: maximumPageSize,
    maximumQueryResults: maximumQueryResults,
    maximumQueryWork: maximumQueryWork,
    maximumTraversalDepth: maximumTraversalDepth,
    maximumIntentsPerRequest: maximumIntentsPerRequest,
    maximumCommandHistory: maximumCommandHistory,
    maximumProposals: maximumProposals,
    maximumProposalIntents: maximumProposalIntents,
    maximumSessionEndpoints: maximumSessionEndpoints,
    maximumSessionRequestHistory: maximumSessionRequestHistory,
    maximumActiveTasksPerParticipant: maximumActiveTasksPerParticipant,
    maximumRetainedTasks: maximumRetainedTasks,
    maximumProgressEventsPerTask: maximumProgressEventsPerTask
  )
}
