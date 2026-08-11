import FlowingDayGraphAutomation
import FlowingDayGraphCollaboration
import XCTest

final class FlowingAutomationTaskCoordinatorTests: XCTestCase {
  func testTaskPublishesMonotonicProgressAndTerminalResult() async throws {
    let gate = AutomationTaskGate()
    let probe = AutomationTaskProbe()
    let coordinator = FlowingAutomationTaskCoordinator(
      executor: AutomationTaskExecutor(gate: gate, probe: probe)
    )
    let request = automationTaskRequest(value: 21)

    let start = try await coordinator.start(
      request,
      authorizer: AutomationTaskAuthorizer()
    )
    XCTAssertFalse(start.isDuplicate)
    await probe.waitUntilStarted()

    let running = try await coordinator.poll(
      automationTaskAccess(request),
      maximumProgressEvents: 10,
      authorizer: AutomationTaskAuthorizer()
    )
    XCTAssertEqual(running.status.state, .running)
    XCTAssertEqual(running.progress.map(\.sequence), [1])
    XCTAssertEqual(running.progress.map(\.completedUnitCount), [1])

    await gate.open()
    let completed = try await waitForAutomationTask(
      coordinator,
      request: request
    )
    XCTAssertEqual(completed.status.state, .succeeded(42))
    XCTAssertEqual(completed.progress.map(\.sequence), [1, 2])
    XCTAssertEqual(completed.progress.map(\.completedUnitCount), [1, 2])
  }

  func testDuplicateStartIsIdempotentAndEquivocationIsRejected() async throws {
    let gate = AutomationTaskGate()
    let probe = AutomationTaskProbe()
    let coordinator = FlowingAutomationTaskCoordinator(
      executor: AutomationTaskExecutor(gate: gate, probe: probe)
    )
    let request = automationTaskRequest(value: 1)
    _ = try await coordinator.start(request, authorizer: AutomationTaskAuthorizer())
    let duplicate = try await coordinator.start(
      request,
      authorizer: AutomationTaskAuthorizer()
    )
    XCTAssertTrue(duplicate.isDuplicate)

    let conflicting = FlowingAutomationTaskRequest(
      taskID: request.taskID,
      access: request.access,
      provenance: request.provenance,
      payload: 2
    )
    await assertThrowsErrorAsync(
      try await coordinator.start(
        conflicting,
        authorizer: AutomationTaskAuthorizer()
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingAutomationTaskIssue,
        .taskEquivocation(request.taskID)
      )
    }
    await gate.open()
  }

  func testAuthorizationIsRecheckedForDuplicatePollAndCancel() async throws {
    let gate = AutomationTaskGate()
    let probe = AutomationTaskProbe()
    let coordinator = FlowingAutomationTaskCoordinator(
      executor: AutomationTaskExecutor(gate: gate, probe: probe)
    )
    let request = automationTaskRequest(value: 1)
    _ = try await coordinator.start(request, authorizer: AutomationTaskAuthorizer())
    await probe.waitUntilStarted()

    await assertThrowsErrorAsync(
      try await coordinator.start(
        request,
        authorizer: AutomationTaskAuthorizer(startDecision: .deny(code: "revoked"))
      )
    ) { error in
      XCTAssertEqual(error as? FlowingAutomationTaskIssue, .unauthorized(code: "revoked"))
    }
    await assertThrowsErrorAsync(
      try await coordinator.poll(
        automationTaskAccess(request),
        maximumProgressEvents: 1,
        authorizer: AutomationTaskAuthorizer(accessDecision: .deny(code: "revoked"))
      )
    ) { error in
      XCTAssertEqual(error as? FlowingAutomationTaskIssue, .unauthorized(code: "revoked"))
    }
    await assertThrowsErrorAsync(
      try await coordinator.cancel(
        automationTaskAccess(request),
        authorizer: AutomationTaskAuthorizer(accessDecision: .deny(code: "revoked"))
      )
    ) { error in
      XCTAssertEqual(error as? FlowingAutomationTaskIssue, .unauthorized(code: "revoked"))
    }
    await gate.open()
  }

