import FlowingDayGraphAutomation
import FlowingDayGraphCollaboration
import FlowingDayGraphCore
import XCTest

final class FlowingGraphAutomationQueryTests: XCTestCase {
  func testSnapshotMetadataIsAuthorizedSeparatelyFromElementQueries() async throws {
    let snapshot = try makeAutomationReplica().materialize()
    let coordinator = AutomationTestQueryCoordinator()
    let snapshotID = try await coordinator.publish(snapshot, at: 0)
    let context = automationContext()

    let metadata = try await coordinator.metadata(
      for: snapshotID,
      context: context,
      authorizer: FlowingAllowAllGraphAutomationReadAuthorizer<
        AutomationTestSchema
      >()
    )
    XCTAssertEqual(metadata.snapshotID, snapshotID)
    XCTAssertEqual(metadata.operationCount, 0)
    XCTAssertEqual(metadata.pendingOperationCount, 0)
    XCTAssertEqual(metadata.auditEntryCount, 0)

    await assertThrowsErrorAsync(
      try await coordinator.metadata(
        for: snapshotID,
        context: context,
        authorizer: AutomationReadAuthorizer()
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphAutomationQueryIssue<String>,
        .unauthorized(code: "snapshot_metadata_not_authorized")
      )
    }
  }

  func testPaginationRemainsPinnedWhileANewerSnapshotIsPublished() async throws {
    var replica = try makeAutomationReplica()
    let firstSnapshot = replica.materialize()
    let coordinator = AutomationTestQueryCoordinator()
    let firstID = try await coordinator.publish(firstSnapshot, at: 0)
    let context = automationContext()
    let cursorID = try await coordinator.openQuery(
      automationElementQuery(kinds: [.node], pageSize: 1, snapshotID: firstID),
      context: context,
      at: 0,
      authorizer: AutomationReadAuthorizer()
    )
    let firstPage = try await coordinator.nextPage(
      cursorID: cursorID,
      context: context,
      at: 1,
      authorizer: AutomationReadAuthorizer(),
      projector: AutomationStringProjector()
    )

    let operationID = FlowingCollaborationOperationID(
      replicaID: automationReplica(1),
      counter: 1
    )
    let envelope = FlowingCollaborationOperationEnvelope<AutomationTestOperationSchema>(
      operationID: operationID,
      participantID: automationParticipant(1),
      replicaID: operationID.replicaID,
      sessionID: automationSession(1),
      documentID: "document",
      dependencies: .init(),
      schemaVersion: .init(rawValue: 1),
      commands: [.updateNode(graphID: 1, node: .init(id: 2, value: "changed"))]
    )
    XCTAssertEqual(replica.ingest([envelope]).map(\.status), [.admitted])
    let secondID = try await coordinator.publish(replica.materialize(), at: 2)
    XCTAssertNotEqual(firstID, secondID)

    let secondPage = try await coordinator.nextPage(
      cursorID: try XCTUnwrap(firstPage.nextCursorID),
      context: context,
      at: 2,
      authorizer: AutomationReadAuthorizer(),
      projector: AutomationStringProjector()
    )

    XCTAssertEqual(nodePayload(in: firstPage), "node-1")
    XCTAssertEqual(nodePayload(in: secondPage), "node-2")
    XCTAssertEqual(secondPage.snapshotID, firstID)
  }

  func testMetadataOnlyAccessRedactsValues() async throws {
    let snapshot = try makeAutomationReplica().materialize()
    let coordinator = AutomationTestQueryCoordinator()
    let snapshotID = try await coordinator.publish(snapshot, at: 0)
    let context = automationContext()
    let cursorID = try await coordinator.openQuery(
      automationElementQuery(kinds: [.entryPoint, .node], pageSize: 10, snapshotID: snapshotID),
      context: context,
      at: 0,
      authorizer: AutomationReadAuthorizer(elementAccess: .metadataOnly)
    )

    let page = try await coordinator.nextPage(
      cursorID: cursorID,
      context: context,
      at: 1,
      authorizer: AutomationReadAuthorizer(elementAccess: .metadataOnly),
      projector: AutomationStringProjector()
    )

    for record in page.records {
      switch record {
      case .entryPoint(_, let name, _, _):
        guard case .redacted = name else { return XCTFail("Expected redacted name") }
      case .node(_, _, let value):
        guard case .redacted = value else { return XCTFail("Expected redacted value") }
      default:
        XCTFail("Unexpected record")
      }
    }
  }

