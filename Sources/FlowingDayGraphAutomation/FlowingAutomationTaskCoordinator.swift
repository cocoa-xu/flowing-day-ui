import FlowingDayGraphCollaboration

public enum FlowingAutomationTaskAction: Equatable, Sendable {
  case start
  case read
  case cancel
}

public struct FlowingAutomationTaskRequest<Payload: Equatable & Sendable>:
  Equatable,
  Sendable
{
  public let taskID: FlowingAutomationTaskID
  public let access: FlowingAutomationAccessContext
  public let provenance: FlowingCollaborationProvenance
  public let payload: Payload

  public init(
    taskID: FlowingAutomationTaskID = .init(),
    access: FlowingAutomationAccessContext,
    provenance: FlowingCollaborationProvenance,
    payload: Payload
  ) {
    self.taskID = taskID
    self.access = access
    self.provenance = provenance
    self.payload = payload
  }
}

public struct FlowingAutomationTaskAccessRequest: Equatable, Sendable {
  public let taskID: FlowingAutomationTaskID
  public let access: FlowingAutomationAccessContext

  public init(
    taskID: FlowingAutomationTaskID,
    access: FlowingAutomationAccessContext
  ) {
    self.taskID = taskID
    self.access = access
  }
}

public protocol FlowingAutomationTaskAuthorizer<Payload>: Sendable
where Payload: Equatable & Sendable {
  associatedtype Payload

  func authorize(
    _ action: FlowingAutomationTaskAction,
    request: FlowingAutomationTaskRequest<Payload>,
    access: FlowingAutomationAccessContext
  ) -> FlowingGraphAutomationReadDecision
}

public struct FlowingAllowAllAutomationTaskAuthorizer<Payload: Equatable & Sendable>:
  FlowingAutomationTaskAuthorizer
{
  public init() {}

  public func authorize(
    _ action: FlowingAutomationTaskAction,
    request: FlowingAutomationTaskRequest<Payload>,
    access: FlowingAutomationAccessContext
  ) -> FlowingGraphAutomationReadDecision {
    .allow
  }
}

public struct FlowingAutomationTaskProgress: Equatable, Sendable {
  public let sequence: UInt64
  public let completedUnitCount: UInt64
  public let totalUnitCount: UInt64?
  public let message: String?

  public init(
    sequence: UInt64,
    completedUnitCount: UInt64,
    totalUnitCount: UInt64? = nil,
    message: String? = nil
  ) {
    self.sequence = sequence
    self.completedUnitCount = completedUnitCount
    self.totalUnitCount = totalUnitCount
    self.message = message
  }
}

public enum FlowingAutomationTaskExecutionResult<Output, Failure>: Sendable
where Output: Equatable & Sendable, Failure: Error & Equatable & Sendable {
  case succeeded(Output)
  case failed(Failure)
  case cancelled
}

extension FlowingAutomationTaskExecutionResult: Equatable {}

public struct FlowingAutomationTaskContext: Sendable {
  public let taskID: FlowingAutomationTaskID

  private let progressHandler:
    @Sendable (UInt64, UInt64?, String?) async -> Result<Void, FlowingAutomationTaskContextIssue>
  private let cancellationHandler: @Sendable () async -> Bool

  init(
    taskID: FlowingAutomationTaskID,
    progressHandler: @escaping @Sendable (
      UInt64,
      UInt64?,
      String?
    ) async -> Result<Void, FlowingAutomationTaskContextIssue>,
    cancellationHandler: @escaping @Sendable () async -> Bool
  ) {
    self.taskID = taskID
    self.progressHandler = progressHandler
    self.cancellationHandler = cancellationHandler
  }

  public func reportProgress(
    completedUnitCount: UInt64,
    totalUnitCount: UInt64? = nil,
    message: String? = nil
  ) async throws {
    try await progressHandler(
      completedUnitCount,
      totalUnitCount,
      message
    ).get()
  }

  public var isCancellationRequested: Bool {
    get async {
      if Task.isCancelled {
        return true
      }
      return await cancellationHandler()
    }
  }

  public func checkCancellation() async throws {
    if await isCancellationRequested {
      throw CancellationError()
    }
  }
}

public enum FlowingAutomationTaskContextIssue: Error, Equatable, Sendable {
  case taskNotRunning
  case invalidProgress
  case progressLimitExceeded(maximum: Int)
}

