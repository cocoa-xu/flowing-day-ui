import CoreGraphics
import FlowingDayGraphCollaboration
import FlowingDayGraphComposition
import FlowingDayGraphCore
import FlowingDayGraphHistory
import XCTest

final class FlowingGraphSharedNodePlacementUndoPolicyTests: XCTestCase {
  func testUndoBuildsAtomicCompareAndSetCompensation() throws {
    let first = address(1)
    let second = address(2)
    let operationID = operationID(counter: 4)
    let transaction = Transaction(
      operationIDs: [operationID],
      transitions: [
        Transition(address: first, before: CGPoint(x: 1, y: 2), after: CGPoint(x: 5, y: 8)),
        Transition(address: second, before: nil, after: CGPoint(x: 13, y: 21)),
      ]
    )
    let state = try makeState(
      placements: [
        first: CGPoint(x: 5, y: 8),
        second: CGPoint(x: 13, y: 21),
      ]
    )

    let compensation = try XCTUnwrap(
      try? Policy().resolveCompensation(
        for: transaction,
        direction: .undo,
        in: state
      ).get()
    )

    XCTAssertEqual(compensation.compensates, [operationID])
    XCTAssertEqual(
      compensation.commands,
      [
        .compareAndSetSharedNodePlacement(
          address: first,
          expected: CGPoint(x: 5, y: 8),
          replacement: CGPoint(x: 1, y: 2)
        ),
        .compareAndSetSharedNodePlacement(
          address: second,
          expected: CGPoint(x: 13, y: 21),
          replacement: nil
        ),
      ]
    )
  }

  func testRedoReversesExpectedAndReplacementValues() throws {
    let address = address(1)
    let transaction = Transaction(
      operationIDs: [operationID(counter: 4)],
      transitions: [
        Transition(address: address, before: CGPoint(x: 1, y: 2), after: CGPoint(x: 5, y: 8))
      ]
    )
    let state = try makeState(placements: [address: CGPoint(x: 1, y: 2)])

    let compensation = try Policy().resolveCompensation(
      for: transaction,
      direction: .redo,
      in: state
    ).get()

    XCTAssertEqual(
      compensation.commands,
      [
        .compareAndSetSharedNodePlacement(
          address: address,
          expected: CGPoint(x: 1, y: 2),
          replacement: CGPoint(x: 5, y: 8)
        )
      ]
    )
  }

  func testConcurrentEditRejectsEntireCompensation() throws {
    let first = address(1)
    let second = address(2)
    let transaction = Transaction(
      operationIDs: [operationID(counter: 4)],
      transitions: [
        Transition(address: first, before: .zero, after: CGPoint(x: 5, y: 8)),
        Transition(address: second, before: .zero, after: CGPoint(x: 13, y: 21)),
      ]
    )
    let state = try makeState(
      placements: [
        first: CGPoint(x: 99, y: 99),
        second: CGPoint(x: 13, y: 21),
      ]
    )

    let result = Policy().resolveCompensation(
      for: transaction,
      direction: .undo,
      in: state
    )

    XCTAssertEqual(
      result.failure,
      .concurrentChanges([
        FlowingGraphSharedNodePlacementMismatch(
          address: first,
          expected: CGPoint(x: 5, y: 8),
          actual: CGPoint(x: 99, y: 99)
        )
      ])
    )
  }

  func testDuplicateAddressIsRejectedBeforeGeneratingCommands() throws {
    let address = address(1)
    let transition = Transition(address: address, before: .zero, after: CGPoint(x: 1, y: 1))
    let transaction = Transaction(
      operationIDs: [operationID(counter: 4)],
      transitions: [transition, transition]
    )

    let result = Policy().resolveCompensation(
      for: transaction,
      direction: .undo,
      in: try makeState(placements: [address: CGPoint(x: 1, y: 1)])
    )

    XCTAssertEqual(result.failure, .duplicateAddress(address))
  }

  func testMissingOperationIdentityIsRejected() throws {
    let address = address(1)
    let transaction = Transaction(
      operationIDs: [],
      transitions: [
        Transition(address: address, before: .zero, after: CGPoint(x: 1, y: 1))
      ]
    )

    let result = Policy().resolveCompensation(
      for: transaction,
      direction: .undo,
      in: try makeState(placements: [address: CGPoint(x: 1, y: 1)])
    )

    XCTAssertEqual(result.failure, .missingOperationIdentity)
  }

  func testReciprocalTargetsTheSubmittedCompensation() throws {
    let originalID = operationID(counter: 4)
    let compensationID = operationID(counter: 5)
    let address = address(1)
    let transition = Transition(address: address, before: .zero, after: CGPoint(x: 1, y: 1))
    let transaction = Transaction(operationIDs: [originalID], transitions: [transition])
    let compensation = try Policy().resolveCompensation(
      for: transaction,
      direction: .undo,
      in: try makeState(placements: [address: CGPoint(x: 1, y: 1)])
    ).get()

    let reciprocal = compensation.reciprocalTransaction(
      afterSubmitting: compensationID
    )

    XCTAssertEqual(reciprocal.operationIDs, [compensationID])
    XCTAssertEqual(reciprocal.transitions, [transition])
  }

  private typealias Policy = FlowingGraphSharedNodePlacementUndoPolicy<TestSchema>
  private typealias Transaction = FlowingGraphSharedNodePlacementHistoryTransaction<TestSchema>
  private typealias Transition = FlowingGraphSharedNodePlacementTransition<TestSchema>
  private typealias Address = FlowingGraphDefinitionNodeAddress<Int, Int>

  private func address(_ nodeID: Int) -> Address {
    Address(graphID: 1, nodeID: nodeID)
  }

  private func operationID(counter: UInt64) -> FlowingCollaborationOperationID {
    FlowingCollaborationOperationID(
      replicaID: FlowingReplicaID(
        UUID(uuidString: "00000000-0000-0000-0000-000000000001")!
      ),
      counter: counter
    )
  }

  private func makeState(
    placements: [Address: CGPoint]
  ) throws -> FlowingGraphCollaborationState<TestSchema> {
    var graph = FlowingGraph<TestGraphSchema>()
    _ = graph.update {
      $0.insert(FlowingGraphNode(id: 1, value: "one"))
      $0.insert(FlowingGraphNode(id: 2, value: "two"))
    }
    let document = FlowingGraphDocument<TestSchema>(
      id: "document",
      defaultEntryPointID: 1,
      entryPoints: [FlowingGraphEntryPoint(id: 1, name: "Main", graphID: 1)],
      definitions: [FlowingGraphDefinition(id: 1, graph: graph)],
      subgraphLinks: []
    )
    return try FlowingGraphCollaborationState(
      document: document,
      sharedNodePlacements: placements
    )
  }
}

extension Result {
  fileprivate var failure: Failure? {
    guard case .failure(let failure) = self else { return nil }
    return failure
  }
}

private enum TestGraphSchema: FlowingGraphSchema {
  typealias NodeID = Int
  typealias NodeValue = String
  typealias PortID = Int
  typealias PortValue = String
  typealias EdgeID = Int
  typealias EdgeValue = String
}

private enum TestSchema: FlowingGraphCollaborationSchema {
  typealias DocumentID = String
  typealias GraphID = Int
  typealias EntryPointID = Int
  typealias LinkID = Int
  typealias LinkValue = String
  typealias GraphSchema = TestGraphSchema
}
