import CoreGraphics
import FlowingDayGraphCollaboration
import FlowingDayGraphComposition
import FlowingDayGraphCore
import Foundation
import XCTest

final class FlowingGraphCollaborationReducerTests: XCTestCase {
  func testConcurrentNodeInsertsConvergeWithPersistentOrder() throws {
    let firstReplica = replicaID(1)
    let secondReplica = replicaID(2)
    let firstID = FlowingCollaborationOperationID(replicaID: firstReplica, counter: 1)
    let secondID = FlowingCollaborationOperationID(replicaID: secondReplica, counter: 1)
    let lower = try initialNodePosition()
    let firstPosition = try position(after: lower, operationID: firstID, commandIndex: 0)
    let secondPosition = try position(after: lower, operationID: secondID, commandIndex: 0)
    let first = envelope(
      operationID: firstID,
      commands: [.insertNode(graphID: 1, node: .init(id: 2, value: "two"), position: firstPosition)]
    )
    let second = envelope(
      operationID: secondID,
      commands: [
        .insertNode(graphID: 1, node: .init(id: 3, value: "three"), position: secondPosition)
      ]
    )

    let snapshots = [[first, second], [second, first], [second, first, second]].map { history in
      var replica = makeReplica()
      _ = replica.ingest(history)
      return replica.materialize()
    }

    XCTAssertTrue(snapshots.allSatisfy { $0.pendingOperations.isEmpty })
    XCTAssertTrue(snapshots.allSatisfy { nodeIDs(in: $0.state) == [1, 2, 3] })
    XCTAssertTrue(
      snapshots.dropFirst().allSatisfy {
        $0.operationOrder == snapshots[0].operationOrder
      })
  }

  func testNodePortAndEdgeTransactionCommitsAtomically() throws {
    let operationID = FlowingCollaborationOperationID(replicaID: replicaID(1), counter: 1)
    let nodePosition = try position(
      after: initialNodePosition(), operationID: operationID, commandIndex: 0)
    let portPosition = try position(after: nil, operationID: operationID, commandIndex: 1)
    let edgePosition = try position(after: nil, operationID: operationID, commandIndex: 2)
    let portKey = FlowingGraphPortKey<TestGraphSchema>(nodeID: 2, portID: 1)
    let edge = FlowingGraphEdge<TestGraphSchema>(
      id: 1,
      endpoints: .directed(source: .node(1), target: .port(portKey)),
      value: "link"
    )
    let operation = envelope(
      operationID: operationID,
      commands: [
        .insertNode(graphID: 1, node: .init(id: 2, value: "two"), position: nodePosition),
        .insertPort(graphID: 1, port: .init(key: portKey, value: "input"), position: portPosition),
        .insertEdge(graphID: 1, edge: edge, position: edgePosition),
      ]
    )
    var replica = makeReplica()

    _ = replica.ingest([operation])
    let snapshot = replica.materialize()
    let graph = graph(in: snapshot.state)

    XCTAssertEqual(graph.nodeIDs, [1, 2])
    XCTAssertEqual(graph.portKeys, [portKey])
    XCTAssertEqual(graph.edgeIDs, [1])
    XCTAssertEqual(snapshot.audit.map(\.outcome), [.applied])
  }

  func testFinalDocumentValidationRollsBackTheWholeTransaction() {
    let operationID = FlowingCollaborationOperationID(replicaID: replicaID(1), counter: 1)
    let operation = envelope(
      operationID: operationID,
      commands: [.removeEntryPoint(id: 1)]
    )
    var replica = makeReplica()

    _ = replica.ingest([operation])
    let snapshot = replica.materialize()

    XCTAssertEqual(snapshot.state.document.entryPoints.map(\.id), [1])
    guard case .rejected(.documentValidation(let issues)) = snapshot.audit.first?.outcome else {
      return XCTFail("Expected document validation rejection")
    }
    XCTAssertEqual(issues, [.unknownDefaultEntryPoint(1)])
  }

