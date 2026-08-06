import FlowingDayGraphAutomation
import FlowingDayGraphCollaboration
import XCTest

final class FlowingGraphAutomationCommandTests: XCTestCase {
  func testDirectRetryHasExactlyOneMaterializedEffect() async throws {
    let fixture = try makeAutomationCommandFixture()
    let gateway = fixture.gateway
    let operationID = FlowingCollaborationOperationID(
      replicaID: automationReplica(1),
      counter: 1
    )
    let request = automationDirectRequest(
      operationID: operationID,
      baseVersion: .init(),
      intents: [.updateNode(id: 1, value: "changed")]
    )

    let first = try await gateway.commit(
      request,
      policy: AutomationCommandPolicy(),
      authorizer: FlowingAllowAllCollaborationAuthorizer<AutomationTestOperationSchema>()
    )
    let retry = try await gateway.commit(
      request,
      policy: AutomationCommandPolicy(.deny(code: "revoked-after-commit")),
      authorizer: AutomationDenyCollaborationAuthorizer()
    )
    let snapshot = await fixture.collaboration.snapshot()

    XCTAssertEqual(first.receipt.status, .admitted)
    XCTAssertEqual(first.outcome, .applied)
    XCTAssertEqual(retry.receipt.status, .duplicate)
    XCTAssertEqual(retry.envelope, first.envelope)
    XCTAssertEqual(snapshot.audit.count, 1)
    XCTAssertEqual(nodeValue(1, snapshot: snapshot), "changed")
  }

  func testSameOperationIdentityWithDifferentIntentIsEquivocation() async throws {
    let gateway = try makeAutomationCommandGateway()
    let operationID = FlowingCollaborationOperationID(
      replicaID: automationReplica(1),
      counter: 1
    )
    let first = automationDirectRequest(
      operationID: operationID,
      baseVersion: .init(),
      intents: [.updateNode(id: 1, value: "first")]
    )
    _ = try await gateway.commit(
      first,
      policy: AutomationCommandPolicy(),
      authorizer: FlowingAllowAllCollaborationAuthorizer<AutomationTestOperationSchema>()
    )
    let conflicting = automationDirectRequest(
      operationID: operationID,
      baseVersion: .init(),
      intents: [.updateNode(id: 1, value: "second")]
    )

    await XCTAssertThrowsErrorAsync(
      try await gateway.commit(
        conflicting,
        policy: AutomationCommandPolicy(),
        authorizer: FlowingAllowAllCollaborationAuthorizer<AutomationTestOperationSchema>()
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphAutomationCommandIssue<String, AutomationTestCompilerFailure>,
        .operationEquivocation(operationID)
      )
    }
  }

  func testStaleDirectBaseAndProposalOnlyPolicyRejectDirectCommit() async throws {
    let gateway = try makeAutomationCommandGateway()
    let firstID = FlowingCollaborationOperationID(
      replicaID: automationReplica(1),
      counter: 1
    )
    let first = automationDirectRequest(
      operationID: firstID,
      baseVersion: .init(),
      intents: [.updateNode(id: 1, value: "first")]
    )
    let firstCommit = try await gateway.commit(
      first,
      policy: AutomationCommandPolicy(),
      authorizer: FlowingAllowAllCollaborationAuthorizer<AutomationTestOperationSchema>()
    )
    let stale = automationDirectRequest(
      operationID: .init(replicaID: firstID.replicaID, counter: 2),
      baseVersion: .init(),
      intents: [.updateNode(id: 1, value: "stale")]
    )

    await XCTAssertThrowsErrorAsync(
      try await gateway.commit(
        stale,
        policy: AutomationCommandPolicy(),
        authorizer: FlowingAllowAllCollaborationAuthorizer<AutomationTestOperationSchema>()
      )
    ) { error in
      guard case .staleBase = error as? FlowingGraphAutomationCommandIssue<
        String, AutomationTestCompilerFailure
      > else {
        return XCTFail("Expected stale base")
      }
    }

    let direct = automationDirectRequest(
      operationID: .init(replicaID: firstID.replicaID, counter: 2),
      baseVersion: firstCommit.snapshotID.version,
      intents: [.updateNode(id: 1, value: "proposal-only")]
    )
    await XCTAssertThrowsErrorAsync(
      try await gateway.commit(
        direct,
        policy: AutomationCommandPolicy(.requireProposal),
        authorizer: FlowingAllowAllCollaborationAuthorizer<AutomationTestOperationSchema>()
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphAutomationCommandIssue<String, AutomationTestCompilerFailure>,
        .proposalRequired
      )
    }
  }

