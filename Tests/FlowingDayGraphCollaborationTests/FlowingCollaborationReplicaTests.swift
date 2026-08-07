import FlowingDayGraphCollaboration
import XCTest

final class FlowingCollaborationReplicaTests: XCTestCase {
  func testReplicasConvergeAcrossDeliveryPermutationsAndDuplicates() {
    let firstReplica = replicaID(1)
    let secondReplica = replicaID(2)
    let first = envelope(replicaID: firstReplica, counter: 1, commands: [.append("A")])
    let second = envelope(replicaID: secondReplica, counter: 1, commands: [.append("B")])
    let dependencies = FlowingCausalVersion([firstReplica: 1, secondReplica: 1])
    let third = envelope(
      replicaID: firstReplica,
      counter: 2,
      dependencies: dependencies,
      commands: [.append("C")]
    )
    let histories = [
      [first, second, third],
      [third, second, first],
      [second, first, second, third, first],
    ]

    let snapshots = histories.map { history in
      var replica = makeReplica()
      _ = replica.ingest(history)
      return replica.materialize()
    }

    XCTAssertEqual(snapshots.map(\.state), [["A", "B", "C"], ["A", "B", "C"], ["A", "B", "C"]])
    XCTAssertTrue(
      snapshots.dropFirst().allSatisfy { $0.operationOrder == snapshots[0].operationOrder })
    XCTAssertTrue(snapshots.dropFirst().allSatisfy { $0.version == snapshots[0].version })
    XCTAssertTrue(snapshots.allSatisfy(\.pendingOperations.isEmpty))
  }

  func testMissingDependencyRemainsPendingUntilItArrives() throws {
    let firstReplica = replicaID(1)
    let secondReplica = replicaID(2)
    let first = envelope(replicaID: firstReplica, counter: 1, commands: [.append("A")])
    let second = envelope(
      replicaID: secondReplica,
      counter: 1,
      dependencies: FlowingCausalVersion([firstReplica: 1]),
      commands: [.append("B")]
    )
    var replica = makeReplica()

    _ = replica.ingest([second])
    let pending = replica.materialize()

    XCTAssertEqual(pending.state, [])
    XCTAssertEqual(pending.pendingOperations.count, 1)
    XCTAssertEqual(
      try XCTUnwrap(pending.pendingOperations.first).missingDependencies,
      [first.operationID]
    )

    _ = replica.ingest([first])
    let resolved = replica.materialize()

    XCTAssertEqual(resolved.state, ["A", "B"])
    XCTAssertTrue(resolved.pendingOperations.isEmpty)
  }

  func testCausalCyclesAreBlockedWithoutRecursion() {
    let firstReplica = replicaID(1)
    let secondReplica = replicaID(2)
    let first = envelope(
      replicaID: firstReplica,
      counter: 1,
      dependencies: FlowingCausalVersion([secondReplica: 1]),
      commands: [.append("A")]
    )
    let second = envelope(
      replicaID: secondReplica,
      counter: 1,
      dependencies: FlowingCausalVersion([firstReplica: 1]),
      commands: [.append("B")]
    )
    var replica = makeReplica()

    _ = replica.ingest([first, second])
    let snapshot = replica.materialize()

    XCTAssertEqual(snapshot.state, [])
    XCTAssertEqual(snapshot.pendingOperations.count, 2)
    XCTAssertTrue(snapshot.pendingOperations.allSatisfy(\.isCausallyBlocked))
  }

  func testSemanticRejectionIsAtomicAndAdvancesCausalVersion() {
    let replicaID = replicaID(1)
    let rejected = envelope(replicaID: replicaID, counter: 1, commands: [.append("A"), .reject])
    let dependent = envelope(
      replicaID: replicaID,
      counter: 2,
      dependencies: FlowingCausalVersion([replicaID: 1]),
      commands: [.append("B")]
    )
    var replica = makeReplica()

    _ = replica.ingest([dependent, rejected])
    let snapshot = replica.materialize()

    XCTAssertEqual(snapshot.state, ["B"])
    XCTAssertEqual(snapshot.audit.map(\.outcome), [.rejected(.requested), .applied])
    XCTAssertEqual(snapshot.version[replicaID], 2)
  }

  func testDuplicateAndEquivocationAreDistinct() {
    let replicaID = replicaID(1)
    let operation = envelope(replicaID: replicaID, counter: 1, commands: [.append("A")])
    let equivocation = envelope(
      replicaID: replicaID,
      counter: 1,
      transactionID: operation.transactionID,
      commands: [.append("B")]
    )
    var replica = makeReplica()

    let first = replica.ingest([operation])
    let duplicate = replica.ingest([operation])
    let conflicting = replica.ingest([equivocation])

    XCTAssertEqual(first.map(\.status), [.admitted])
    XCTAssertEqual(duplicate.map(\.status), [.duplicate])
    XCTAssertEqual(
      conflicting.map(\.status),
      [.rejected(.operationEquivocation(operation.operationID))]
    )
    XCTAssertEqual(replica.materialize().state, ["A"])
  }