  func testAuthorizationIsRecheckedForEveryPage() async throws {
    let snapshot = try makeAutomationReplica().materialize()
    let coordinator = AutomationTestQueryCoordinator()
    let snapshotID = try await coordinator.publish(snapshot, at: 0)
    let context = automationContext()
    let cursorID = try await coordinator.openQuery(
      automationElementQuery(kinds: [.node], pageSize: 1, snapshotID: snapshotID),
      context: context,
      at: 0,
      authorizer: AutomationReadAuthorizer()
    )
    let firstPage = try await coordinator.nextPage(
      cursorID: cursorID,
      context: context,
      at: 1,
      authorizer: AutomationReadAuthorizer(),
      projector: AutomationStringProjector()
    )

    await assertThrowsErrorAsync(
      try await coordinator.nextPage(
        cursorID: XCTUnwrap(firstPage.nextCursorID),
        context: context,
        at: 2,
        authorizer: AutomationReadAuthorizer(queryDecision: .deny(code: "revoked")),
        projector: AutomationStringProjector()
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphAutomationQueryIssue<String>,
        .unauthorized(code: "revoked")
      )
    }
  }

  func testCursorRejectsWrongParticipantScopeAndExpiry() async throws {
    let snapshot = try makeAutomationReplica().materialize()
    let limits = automationLimits(cursorTimeToLive: 5)
    let coordinator = AutomationTestQueryCoordinator(limits: limits)
    let snapshotID = try await coordinator.publish(snapshot, at: 10)
    let context = automationContext()

    let wrongParticipantCursor = try await coordinator.openQuery(
      automationElementQuery(kinds: [.node], pageSize: 1, snapshotID: snapshotID),
      context: context,
      at: 10,
      authorizer: AutomationReadAuthorizer()
    )
    await assertThrowsErrorAsync(
      try await coordinator.nextPage(
        cursorID: wrongParticipantCursor,
        context: automationContext(participant: 2),
        at: 11,
        authorizer: AutomationReadAuthorizer(),
        projector: AutomationStringProjector()
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphAutomationQueryIssue<String>,
        .cursorParticipantMismatch
      )
    }

    let wrongScopeCursor = try await coordinator.openQuery(
      automationElementQuery(kinds: [.node], pageSize: 1, snapshotID: snapshotID),
      context: context,
      at: 10,
      authorizer: AutomationReadAuthorizer()
    )
    await assertThrowsErrorAsync(
      try await coordinator.nextPage(
        cursorID: wrongScopeCursor,
        context: automationContext(
          scopeID: .init(id: automationUUID(9_999), revision: 1)
        ),
        at: 11,
        authorizer: AutomationReadAuthorizer(),
        projector: AutomationStringProjector()
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphAutomationQueryIssue<String>,
        .authorizationScopeChanged
      )
    }

    let expiredCursor = try await coordinator.openQuery(
      automationElementQuery(kinds: [.node], pageSize: 1, snapshotID: snapshotID),
      context: context,
      at: 10,
      authorizer: AutomationReadAuthorizer()
    )
    await assertThrowsErrorAsync(
      try await coordinator.nextPage(
        cursorID: expiredCursor,
        context: context,
        at: 15,
        authorizer: AutomationReadAuthorizer(),
        projector: AutomationStringProjector()
      )
    ) { error in
      XCTAssertEqual(error as? FlowingGraphAutomationQueryIssue<String>, .staleCursor)
    }
  }