  func testProposalInsertionCompilesWithAcceptanceOperationIdentity() async throws {
    let fixture = try makeAutomationCommandFixture()
    let gateway = fixture.gateway
    let proposalID = FlowingCollaborationProposalID(automationUUID(7_001))
    let proposal = try await gateway.propose(
      FlowingGraphAutomationProposalRequest<AutomationTestSchema, AutomationTestIntent>(
        proposalID: proposalID,
        participantID: automationParticipant(2),
        sessionID: automationSession(2),
        documentID: "document",
        baseVersion: .init(),
        provenance: .init(origin: .agent, originLabel: "planner"),
        intents: [.insertNode(id: 10, value: "inserted", after: 1)]
      ),
      at: 1,
      policy: AutomationCommandPolicy(.requireProposal)
    )
    let operationID = FlowingCollaborationOperationID(
      replicaID: automationReplica(2),
      counter: 1
    )

    let accepted = try await gateway.accept(
      FlowingGraphAutomationProposalAcceptance(
        proposalID: proposal.proposalID,
        operationID: operationID,
        participantID: automationParticipant(3),
        sessionID: automationSession(3),
        documentID: "document",
        schemaVersion: .init(rawValue: 1),
        provenance: .init(origin: .human, originLabel: "reviewer")
      ),
      at: 2,
      policy: AutomationCommandPolicy(),
      authorizer: FlowingAllowAllCollaborationAuthorizer<AutomationTestOperationSchema>()
    )

    guard case .insertNode(_, _, let position) = accepted.envelope.commands[0] else {
      return XCTFail("Expected compiled insertion")
    }
    XCTAssertEqual(position.discriminator.operationID, operationID)
    XCTAssertEqual(position.discriminator.commandIndex, 0)
    XCTAssertEqual(accepted.outcome, .applied)
    let snapshot = await fixture.collaboration.snapshot()
    XCTAssertEqual(snapshot.state.document.definitions[0].graph.nodeIDs, [1, 10, 2, 3])
  }

  func testProposalAuthorizationAndBaseAreRecheckedAtAcceptTime() async throws {
    let fixture = try makeAutomationCommandFixture()
    let gateway = fixture.gateway
    let proposal = try await gateway.propose(
      FlowingGraphAutomationProposalRequest<AutomationTestSchema, AutomationTestIntent>(
        participantID: automationParticipant(2),
        sessionID: automationSession(2),
        documentID: "document",
        baseVersion: .init(),
        provenance: .init(origin: .agent),
        intents: [.updateNode(id: 2, value: "proposed")]
      ),
      at: 0,
      policy: AutomationCommandPolicy(.requireProposal)
    )
    let acceptance = FlowingGraphAutomationProposalAcceptance<AutomationTestSchema>(
      proposalID: proposal.proposalID,
      operationID: .init(replicaID: automationReplica(2), counter: 1),
      participantID: automationParticipant(3),
      sessionID: automationSession(3),
      documentID: "document",
      schemaVersion: .init(rawValue: 1),
      provenance: .init(origin: .human)
    )

    await XCTAssertThrowsErrorAsync(
      try await gateway.accept(
        acceptance,
        at: 1,
        policy: AutomationCommandPolicy(.deny(code: "reviewer-revoked")),
        authorizer: FlowingAllowAllCollaborationAuthorizer<AutomationTestOperationSchema>()
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphAutomationCommandIssue<String, AutomationTestCompilerFailure>,
        .unauthorized(code: "reviewer-revoked")
      )
    }

    let intervening = automationDirectRequest(
      operationID: .init(replicaID: automationReplica(1), counter: 1),
      baseVersion: .init(),
      intents: [.updateNode(id: 1, value: "intervening")]
    )
    _ = try await gateway.commit(
      intervening,
      policy: AutomationCommandPolicy(),
      authorizer: FlowingAllowAllCollaborationAuthorizer<AutomationTestOperationSchema>()
    )

    await XCTAssertThrowsErrorAsync(
      try await gateway.accept(
        acceptance,
        at: 2,
        policy: AutomationCommandPolicy(),
        authorizer: FlowingAllowAllCollaborationAuthorizer<AutomationTestOperationSchema>()
      )
    ) { error in
      guard case .staleBase = error as? FlowingGraphAutomationCommandIssue<
        String, AutomationTestCompilerFailure
      > else {
        return XCTFail("Expected stale proposal base")
      }
    }
  }

