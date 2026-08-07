import FlowingDayGraphCollaboration
import Foundation

public struct FlowingAutomationSessionReadRequirement<ElementID: Hashable & Sendable>:
  Equatable,
  Sendable
{
  public let includesSessionState: Bool
  public let includesPresentation: Bool
  public let elementIDs: Set<ElementID>

  public init(
    includesSessionState: Bool = false,
    includesPresentation: Bool = false,
    elementIDs: Set<ElementID> = []
  ) {
    self.includesSessionState = includesSessionState
    self.includesPresentation = includesPresentation
    self.elementIDs = elementIDs
  }

  public static var none: Self { Self() }
  public static var sessionState: Self { Self(includesSessionState: true) }
  public static var presentation: Self { Self(includesPresentation: true) }

  public static func elements(_ elementIDs: Set<ElementID>) -> Self {
    Self(elementIDs: elementIDs)
  }
}

public protocol FlowingAutomationSessionCommand: Equatable, Sendable {
  associatedtype ElementID: Hashable & Sendable

  var readRequirement: FlowingAutomationSessionReadRequirement<ElementID> { get }
}

public struct FlowingAutomationSessionRequest<Command: FlowingAutomationSessionCommand>:
  Equatable,
  Sendable
{
  public let requestID: FlowingAutomationSessionRequestID
  public let participantID: FlowingParticipantID
  public let targetSessionID: FlowingCollaborationSessionID
  public let authorization: FlowingCollaborationAuthorizationContext
  public let provenance: FlowingCollaborationProvenance
  public let command: Command

  public init(
    requestID: FlowingAutomationSessionRequestID = .init(),
    participantID: FlowingParticipantID,
    targetSessionID: FlowingCollaborationSessionID,
    authorization: FlowingCollaborationAuthorizationContext = .init(),
    provenance: FlowingCollaborationProvenance,
    command: Command
  ) {
    self.requestID = requestID
    self.participantID = participantID
    self.targetSessionID = targetSessionID
    self.authorization = authorization
    self.provenance = provenance
    self.command = command
  }
}

public protocol FlowingAutomationSessionAuthorizer<Command>: Sendable
where Command: FlowingAutomationSessionCommand {
  associatedtype Command

  func authorize(
    _ request: FlowingAutomationSessionRequest<Command>
  ) -> FlowingGraphAutomationReadDecision
}

public struct FlowingAllowAllAutomationSessionAuthorizer<
  Command: FlowingAutomationSessionCommand
>: FlowingAutomationSessionAuthorizer {
  public init() {}

  public func authorize(
    _ request: FlowingAutomationSessionRequest<Command>
  ) -> FlowingGraphAutomationReadDecision {
    .allow
  }
}

public protocol FlowingAutomationSessionEndpoint<Command>: Sendable
where Command: FlowingAutomationSessionCommand {
  associatedtype Command
  associatedtype Response: Equatable & Sendable
  associatedtype Failure: Error & Equatable & Sendable

  func handle(_ command: Command) async -> Result<Response, Failure>
}

public struct FlowingAutomationSessionDelivery<Response: Equatable & Sendable>:
  Equatable,
  Sendable
{
  public let requestID: FlowingAutomationSessionRequestID
  public let response: Response
  public let isDuplicate: Bool

  public init(
    requestID: FlowingAutomationSessionRequestID,
    response: Response,
    isDuplicate: Bool
  ) {
    self.requestID = requestID
    self.response = response
    self.isDuplicate = isDuplicate
  }
}

public enum FlowingAutomationSessionIssue<Failure: Error & Equatable & Sendable>:
  Error,
  Equatable,
  Sendable
{
  case unknownSession(FlowingCollaborationSessionID)
  case duplicateSession(FlowingCollaborationSessionID)
  case endpointLimitExceeded(maximum: Int)
  case requestHistoryLimitExceeded(maximum: Int)
  case requestEquivocation(FlowingAutomationSessionRequestID)
  case unauthorized(code: String)
  case endpoint(Failure)
}

private struct FlowingAutomationSessionRequestEntry<
  Command: FlowingAutomationSessionCommand,
  Response: Equatable & Sendable,
  Failure: Error & Equatable & Sendable
>: Sendable {
  let request: FlowingAutomationSessionRequest<Command>
  let result: Result<Response, Failure>
}

private struct FlowingAutomationSessionInFlightEntry<
  Command: FlowingAutomationSessionCommand,
  Response: Equatable & Sendable,
  Failure: Error & Equatable & Sendable
>: Sendable {
  let token: UUID
  let request: FlowingAutomationSessionRequest<Command>
  let task: Task<Result<Response, Failure>, Never>
}

public actor FlowingAutomationSessionRouter<
  Endpoint: FlowingAutomationSessionEndpoint<Command>,
  Command: FlowingAutomationSessionCommand