  func testCancellationCannotBeOverwrittenByLateSuccess() async throws {
    let gate = AutomationTaskGate()
    let probe = AutomationTaskProbe()
    let coordinator = FlowingAutomationTaskCoordinator(
      executor: AutomationTaskExecutor(gate: gate, probe: probe)
    )
    let request = automationTaskRequest(value: 10)
    _ = try await coordinator.start(request, authorizer: AutomationTaskAuthorizer())
    await probe.waitUntilStarted()

    let cancelling = try await coordinator.cancel(
      automationTaskAccess(request),
      authorizer: AutomationTaskAuthorizer()
    )
    XCTAssertTrue(cancelling.cancellationRequested)
    await gate.open()

    let terminal = try await waitForAutomationTask(coordinator, request: request)
    XCTAssertEqual(terminal.status.state, .cancelled)
    let repeated = try await coordinator.cancel(
      automationTaskAccess(request),
      authorizer: AutomationTaskAuthorizer()
    )
    XCTAssertEqual(repeated.state, .cancelled)
  }

  func testProgressAndParticipantTaskLimitsAreEnforced() async throws {
    let gate = AutomationTaskGate()
    let probe = AutomationTaskProbe()
    let limits = automationTaskLimits(maximumActiveTasks: 1, maximumProgressEvents: 1)
    let coordinator = FlowingAutomationTaskCoordinator(
      executor: AutomationTaskExecutor(gate: gate, probe: probe),
      limits: limits
    )
    let first = automationTaskRequest(task: 1, value: 1)
    let second = automationTaskRequest(task: 2, value: 2)
    _ = try await coordinator.start(first, authorizer: AutomationTaskAuthorizer())
    await probe.waitUntilStarted()

    await assertThrowsErrorAsync(
      try await coordinator.start(second, authorizer: AutomationTaskAuthorizer())
    ) { error in
      XCTAssertEqual(
        error as? FlowingAutomationTaskIssue,
        .activeTaskLimitExceeded(maximum: 1)
      )
    }
    await gate.open()
    let terminal = try await waitForAutomationTask(
      coordinator,
      request: first,
      maximumProgressEvents: 1
    )
    XCTAssertEqual(terminal.status.state, .succeeded(2))
    XCTAssertEqual(terminal.progress.count, 1)
  }

  func testDifferentParticipantsCanUseTheirIndependentTaskQuota() async throws {
    let gate = AutomationTaskGate()
    let probe = AutomationTaskProbe()
    let coordinator = FlowingAutomationTaskCoordinator(
      executor: AutomationTaskExecutor(gate: gate, probe: probe),
      limits: automationTaskLimits(maximumActiveTasks: 1)
    )
    let first = automationTaskRequest(task: 1, participant: 1, value: 1)
    let second = automationTaskRequest(task: 2, participant: 2, value: 2)

    _ = try await coordinator.start(first, authorizer: AutomationTaskAuthorizer())
    _ = try await coordinator.start(second, authorizer: AutomationTaskAuthorizer())
    await gate.open()

    let firstResult = try await waitForAutomationTask(coordinator, request: first)
    let secondResult = try await waitForAutomationTask(coordinator, request: second)
    XCTAssertEqual(firstResult.status.state, .succeeded(2))
    XCTAssertEqual(secondResult.status.state, .succeeded(4))
  }