  func testCollaborationAuthorizationDenialCanBeRetriedAfterPolicyChanges() async throws {
    let gateway = try makeAutomationCommandGateway()
    let operationID = FlowingCollaborationOperationID(
      replicaID: automationReplica(1),
      counter: 1
    )
    let request = automationDirectRequest(
      operationID: operationID,
      baseVersion: .init(),
      intents: [.updateNode(id: 1, value: "allowed-later")]
    )

    let denied = try await gateway.commit(
      request,
      policy: AutomationCommandPolicy(),
      authorizer: AutomationDenyCollaborationAuthorizer()
    )
    let accepted = try await gateway.commit(
      request,
      policy: AutomationCommandPolicy(),
      authorizer: FlowingAllowAllCollaborationAuthorizer<AutomationTestOperationSchema>()
    )

    XCTAssertEqual(
      denied.receipt.status,
      .rejected(.unauthorized(code: "revoked"))
    )
    XCTAssertEqual(accepted.receipt.status, .admitted)
    XCTAssertEqual(accepted.outcome, .applied)
  }

  private func nodeValue(
    _ nodeID: Int,
    snapshot: AutomationTestSnapshot
  ) -> String? {
    snapshot.state.document.definitions[0].graph.node(id: nodeID)?.value
  }

  func testConcurrentProposalAcceptancesMaterializeAtMostOneOperation() async throws {
    let fixture = try makeAutomationCommandFixture()
    let gateway = fixture.gateway
    let proposal = try await gateway.propose(
      FlowingGraphAutomationProposalRequest<AutomationTestSchema, AutomationTestIntent>(
        participantID: automationParticipant(1),
        sessionID: automationSession(1),
        documentID: "document",
        baseVersion: .init(),
        provenance: .init(origin: .agent),
        intents: [.updateNode(id: 1, value: "accepted-once")]
      ),
      at: 0,
      policy: AutomationCommandPolicy(.requireProposal)
    )

    let acceptedCount = await withTaskGroup(of: Bool.self) { group in
      for value in 1...100 {
        group.addTask {
          let acceptance = FlowingGraphAutomationProposalAcceptance<AutomationTestSchema>(
            proposalID: proposal.proposalID,
            operationID: .init(replicaID: automationReplica(value), counter: 1),
            participantID: automationParticipant(value),
            sessionID: automationSession(value),
            documentID: "document",
            schemaVersion: .init(rawValue: 1),
            provenance: .init(origin: .human)
          )
          do {
            _ = try await gateway.accept(
              acceptance,
              at: 1,
              policy: AutomationCommandPolicy(),
              authorizer: FlowingAllowAllCollaborationAuthorizer<
                AutomationTestOperationSchema
              >()
            )
            return true
          } catch {
            return false
          }
        }
      }
      return await group.reduce(into: 0) { count, accepted in
        if accepted { count += 1 }
      }
    }
    let snapshot = await fixture.collaboration.snapshot()

    XCTAssertEqual(acceptedCount, 1)
    XCTAssertEqual(snapshot.audit.count, 1)
    XCTAssertEqual(nodeValue(1, snapshot: snapshot), "accepted-once")
  }

