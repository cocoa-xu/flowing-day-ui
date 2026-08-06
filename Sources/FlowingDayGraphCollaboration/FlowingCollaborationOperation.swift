import Foundation

public protocol FlowingCollaborationSchema {
  associatedtype DocumentID: Hashable & Sendable
  associatedtype Command: Equatable & Sendable
}

public struct FlowingCollaborationSchemaVersion: RawRepresentable, Hashable, Comparable, Sendable {
  public let rawValue: UInt32

  public init(rawValue: UInt32) {
    self.rawValue = rawValue
  }

  public static func < (lhs: Self, rhs: Self) -> Bool {
    lhs.rawValue < rhs.rawValue
  }
}

public struct FlowingCollaborationAuthorizationContext: Equatable, Sendable {
  public let capabilities: Set<String>

  public init(capabilities: Set<String> = []) {
    self.capabilities = capabilities
  }
}

public enum FlowingCollaborationOrigin: Hashable, Sendable {
  case human
  case agent
  case service
  case unspecified
}

public struct FlowingCollaborationProvenance: Equatable, Sendable {
  public let origin: FlowingCollaborationOrigin
  public let originLabel: String?
  public let correlationID: UUID?

  public init(
    origin: FlowingCollaborationOrigin,
    originLabel: String? = nil,
    correlationID: UUID? = nil
  ) {
    self.origin = origin
    self.originLabel = originLabel
    self.correlationID = correlationID
  }

  public static let unspecified = Self(origin: .unspecified)
}

public struct FlowingCollaborationOperationEnvelope<Schema: FlowingCollaborationSchema>:
  Equatable,
  Sendable
{
  public let operationID: FlowingCollaborationOperationID
  public let transactionID: FlowingCollaborationTransactionID
  public let participantID: FlowingParticipantID
  public let replicaID: FlowingReplicaID
  public let sessionID: FlowingCollaborationSessionID
  public let documentID: Schema.DocumentID
  public let dependencies: FlowingCausalVersion
  public let schemaVersion: FlowingCollaborationSchemaVersion
  public let authorization: FlowingCollaborationAuthorizationContext
  public let provenance: FlowingCollaborationProvenance
  public let compensates: Set<FlowingCollaborationOperationID>
  public let commands: [Schema.Command]

  public init(
    operationID: FlowingCollaborationOperationID,
    transactionID: FlowingCollaborationTransactionID = .init(),
    participantID: FlowingParticipantID,
    replicaID: FlowingReplicaID,
    sessionID: FlowingCollaborationSessionID,
    documentID: Schema.DocumentID,
    dependencies: FlowingCausalVersion,
    schemaVersion: FlowingCollaborationSchemaVersion,
    authorization: FlowingCollaborationAuthorizationContext = .init(),
    provenance: FlowingCollaborationProvenance = .unspecified,
    compensates: Set<FlowingCollaborationOperationID> = [],
    commands: [Schema.Command]
  ) {
    self.operationID = operationID
    self.transactionID = transactionID
    self.participantID = participantID
    self.replicaID = replicaID
    self.sessionID = sessionID
    self.documentID = documentID
    self.dependencies = dependencies
    self.schemaVersion = schemaVersion
    self.authorization = authorization
    self.provenance = provenance
    self.compensates = compensates
    self.commands = commands
  }
}

public struct FlowingCollaborationLimits: Equatable, Sendable {
  public let maximumCommandsPerOperation: Int
  public let maximumCausalEntries: Int
  public let maximumOperationsPerIngest: Int
  public let maximumHistoryOperations: Int
  public let maximumPendingOperations: Int
  public let maximumSequenceKeyBytes: Int
  public let maximumProposalCommands: Int
  public let maximumPresenceSessions: Int

  public init(
    maximumCommandsPerOperation: Int,
    maximumCausalEntries: Int,
    maximumOperationsPerIngest: Int,
    maximumHistoryOperations: Int,
    maximumPendingOperations: Int,
    maximumSequenceKeyBytes: Int,
    maximumProposalCommands: Int,
    maximumPresenceSessions: Int
  ) {
    precondition(maximumCommandsPerOperation > 0)
    precondition(maximumCausalEntries > 0)
    precondition(maximumOperationsPerIngest > 0)
    precondition(maximumHistoryOperations > 0)
    precondition(maximumPendingOperations >= 0)
    precondition(maximumSequenceKeyBytes > 0)
    precondition(maximumProposalCommands > 0)
    precondition(maximumPresenceSessions > 0)
    self.maximumCommandsPerOperation = maximumCommandsPerOperation
    self.maximumCausalEntries = maximumCausalEntries
    self.maximumOperationsPerIngest = maximumOperationsPerIngest
    self.maximumHistoryOperations = maximumHistoryOperations
    self.maximumPendingOperations = maximumPendingOperations
    self.maximumSequenceKeyBytes = maximumSequenceKeyBytes
    self.maximumProposalCommands = maximumProposalCommands
    self.maximumPresenceSessions = maximumPresenceSessions
  }

  public static let standard = Self(
    maximumCommandsPerOperation: 1_024,
    maximumCausalEntries: 1_024,
    maximumOperationsPerIngest: 10_000,
    maximumHistoryOperations: 1_000_000,
    maximumPendingOperations: 100_000,
    maximumSequenceKeyBytes: 256,
    maximumProposalCommands: 10_000,
    maximumPresenceSessions: 10_000
  )
}

public enum FlowingCollaborationAuthorizationDecision: Equatable, Sendable {
  case allow
  case deny(code: String)
}

public protocol FlowingCollaborationAuthorizer<Schema>: Sendable {
  associatedtype Schema: FlowingCollaborationSchema

  func authorize(
    _ envelope: FlowingCollaborationOperationEnvelope<Schema>,
    at version: FlowingCausalVersion
  ) -> FlowingCollaborationAuthorizationDecision
}

public struct FlowingAllowAllCollaborationAuthorizer<Schema: FlowingCollaborationSchema>:
  FlowingCollaborationAuthorizer
{
  public init() {}

  public func authorize(
    _ envelope: FlowingCollaborationOperationEnvelope<Schema>,
    at version: FlowingCausalVersion
  ) -> FlowingCollaborationAuthorizationDecision {
    .allow
  }
}
