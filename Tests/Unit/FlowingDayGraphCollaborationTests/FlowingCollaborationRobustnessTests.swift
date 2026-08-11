import FlowingDayGraphCollaboration
import Foundation
import XCTest

final class FlowingCollaborationRobustnessTests: XCTestCase {
  func testEveryPermutationOfThreeConcurrentOperationsConverges() {
    let operations = (1...3).map {
      envelope(replica: $0, counter: 1, command: .record($0))
    }
    let snapshots = permutations(of: operations).map { history in
      var replica = makeReplica()
      _ = replica.ingest(history)
      return replica.materialize()
    }

    XCTAssertEqual(snapshots.count, 6)
    XCTAssertTrue(snapshots.allSatisfy { $0.state == [1, 2, 3] })
    XCTAssertTrue(
      snapshots.dropFirst().allSatisfy {
        $0.operationOrder == snapshots[0].operationOrder
      })
  }

  func testSeededOfflineDeliveryWithDuplicatesAndBatchesConverges() {
    let seed: UInt64 = 0xC011_AB0A
    let operations = (1...4).flatMap { replica in
      (1...100).map { counter in
        envelope(
          replica: replica,
          counter: UInt64(counter),
          command: .record(replica * 1_000 + counter)
        )
      }
    }
    let histories = (0..<8).map { run -> [Envelope] in
      var generator = SeededGenerator(seed: seed + UInt64(run))
      var history = operations
      for operation in operations where generator.next() % 5 == 0 {
        history.append(operation)
      }
      history.shuffle(using: &generator)
      return history
    }

    let snapshots = histories.map { history in
      var replica = makeReplica()
      var index = 0
      while index < history.count {
        let count = min(Int((UInt64(index) + seed) % 17) + 1, history.count - index)
        _ = replica.ingest(Array(history[index..<(index + count)]))
        index += count
      }
      return replica.materialize()
    }

    XCTAssertTrue(snapshots.allSatisfy { $0.state.count == operations.count })
    XCTAssertTrue(snapshots.allSatisfy { $0.pendingOperations.isEmpty })
    XCTAssertTrue(snapshots.dropFirst().allSatisfy { $0.state == snapshots[0].state })
    XCTAssertTrue(
      snapshots.dropFirst().allSatisfy {
        $0.operationOrder == snapshots[0].operationOrder
      })
  }

  func testPendingBudgetRollbackAlsoReclassifiesDuplicatesInTheSameBatch() {
    let limits = limits(maximumPendingOperations: 0)
    let missingReplica = replicaID(2)
    let operation = envelope(
      replica: 1,
      counter: 1,
      dependencies: FlowingCausalVersion([missingReplica: 1]),
      command: .record(1)
    )
    var replica = makeReplica(limits: limits)

    let receipts = replica.ingest([operation, operation])

    XCTAssertEqual(
      receipts.map(\.status),
      [
        .rejected(.pendingLimitExceeded(maximum: 0, actual: 1)),
        .rejected(.pendingLimitExceeded(maximum: 0, actual: 1)),
      ])
    XCTAssertEqual(replica.admittedOperationCount, 0)
  }

  func testStructuralAndResourceAdmissionFailuresDoNotEnterHistory() {
    let base = envelope(replica: 1, counter: 1, command: .record(1))
    let wrongDocument = envelope(
      replica: 1,
      counter: 1,
      documentID: "other",
      command: .record(1)
    )
    let wrongSchema = envelope(
      replica: 1,
      counter: 1,
      schemaVersion: .init(rawValue: 2),
      command: .record(1)
    )
    let mismatchedReplica = Envelope(
      operationID: base.operationID,
      transactionID: transactionID(99),
      participantID: base.participantID,
      replicaID: replicaID(2),
      sessionID: base.sessionID,
      documentID: "document",
      dependencies: .init(),
      schemaVersion: .init(rawValue: 1),
      commands: [.record(1)]
    )
    let empty = Envelope(
      operationID: base.operationID,
      transactionID: transactionID(98),
      participantID: base.participantID,
      replicaID: base.replicaID,
      sessionID: base.sessionID,
      documentID: "document",
      dependencies: .init(),
      schemaVersion: .init(rawValue: 1),
      commands: []
    )
    var replica = makeReplica()

    XCTAssertEqual(
      replica.ingest([wrongDocument]).map(\.status),
      [.rejected(.wrongDocument(expected: "document", actual: "other"))]
    )
    XCTAssertEqual(
      replica.ingest([wrongSchema]).map(\.status),
      [
        .rejected(
          .unsupportedSchemaVersion(expected: .init(rawValue: 1), actual: .init(rawValue: 2)))
      ]
    )
    XCTAssertEqual(
      replica.ingest([mismatchedReplica]).map(\.status),
      [.rejected(.operationReplicaMismatch)]
    )
    XCTAssertEqual(replica.ingest([empty]).map(\.status), [.rejected(.emptyOperation)])
    XCTAssertEqual(replica.admittedOperationCount, 0)
  }

