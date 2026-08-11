import FlowingDayGraphCollaboration
import Foundation
import XCTest

final class FlowingCollaborationProposalTests: XCTestCase {
  func testProposalDoesNotEnterDocumentUntilSubmittedAsAnOperation() async throws {
    let replicaID = FlowingReplicaID(uuid(1))
    let coordinator = FlowingCollaborationCoordinator(
      replicaID: replicaID,
      replica: makeReplica()
    )
    let proposal = makeProposal(commands: [.append("proposed")])

    XCTAssertNil(
      proposal.validate(
        for: "document",
        at: FlowingCausalVersion(),
        currentTick: 1
      )
    )
    let before = await coordinator.snapshot()
    XCTAssertEqual(before.state, [])

    _ = try await coordinator.submit(
      participantID: FlowingParticipantID(uuid(2)),
      sessionID: FlowingCollaborationSessionID(uuid(3)),
      provenance: proposal.provenance
    ) { _ in proposal.commands }

    let after = await coordinator.snapshot()
    XCTAssertEqual(after.state, ["proposed"])
  }

  func testStaleExpiredAndOverBudgetProposalsAreRejected() {
    let replicaID = FlowingReplicaID(uuid(1))
    let current = FlowingCausalVersion([replicaID: 1])
    let proposal = makeProposal(expiresAt: 10, commands: [.append("A"), .append("B")])

    XCTAssertEqual(
      proposal.validate(
        for: "document",
        at: current,
        currentTick: 1
      ),
      .staleBase(expected: .init(), actual: current)
    )
    XCTAssertEqual(
      proposal.validate(
        for: "document",
        at: .init(),
        currentTick: 10
      ),
      .expired
    )
    XCTAssertEqual(
      proposal.validate(
        for: "document",
        at: .init(),
        currentTick: 1,
        maximumCommands: 1
      ),
      .commandLimitExceeded(maximum: 1, actual: 2)
    )
  }

  func testCoordinatorSerializesConcurrentSubmissions() async throws {
    let coordinator = FlowingCollaborationCoordinator(
      replicaID: FlowingReplicaID(uuid(1)),
      replica: makeReplica()
    )
    let participantID = FlowingParticipantID(uuid(2))
    let sessionID = FlowingCollaborationSessionID(uuid(3))

    try await withThrowingTaskGroup(of: Void.self) { group in
      for value in 0..<100 {
        group.addTask {
          _ = try await coordinator.submit(
            participantID: participantID,
            sessionID: sessionID
          ) { _ in [.append(String(value))] }
        }
      }
      try await group.waitForAll()
    }

    let snapshot = await coordinator.snapshot()
    XCTAssertEqual(snapshot.state.count, 100)
    XCTAssertEqual(Set(snapshot.state), Set((0..<100).map(String.init)))
    XCTAssertEqual(snapshot.operationOrder.map(\.counter), Array(1...100))
  }

  func testProposalRejectsWrongDocumentEmptyCommandsAndUnknownBase() {
    let replicaID = FlowingReplicaID(uuid(1))
    let unknownBase = FlowingCausalVersion([replicaID: 2])
    let current = FlowingCausalVersion([replicaID: 1])
    let proposal = FlowingCollaborationProposal<TestSchema>(
      participantID: FlowingParticipantID(uuid(2)),
      sessionID: FlowingCollaborationSessionID(uuid(3)),
      documentID: "document",
      baseVersion: unknownBase,
      provenance: .unspecified,
      commands: []
    )

    XCTAssertEqual(
      proposal.validate(for: "other", at: current, currentTick: 0),
      .wrongDocument(expected: "other", actual: "document")
    )
    XCTAssertEqual(
      proposal.validate(for: "document", at: current, currentTick: 0),
      .emptyProposal
    )
    let nonempty = FlowingCollaborationProposal<TestSchema>(
      participantID: proposal.participantID,
      sessionID: proposal.sessionID,
      documentID: proposal.documentID,
      baseVersion: proposal.baseVersion,
      provenance: proposal.provenance,
      commands: [.append("value")]
    )
    XCTAssertEqual(
      nonempty.validate(
        for: "document",
        at: current,
        currentTick: 0,
        requiresExactBase: false
      ),
      .unknownBase
    )
  }

  func testCoordinatorReturnsAdmissionReceiptsForRemoteDelivery() async throws {
    let coordinator = FlowingCollaborationCoordinator(
      replicaID: FlowingReplicaID(uuid(1)),
      replica: makeReplica()
    )
    let submission = try await coordinator.submit(
      participantID: FlowingParticipantID(uuid(2)),
      sessionID: FlowingCollaborationSessionID(uuid(3))
    ) { _ in [.append("value")] }

    let echo = await coordinator.ingest([submission.envelope])

    XCTAssertEqual(echo.receipts.map(\.status), [.duplicate])
    XCTAssertEqual(echo.snapshot.state, ["value"])
  }

  private func makeProposal(
    expiresAt: UInt64? = nil,
    commands: [TestCommand]
  ) -> FlowingCollaborationProposal<TestSchema> {
    FlowingCollaborationProposal(
      participantID: FlowingParticipantID(uuid(2)),
      sessionID: FlowingCollaborationSessionID(uuid(3)),
      documentID: "document",
      baseVersion: .init(),
      provenance: .init(origin: .agent, originLabel: "test-agent"),
      expiresAt: expiresAt,
      commands: commands
    )
  }

  private func makeReplica() -> FlowingCollaborationReplica<TestSchema, TestReducer> {
    FlowingCollaborationReplica(
      documentID: "document",
      schemaVersion: .init(rawValue: 1),
      initialState: [],
      reducer: TestReducer()
    )
  }

  private func uuid(_ value: Int) -> UUID {
    UUID(uuidString: String(format: "00000000-0000-0000-0000-%012X", value))!
  }
}

private enum TestCommand: Equatable, Sendable {
  case append(String)
}

private enum TestSchema: FlowingCollaborationSchema {
  typealias DocumentID = String
  typealias Command = TestCommand
}

private enum TestFailure: Error, Equatable, Sendable {}

private struct TestReducer: FlowingCollaborationReducer {
  let identity = FlowingCollaborationReducerIdentity(
    id: UUID(uuidString: "00000000-0000-0000-0000-000000000099")!
  )

  func applying(
    _ envelope: FlowingCollaborationOperationEnvelope<TestSchema>,
    to state: [String]
  ) -> Result<[String], TestFailure> {
    .success(
      state
        + envelope.commands.map { command in
          switch command {
          case .append(let value): value
          }
        })
  }
}