  func testMultiCommandTransactionMayRepairTemporaryInvalidState() throws {
    let operationID = FlowingCollaborationOperationID(replicaID: replicaID(1), counter: 1)
    let entryPosition = try position(after: nil, operationID: operationID, commandIndex: 0)
    let operation = envelope(
      operationID: operationID,
      commands: [
        .insertEntryPoint(.init(id: 2, name: "Replacement", graphID: 1), position: entryPosition),
        .setDefaultEntryPoint(id: 2),
        .removeEntryPoint(id: 1),
      ]
    )
    var replica = makeReplica()

    _ = replica.ingest([operation])
    let snapshot = replica.materialize()

    XCTAssertEqual(snapshot.state.document.defaultEntryPointID, 2)
    XCTAssertEqual(snapshot.state.document.entryPoints.map(\.id), [2])
    XCTAssertEqual(snapshot.audit.map(\.outcome), [.applied])
  }

  func testDeletedIdentityCannotBeReusedByALateOperation() throws {
    let replicaID = replicaID(1)
    let deletion = envelope(
      operationID: .init(replicaID: replicaID, counter: 1),
      commands: [.removeNode(graphID: 1, id: 1)]
    )
    let insertionID = FlowingCollaborationOperationID(replicaID: replicaID, counter: 2)
    let insertion = envelope(
      operationID: insertionID,
      dependencies: FlowingCausalVersion([replicaID: 1]),
      commands: [
        .insertNode(
          graphID: 1,
          node: .init(id: 1, value: "replacement"),
          position: try position(after: nil, operationID: insertionID, commandIndex: 0)
        )
      ]
    )
    var replica = makeReplica()

    _ = replica.ingest([insertion, deletion])
    let snapshot = replica.materialize()

    XCTAssertTrue(nodeIDs(in: snapshot.state).isEmpty)
    XCTAssertEqual(
      snapshot.audit.map(\.outcome),
      [
        .applied,
        .rejected(.tombstonedElement(.graphElement(graphID: 1, elementID: .node(1)))),
      ])
  }

  func testRelativePlacementTranslationsComposeAcrossReplicas() {
    let firstReplica = replicaID(1)
    let secondReplica = replicaID(2)
    let address = NodeAddress(graphID: 1, nodeID: 1)
    let first = envelope(
      operationID: .init(replicaID: firstReplica, counter: 1),
      commands: [
        .translateSharedNodePlacement(address: address, delta: .init(width: 10, height: 2))
      ]
    )
    let second = envelope(
      operationID: .init(replicaID: secondReplica, counter: 1),
      commands: [
        .translateSharedNodePlacement(address: address, delta: .init(width: -3, height: 5))
      ]
    )

    let positions = [[first, second], [second, first]].map { history in
      var replica = makeReplica()
      _ = replica.ingest(history)
      return replica.materialize().state.sharedNodePlacements[address]
    }

    XCTAssertEqual(positions, [CGPoint(x: 7, y: 7), CGPoint(x: 7, y: 7)])
  }

  func testCompensatingCompareAndSetPreservesAnotherParticipantsLaterEdit() {
    let replicaID = replicaID(1)
    let firstID = FlowingCollaborationOperationID(replicaID: replicaID, counter: 1)
    let secondID = FlowingCollaborationOperationID(replicaID: replicaID, counter: 2)
    let compensationID = FlowingCollaborationOperationID(replicaID: replicaID, counter: 3)
    let first = envelope(
      operationID: firstID,
      commands: [.updateNode(graphID: 1, node: .init(id: 1, value: "first edit"))]
    )
    let second = envelope(
      operationID: secondID,
      dependencies: FlowingCausalVersion([replicaID: 1]),
      commands: [.updateNode(graphID: 1, node: .init(id: 1, value: "later edit"))]
    )
    let compensation = envelope(
      operationID: compensationID,
      dependencies: FlowingCausalVersion([replicaID: 2]),
      compensates: [firstID],
      commands: [
        .compareAndSetNode(
          graphID: 1,
          expected: .init(id: 1, value: "first edit"),
          replacement: .init(id: 1, value: "one")
        )
      ]
    )
    var replica = makeReplica()

    _ = replica.ingest([compensation, second, first])
    let snapshot = replica.materialize()

    XCTAssertEqual(graph(in: snapshot.state).node(id: 1)?.value, "later edit")
    XCTAssertEqual(snapshot.audit.last?.compensates, [firstID])
    XCTAssertEqual(
      snapshot.audit.last?.outcome,
      .rejected(.compareAndSetConflict(.graphElement(graphID: 1, elementID: .node(1))))
    )
  }