  func testAuthorizationDenialNeverEntersHistory() {
    let operation = envelope(replicaID: replicaID(1), counter: 1, commands: [.append("A")])
    var replica = makeReplica()

    let receipts = replica.ingest([operation], authorizer: DenyAllAuthorizer())

    XCTAssertEqual(receipts.map(\.status), [.rejected(.unauthorized(code: "read-only"))])
    XCTAssertEqual(replica.admittedOperationCount, 0)
    XCTAssertEqual(replica.materialize().state, [])
  }

  func testCheckpointCompactionPreservesStateAndRejectsLateHistory() throws {
    let replicaID = replicaID(1)
    let first = envelope(replicaID: replicaID, counter: 1, commands: [.append("A")])
    let second = envelope(
      replicaID: replicaID,
      counter: 2,
      dependencies: FlowingCausalVersion([replicaID: 1]),
      commands: [.append("B")]
    )
    var replica = makeReplica()
    _ = replica.ingest([first, second])
    let snapshot = replica.materialize()

    try replica.compact(through: replica.checkpoint(from: snapshot))
    let receipt = replica.ingest([first])
    let compacted = replica.materialize()

    XCTAssertEqual(receipt.map(\.status), [.compactedDuplicate])
    XCTAssertEqual(replica.admittedOperationCount, 0)
    XCTAssertEqual(compacted.state, ["A", "B"])
    XCTAssertEqual(compacted.version[replicaID], 2)
  }

  private func makeReplica() -> FlowingCollaborationReplica<TestSchema, TestReducer> {
    FlowingCollaborationReplica(
      documentID: "document",
      schemaVersion: .init(rawValue: 1),
      initialState: [],
      reducer: TestReducer()
    )
  }

  private func envelope(
    replicaID: FlowingReplicaID,
    counter: UInt64,
    transactionID: FlowingCollaborationTransactionID = .init(),
    dependencies: FlowingCausalVersion? = nil,
    commands: [TestCommand]
  ) -> FlowingCollaborationOperationEnvelope<TestSchema> {
    FlowingCollaborationOperationEnvelope(
      operationID: .init(replicaID: replicaID, counter: counter),
      transactionID: transactionID,
      participantID: participantID(Int(counter)),
      replicaID: replicaID,
      sessionID: sessionID(Int(counter)),
      documentID: "document",
      dependencies: dependencies ?? FlowingCausalVersion([replicaID: counter - 1]),
      schemaVersion: .init(rawValue: 1),
      commands: commands
    )
  }

  private func replicaID(_ value: Int) -> FlowingReplicaID {
    FlowingReplicaID(uuid(value))
  }

  private func participantID(_ value: Int) -> FlowingParticipantID {
    FlowingParticipantID(uuid(value + 20))
  }

  private func sessionID(_ value: Int) -> FlowingCollaborationSessionID {
    FlowingCollaborationSessionID(uuid(value + 40))
  }

  private func uuid(_ value: Int) -> UUID {
    UUID(uuidString: String(format: "00000000-0000-0000-0000-%012X", value))!
  }
}

private enum TestCommand: Equatable, Sendable {
  case append(String)
  case reject
}

private enum TestSchema: FlowingCollaborationSchema {
  typealias DocumentID = String
  typealias Command = TestCommand
}

private enum TestFailure: Error, Equatable, Sendable {
  case requested
}

private struct TestReducer: FlowingCollaborationReducer {
  static let identity = FlowingCollaborationReducerIdentity(
    id: UUID(uuidString: "00000000-0000-0000-0000-000000000099")!
  )

  var identity: FlowingCollaborationReducerIdentity { Self.identity }

  func applying(
    _ envelope: FlowingCollaborationOperationEnvelope<TestSchema>,
    to state: [String]
  ) -> Result<[String], TestFailure> {
    var next = state
    for command in envelope.commands {
      switch command {
      case .append(let value): next.append(value)
      case .reject: return .failure(.requested)
      }
    }
    return .success(next)
  }
}

private struct DenyAllAuthorizer: FlowingCollaborationAuthorizer {
  func authorize(
    _ envelope: FlowingCollaborationOperationEnvelope<TestSchema>,
    at version: FlowingCausalVersion
  ) -> FlowingCollaborationAuthorizationDecision {
    .deny(code: "read-only")
  }
}
