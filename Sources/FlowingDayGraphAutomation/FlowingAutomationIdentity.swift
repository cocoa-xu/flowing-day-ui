import FlowingDayGraphCollaboration
import Foundation

public struct FlowingAutomationCursorID: Hashable, Sendable {
  public let rawValue: UUID

  public init(rawValue: UUID = UUID()) {
    self.rawValue = rawValue
  }
}

public struct FlowingAutomationTaskID: Hashable, Sendable {
  public let rawValue: UUID

  public init(rawValue: UUID = UUID()) {
    self.rawValue = rawValue
  }
}

public struct FlowingAutomationSessionRequestID: Hashable, Sendable {
  public let rawValue: UUID

  public init(rawValue: UUID = UUID()) {
    self.rawValue = rawValue
  }
}

public struct FlowingAutomationAuthorizationScopeID: Hashable, Sendable {
  public let id: UUID
  public let revision: UInt64

  public init(id: UUID = UUID(), revision: UInt64 = 0) {
    self.id = id
    self.revision = revision
  }
}

public struct FlowingAutomationSnapshotID<DocumentID: Hashable & Sendable>:
  Hashable,
  Sendable
{
  public let documentID: DocumentID
  public let schemaVersion: FlowingCollaborationSchemaVersion
  public let reducerIdentity: FlowingCollaborationReducerIdentity
  public let version: FlowingCausalVersion

  public init<State, Failure>(
    _ snapshot: FlowingCollaborationSnapshot<DocumentID, State, Failure>
  ) where State: Sendable, Failure: Error & Equatable & Sendable {
    documentID = snapshot.documentID
    schemaVersion = snapshot.schemaVersion
    reducerIdentity = snapshot.reducerIdentity
    version = snapshot.version
  }
}

public struct FlowingAutomationAccessContext: Equatable, Sendable {
  public let participantID: FlowingParticipantID
  public let sessionID: FlowingCollaborationSessionID
  public let scopeID: FlowingAutomationAuthorizationScopeID
  public let authorization: FlowingCollaborationAuthorizationContext

  public init(
    participantID: FlowingParticipantID,
    sessionID: FlowingCollaborationSessionID,
    scopeID: FlowingAutomationAuthorizationScopeID,
    authorization: FlowingCollaborationAuthorizationContext = .init()
  ) {
    self.participantID = participantID
    self.sessionID = sessionID
    self.scopeID = scopeID
    self.authorization = authorization
  }
}

public struct FlowingGraphAutomationLimits: Equatable, Sendable {
  public let maximumRetainedSnapshots: Int
  public let maximumCursorsPerParticipant: Int
  public let maximumPinnedSnapshotsPerParticipant: Int
  public let cursorTimeToLive: UInt64
  public let maximumPageSize: Int
  public let maximumQueryResults: Int
  public let maximumQueryWork: Int
  public let maximumTraversalDepth: Int
  public let maximumIntentsPerRequest: Int
  public let maximumCommandHistory: Int
  public let maximumProposals: Int
  public let maximumProposalIntents: Int
  public let maximumSessionEndpoints: Int
  public let maximumSessionRequestHistory: Int
  public let maximumActiveTasksPerParticipant: Int
  public let maximumRetainedTasks: Int
  public let maximumProgressEventsPerTask: Int

  public init(
    maximumRetainedSnapshots: Int,
    maximumCursorsPerParticipant: Int,
    maximumPinnedSnapshotsPerParticipant: Int,
    cursorTimeToLive: UInt64,
    maximumPageSize: Int,
    maximumQueryResults: Int,
    maximumQueryWork: Int,
    maximumTraversalDepth: Int,
    maximumIntentsPerRequest: Int,
    maximumCommandHistory: Int,
    maximumProposals: Int,
    maximumProposalIntents: Int,
    maximumSessionEndpoints: Int,
    maximumSessionRequestHistory: Int,
    maximumActiveTasksPerParticipant: Int,
    maximumRetainedTasks: Int,
    maximumProgressEventsPerTask: Int
  ) {
    precondition(maximumRetainedSnapshots > 0)
    precondition(maximumCursorsPerParticipant > 0)
    precondition(maximumPinnedSnapshotsPerParticipant > 0)
    precondition(cursorTimeToLive > 0)
    precondition(maximumPageSize > 0)
    precondition(maximumQueryResults > 0)
    precondition(maximumQueryWork > 0)
    precondition(maximumTraversalDepth >= 0)
    precondition(maximumIntentsPerRequest > 0)
    precondition(maximumCommandHistory > 0)
    precondition(maximumProposals > 0)
    precondition(maximumProposalIntents > 0)
    precondition(maximumSessionEndpoints > 0)
    precondition(maximumSessionRequestHistory > 0)
    precondition(maximumActiveTasksPerParticipant > 0)
    precondition(maximumRetainedTasks > 0)
    precondition(maximumProgressEventsPerTask > 0)
    self.maximumRetainedSnapshots = maximumRetainedSnapshots
    self.maximumCursorsPerParticipant = maximumCursorsPerParticipant
    self.maximumPinnedSnapshotsPerParticipant = maximumPinnedSnapshotsPerParticipant
    self.cursorTimeToLive = cursorTimeToLive
    self.maximumPageSize = maximumPageSize
    self.maximumQueryResults = maximumQueryResults
    self.maximumQueryWork = maximumQueryWork
    self.maximumTraversalDepth = maximumTraversalDepth
    self.maximumIntentsPerRequest = maximumIntentsPerRequest
    self.maximumCommandHistory = maximumCommandHistory
    self.maximumProposals = maximumProposals
    self.maximumProposalIntents = maximumProposalIntents
    self.maximumSessionEndpoints = maximumSessionEndpoints
    self.maximumSessionRequestHistory = maximumSessionRequestHistory
    self.maximumActiveTasksPerParticipant = maximumActiveTasksPerParticipant
    self.maximumRetainedTasks = maximumRetainedTasks
    self.maximumProgressEventsPerTask = maximumProgressEventsPerTask
  }

  public static let standard = Self(
    maximumRetainedSnapshots: 32,
    maximumCursorsPerParticipant: 16,
    maximumPinnedSnapshotsPerParticipant: 4,
    cursorTimeToLive: 300,
    maximumPageSize: 1_000,
    maximumQueryResults: 100_000,
    maximumQueryWork: 1_000_000,
    maximumTraversalDepth: 256,
    maximumIntentsPerRequest: 1_024,
    maximumCommandHistory: 1_000_000,
    maximumProposals: 1_000,
    maximumProposalIntents: 10_000,
    maximumSessionEndpoints: 10_000,
    maximumSessionRequestHistory: 100_000,
    maximumActiveTasksPerParticipant: 32,
    maximumRetainedTasks: 10_000,
    maximumProgressEventsPerTask: 1_000
  )
}
