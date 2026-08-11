import FlowingDayGraphAutomation
import FlowingDayGraphCollaboration
import Foundation
import XCTest

final class FlowingAutomationSessionRouterTests: XCTestCase {
  func testRequestsOnlyReachTheirExplicitTargetSession() async throws {
    let router = FlowingAutomationSessionRouter<
      AutomationSessionEndpoint,
      AutomationSessionCommand
    >()
    let human = AutomationSessionEndpoint()
    let agent = AutomationSessionEndpoint()
    let humanSession = automationSession(1)
    let agentSession = automationSession(2)
    try await router.register(sessionID: humanSession, endpoint: human)
    try await router.register(sessionID: agentSession, endpoint: agent)

    _ = try await router.deliver(
      automationSessionRequest(target: agentSession, command: .focus(42)),
      authorizer: AutomationSessionAuthorizer()
    )

    let humanCommands = await human.receivedCommands()
    let agentCommands = await agent.receivedCommands()
    XCTAssertEqual(humanCommands, [])
    XCTAssertEqual(agentCommands, [.focus(42)])
  }

  func testDuplicateSessionRequestIsNotDeliveredTwiceAndIsReauthorized() async throws {
    let router = FlowingAutomationSessionRouter<
      AutomationSessionEndpoint,
      AutomationSessionCommand
    >()
    let endpoint = AutomationSessionEndpoint()
    let sessionID = automationSession(1)
    try await router.register(sessionID: sessionID, endpoint: endpoint)
    let request = automationSessionRequest(target: sessionID, command: .inspect(7))

    let first = try await router.deliver(
      request,
      authorizer: AutomationSessionAuthorizer()
    )
    let duplicate = try await router.deliver(
      request,
      authorizer: AutomationSessionAuthorizer()
    )

    XCTAssertFalse(first.isDuplicate)
    XCTAssertTrue(duplicate.isDuplicate)
    let commands = await endpoint.receivedCommands()
    XCTAssertEqual(commands, [.inspect(7)])

    await assertThrowsErrorAsync(
      try await router.deliver(
        request,
        authorizer: AutomationSessionAuthorizer(decision: .deny(code: "revoked"))
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingAutomationSessionIssue<AutomationSessionFailure>,
        .unauthorized(code: "revoked")
      )
    }
  }

  func testRequestIdentityEquivocationAndUnknownSessionAreRejected() async throws {
    let router = FlowingAutomationSessionRouter<
      AutomationSessionEndpoint,
      AutomationSessionCommand
    >()
    let endpoint = AutomationSessionEndpoint()
    let sessionID = automationSession(1)
    try await router.register(sessionID: sessionID, endpoint: endpoint)
    let first = automationSessionRequest(target: sessionID, command: .focus(1))
    _ = try await router.deliver(first, authorizer: AutomationSessionAuthorizer())
    let conflicting = FlowingAutomationSessionRequest(
      requestID: first.requestID,
      participantID: first.participantID,
      targetSessionID: first.targetSessionID,
      provenance: first.provenance,
      command: AutomationSessionCommand.focus(2)
    )

    await assertThrowsErrorAsync(
      try await router.deliver(
        conflicting,
        authorizer: AutomationSessionAuthorizer()
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingAutomationSessionIssue<AutomationSessionFailure>,
        .requestEquivocation(first.requestID)
      )
    }

    await assertThrowsErrorAsync(
      try await router.deliver(
        automationSessionRequest(target: automationSession(99), command: .ping),
        authorizer: AutomationSessionAuthorizer()
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingAutomationSessionIssue<AutomationSessionFailure>,
        .unknownSession(automationSession(99))
      )
    }
  }

  func testConcurrentDeliveriesRemainSessionIsolated() async throws {
    let router = FlowingAutomationSessionRouter<
      AutomationSessionEndpoint,
      AutomationSessionCommand
    >()
    let firstEndpoint = AutomationSessionEndpoint()
    let secondEndpoint = AutomationSessionEndpoint()
    let firstSession = automationSession(1)
    let secondSession = automationSession(2)
    try await router.register(sessionID: firstSession, endpoint: firstEndpoint)
    try await router.register(sessionID: secondSession, endpoint: secondEndpoint)

    try await withThrowingTaskGroup(of: Void.self) { group in
      for value in 0..<100 {
        group.addTask {
          let target = value.isMultiple(of: 2) ? firstSession : secondSession
          _ = try await router.deliver(
            automationSessionRequest(target: target, command: .focus(value)),
            authorizer: AutomationSessionAuthorizer()
          )
        }
      }
      try await group.waitForAll()
    }

    let firstCommands = await firstEndpoint.receivedCommands()
    let secondCommands = await secondEndpoint.receivedCommands()
    let firstValues = firstCommands.compactMap(\.focusedElement)
    let secondValues = secondCommands.compactMap(\.focusedElement)
    XCTAssertEqual(Set(firstValues), Set(stride(from: 0, to: 100, by: 2)))
    XCTAssertEqual(Set(secondValues), Set(stride(from: 1, to: 100, by: 2)))
  }

