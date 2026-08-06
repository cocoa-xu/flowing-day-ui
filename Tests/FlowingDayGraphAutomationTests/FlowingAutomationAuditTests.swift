import FlowingDayGraphAutomation
import FlowingDayGraphCollaboration
import Foundation
import XCTest

final class FlowingAutomationAuditTests: XCTestCase {
  func testQueryCommandAndSessionBoundariesEmitStructuredAuditEvents() async throws {
    let audit = AutomationAuditRecorder()
    let queryCoordinator = AutomationTestQueryCoordinator(auditSink: audit)
    let snapshotID = try await queryCoordinator.publish(
      makeAutomationReplica().materialize(),
      at: 0
    )
    let context = automationContext()
    let query = FlowingGraphAutomationQueryRequest<AutomationTestSchema>(
      snapshotID: snapshotID,
      query: .elements(.init(kinds: [.node])),
      pageSize: 1,
      provenance: .init(origin: .agent, originLabel: "audited-query")
    )
    let cursorID = try await queryCoordinator.openQuery(
      query,
      context: context,
      at: 0,
      authorizer: AutomationReadAuthorizer()
    )
    _ = try await queryCoordinator.nextPage(
      cursorID: cursorID,
      context: context,
      at: 1,
      authorizer: AutomationReadAuthorizer(),
      projector: AutomationStringProjector()
    )
    try await queryCoordinator.closeQuery(
      cursorID,
      participantID: context.participantID
    )

    let gateway = try makeAutomationCommandGateway(auditSink: audit)
    let operationID = FlowingCollaborationOperationID(
      replicaID: automationReplica(1),
      counter: 1
    )
    let command = automationDirectRequest(
      operationID: operationID,
      baseVersion: .init(),
      intents: [.updateNode(id: 1, value: "audited")]
    )
    _ = try await gateway.commit(
      command,
      policy: AutomationCommandPolicy(),
      authorizer: FlowingAllowAllCollaborationAuthorizer<AutomationTestOperationSchema>()
    )

    let sessionRouter = FlowingAutomationSessionRouter<
      AuditedSessionEndpoint,
      AuditedSessionCommand
    >(auditSink: audit)
    let sessionID = automationSession(9)
    try await sessionRouter.register(
      sessionID: sessionID,
      endpoint: AuditedSessionEndpoint()
    )
    _ = try await sessionRouter.deliver(
      FlowingAutomationSessionRequest(
        participantID: automationParticipant(9),
        targetSessionID: sessionID,
        provenance: .init(origin: .agent, originLabel: "audited-session"),
        command: .ping
      ),
      authorizer: FlowingAllowAllAutomationSessionAuthorizer<AuditedSessionCommand>()
    )

    let events = audit.events()
    XCTAssertEqual(
      events.map(\.action),
      [
        .queryOpened,
        .queryPageRead,
        .queryClosed,
        .commandCommitted,
        .sessionCommandDelivered,
      ]
    )
    XCTAssertTrue(events.allSatisfy { $0.outcome == .succeeded })
    XCTAssertEqual(events[3].version?[operationID.replicaID], 1)
  }

  func testAuthorizationDenialsAreAuditedWithoutAuthorizationPayloads() async throws {
    let audit = AutomationAuditRecorder()
    let coordinator = AutomationTestQueryCoordinator(auditSink: audit)
    let snapshotID = try await coordinator.publish(
      makeAutomationReplica().materialize(),
      at: 0
    )

    await XCTAssertThrowsErrorAsync(
      try await coordinator.openQuery(
        automationElementQuery(kinds: [.node], pageSize: 1, snapshotID: snapshotID),
        context: automationContext(),
        at: 0,
        authorizer: AutomationReadAuthorizer(queryDecision: .deny(code: "redacted"))
      )
    ) { _ in }

    XCTAssertEqual(audit.events().map(\.outcome), [.denied(code: "redacted")])
  }

  func testEchoSuppressionUsesStableIdentityInsteadOfParticipantOrPayload() {
    let operationID = FlowingCollaborationOperationID(
      replicaID: automationReplica(1),
      counter: 1
    )
    let correlationID = automationUUID(8_001)
    let envelope = FlowingCollaborationOperationEnvelope<AutomationTestOperationSchema>(
      operationID: operationID,
      participantID: automationParticipant(1),
      replicaID: operationID.replicaID,
      sessionID: automationSession(1),
      documentID: "document",
      dependencies: .init(),
      schemaVersion: .init(rawValue: 1),
      provenance: .init(origin: .agent, correlationID: correlationID),
      commands: [.updateNode(graphID: 1, node: .init(id: 1, value: "same-payload"))]
    )

    XCTAssertFalse(FlowingAutomationEchoReceipt().shouldSuppress(envelope))
    XCTAssertTrue(
      FlowingAutomationEchoReceipt(operationIDs: [operationID]).shouldSuppress(envelope)
    )
    XCTAssertTrue(
      FlowingAutomationEchoReceipt(correlationIDs: [correlationID]).shouldSuppress(envelope)
    )

    let unrelatedID = FlowingCollaborationOperationID(
      replicaID: operationID.replicaID,
      counter: 2
    )
    let unrelated = FlowingCollaborationOperationEnvelope<AutomationTestOperationSchema>(
      operationID: unrelatedID,
      participantID: envelope.participantID,
      replicaID: unrelatedID.replicaID,
      sessionID: envelope.sessionID,
      documentID: envelope.documentID,
      dependencies: .init(),
      schemaVersion: envelope.schemaVersion,
      provenance: .init(origin: .agent),
      commands: envelope.commands
    )
    XCTAssertFalse(
      FlowingAutomationEchoReceipt(operationIDs: [operationID]).shouldSuppress(unrelated)
    )
  }
}

private final class AutomationAuditRecorder: FlowingAutomationAuditSink, @unchecked Sendable {
  private let lock = NSLock()
  private var recordedEvents: [FlowingAutomationAuditEvent] = []

  func record(_ event: FlowingAutomationAuditEvent) {
    lock.lock()
    recordedEvents.append(event)
    lock.unlock()
  }

  func events() -> [FlowingAutomationAuditEvent] {
    lock.lock()
    defer { lock.unlock() }
    return recordedEvents
  }
}

private enum AuditedSessionCommand: FlowingAutomationSessionCommand {
  case ping

  var readRequirement: FlowingAutomationSessionReadRequirement<Int> {
    .none
  }
}

private enum AuditedSessionFailure: Error, Equatable, Sendable {
  case rejected
}

private actor AuditedSessionEndpoint: FlowingAutomationSessionEndpoint {
  typealias Command = AuditedSessionCommand
  typealias Response = Bool
  typealias Failure = AuditedSessionFailure

  func handle(_ command: AuditedSessionCommand) -> Result<Bool, AuditedSessionFailure> {
    .success(true)
  }
}