  func testCommandCausalIngestAndHistoryBudgetsAreEnforced() {
    let twoCommands = envelope(
      replica: 1,
      counter: 1,
      commands: [.record(1), .record(2)]
    )
    var commandReplica = makeReplica(limits: limits(maximumCommandsPerOperation: 1))
    XCTAssertEqual(
      commandReplica.ingest([twoCommands]).map(\.status),
      [.rejected(.commandLimitExceeded(maximum: 1, actual: 2))]
    )

    let causal = envelope(
      replica: 1,
      counter: 1,
      dependencies: FlowingCausalVersion([replicaID(2): 1, replicaID(3): 1]),
      command: .record(1)
    )
    var causalReplica = makeReplica(limits: limits(maximumCausalEntries: 1))
    XCTAssertEqual(
      causalReplica.ingest([causal]).map(\.status),
      [.rejected(.causalEntryLimitExceeded(maximum: 1, actual: 2))]
    )

    let first = envelope(replica: 1, counter: 1, command: .record(1))
    let second = envelope(replica: 2, counter: 1, command: .record(2))
    var ingestReplica = makeReplica(limits: limits(maximumOperationsPerIngest: 1))
    XCTAssertEqual(
      ingestReplica.ingest([first, second]).map(\.status),
      [
        .rejected(.ingestLimitExceeded(maximum: 1, actual: 2)),
        .rejected(.ingestLimitExceeded(maximum: 1, actual: 2)),
      ]
    )

    var historyReplica = makeReplica(limits: limits(maximumHistoryOperations: 1))
    _ = historyReplica.ingest([first])
    XCTAssertEqual(
      historyReplica.ingest([second]).map(\.status),
      [.rejected(.historyLimitExceeded(maximum: 1))]
    )
  }

  func testTransactionIdentityEquivocationIsRejected() {
    let sharedTransactionID = transactionID(1)
    let first = envelope(
      replica: 1,
      counter: 1,
      transactionID: sharedTransactionID,
      command: .record(1)
    )
    let second = envelope(
      replica: 2,
      counter: 1,
      transactionID: sharedTransactionID,
      command: .record(2)
    )
    var replica = makeReplica()

    _ = replica.ingest([first])
    XCTAssertEqual(
      replica.ingest([second]).map(\.status),
      [.rejected(.transactionEquivocation(sharedTransactionID))]
    )
  }

  func testAuthorizationIsRecheckedAtEachAdmissionBoundary() {
    let allowed = envelope(
      replica: 1,
      counter: 1,
      authorization: .init(capabilities: ["edit"]),
      command: .record(1)
    )
    let denied = envelope(
      replica: 1,
      counter: 2,
      dependencies: FlowingCausalVersion([replicaID(1): 1]),
      command: .record(2)
    )
    var replica = makeReplica()

    XCTAssertEqual(
      replica.ingest([allowed], authorizer: EditCapabilityAuthorizer()).map(\.status),
      [.admitted]
    )
    XCTAssertEqual(
      replica.ingest([denied], authorizer: EditCapabilityAuthorizer()).map(\.status),
      [.rejected(.unauthorized(code: "missing-edit-capability"))]
    )
    XCTAssertEqual(replica.materialize().state, [1])
  }

  func testOneHundredThousandOperationHistoryMaterializesIteratively() {
    let operationCount = 100_000
    let batchSize = 10_000
    var replica = makeCountingReplica()
    var batch: [CountingEnvelope] = []
    batch.reserveCapacity(batchSize)

    for counter in 1...operationCount {
      batch.append(countingEnvelope(counter: UInt64(counter)))
      if batch.count == batchSize {
        let receipts = replica.ingest(batch)
        XCTAssertTrue(receipts.allSatisfy { $0.status == .admitted })
        batch.removeAll(keepingCapacity: true)
      }
    }
    let snapshot = replica.materialize()

    XCTAssertEqual(snapshot.state, operationCount)
    XCTAssertEqual(snapshot.operationOrder.count, operationCount)
    XCTAssertTrue(snapshot.pendingOperations.isEmpty)
  }