public protocol FlowingAutomationTaskExecutor<Payload>: Sendable
where Payload: Equatable & Sendable {
  associatedtype Payload
  associatedtype Output: Equatable & Sendable
  associatedtype Failure: Error & Equatable & Sendable

  func execute(
    _ payload: Payload,
    context: FlowingAutomationTaskContext
  ) async -> FlowingAutomationTaskExecutionResult<Output, Failure>
}

public enum FlowingAutomationTaskState<Output, Failure>: Sendable
where Output: Equatable & Sendable, Failure: Error & Equatable & Sendable {
  case queued
  case running
  case succeeded(Output)
  case failed(Failure)
  case cancelled

  public var isTerminal: Bool {
    switch self {
    case .queued, .running:
      false
    case .succeeded, .failed, .cancelled:
      true
    }
  }
}

extension FlowingAutomationTaskState: Equatable {}

public struct FlowingAutomationTaskStatus<Output, Failure>: Equatable, Sendable
where Output: Equatable & Sendable, Failure: Error & Equatable & Sendable {
  public let taskID: FlowingAutomationTaskID
  public let state: FlowingAutomationTaskState<Output, Failure>
  public let cancellationRequested: Bool
  public let latestProgressSequence: UInt64

  public init(
    taskID: FlowingAutomationTaskID,
    state: FlowingAutomationTaskState<Output, Failure>,
    cancellationRequested: Bool,
    latestProgressSequence: UInt64
  ) {
    self.taskID = taskID
    self.state = state
    self.cancellationRequested = cancellationRequested
    self.latestProgressSequence = latestProgressSequence
  }
}

public struct FlowingAutomationTaskStartResult<Output, Failure>: Equatable, Sendable
where Output: Equatable & Sendable, Failure: Error & Equatable & Sendable {
  public let status: FlowingAutomationTaskStatus<Output, Failure>
  public let isDuplicate: Bool

  public init(
    status: FlowingAutomationTaskStatus<Output, Failure>,
    isDuplicate: Bool
  ) {
    self.status = status
    self.isDuplicate = isDuplicate
  }
}

public struct FlowingAutomationTaskPollResult<Output, Failure>: Equatable, Sendable
where Output: Equatable & Sendable, Failure: Error & Equatable & Sendable {
  public let status: FlowingAutomationTaskStatus<Output, Failure>
  public let progress: [FlowingAutomationTaskProgress]

  public init(
    status: FlowingAutomationTaskStatus<Output, Failure>,
    progress: [FlowingAutomationTaskProgress]
  ) {
    self.status = status
    self.progress = progress
  }
}

public enum FlowingAutomationTaskIssue: Error, Equatable, Sendable {
  case unknownTask(FlowingAutomationTaskID)
  case taskEquivocation(FlowingAutomationTaskID)
  case unauthorized(code: String)
  case activeTaskLimitExceeded(maximum: Int)
  case retainedTaskLimitExceeded(maximum: Int)
  case invalidProgressPageSize
}

private struct FlowingAutomationTaskRecord<Executor: FlowingAutomationTaskExecutor>:
  Sendable
{
  let request: FlowingAutomationTaskRequest<Executor.Payload>
  var state: FlowingAutomationTaskState<Executor.Output, Executor.Failure>
  var cancellationRequested = false
  var progress: [FlowingAutomationTaskProgress] = []
}

