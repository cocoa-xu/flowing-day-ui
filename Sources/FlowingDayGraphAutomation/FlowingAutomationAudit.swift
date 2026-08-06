import FlowingDayGraphCollaboration
import Foundation

public enum FlowingAutomationAuditSubject: Hashable, Sendable {
  case snapshot
  case cursor(FlowingAutomationCursorID)
  case operation(FlowingCollaborationOperationID)
  case proposal(FlowingCollaborationProposalID)
  case sessionRequest(FlowingAutomationSessionRequestID)
  case task(FlowingAutomationTaskID)
}

public enum FlowingAutomationAuditAction: Hashable, Sendable {
  case snapshotRead
  case queryOpened
  case queryPageRead
  case queryClosed
  case commandCommitted
  case proposalCreated
  case proposalAccepted
  case proposalRejected
  case sessionCommandDelivered
  case taskStarted
  case taskRead
  case taskCancellationRequested
  case taskCompleted
}

public enum FlowingAutomationAuditOutcome: Hashable, Sendable {
  case succeeded
  case duplicate
  case denied(code: String)
  case failed(code: String)
  case cancelled
}

public struct FlowingAutomationAuditEvent: Equatable, Sendable {
  public let subject: FlowingAutomationAuditSubject
  public let action: FlowingAutomationAuditAction
  public let outcome: FlowingAutomationAuditOutcome
  public let participantID: FlowingParticipantID
  public let sessionID: FlowingCollaborationSessionID
  public let provenance: FlowingCollaborationProvenance
  public let version: FlowingCausalVersion?

  public init(
    subject: FlowingAutomationAuditSubject,
    action: FlowingAutomationAuditAction,
    outcome: FlowingAutomationAuditOutcome,
    participantID: FlowingParticipantID,
    sessionID: FlowingCollaborationSessionID,
    provenance: FlowingCollaborationProvenance,
    version: FlowingCausalVersion? = nil
  ) {
    self.subject = subject
    self.action = action
    self.outcome = outcome
    self.participantID = participantID
    self.sessionID = sessionID
    self.provenance = provenance
    self.version = version
  }
}

public protocol FlowingAutomationAuditSink: Sendable {
  func record(_ event: FlowingAutomationAuditEvent)
}

public struct FlowingNoOpAutomationAuditSink: FlowingAutomationAuditSink {
  public init() {}

  public func record(_ event: FlowingAutomationAuditEvent) {}
}

public struct FlowingAutomationEchoReceipt: Equatable, Sendable {
  public let operationIDs: Set<FlowingCollaborationOperationID>
  public let proposalIDs: Set<FlowingCollaborationProposalID>
  public let sessionRequestIDs: Set<FlowingAutomationSessionRequestID>
  public let taskIDs: Set<FlowingAutomationTaskID>
  public let correlationIDs: Set<UUID>

  public init(
    operationIDs: Set<FlowingCollaborationOperationID> = [],
    proposalIDs: Set<FlowingCollaborationProposalID> = [],
    sessionRequestIDs: Set<FlowingAutomationSessionRequestID> = [],
    taskIDs: Set<FlowingAutomationTaskID> = [],
    correlationIDs: Set<UUID> = []
  ) {
    self.operationIDs = operationIDs
    self.proposalIDs = proposalIDs
    self.sessionRequestIDs = sessionRequestIDs
    self.taskIDs = taskIDs
    self.correlationIDs = correlationIDs
  }

  public func shouldSuppress(_ event: FlowingAutomationAuditEvent) -> Bool {
    if let correlationID = event.provenance.correlationID,
      correlationIDs.contains(correlationID)
    {
      return true
    }
    switch event.subject {
    case .snapshot:
      return false
    case .cursor:
      return false
    case .operation(let operationID):
      return operationIDs.contains(operationID)
    case .proposal(let proposalID):
      return proposalIDs.contains(proposalID)
    case .sessionRequest(let requestID):
      return sessionRequestIDs.contains(requestID)
    case .task(let taskID):
      return taskIDs.contains(taskID)
    }
  }

  public func shouldSuppress<Schema: FlowingCollaborationSchema>(
    _ envelope: FlowingCollaborationOperationEnvelope<Schema>
  ) -> Bool {
    if operationIDs.contains(envelope.operationID) {
      return true
    }
    guard let correlationID = envelope.provenance.correlationID else {
      return false
    }
    return correlationIDs.contains(correlationID)
  }
}