  func testPinnedSnapshotAndCursorBudgetsAreEnforced() async throws {
    var replica = try makeAutomationReplica()
    let firstSnapshot = replica.materialize()
    let limits = automationLimits(
      maximumRetainedSnapshots: 2,
      maximumCursorsPerParticipant: 2,
      maximumPinnedSnapshotsPerParticipant: 1
    )
    let coordinator = AutomationTestQueryCoordinator(limits: limits)
    let firstID = try await coordinator.publish(firstSnapshot, at: 0)
    let context = automationContext()
    _ = try await coordinator.openQuery(
      automationElementQuery(kinds: [.node], pageSize: 1, snapshotID: firstID),
      context: context,
      at: 0,
      authorizer: AutomationReadAuthorizer()
    )

    let operationID = FlowingCollaborationOperationID(
      replicaID: automationReplica(1),
      counter: 1
    )
    _ = replica.ingest([
      FlowingCollaborationOperationEnvelope<AutomationTestOperationSchema>(
        operationID: operationID,
        participantID: automationParticipant(1),
        replicaID: operationID.replicaID,
        sessionID: automationSession(1),
        documentID: "document",
        dependencies: .init(),
        schemaVersion: .init(rawValue: 1),
        commands: [.updateNode(graphID: 1, node: .init(id: 1, value: "changed"))]
      )
    ])
    let secondID = try await coordinator.publish(replica.materialize(), at: 1)

    await assertThrowsErrorAsync(
      try await coordinator.openQuery(
        automationElementQuery(kinds: [.node], pageSize: 1, snapshotID: secondID),
        context: context,
        at: 1,
        authorizer: AutomationReadAuthorizer()
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphAutomationQueryIssue<String>,
        .participantPinnedSnapshotLimitExceeded(maximum: 1)
      )
    }
  }

  func testBoundedTraversalReturnsStableNodesPortsAndEdges() async throws {
    let snapshot = try makeAutomationReplica(nodeCount: 5).materialize()
    let coordinator = AutomationTestQueryCoordinator()
    let snapshotID = try await coordinator.publish(snapshot, at: 0)
    let context = automationContext()
    let cursorID = try await coordinator.openQuery(
      FlowingGraphAutomationQueryRequest(
        snapshotID: snapshotID,
        query: .traversal(
          .init(
            graphID: 1,
            startNodeIDs: [2],
            policy: .outgoing,
            maximumDepth: 2
          )
        ),
        pageSize: 20
      ),
      context: context,
      at: 0,
      authorizer: AutomationReadAuthorizer()
    )

    let page = try await coordinator.nextPage(
      cursorID: cursorID,
      context: context,
      at: 1,
      authorizer: AutomationReadAuthorizer(),
      projector: AutomationStringProjector()
    )

    XCTAssertEqual(recordNodeIDs(page.records), [2, 3, 4])
    XCTAssertEqual(recordPortNodeIDs(page.records), [2, 3, 4])
    XCTAssertEqual(recordEdgeIDs(page.records), [2, 3])
  }

  private func nodePayload(
    in page: FlowingGraphAutomationQueryPage<AutomationTestSchema, String>
  ) -> String? {
    for record in page.records {
      guard case .node(_, _, .value(let value)) = record else { continue }
      return value
    }
    return nil
  }

  private func recordNodeIDs(
    _ records: [FlowingGraphAutomationRecord<AutomationTestSchema, String>]
  ) -> [Int] {
    records.compactMap {
      guard case .node(_, let nodeID, _) = $0 else { return nil }
      return nodeID
    }
  }

  private func recordPortNodeIDs(
    _ records: [FlowingGraphAutomationRecord<AutomationTestSchema, String>]
  ) -> [Int] {
    records.compactMap {
      guard case .port(_, let key, _) = $0 else { return nil }
      return key.nodeID
    }
  }

  private func recordEdgeIDs(
    _ records: [FlowingGraphAutomationRecord<AutomationTestSchema, String>]
  ) -> [Int] {
    records.compactMap {
      guard case .edge(_, let edgeID, _, _) = $0 else { return nil }
      return edgeID
    }
  }
}

func assertThrowsErrorAsync<T: Sendable>(
  _ expression: @autoclosure () async throws -> T,
  _ handler: (Error) -> Void
) async {
  do {
    _ = try await expression()
    XCTFail("Expected error")
  } catch {
    handler(error)
  }
}