  func testCoordinatorSubmitsOneHundredThousandOperationsIncrementally() async throws {
    let coordinator = FlowingCollaborationCoordinator(
      replicaID: replicaID(1),
      replica: makeCountingReplica()
    )
    let participantID = FlowingParticipantID(uuid(21))
    let sessionID = FlowingCollaborationSessionID(uuid(41))

    for _ in 0..<100_000 {
      let submission = try await coordinator.submit(
        participantID: participantID,
        sessionID: sessionID
      ) { _ in [.increment] }
      guard submission.receipt.status == .admitted else {
        return XCTFail("Local operation was not admitted")
      }
    }
    let snapshot = await coordinator.snapshot()

    XCTAssertEqual(snapshot.state, 100_000)
    XCTAssertEqual(snapshot.operationOrder.count, 100_000)
  }

  private typealias Envelope = FlowingCollaborationOperationEnvelope<RobustnessSchema>
  private typealias CountingEnvelope = FlowingCollaborationOperationEnvelope<CountingSchema>

  private func makeReplica(
    limits: FlowingCollaborationLimits = .standard
  ) -> FlowingCollaborationReplica<RobustnessSchema, RecordingReducer> {
    FlowingCollaborationReplica(
      documentID: "document",
      schemaVersion: .init(rawValue: 1),
      initialState: [],
      reducer: RecordingReducer(),
      limits: limits
    )
  }

  private func makeCountingReplica() -> FlowingCollaborationReplica<CountingSchema, CountingReducer>
  {
    FlowingCollaborationReplica(
      documentID: "document",
      schemaVersion: .init(rawValue: 1),
      initialState: 0,
      reducer: CountingReducer()
    )
  }

  private func envelope(
    replica: Int,
    counter: UInt64,
    transactionID: FlowingCollaborationTransactionID? = nil,
    documentID: String = "document",
    dependencies: FlowingCausalVersion? = nil,
    schemaVersion: FlowingCollaborationSchemaVersion = .init(rawValue: 1),
    authorization: FlowingCollaborationAuthorizationContext = .init(),
    command: RobustnessCommand
  ) -> Envelope {
    envelope(
      replica: replica,
      counter: counter,
      transactionID: transactionID,
      documentID: documentID,
      dependencies: dependencies,
      schemaVersion: schemaVersion,
      authorization: authorization,
      commands: [command]
    )
  }

  private func envelope(
    replica: Int,
    counter: UInt64,
    transactionID: FlowingCollaborationTransactionID? = nil,
    documentID: String = "document",
    dependencies: FlowingCausalVersion? = nil,
    schemaVersion: FlowingCollaborationSchemaVersion = .init(rawValue: 1),
    authorization: FlowingCollaborationAuthorizationContext = .init(),
    commands: [RobustnessCommand]
  ) -> Envelope {
    let replicaID = replicaID(replica)
    return Envelope(
      operationID: .init(replicaID: replicaID, counter: counter),
      transactionID: transactionID ?? self.transactionID(replica * 1_000_000 + Int(counter)),
      participantID: FlowingParticipantID(uuid(replica + 20)),
      replicaID: replicaID,
      sessionID: FlowingCollaborationSessionID(uuid(replica + 40)),
      documentID: documentID,
      dependencies: dependencies ?? FlowingCausalVersion([replicaID: counter - 1]),
      schemaVersion: schemaVersion,
      authorization: authorization,
      commands: commands
    )
  }

  private func countingEnvelope(counter: UInt64) -> CountingEnvelope {
    let replicaID = replicaID(1)
    return CountingEnvelope(
      operationID: .init(replicaID: replicaID, counter: counter),
      transactionID: transactionID(Int(counter)),
      participantID: FlowingParticipantID(uuid(21)),
      replicaID: replicaID,
      sessionID: FlowingCollaborationSessionID(uuid(41)),
      documentID: "document",
      dependencies: FlowingCausalVersion([replicaID: counter - 1]),
      schemaVersion: .init(rawValue: 1),
      commands: [.increment]
    )
  }

