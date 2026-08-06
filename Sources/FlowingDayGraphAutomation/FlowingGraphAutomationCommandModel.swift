import FlowingDayGraphCollaboration
import FlowingDayGraphComposition

public enum FlowingGraphAutomationMutationMode: Hashable, Sendable {
  case direct
  case proposal
}

public enum FlowingGraphAutomationCommandPolicyDecision: Equatable, Sendable {
  case allowDirect
  case requireProposal
  case deny(code: String)
}

public struct FlowingGraphAutomationCommandAuthorizationRequest<
  Schema: FlowingGraphCollaborationSchema,
  Intent: Equatable & Sendable
>: Equatable, Sendable {
  public let participantID: FlowingParticipantID
  public let sessionID: FlowingCollaborationSessionID
  public let documentID: Schema.DocumentID
  public let baseVersion: FlowingCausalVersion
  public let authorization: FlowingCollaborationAuthorizationContext
  public let provenance: FlowingCollaborationProvenance
  public let mode: FlowingGraphAutomationMutationMode
  public let intents: [Intent]

  public init(
    participantID: FlowingParticipantID,
    sessionID: FlowingCollaborationSessionID,
    documentID: Schema.DocumentID,
    baseVersion: FlowingCausalVersion,
    authorization: FlowingCollaborationAuthorizationContext,
    provenance: FlowingCollaborationProvenance,
    mode: FlowingGraphAutomationMutationMode,
    intents: [Intent]
  ) {
    self.participantID = participantID
    self.sessionID = sessionID
    self.documentID = documentID
    self.baseVersion = baseVersion
    self.authorization = authorization
    self.provenance = provenance
    self.mode = mode
    self.intents = intents
  }
}

public protocol FlowingGraphAutomationCommandAuthorizer<Schema, Intent>: Sendable {
  associatedtype Schema: FlowingGraphCollaborationSchema
  associatedtype Intent: Equatable & Sendable

  func authorize(
    _ request: FlowingGraphAutomationCommandAuthorizationRequest<Schema, Intent>,
    at version: FlowingCausalVersion
  ) -> FlowingGraphAutomationCommandPolicyDecision
}

public struct FlowingAllowAllGraphAutomationCommandAuthorizer<
  Schema: FlowingGraphCollaborationSchema,
  Intent: Equatable & Sendable
>: FlowingGraphAutomationCommandAuthorizer {
  public init() {}

  public func authorize(
    _ request: FlowingGraphAutomationCommandAuthorizationRequest<Schema, Intent>,
    at version: FlowingCausalVersion
  ) -> FlowingGraphAutomationCommandPolicyDecision {
    .allowDirect
  }
}

public protocol FlowingGraphAutomationIntentCompiler<Schema>: Sendable {
  associatedtype Schema: FlowingGraphCollaborationSchema
  associatedtype Intent: Equatable & Sendable
  associatedtype Failure: Error & Equatable & Sendable

  func compile(
    _ intents: [Intent],
    operationID: FlowingCollaborationOperationID,
    snapshot: FlowingCollaborationSnapshot<
      Schema.DocumentID,
      FlowingGraphCollaborationState<Schema>,
      FlowingGraphCollaborationFailure<Schema>
    >
  ) -> Result<[FlowingGraphCollaborationCommand<Schema>], Failure>
}

public struct FlowingGraphAutomationDirectRequest<
  Schema: FlowingGraphCollaborationSchema,
  Intent: Equatable & Sendable
>: Equatable, Sendable {
  public let operationID: FlowingCollaborationOperationID
  public let transactionID: FlowingCollaborationTransactionID
  public let participantID: FlowingParticipantID
  public let sessionID: FlowingCollaborationSessionID
  public let documentID: Schema.DocumentID
  public let baseVersion: FlowingCausalVersion
  public let schemaVersion: FlowingCollaborationSchemaVersion
  public let authorization: FlowingCollaborationAuthorizationContext
  public let provenance: FlowingCollaborationProvenance
  public let compensates: Set<FlowingCollaborationOperationID>
  public let intents: [Intent]

  public init(
    operationID: FlowingCollaborationOperationID,
    transactionID: FlowingCollaborationTransactionID = .init(),
    participantID: FlowingParticipantID,
    sessionID: FlowingCollaborationSessionID,
    documentID: Schema.DocumentID,
    baseVersion: FlowingCausalVersion,
    schemaVersion: FlowingCollaborationSchemaVersion,
    authorization: FlowingCollaborationAuthorizationContext = .init(),
    provenance: FlowingCollaborationProvenance,
    compensates: Set<FlowingCollaborationOperationID> = [],
    intents: [Intent]
  ) {
    self.operationID = operationID
    self.transactionID = transactionID
    self.participantID = participantID
    self.sessionID = sessionID
    self.documentID = documentID
    self.baseVersion = baseVersion
    self.schemaVersion = schemaVersion
    self.authorization = authorization
    self.provenance = provenance
    self.compensates = compensates
    self.intents = intents
  }
}

public struct FlowingGraphAutomationProposalRequest<
  Schema: FlowingGraphCollaborationSchema,
  Intent: Equatable & Sendable
