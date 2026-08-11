import FlowingDayGraphAutomation
import FlowingDayGraphCollaboration
import FlowingDayGraphComposition
import FlowingDayGraphCore
import Foundation
import XCTest

final class FlowingGraphAutomationScaleTests: XCTestCase {
  private let scale = 100_000

  func testHundredThousandElementQueryProjectsPayloadOnlyAsPagesAreRead() async throws {
    let snapshot = try makeLargeAutomationSnapshot(nodeCount: scale)
    let coordinator = AutomationTestQueryCoordinator()
    let snapshotID = try await coordinator.publish(snapshot, at: 0)
    let context = automationContext()
    let projector = CountingAutomationProjector()
    var cursorID: FlowingAutomationCursorID? = try await coordinator.openQuery(
      automationElementQuery(
        kinds: [.node],
        pageSize: 1_000,
        snapshotID: snapshotID
      ),
      context: context,
      at: 0,
      authorizer: AutomationReadAuthorizer()
    )

    XCTAssertEqual(projector.projectedValueCount(), 0)
    var recordCount = 0
    while let currentCursorID = cursorID {
      let page = try await coordinator.nextPage(
        cursorID: currentCursorID,
        context: context,
        at: 1,
        authorizer: AutomationReadAuthorizer(),
        projector: projector
      )
      recordCount += page.records.count
      cursorID = page.nextCursorID
    }

    XCTAssertEqual(recordCount, scale)
    XCTAssertEqual(projector.projectedValueCount(), scale)
  }

  func testHundredThousandIdempotentRetriesHaveOneMaterializedEffect() async throws {
    let fixture = try makeAutomationCommandFixture()
    let gateway = fixture.gateway
    let operationID = FlowingCollaborationOperationID(
      replicaID: automationReplica(1),
      counter: 1
    )
    let request = automationDirectRequest(
      operationID: operationID,
      baseVersion: .init(),
      intents: [.updateNode(id: 1, value: "once")]
    )
    _ = try await gateway.commit(
      request,
      policy: AutomationCommandPolicy(),
      authorizer: FlowingAllowAllCollaborationAuthorizer<AutomationTestOperationSchema>()
    )

    var lastRetry: FlowingGraphAutomationCommit<AutomationTestSchema>?
    for _ in 0..<scale {
      let retry = try await gateway.commit(
        request,
        policy: AutomationCommandPolicy(),
        authorizer: FlowingAllowAllCollaborationAuthorizer<AutomationTestOperationSchema>()
      )
      lastRetry = retry
    }
    let snapshot = await fixture.collaboration.snapshot()

    XCTAssertEqual(snapshot.audit.count, 1)
    XCTAssertEqual(lastRetry?.receipt.status, .duplicate)
    XCTAssertEqual(
      snapshot.state.document.definitions[0].graph.node(id: 1)?.value,
      "once"
    )
  }