public actor FlowingAutomationTaskCoordinator<Executor: FlowingAutomationTaskExecutor> {
  public let limits: FlowingGraphAutomationLimits

  private let executor: Executor
  private let auditSink: any FlowingAutomationAuditSink
  private var records: [FlowingAutomationTaskID: FlowingAutomationTaskRecord<Executor>] = [:]
  private var taskOrder: [FlowingAutomationTaskID] = []
  private var executions: [FlowingAutomationTaskID: Task<Void, Never>] = [:]

  public init(
    executor: Executor,
    limits: FlowingGraphAutomationLimits = .standard,
    auditSink: any FlowingAutomationAuditSink = FlowingNoOpAutomationAuditSink()
  ) {
    self.executor = executor
    self.limits = limits
    self.auditSink = auditSink
  }

  deinit {
    for execution in executions.values {
      execution.cancel()
    }
  }

  public func start<Authorizer: FlowingAutomationTaskAuthorizer<Executor.Payload>>(
    _ request: FlowingAutomationTaskRequest<Executor.Payload>,
    authorizer: Authorizer
  ) throws -> FlowingAutomationTaskStartResult<Executor.Output, Executor.Failure> {
    if let existing = records[request.taskID] {
      guard existing.request == request else {
        throw FlowingAutomationTaskIssue.taskEquivocation(request.taskID)
      }
      try authorize(
        .start,
        request: request,
        access: request.access,
        authorizer: authorizer
      )
      audit(
        request: request,
        action: .taskStarted,
        outcome: .duplicate
      )
      return FlowingAutomationTaskStartResult(
        status: status(for: existing),
        isDuplicate: true
      )
    }
    try authorize(
      .start,
      request: request,
      access: request.access,
      authorizer: authorizer
    )
    trimTerminalRecords()
    guard records.count < limits.maximumRetainedTasks else {
      throw FlowingAutomationTaskIssue.retainedTaskLimitExceeded(
        maximum: limits.maximumRetainedTasks
      )
    }
    let activeCount = records.values.reduce(into: 0) { count, record in
      if record.request.access.participantID == request.access.participantID,
        !record.state.isTerminal
      {
        count += 1
      }
    }
    guard activeCount < limits.maximumActiveTasksPerParticipant else {
      throw FlowingAutomationTaskIssue.activeTaskLimitExceeded(
        maximum: limits.maximumActiveTasksPerParticipant
      )
    }
    let record = FlowingAutomationTaskRecord<Executor>(
      request: request,
      state: .queued
    )
    records[request.taskID] = record
    taskOrder.append(request.taskID)
    executions[request.taskID] = Task { [weak self, executor] in
      guard let payload = await self?.beginExecution(taskID: request.taskID) else {
        return
      }
      let context = FlowingAutomationTaskContext(
        taskID: request.taskID,
        progressHandler: { [weak self] completed, total, message in
          guard let self else { return .failure(.taskNotRunning) }
          return await self.recordProgress(
            taskID: request.taskID,
            completedUnitCount: completed,
            totalUnitCount: total,
            message: message
          )
        },
        cancellationHandler: { [weak self] in
          guard let self else { return true }
          return await self.isCancellationRequested(taskID: request.taskID)
        }
      )
      let result = await executor.execute(payload, context: context)
      await self?.finish(taskID: request.taskID, result: result)
    }
    audit(
      request: request,
      action: .taskStarted,
      outcome: .succeeded
    )
    return FlowingAutomationTaskStartResult(
      status: status(for: record),
      isDuplicate: false
    )
  }

  public func poll<Authorizer: FlowingAutomationTaskAuthorizer<Executor.Payload>>(
    _ request: FlowingAutomationTaskAccessRequest,
    after progressSequence: UInt64? = nil,
    maximumProgressEvents: Int,
    authorizer: Authorizer
  ) throws -> FlowingAutomationTaskPollResult<Executor.Output, Executor.Failure> {
    guard maximumProgressEvents > 0,
      maximumProgressEvents <= limits.maximumProgressEventsPerTask
    else {
      throw FlowingAutomationTaskIssue.invalidProgressPageSize
    }
    guard let record = records[request.taskID] else {
      throw FlowingAutomationTaskIssue.unknownTask(request.taskID)
    }
    try authorize(.read, request: record.request, access: request.access, authorizer: authorizer)
    let progress = record.progress.lazy
      .filter { event in
        guard let progressSequence else { return true }
        return event.sequence > progressSequence
      }
      .prefix(maximumProgressEvents)
    let result = FlowingAutomationTaskPollResult(
      status: status(for: record),
      progress: Array(progress)
    )
    audit(request: record.request, action: .taskRead, outcome: .succeeded)
    return result
  }

  @discardableResult
  public func cancel<Authorizer: FlowingAutomationTaskAuthorizer<Executor.Payload>>(
    _ request: FlowingAutomationTaskAccessRequest,
    authorizer: Authorizer
  ) throws -> FlowingAutomationTaskStatus<Executor.Output, Executor.Failure> {
    guard var record = records[request.taskID] else {
      throw FlowingAutomationTaskIssue.unknownTask(request.taskID)
    }
    try authorize(.cancel, request: record.request, access: request.access, authorizer: authorizer)
    guard !record.state.isTerminal else {
      audit(
        request: record.request,
        action: .taskCancellationRequested,
        outcome: .duplicate
      )
      return status(for: record)
    }
    record.cancellationRequested = true
    records[request.taskID] = record
    executions[request.taskID]?.cancel()
    audit(
      request: record.request,
      action: .taskCancellationRequested,
      outcome: .succeeded
    )
    return status(for: record)
  }

  private func beginExecution(taskID: FlowingAutomationTaskID) -> Executor.Payload? {
    guard var record = records[taskID], !record.cancellationRequested else {
      finish(taskID: taskID, result: .cancelled)
      return nil
    }
    record.state = .running
    records[taskID] = record
    return record.request.payload
  }

  private func finish(
    taskID: FlowingAutomationTaskID,
    result: FlowingAutomationTaskExecutionResult<Executor.Output, Executor.Failure>
  ) {
    guard var record = records[taskID], !record.state.isTerminal else { return }
    if record.cancellationRequested {
      record.state = .cancelled
    } else {
      switch result {
      case .succeeded(let output):
        record.state = .succeeded(output)
      case .failed(let failure):
        record.state = .failed(failure)
      case .cancelled:
        record.state = .cancelled
      }
    }
    records[taskID] = record
    executions.removeValue(forKey: taskID)
    let outcome: FlowingAutomationAuditOutcome
    switch record.state {
    case .queued, .running:
      return
    case .succeeded:
      outcome = .succeeded
    case .failed:
      outcome = .failed(code: "executor_failure")
    case .cancelled:
      outcome = .cancelled
    }
    audit(request: record.request, action: .taskCompleted, outcome: outcome)
  }

  private func recordProgress(
    taskID: FlowingAutomationTaskID,
    completedUnitCount: UInt64,
    totalUnitCount: UInt64?,
    message: String?
  ) -> Result<Void, FlowingAutomationTaskContextIssue> {
    guard var record = records[taskID], case .running = record.state else {
      return .failure(.taskNotRunning)
    }
    guard !record.cancellationRequested,
      totalUnitCount.map({ completedUnitCount <= $0 }) ?? true,
      record.progress.last.map({ completedUnitCount >= $0.completedUnitCount }) ?? true
    else {
      return .failure(.invalidProgress)
    }
    guard record.progress.count < limits.maximumProgressEventsPerTask else {
      return .failure(
        .progressLimitExceeded(maximum: limits.maximumProgressEventsPerTask)
      )
    }
    let sequence = (record.progress.last?.sequence ?? 0) + 1
    record.progress.append(
      FlowingAutomationTaskProgress(
        sequence: sequence,
        completedUnitCount: completedUnitCount,
        totalUnitCount: totalUnitCount,
        message: message
      )
    )
    records[taskID] = record
    return .success(())
  }

  private func isCancellationRequested(taskID: FlowingAutomationTaskID) -> Bool {
    records[taskID]?.cancellationRequested ?? true
  }

  private func authorize<Authorizer: FlowingAutomationTaskAuthorizer<Executor.Payload>>(
    _ action: FlowingAutomationTaskAction,
    request: FlowingAutomationTaskRequest<Executor.Payload>,
    access: FlowingAutomationAccessContext,
    authorizer: Authorizer
  ) throws {
    switch authorizer.authorize(action, request: request, access: access) {
    case .allow:
      break
    case .deny(let code):
      audit(
        request: request,
        action: auditAction(for: action),
        outcome: .denied(code: code)
      )
      throw FlowingAutomationTaskIssue.unauthorized(code: code)
    }
  }

  private func status(
    for record: FlowingAutomationTaskRecord<Executor>
  ) -> FlowingAutomationTaskStatus<Executor.Output, Executor.Failure> {
    FlowingAutomationTaskStatus(
      taskID: record.request.taskID,
      state: record.state,
      cancellationRequested: record.cancellationRequested,
      latestProgressSequence: record.progress.last?.sequence ?? 0
    )
  }

  private func trimTerminalRecords() {
    while records.count >= limits.maximumRetainedTasks,
      let index = taskOrder.firstIndex(where: { taskID in
        records[taskID]?.state.isTerminal == true
      })
    {
      let taskID = taskOrder.remove(at: index)
      records.removeValue(forKey: taskID)
      executions.removeValue(forKey: taskID)?.cancel()
    }
  }

  private func auditAction(
    for action: FlowingAutomationTaskAction
  ) -> FlowingAutomationAuditAction {
    switch action {
    case .start:
      .taskStarted
    case .read:
      .taskRead
    case .cancel:
      .taskCancellationRequested
    }
  }

  private func audit(
    request: FlowingAutomationTaskRequest<Executor.Payload>,
    action: FlowingAutomationAuditAction,
    outcome: FlowingAutomationAuditOutcome
  ) {
    auditSink.record(
      FlowingAutomationAuditEvent(
        subject: .task(request.taskID),
        action: action,
        outcome: outcome,
        participantID: request.access.participantID,
        sessionID: request.access.sessionID,
        provenance: request.provenance
      )
    )
  }
}