> {
  public let limits: FlowingGraphAutomationLimits

  private var endpoints: [FlowingCollaborationSessionID: Endpoint] = [:]
  private var requestHistory:
    [FlowingAutomationSessionRequestID: FlowingAutomationSessionRequestEntry<
      Command, Endpoint.Response, Endpoint.Failure
    >] = [:]
  private var inFlightRequests:
    [FlowingAutomationSessionRequestID: FlowingAutomationSessionInFlightEntry<
      Command, Endpoint.Response, Endpoint.Failure
    >] = [:]
  private let auditSink: any FlowingAutomationAuditSink

  public init(
    limits: FlowingGraphAutomationLimits = .standard,
    auditSink: any FlowingAutomationAuditSink = FlowingNoOpAutomationAuditSink()
  ) {
    self.limits = limits
    self.auditSink = auditSink
  }

  public func register(
    sessionID: FlowingCollaborationSessionID,
    endpoint: Endpoint
  ) throws {
    guard endpoints[sessionID] == nil else {
      throw FlowingAutomationSessionIssue<Endpoint.Failure>.duplicateSession(sessionID)
    }
    guard endpoints.count < limits.maximumSessionEndpoints else {
      throw FlowingAutomationSessionIssue<Endpoint.Failure>.endpointLimitExceeded(
        maximum: limits.maximumSessionEndpoints
      )
    }
    endpoints[sessionID] = endpoint
  }

  public func unregister(sessionID: FlowingCollaborationSessionID) {
    endpoints.removeValue(forKey: sessionID)
    requestHistory = requestHistory.filter {
      $0.value.request.targetSessionID != sessionID
    }
    let inFlightIDs = inFlightRequests.compactMap { requestID, entry in
      entry.request.targetSessionID == sessionID ? requestID : nil
    }
    for requestID in inFlightIDs {
      inFlightRequests.removeValue(forKey: requestID)?.task.cancel()
    }
  }

  public func deliver<Authorizer: FlowingAutomationSessionAuthorizer<Command>>(
    _ request: FlowingAutomationSessionRequest<Command>,
    authorizer: Authorizer
  ) async throws -> FlowingAutomationSessionDelivery<Endpoint.Response> {
    let existing = requestHistory[request.requestID]
    if let existing, existing.request != request {
      audit(request, outcome: .failed(code: "request_equivocation"))
      throw FlowingAutomationSessionIssue<Endpoint.Failure>.requestEquivocation(
        request.requestID
      )
    }
    let inFlight = inFlightRequests[request.requestID]
    if let inFlight, inFlight.request != request {
      audit(request, outcome: .failed(code: "request_equivocation"))
      throw FlowingAutomationSessionIssue<Endpoint.Failure>.requestEquivocation(
        request.requestID
      )
    }
    try authorize(request, authorizer: authorizer)
    if let existing {
      return try duplicateDelivery(request: request, result: existing.result)
    }
    if let inFlight {
      let result = await inFlight.task.value
      try authorize(request, authorizer: authorizer)
      if let completed = requestHistory[request.requestID] {
        return try duplicateDelivery(request: request, result: completed.result)
      }
      guard inFlightRequests[request.requestID]?.token == inFlight.token else {
        audit(request, outcome: .failed(code: "session_unregistered"))
        throw FlowingAutomationSessionIssue<Endpoint.Failure>.unknownSession(
          request.targetSessionID
        )
      }
      return try duplicateDelivery(request: request, result: result)
    }
    guard
      requestHistory.count + inFlightRequests.count
        < limits.maximumSessionRequestHistory
    else {
      throw FlowingAutomationSessionIssue<Endpoint.Failure>
        .requestHistoryLimitExceeded(maximum: limits.maximumSessionRequestHistory)
    }
    guard let endpoint = endpoints[request.targetSessionID] else {
      audit(request, outcome: .failed(code: "unknown_session"))
      throw FlowingAutomationSessionIssue<Endpoint.Failure>.unknownSession(
        request.targetSessionID
      )
    }
    let token = UUID()
    let task = Task { await endpoint.handle(request.command) }
    inFlightRequests[request.requestID] = FlowingAutomationSessionInFlightEntry(
      token: token,
      request: request,
      task: task
    )
    let result = await task.value
    guard inFlightRequests[request.requestID]?.token == token else {
      audit(request, outcome: .failed(code: "session_unregistered"))
      throw FlowingAutomationSessionIssue<Endpoint.Failure>.unknownSession(
        request.targetSessionID
      )
    }
    inFlightRequests.removeValue(forKey: request.requestID)
    requestHistory[request.requestID] = FlowingAutomationSessionRequestEntry(
      request: request,
      result: result
    )
    try authorize(request, authorizer: authorizer)
    let response: Endpoint.Response
    switch result {
    case .success(let value):
      response = value
    case .failure(let failure):
      audit(request, outcome: .failed(code: "endpoint_failure"))
      throw FlowingAutomationSessionIssue<Endpoint.Failure>.endpoint(failure)
    }
    audit(request, outcome: .succeeded)
    return FlowingAutomationSessionDelivery(
      requestID: request.requestID,
      response: response,
      isDuplicate: false
    )
  }

  private func duplicateDelivery(
    request: FlowingAutomationSessionRequest<Command>,
    result: Result<Endpoint.Response, Endpoint.Failure>
  ) throws -> FlowingAutomationSessionDelivery<Endpoint.Response> {
    switch result {
    case .success(let response):
      audit(request, outcome: .duplicate)
      return FlowingAutomationSessionDelivery(
        requestID: request.requestID,
        response: response,
        isDuplicate: true
      )
    case .failure(let failure):
      audit(request, outcome: .failed(code: "endpoint_failure"))
      throw FlowingAutomationSessionIssue<Endpoint.Failure>.endpoint(failure)
    }
  }

  private func authorize<Authorizer: FlowingAutomationSessionAuthorizer<Command>>(
    _ request: FlowingAutomationSessionRequest<Command>,
    authorizer: Authorizer
  ) throws {
    switch authorizer.authorize(request) {
    case .allow:
      break
    case .deny(let code):
      audit(request, outcome: .denied(code: code))
      throw FlowingAutomationSessionIssue<Endpoint.Failure>.unauthorized(code: code)
    }
  }

  private func audit(
    _ request: FlowingAutomationSessionRequest<Command>,
    outcome: FlowingAutomationAuditOutcome
  ) {
    auditSink.record(
      FlowingAutomationAuditEvent(
        subject: .sessionRequest(request.requestID),
        action: .sessionCommandDelivered,
        outcome: outcome,
        participantID: request.participantID,
        sessionID: request.targetSessionID,
        provenance: request.provenance
      )
    )
  }
}