  func testConcurrentDirectCommandsCannotOverrunHistoryLimit() async throws {
    let fixture = try makeAutomationCommandFixture(
      limits: automationLimits(maximumCommandHistory: 1)
    )
    let gateway = fixture.gateway

    let acceptedCount = await withTaskGroup(of: Bool.self) { group in
      for value in 1...100 {
        group.addTask {
          let operationID = FlowingCollaborationOperationID(
            replicaID: automationReplica(value),
            counter: 1
          )
          let request = automationDirectRequest(
            operationID: operationID,
            baseVersion: .init(),
            intents: [.updateNode(id: 1, value: "value-\(value)")]
          )
          do {
            _ = try await gateway.commit(
              request,
              policy: AutomationCommandPolicy(),
              authorizer: FlowingAllowAllCollaborationAuthorizer<
                AutomationTestOperationSchema
              >()
            )
            return true
          } catch {
            return false
          }
        }
      }
      return await group.reduce(into: 0) { count, accepted in
        if accepted { count += 1 }
      }
    }
    let snapshot = await fixture.collaboration.snapshot()

    XCTAssertEqual(acceptedCount, 1)
    XCTAssertEqual(snapshot.audit.count, 1)
  }

  func testProposalExpiryAuthorizationAndRetentionAreEnforced() async throws {
    let gateway = try makeAutomationCommandGateway(
      limits: automationLimits(maximumProposals: 1)
    )
    let firstRequest = FlowingGraphAutomationProposalRequest<
      AutomationTestSchema,
      AutomationTestIntent
    >(
      participantID: automationParticipant(1),
      sessionID: automationSession(1),
      documentID: "document",
      baseVersion: .init(),
      provenance: .init(origin: .agent),
      intents: [.updateNode(id: 1, value: "first")]
    )
    let first = try await gateway.propose(
      firstRequest,
      at: 0,
      policy: AutomationCommandPolicy(.requireProposal)
    )
    let secondRequest = FlowingGraphAutomationProposalRequest<
      AutomationTestSchema,
      AutomationTestIntent
    >(
      participantID: automationParticipant(2),
      sessionID: automationSession(2),
      documentID: "document",
      baseVersion: .init(),
      provenance: .init(origin: .agent),
      intents: [.updateNode(id: 2, value: "second")]
    )

    await XCTAssertThrowsErrorAsync(
      try await gateway.propose(
        secondRequest,
        at: 0,
        policy: AutomationCommandPolicy(.requireProposal)
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphAutomationCommandIssue<
          String,
          AutomationTestCompilerFailure
        >,
        .proposalLimitExceeded(maximum: 1)
      )
    }
    await XCTAssertThrowsErrorAsync(
      try await gateway.reject(
        proposalID: first.proposalID,
        participantID: automationParticipant(3),
        sessionID: automationSession(3),
        provenance: .init(origin: .human),
        policy: AutomationCommandPolicy(.deny(code: "reviewer-revoked"))
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphAutomationCommandIssue<
          String,
          AutomationTestCompilerFailure
        >,
        .unauthorized(code: "reviewer-revoked")
      )
    }
    try await gateway.reject(
      proposalID: first.proposalID,
      participantID: automationParticipant(3),
      sessionID: automationSession(3),
      provenance: .init(origin: .human),
      policy: AutomationCommandPolicy(.requireProposal)
    )
    _ = try await gateway.propose(
      secondRequest,
      at: 0,
      policy: AutomationCommandPolicy(.requireProposal)
    )

    let expired = FlowingGraphAutomationProposalRequest<
      AutomationTestSchema,
      AutomationTestIntent
    >(
      participantID: automationParticipant(4),
      sessionID: automationSession(4),
      documentID: "document",
      baseVersion: .init(),
      provenance: .init(origin: .agent),
      expiresAt: 5,
      intents: [.updateNode(id: 3, value: "expired")]
    )
    await XCTAssertThrowsErrorAsync(
      try await gateway.propose(
        expired,
        at: 5,
        policy: AutomationCommandPolicy(.requireProposal)
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphAutomationCommandIssue<
          String,
          AutomationTestCompilerFailure
        >,
        .expiredProposal(expired.proposalID)
      )
    }
  }
}