  func testDeepTraversalIsIterativeAndCycleTraversalTerminates() async throws {
    let deepNodeCount = 10_000
    let deepSnapshot = try makeAutomationSnapshot(
      graph: makeAutomationGraph(nodeCount: deepNodeCount)
    )
    let limits = automationLimits(
      maximumPageSize: deepNodeCount,
      maximumQueryResults: deepNodeCount * 3,
      maximumQueryWork: deepNodeCount * 10,
      maximumTraversalDepth: deepNodeCount
    )
    let deepCoordinator = AutomationTestQueryCoordinator(limits: limits)
    let deepSnapshotID = try await deepCoordinator.publish(deepSnapshot, at: 0)
    let context = automationContext()
    let deepCursorID = try await deepCoordinator.openQuery(
      FlowingGraphAutomationQueryRequest(
        snapshotID: deepSnapshotID,
        query: .traversal(
          .init(
            graphID: 1,
            startNodeIDs: [1],
            maximumDepth: deepNodeCount,
            includedKinds: [.node]
          )
        ),
        pageSize: deepNodeCount
      ),
      context: context,
      at: 0,
      authorizer: AutomationReadAuthorizer()
    )
    let deepPage = try await deepCoordinator.nextPage(
      cursorID: deepCursorID,
      context: context,
      at: 1,
      authorizer: AutomationReadAuthorizer(),
      projector: AutomationStringProjector()
    )
    XCTAssertEqual(deepPage.records.count, deepNodeCount)

    var cyclicGraph = makeAutomationGraph(nodeCount: 3)
    let cycleMutation = cyclicGraph.update { transaction in
      transaction.insert(
        FlowingGraphEdge(
          id: 99,
          endpoints: .directed(
            source: .port(.init(nodeID: 3, portID: 1)),
            target: .port(.init(nodeID: 1, portID: 1))
          ),
          value: "cycle"
        )
      )
    }
    guard case .committed = cycleMutation else {
      return XCTFail("Invalid cycle fixture")
    }
    let cycleCoordinator = AutomationTestQueryCoordinator(limits: limits)
    let cycleSnapshotID = try await cycleCoordinator.publish(
      makeAutomationSnapshot(graph: cyclicGraph),
      at: 0
    )
    let cycleCursorID = try await cycleCoordinator.openQuery(
      FlowingGraphAutomationQueryRequest(
        snapshotID: cycleSnapshotID,
        query: .traversal(
          .init(
            graphID: 1,
            startNodeIDs: [1],
            maximumDepth: deepNodeCount,
            includedKinds: [.node, .edge]
          )
        ),
        pageSize: deepNodeCount
      ),
      context: context,
      at: 0,
      authorizer: AutomationReadAuthorizer()
    )
    let cyclePage = try await cycleCoordinator.nextPage(
      cursorID: cycleCursorID,
      context: context,
      at: 1,
      authorizer: AutomationReadAuthorizer(),
      projector: AutomationStringProjector()
    )
    XCTAssertEqual(cyclePage.records.count, 6)
  }
}

private func makeLargeAutomationSnapshot(nodeCount: Int) throws -> AutomationTestSnapshot {
  var graph = FlowingGraph<AutomationTestGraphSchema>()
  let mutation = graph.update { transaction in
    for nodeID in 0..<nodeCount {
      transaction.insert(
        FlowingGraphNode(id: nodeID, value: "node-\(nodeID)")
      )
    }
  }
  guard case .committed = mutation else {
    preconditionFailure("Invalid large automation graph")
  }
  return try makeAutomationSnapshot(graph: graph)
}

private func makeAutomationSnapshot(
  graph: FlowingGraph<AutomationTestGraphSchema>
) throws -> AutomationTestSnapshot {
  let document = FlowingGraphDocument<AutomationTestSchema>(
    id: "document",
    defaultEntryPointID: 1,
    entryPoints: [.init(id: 1, name: "Main", graphID: 1)],
    definitions: [.init(id: 1, graph: graph)],
    subgraphLinks: []
  )
  let state = try FlowingGraphCollaborationState<AutomationTestSchema>(
    document: document
  )
  return FlowingCollaborationReplica(
    documentID: "document",
    schemaVersion: .init(rawValue: 1),
    initialState: state,
    reducer: AutomationTestReducer()
  ).materialize()
}

private final class CountingAutomationProjector:
  FlowingGraphAutomationValueProjector,
  @unchecked Sendable
{
  typealias Schema = AutomationTestSchema
  typealias Payload = String

  private let lock = NSLock()
  private var count = 0

  func nodePayload(
    _ value: String,
    graphID: Int,
    nodeID: Int,
    context: FlowingAutomationAccessContext
  ) -> String {
    incrementCount()
    return value
  }

  func portPayload(
    _ value: String,
    graphID: Int,
    key: FlowingGraphPortKey<AutomationTestGraphSchema>,
    context: FlowingAutomationAccessContext
  ) -> String {
    incrementCount()
    return value
  }

  func edgePayload(
    _ value: String,
    graphID: Int,
    edgeID: Int,
    context: FlowingAutomationAccessContext
  ) -> String {
    incrementCount()
    return value
  }

  func linkPayload(
    _ value: String,
    linkID: Int,
    context: FlowingAutomationAccessContext
  ) -> String {
    incrementCount()
    return value
  }

  func projectedValueCount() -> Int {
    lock.lock()
    defer { lock.unlock() }
    return count
  }

  private func incrementCount() {
    lock.lock()
    count += 1
    lock.unlock()
  }
}