  func testInvalidProgressIsRejectedAndTerminalRetentionIsBounded() async throws {
    let progressCoordinator = FlowingAutomationTaskCoordinator(
      executor: InvalidProgressTaskExecutor()
    )
    let progressRequest = automationTaskRequest(value: 1)
    _ = try await progressCoordinator.start(
      progressRequest,
      authorizer: AutomationTaskAuthorizer()
    )
    var progressResult:
      FlowingAutomationTaskPollResult<
        [FlowingAutomationTaskContextIssue],
        AutomationTaskFailure
      >?
    for _ in 0..<1_000 {
      let result = try await progressCoordinator.poll(
        automationTaskAccess(progressRequest),
        maximumProgressEvents: 10,
        authorizer: AutomationTaskAuthorizer()
      )
      if result.status.state.isTerminal {
        progressResult = result
        break
      }
      await Task.yield()
    }
    XCTAssertEqual(
      progressResult?.status.state,
      .succeeded([.invalidProgress, .invalidProgress])
    )

    let retentionCoordinator = FlowingAutomationTaskCoordinator(
      executor: ImmediateAutomationTaskExecutor(),
      limits: automationTaskLimits(maximumRetainedTasks: 1)
    )
    let first = automationTaskRequest(task: 1, value: 1)
    let second = automationTaskRequest(task: 2, value: 2)
    _ = try await retentionCoordinator.start(
      first,
      authorizer: AutomationTaskAuthorizer()
    )
    try await waitForImmediateAutomationTask(retentionCoordinator, request: first)
    _ = try await retentionCoordinator.start(
      second,
      authorizer: AutomationTaskAuthorizer()
    )

    await assertThrowsErrorAsync(
      try await retentionCoordinator.poll(
        automationTaskAccess(first),
        maximumProgressEvents: 1,
        authorizer: AutomationTaskAuthorizer()
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingAutomationTaskIssue,
        .unknownTask(first.taskID)
      )
    }
  }
}

private func automationTaskRequest(
  task: Int = 1,
  participant: Int = 1,
  value: Int
) -> FlowingAutomationTaskRequest<Int> {
  FlowingAutomationTaskRequest(
    taskID: FlowingAutomationTaskID(rawValue: automationUUID(4_000 + task)),
    access: automationContext(participant: participant, session: participant),
    provenance: .init(origin: .agent, originLabel: "task-test"),
    payload: value
  )
}

private func automationTaskAccess(
  _ request: FlowingAutomationTaskRequest<Int>
) -> FlowingAutomationTaskAccessRequest {
  FlowingAutomationTaskAccessRequest(
    taskID: request.taskID,
    access: request.access
  )
}

private func waitForAutomationTask(
  _ coordinator: FlowingAutomationTaskCoordinator<AutomationTaskExecutor>,
  request: FlowingAutomationTaskRequest<Int>,
  maximumProgressEvents: Int = 10
) async throws -> FlowingAutomationTaskPollResult<Int, AutomationTaskFailure> {
  for _ in 0..<1_000 {
    let result = try await coordinator.poll(
      automationTaskAccess(request),
      maximumProgressEvents: maximumProgressEvents,
      authorizer: AutomationTaskAuthorizer()
    )
    if result.status.state.isTerminal {
      return result
    }
    await Task.yield()
  }
  XCTFail("Task did not reach a terminal state")
  return try await coordinator.poll(
    automationTaskAccess(request),
    maximumProgressEvents: maximumProgressEvents,
    authorizer: AutomationTaskAuthorizer()
  )
}

private enum AutomationTaskFailure: Error, Equatable, Sendable {
  case rejected
}

private struct AutomationTaskExecutor: FlowingAutomationTaskExecutor {
  let gate: AutomationTaskGate
  let probe: AutomationTaskProbe

  func execute(
    _ payload: Int,
    context: FlowingAutomationTaskContext
  ) async -> FlowingAutomationTaskExecutionResult<Int, AutomationTaskFailure> {
    try? await context.reportProgress(
      completedUnitCount: 1,
      totalUnitCount: 2,
      message: "Started"
    )
    await probe.markStarted()
    await gate.wait()
    if await context.isCancellationRequested {
      return .cancelled
    }
    try? await context.reportProgress(
      completedUnitCount: 2,
      totalUnitCount: 2,
      message: "Completed"
    )
    return .succeeded(payload * 2)
  }
}

private struct InvalidProgressTaskExecutor: FlowingAutomationTaskExecutor {
  typealias Payload = Int
  typealias Output = [FlowingAutomationTaskContextIssue]
  typealias Failure = AutomationTaskFailure

  func execute(
    _ payload: Int,
    context: FlowingAutomationTaskContext
  ) async -> FlowingAutomationTaskExecutionResult<Output, Failure> {
    var issues: [FlowingAutomationTaskContextIssue] = []
    try? await context.reportProgress(
      completedUnitCount: 2,
      totalUnitCount: 4
    )
    do {
      try await context.reportProgress(
        completedUnitCount: 1,
        totalUnitCount: 4
      )
    } catch let issue as FlowingAutomationTaskContextIssue {
      issues.append(issue)
    } catch {}
    do {
      try await context.reportProgress(
        completedUnitCount: 5,
        totalUnitCount: 4
      )
    } catch let issue as FlowingAutomationTaskContextIssue {
      issues.append(issue)
    } catch {}
    return .succeeded(issues)
  }
}