>: Equatable, Sendable {
  public let proposalID: FlowingCollaborationProposalID
  public let participantID: FlowingParticipantID
  public let sessionID: FlowingCollaborationSessionID
  public let documentID: Schema.DocumentID
  public let baseVersion: FlowingCausalVersion
  public let authorization: FlowingCollaborationAuthorizationContext
  public let provenance: FlowingCollaborationProvenance
  public let expiresAt: UInt64?
  public let intents: [Intent]

  public init(
    proposalID: FlowingCollaborationProposalID = .init(),
    participantID: FlowingParticipantID,
    sessionID: FlowingCollaborationSessionID,
    documentID: Schema.DocumentID,
    baseVersion: FlowingCausalVersion,
    authorization: FlowingCollaborationAuthorizationContext = .init(),
    provenance: FlowingCollaborationProvenance,
    expiresAt: UInt64? = nil,
    intents: [Intent]
  ) {
    self.proposalID = proposalID
    self.participantID = participantID
    self.sessionID = sessionID
    self.documentID = documentID
    self.baseVersion = baseVersion
    self.authorization = authorization
    self.provenance = provenance
    self.expiresAt = expiresAt
    self.intents = intents
  }
}

public struct FlowingGraphAutomationProposal<
  Schema: FlowingGraphCollaborationSchema,
  Intent: Equatable & Sendable
>: Equatable, Sendable {
  public let proposalID: FlowingCollaborationProposalID
  public let participantID: FlowingParticipantID
  public let sessionID: FlowingCollaborationSessionID
  public let documentID: Schema.DocumentID
  public let baseVersion: FlowingCausalVersion
  public let provenance: FlowingCollaborationProvenance
  public let expiresAt: UInt64?
  public let intents: [Intent]
}

public struct FlowingGraphAutomationProposalAcceptance<
  Schema: FlowingGraphCollaborationSchema
>: Equatable, Sendable {
  public let proposalID: FlowingCollaborationProposalID
  public let operationID: FlowingCollaborationOperationID
  public let transactionID: FlowingCollaborationTransactionID
  public let participantID: FlowingParticipantID
  public let sessionID: FlowingCollaborationSessionID
  public let documentID: Schema.DocumentID
  public let schemaVersion: FlowingCollaborationSchemaVersion
  public let authorization: FlowingCollaborationAuthorizationContext
  public let provenance: FlowingCollaborationProvenance

  public init(
    proposalID: FlowingCollaborationProposalID,
    operationID: FlowingCollaborationOperationID,
    transactionID: FlowingCollaborationTransactionID = .init(),
    participantID: FlowingParticipantID,
    sessionID: FlowingCollaborationSessionID,
    documentID: Schema.DocumentID,
    schemaVersion: FlowingCollaborationSchemaVersion,
    authorization: FlowingCollaborationAuthorizationContext = .init(),
    provenance: FlowingCollaborationProvenance
  ) {
    self.proposalID = proposalID
    self.operationID = operationID
    self.transactionID = transactionID
    self.participantID = participantID
    self.sessionID = sessionID
    self.documentID = documentID
    self.schemaVersion = schemaVersion
    self.authorization = authorization
    self.provenance = provenance
  }
}

public struct FlowingGraphAutomationCommit<Schema: FlowingGraphCollaborationSchema>:
  Sendable
{
  public typealias OperationSchema = FlowingGraphCollaborationOperationSchema<Schema>
  public typealias Failure = FlowingGraphCollaborationFailure<Schema>

  public let envelope: FlowingCollaborationOperationEnvelope<OperationSchema>
  public let receipt: FlowingCollaborationAdmissionReceipt<Schema.DocumentID>
  public let snapshotID: FlowingAutomationSnapshotID<Schema.DocumentID>
  public let outcome: FlowingCollaborationTransactionOutcome<Failure>?
}

public enum FlowingGraphAutomationCommandIssue<
  DocumentID: Hashable & Sendable,
  CompilerFailure: Error & Equatable & Sendable
>: Error, Equatable, Sendable {
  case wrongDocument(expected: DocumentID, actual: DocumentID)
  case unsupportedSchemaVersion(
    expected: FlowingCollaborationSchemaVersion,
    actual: FlowingCollaborationSchemaVersion
  )
  case emptyIntent
  case intentLimitExceeded(maximum: Int, actual: Int)
  case staleBase(expected: FlowingCausalVersion, actual: FlowingCausalVersion)
  case unknownBase
  case unauthorized(code: String)
  case proposalRequired
  case compilation(CompilerFailure)
  case operationEquivocation(FlowingCollaborationOperationID)
  case operationInFlight(FlowingCollaborationOperationID)
  case commandHistoryLimitExceeded(maximum: Int)
  case unknownProposal(FlowingCollaborationProposalID)
  case expiredProposal(FlowingCollaborationProposalID)
  case proposalEquivocation(FlowingCollaborationProposalID)
  case proposalAlreadyResolved(FlowingCollaborationProposalID)
  case proposalLimitExceeded(maximum: Int)
}