  private func limits(
    maximumCommandsPerOperation: Int = FlowingCollaborationLimits.standard
      .maximumCommandsPerOperation,
    maximumCausalEntries: Int = FlowingCollaborationLimits.standard.maximumCausalEntries,
    maximumOperationsPerIngest: Int = FlowingCollaborationLimits.standard
      .maximumOperationsPerIngest,
    maximumHistoryOperations: Int = FlowingCollaborationLimits.standard.maximumHistoryOperations,
    maximumPendingOperations: Int = FlowingCollaborationLimits.standard.maximumPendingOperations
  ) -> FlowingCollaborationLimits {
    let standard = FlowingCollaborationLimits.standard
    return FlowingCollaborationLimits(
      maximumCommandsPerOperation: maximumCommandsPerOperation,
      maximumCausalEntries: maximumCausalEntries,
      maximumOperationsPerIngest: maximumOperationsPerIngest,
      maximumHistoryOperations: maximumHistoryOperations,
      maximumPendingOperations: maximumPendingOperations,
      maximumSequenceKeyBytes: standard.maximumSequenceKeyBytes,
      maximumProposalCommands: standard.maximumProposalCommands,
      maximumPresenceSessions: standard.maximumPresenceSessions
    )
  }

  private func permutations<T>(of values: [T]) -> [[T]] {
    guard let first = values.first else { return [[]] }
    return permutations(of: Array(values.dropFirst())).flatMap { permutation in
      (0...permutation.count).map { index in
        var next = permutation
        next.insert(first, at: index)
        return next
      }
    }
  }

  private func replicaID(_ value: Int) -> FlowingReplicaID {
    FlowingReplicaID(uuid(value))
  }

  private func transactionID(_ value: Int) -> FlowingCollaborationTransactionID {
    FlowingCollaborationTransactionID(uuid(value))
  }

  private func uuid(_ value: Int) -> UUID {
    UUID(uuidString: String(format: "00000000-0000-0000-0000-%012X", value))!
  }
}

private enum RobustnessCommand: Equatable, Sendable {
  case record(Int)
}

private enum RobustnessSchema: FlowingCollaborationSchema {
  typealias DocumentID = String
  typealias Command = RobustnessCommand
}

private enum RobustnessFailure: Error, Equatable, Sendable {}

private struct RecordingReducer: FlowingCollaborationReducer {
  let identity = FlowingCollaborationReducerIdentity(
    id: UUID(uuidString: "0FF7545F-096A-44EB-8864-D4F4E1121A70")!
  )

  func applying(
    _ envelope: FlowingCollaborationOperationEnvelope<RobustnessSchema>,
    to state: [Int]
  ) -> Result<[Int], RobustnessFailure> {
    var next = state
    for command in envelope.commands {
      switch command {
      case .record(let value): next.append(value)
      }
    }
    return .success(next)
  }
}

private enum CountingCommand: Equatable, Sendable {
  case increment
}

private enum CountingSchema: FlowingCollaborationSchema {
  typealias DocumentID = String
  typealias Command = CountingCommand
}

private enum CountingFailure: Error, Equatable, Sendable {}

private struct CountingReducer: FlowingCollaborationReducer {
  let identity = FlowingCollaborationReducerIdentity(
    id: UUID(uuidString: "8F07AD0B-3EBB-4D91-9B47-8108E4B1959C")!
  )

  func applying(
    _ envelope: FlowingCollaborationOperationEnvelope<CountingSchema>,
    to state: Int
  ) -> Result<Int, CountingFailure> {
    .success(state + envelope.commands.count)
  }
}

private struct EditCapabilityAuthorizer: FlowingCollaborationAuthorizer {
  func authorize(
    _ envelope: FlowingCollaborationOperationEnvelope<RobustnessSchema>,
    at version: FlowingCausalVersion
  ) -> FlowingCollaborationAuthorizationDecision {
    envelope.authorization.capabilities.contains("edit")
      ? .allow
      : .deny(code: "missing-edit-capability")
  }
}

private struct SeededGenerator: RandomNumberGenerator {
  private var state: UInt64

  init(seed: UInt64) {
    state = seed
  }

  mutating func next() -> UInt64 {
    state &+= 0x9E37_79B9_7F4A_7C15
    var value = state
    value = (value ^ (value >> 30)) &* 0xBF58_476D_1CE4_E5B9
    value = (value ^ (value >> 27)) &* 0x94D0_49BB_1331_11EB
    return value ^ (value >> 31)
  }
}