private struct ImmediateAutomationTaskExecutor: FlowingAutomationTaskExecutor {
  typealias Payload = Int
  typealias Output = Int
  typealias Failure = AutomationTaskFailure

  func execute(
    _ payload: Int,
    context: FlowingAutomationTaskContext
  ) async -> FlowingAutomationTaskExecutionResult<Int, AutomationTaskFailure> {
    .succeeded(payload)
  }
}

private func waitForImmediateAutomationTask(
  _ coordinator: FlowingAutomationTaskCoordinator<ImmediateAutomationTaskExecutor>,
  request: FlowingAutomationTaskRequest<Int>
) async throws {
  for _ in 0..<1_000 {
    let result = try await coordinator.poll(
      automationTaskAccess(request),
      maximumProgressEvents: 1,
      authorizer: AutomationTaskAuthorizer()
    )
    if result.status.state.isTerminal {
      return
    }
    await Task.yield()
  }
  XCTFail("Task did not reach a terminal state")
}

private actor AutomationTaskGate {
  private var isOpen = false
  private var waiters: [CheckedContinuation<Void, Never>] = []

  func wait() async {
    if isOpen { return }
    await withCheckedContinuation { continuation in
      waiters.append(continuation)
    }
  }

  func open() {
    isOpen = true
    let currentWaiters = waiters
    waiters.removeAll(keepingCapacity: false)
    for waiter in currentWaiters {
      waiter.resume()
    }
  }
}

private actor AutomationTaskProbe {
  private var startedCount = 0
  private var startWaiters: [CheckedContinuation<Void, Never>] = []

  func markStarted() {
    startedCount += 1
    let waiters = startWaiters
    startWaiters.removeAll(keepingCapacity: false)
    for waiter in waiters {
      waiter.resume()
    }
  }

  func waitUntilStarted() async {
    if startedCount > 0 { return }
    await withCheckedContinuation { continuation in
      startWaiters.append(continuation)
    }
  }
}

private struct AutomationTaskAuthorizer: FlowingAutomationTaskAuthorizer {
  typealias Payload = Int

  let startDecision: FlowingGraphAutomationReadDecision
  let accessDecision: FlowingGraphAutomationReadDecision

  init(
    startDecision: FlowingGraphAutomationReadDecision = .allow,
    accessDecision: FlowingGraphAutomationReadDecision = .allow
  ) {
    self.startDecision = startDecision
    self.accessDecision = accessDecision
  }

  func authorize(
    _ action: FlowingAutomationTaskAction,
    request: FlowingAutomationTaskRequest<Int>,
    access: FlowingAutomationAccessContext
  ) -> FlowingGraphAutomationReadDecision {
    action == .start ? startDecision : accessDecision
  }
}

private func automationTaskLimits(
  maximumActiveTasks: Int = 32,
  maximumRetainedTasks: Int = 10,
  maximumProgressEvents: Int = 10
) -> FlowingGraphAutomationLimits {
  FlowingGraphAutomationLimits(
    maximumRetainedSnapshots: 2,
    maximumCursorsPerParticipant: 2,
    maximumPinnedSnapshotsPerParticipant: 2,
    cursorTimeToLive: 10,
    maximumPageSize: 10,
    maximumQueryResults: 100,
    maximumQueryWork: 1_000,
    maximumTraversalDepth: 10,
    maximumIntentsPerRequest: 10,
    maximumCommandHistory: 10,
    maximumProposals: 10,
    maximumProposalIntents: 10,
    maximumSessionEndpoints: 10,
    maximumSessionRequestHistory: 10,
    maximumActiveTasksPerParticipant: maximumActiveTasks,
    maximumRetainedTasks: maximumRetainedTasks,
    maximumProgressEventsPerTask: maximumProgressEvents
  )
}