  private typealias NodeAddress = FlowingGraphDefinitionNodeAddress<Int, Int>
  private typealias OperationSchema = FlowingGraphCollaborationOperationSchema<TestSchema>

  private func makeReplica() -> FlowingCollaborationReplica<
    OperationSchema,
    FlowingGraphCollaborationReducer<TestSchema>
  > {
    FlowingCollaborationReplica(
      documentID: "document",
      schemaVersion: .init(rawValue: 1),
      initialState: try! makeState(),
      reducer: FlowingGraphCollaborationReducer()
    )
  }

  private func makeState() throws -> FlowingGraphCollaborationState<TestSchema> {
    var graph = FlowingGraph<TestGraphSchema>()
    _ = graph.update { $0.insert(.init(id: 1, value: "one")) }
    let document = FlowingGraphDocument<TestSchema>(
      id: "document",
      defaultEntryPointID: 1,
      entryPoints: [.init(id: 1, name: "Main", graphID: 1)],
      definitions: [.init(id: 1, graph: graph)],
      subgraphLinks: []
    )
    return try FlowingGraphCollaborationState(document: document)
  }

  private func envelope(
    operationID: FlowingCollaborationOperationID,
    dependencies: FlowingCausalVersion? = nil,
    compensates: Set<FlowingCollaborationOperationID> = [],
    commands: [FlowingGraphCollaborationCommand<TestSchema>]
  ) -> FlowingCollaborationOperationEnvelope<OperationSchema> {
    FlowingCollaborationOperationEnvelope(
      operationID: operationID,
      participantID: FlowingParticipantID(uuid(Int(operationID.counter) + 20)),
      replicaID: operationID.replicaID,
      sessionID: FlowingCollaborationSessionID(uuid(Int(operationID.counter) + 40)),
      documentID: "document",
      dependencies: dependencies
        ?? FlowingCausalVersion([
          operationID.replicaID: operationID.counter - 1
        ]),
      schemaVersion: .init(rawValue: 1),
      compensates: compensates,
      commands: commands
    )
  }

  private func initialNodePosition() throws -> FlowingCollaborationSequencePosition {
    try FlowingCollaborationSequence.position(
      between: nil,
      and: nil,
      discriminator: .init(
        operationID: .init(
          replicaID: FlowingReplicaID(
            UUID(uuidString: "00000000-0000-0000-0000-00000000C011")!
          ),
          counter: 1
        ),
        commandIndex: 0
      )
    )
  }

  private func position(
    after lower: FlowingCollaborationSequencePosition?,
    operationID: FlowingCollaborationOperationID,
    commandIndex: UInt32
  ) throws -> FlowingCollaborationSequencePosition {
    try FlowingCollaborationSequence.position(
      between: lower,
      and: nil,
      discriminator: .init(operationID: operationID, commandIndex: commandIndex)
    )
  }

  private func nodeIDs(in state: FlowingGraphCollaborationState<TestSchema>) -> [Int] {
    graph(in: state).nodeIDs
  }

  private func graph(
    in state: FlowingGraphCollaborationState<TestSchema>
  ) -> FlowingGraph<TestGraphSchema> {
    state.document.definitions.first { $0.id == 1 }!.graph
  }

  private func replicaID(_ value: Int) -> FlowingReplicaID {
    FlowingReplicaID(uuid(value))
  }

  private func uuid(_ value: Int) -> UUID {
    UUID(uuidString: String(format: "00000000-0000-0000-0000-%012X", value))!
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