  func testConcurrentDuplicateRequestIsDeliveredExactlyOnce() async throws {
    let endpoint = BlockingAutomationSessionEndpoint()
    let router = FlowingAutomationSessionRouter<
      BlockingAutomationSessionEndpoint,
      AutomationSessionCommand
    >()
    let sessionID = automationSession(1)
    try await router.register(sessionID: sessionID, endpoint: endpoint)
    let request = automationSessionRequest(target: sessionID, command: .focus(42))
    let firstDelivery = Task {
      try await router.deliver(request, authorizer: AutomationSessionAuthorizer())
    }
    await endpoint.waitUntilStarted()
    let duplicateDeliveries = Task {
      try await withThrowingTaskGroup(
        of: FlowingAutomationSessionDelivery<AutomationSessionResponse>.self
      ) { group in
        for _ in 0..<100 {
          group.addTask {
            try await router.deliver(
              request,
              authorizer: AutomationSessionAuthorizer()
            )
          }
        }
        return try await group.reduce(into: []) { $0.append($1) }
      }
    }
    for _ in 0..<10 {
      await Task.yield()
    }
    await endpoint.release()

    let firstResult = try await firstDelivery.value
    let duplicateResults = try await duplicateDeliveries.value
    let deliveryCount = await endpoint.deliveryCount()
    XCTAssertFalse(firstResult.isDuplicate)
    XCTAssertTrue(duplicateResults.allSatisfy(\.isDuplicate))
    XCTAssertEqual(deliveryCount, 1)
  }

  func testUnregisterDiscardsCachedAndInFlightSessionIdentity() async throws {
    let router = FlowingAutomationSessionRouter<
      AutomationSessionEndpoint,
      AutomationSessionCommand
    >()
    let firstEndpoint = AutomationSessionEndpoint()
    let secondEndpoint = AutomationSessionEndpoint()
    let sessionID = automationSession(1)
    let request = automationSessionRequest(target: sessionID, command: .focus(7))
    try await router.register(sessionID: sessionID, endpoint: firstEndpoint)
    _ = try await router.deliver(request, authorizer: AutomationSessionAuthorizer())

    await router.unregister(sessionID: sessionID)
    try await router.register(sessionID: sessionID, endpoint: secondEndpoint)
    let replacement = try await router.deliver(
      request,
      authorizer: AutomationSessionAuthorizer()
    )

    let firstCommands = await firstEndpoint.receivedCommands()
    let secondCommands = await secondEndpoint.receivedCommands()
    XCTAssertFalse(replacement.isDuplicate)
    XCTAssertEqual(firstCommands, [.focus(7)])
    XCTAssertEqual(secondCommands, [.focus(7)])
  }

  func testAuthorizationIsRecheckedAfterInFlightEndpointWork() async throws {
    let endpoint = BlockingAutomationSessionEndpoint()
    let router = FlowingAutomationSessionRouter<
      BlockingAutomationSessionEndpoint,
      AutomationSessionCommand
    >()
    let authorizer = MutableAutomationSessionAuthorizer()
    let sessionID = automationSession(1)
    let request = automationSessionRequest(target: sessionID, command: .inspect(7))
    try await router.register(sessionID: sessionID, endpoint: endpoint)
    let delivery = Task {
      try await router.deliver(request, authorizer: authorizer)
    }
    await endpoint.waitUntilStarted()
    authorizer.setDecision(.deny(code: "revoked-in-flight"))
    await endpoint.release()

    do {
      _ = try await delivery.value
      XCTFail("Expected revoked response delivery")
    } catch {
      XCTAssertEqual(
        error as? FlowingAutomationSessionIssue<AutomationSessionFailure>,
        .unauthorized(code: "revoked-in-flight")
      )
    }

    authorizer.setDecision(.allow)
    let retry = try await router.deliver(request, authorizer: authorizer)
    let deliveryCount = await endpoint.deliveryCount()
    XCTAssertTrue(retry.isDuplicate)
    XCTAssertEqual(deliveryCount, 1)
  }

}

private func automationSessionRequest(
  target: FlowingCollaborationSessionID,
  command: AutomationSessionCommand
) -> FlowingAutomationSessionRequest<AutomationSessionCommand> {
  FlowingAutomationSessionRequest(
    participantID: automationParticipant(1),
    targetSessionID: target,
    provenance: .init(origin: .agent, originLabel: "session-test"),
    command: command
  )
}

private enum AutomationSessionCommand: FlowingAutomationSessionCommand {
  case ping
  case focus(Int)
  case inspect(Int)

  var readRequirement: FlowingAutomationSessionReadRequirement<Int> {
    switch self {
    case .ping:
      .none
    case .focus(let elementID), .inspect(let elementID):
      .elements([elementID])
    }
  }

  var focusedElement: Int? {
    guard case .focus(let elementID) = self else { return nil }
    return elementID
  }
}

private struct AutomationSessionResponse: Equatable, Sendable {
  let deliveryCount: Int
}

private enum AutomationSessionFailure: Error, Equatable, Sendable {
  case rejected
}

private actor AutomationSessionEndpoint: FlowingAutomationSessionEndpoint {
  typealias Command = AutomationSessionCommand
  typealias Response = AutomationSessionResponse
  typealias Failure = AutomationSessionFailure

  private var commands: [AutomationSessionCommand] = []

  func handle(
    _ command: AutomationSessionCommand
  ) -> Result<AutomationSessionResponse, AutomationSessionFailure> {
    commands.append(command)
    return .success(AutomationSessionResponse(deliveryCount: commands.count))
  }

  func receivedCommands() -> [AutomationSessionCommand] {
    commands
  }
}

private actor BlockingAutomationSessionEndpoint: FlowingAutomationSessionEndpoint {
  typealias Command = AutomationSessionCommand
  typealias Response = AutomationSessionResponse
  typealias Failure = AutomationSessionFailure

  private var count = 0
  private var isReleased = false
  private var startWaiters: [CheckedContinuation<Void, Never>] = []
  private var releaseWaiters: [CheckedContinuation<Void, Never>] = []

  func handle(
    _ command: AutomationSessionCommand
  ) async -> Result<AutomationSessionResponse, AutomationSessionFailure> {
    count += 1
    let currentStartWaiters = startWaiters
    startWaiters.removeAll(keepingCapacity: false)
    for waiter in currentStartWaiters {
      waiter.resume()
    }
    if !isReleased {
      await withCheckedContinuation { continuation in
        releaseWaiters.append(continuation)
      }
    }
    return .success(AutomationSessionResponse(deliveryCount: count))
  }

  func waitUntilStarted() async {
    if count > 0 { return }
    await withCheckedContinuation { continuation in
      startWaiters.append(continuation)
    }
  }

  func release() {
    isReleased = true
    let currentReleaseWaiters = releaseWaiters
    releaseWaiters.removeAll(keepingCapacity: false)
    for waiter in currentReleaseWaiters {
      waiter.resume()
    }
  }

  func deliveryCount() -> Int {
    count
  }
}

private struct AutomationSessionAuthorizer: FlowingAutomationSessionAuthorizer {
  typealias Command = AutomationSessionCommand

  let decision: FlowingGraphAutomationReadDecision

  init(decision: FlowingGraphAutomationReadDecision = .allow) {
    self.decision = decision
  }

  func authorize(
    _ request: FlowingAutomationSessionRequest<AutomationSessionCommand>
  ) -> FlowingGraphAutomationReadDecision {
    decision
  }
}

private final class MutableAutomationSessionAuthorizer:
  FlowingAutomationSessionAuthorizer,
  @unchecked Sendable
{
  typealias Command = AutomationSessionCommand

  private let lock = NSLock()
  private var decision: FlowingGraphAutomationReadDecision = .allow

  func authorize(
    _ request: FlowingAutomationSessionRequest<AutomationSessionCommand>
  ) -> FlowingGraphAutomationReadDecision {
    lock.lock()
    defer { lock.unlock() }
    return decision
  }

  func setDecision(_ decision: FlowingGraphAutomationReadDecision) {
    lock.lock()
    self.decision = decision
    lock.unlock()
  }
}
