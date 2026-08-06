import FlowingDayGraphCollaboration
import FlowingDayGraphComposition

private enum FlowingGraphAutomationProposalResolution: Sendable {
  case accepting(FlowingCollaborationOperationID)
  case accepted(FlowingCollaborationOperationID)
  case rejected
}

private struct FlowingGraphAutomationProposalEntry<
  Schema: FlowingGraphCollaborationSchema,
  Intent: Equatable & Sendable
>: Sendable {
  let proposal: FlowingGraphAutomationProposal<Schema, Intent>
  var resolution: FlowingGraphAutomationProposalResolution?
}

private struct FlowingGraphAutomationDirectEntry<
  Schema: FlowingGraphCollaborationSchema,
  Intent: Equatable & Sendable
>: Sendable {
  let request: FlowingGraphAutomationDirectRequest<Schema, Intent>
  let envelope: FlowingCollaborationOperationEnvelope<
    FlowingGraphCollaborationOperationSchema<Schema>
  >
  let outcome: FlowingCollaborationTransactionOutcome<
    FlowingGraphCollaborationFailure<Schema>
  >?
}

public actor FlowingGraphAutomationCommandGateway<
  Schema: FlowingGraphCollaborationSchema,
  Compiler: FlowingGraphAutomationIntentCompiler<Schema>
> {
  public typealias OperationSchema = FlowingGraphCollaborationOperationSchema<Schema>
  public typealias Reducer = FlowingGraphCollaborationReducer<Schema>
  public typealias Coordinator = FlowingCollaborationCoordinator<OperationSchema, Reducer>
  public typealias CommandIssue = FlowingGraphAutomationCommandIssue<
    Schema.DocumentID,
    Compiler.Failure
  >

  public let limits: FlowingGraphAutomationLimits

  private let collaboration: Coordinator
  private let compiler: Compiler
  private let auditSink: any FlowingAutomationAuditSink
  private var directRequestsByOperationID:
    [FlowingCollaborationOperationID: FlowingGraphAutomationDirectEntry<
      Schema, Compiler.Intent
    >] = [:]
  private var directRequestsInFlight:
    [FlowingCollaborationOperationID: FlowingGraphAutomationDirectRequest<
      Schema, Compiler.Intent
    >] = [:]
  private var proposals:
    [FlowingCollaborationProposalID: FlowingGraphAutomationProposalEntry<
      Schema, Compiler.Intent
    >] = [:]
  private var proposalOrder: [FlowingCollaborationProposalID] = []

  public init(
    collaboration: Coordinator,
    compiler: Compiler,
    limits: FlowingGraphAutomationLimits = .standard,
    auditSink: any FlowingAutomationAuditSink = FlowingNoOpAutomationAuditSink()
  ) {
    self.collaboration = collaboration
    self.compiler = compiler
    self.limits = limits
    self.auditSink = auditSink
  }

  public func commit<
    Policy: FlowingGraphAutomationCommandAuthorizer<Schema, Compiler.Intent>,
    Authorizer: FlowingCollaborationAuthorizer<OperationSchema>
  >(
    _ request: FlowingGraphAutomationDirectRequest<Schema, Compiler.Intent>,
    policy: Policy,
    authorizer: Authorizer
  ) async throws -> FlowingGraphAutomationCommit<Schema> {
    if let existing = directRequestsByOperationID[request.operationID] {
      guard existing.request == request else {
        throw CommandIssue.operationEquivocation(request.operationID)
      }
      let current = await collaboration.snapshot()
      audit(
        subject: .operation(request.operationID),
        action: .commandCommitted,
        outcome: .duplicate,
        participantID: request.participantID,
        sessionID: request.sessionID,
        provenance: request.provenance,
        version: current.version
      )
      return makeCommit(
        envelope: existing.envelope,
        receipt: FlowingCollaborationAdmissionReceipt(
          operationID: request.operationID,
          status: .duplicate
        ),
        snapshot: current,
        outcome: existing.outcome
      )
    }
    if let inFlight = directRequestsInFlight[request.operationID] {
      guard inFlight == request else {
        throw CommandIssue.operationEquivocation(request.operationID)
      }
      throw CommandIssue.operationInFlight(request.operationID)
    }
    guard directRequestsByOperationID.count + directRequestsInFlight.count
      < limits.maximumCommandHistory
    else {
      throw CommandIssue.commandHistoryLimitExceeded(
        maximum: limits.maximumCommandHistory
      )
    }
    directRequestsInFlight[request.operationID] = request
    defer { directRequestsInFlight.removeValue(forKey: request.operationID) }

    let current = await collaboration.snapshot()
    try validateCommon(
      documentID: request.documentID,
      schemaVersion: request.schemaVersion,
      intents: request.intents,
      current: current
    )
    guard request.baseVersion == current.version else {
      throw CommandIssue.staleBase(expected: request.baseVersion, actual: current.version)
    }
    let authorizationRequest = FlowingGraphAutomationCommandAuthorizationRequest<
      Schema, Compiler.Intent
    >(
      participantID: request.participantID,
      sessionID: request.sessionID,
      documentID: request.documentID,
      baseVersion: request.baseVersion,
      authorization: request.authorization,
      provenance: request.provenance,
      mode: .direct,
      intents: request.intents
    )
    switch policy.authorize(authorizationRequest, at: current.version) {
    case .allowDirect:
      break
    case .requireProposal:
      audit(
        subject: .operation(request.operationID),
        action: .commandCommitted,
        outcome: .failed(code: "proposal_required"),
        participantID: request.participantID,
        sessionID: request.sessionID,
        provenance: request.provenance,
        version: current.version
      )
      throw CommandIssue.proposalRequired
    case .deny(let code):
      audit(
        subject: .operation(request.operationID),
        action: .commandCommitted,
        outcome: .denied(code: code),
        participantID: request.participantID,
        sessionID: request.sessionID,
        provenance: request.provenance,
        version: current.version
      )
      throw CommandIssue.unauthorized(code: code)
    }

    let envelope = try compileEnvelope(request, snapshot: current)
    let result = await collaboration.ingest([envelope], authorizer: authorizer)
    let receipt = result.receipts[0]
    let outcome = result.snapshot.audit.last.flatMap { entry in
      entry.operationID == request.operationID ? entry.outcome : nil
    }
    switch receipt.status {
    case .admitted, .duplicate, .compactedDuplicate:
      directRequestsByOperationID[request.operationID] = FlowingGraphAutomationDirectEntry(
        request: request,
        envelope: envelope,
        outcome: outcome
      )
    case .rejected:
      break
    }
    audit(
      subject: .operation(request.operationID),
      action: .commandCommitted,
      outcome: auditOutcome(receipt: receipt, snapshot: result.snapshot),
      participantID: request.participantID,
      sessionID: request.sessionID,
      provenance: request.provenance,
      version: result.snapshot.version
    )
    return makeCommit(
      envelope: envelope,
      receipt: receipt,
      snapshot: result.snapshot,
      outcome: outcome
    )
  }

  public func propose<Policy: FlowingGraphAutomationCommandAuthorizer<
    Schema, Compiler.Intent
  >>(
    _ request: FlowingGraphAutomationProposalRequest<Schema, Compiler.Intent>,
    at currentTick: UInt64,
    policy: Policy
  ) async throws -> FlowingGraphAutomationProposal<Schema, Compiler.Intent> {
    let proposal = FlowingGraphAutomationProposal<Schema, Compiler.Intent>(
      proposalID: request.proposalID,
      participantID: request.participantID,
      sessionID: request.sessionID,
      documentID: request.documentID,
      baseVersion: request.baseVersion,
      provenance: request.provenance,
      expiresAt: request.expiresAt,
      intents: request.intents
    )
    let existing = proposals[request.proposalID]
    if let existing, existing.proposal != proposal {
      throw CommandIssue.proposalEquivocation(request.proposalID)
    }
    let current = await collaboration.snapshot()
    try validateProposal(request, current: current, currentTick: currentTick)
    let authorizationRequest = FlowingGraphAutomationCommandAuthorizationRequest<
      Schema, Compiler.Intent
    >(
      participantID: request.participantID,
      sessionID: request.sessionID,
      documentID: request.documentID,
      baseVersion: request.baseVersion,
      authorization: request.authorization,
      provenance: request.provenance,
      mode: .proposal,
      intents: request.intents
    )
    switch policy.authorize(authorizationRequest, at: current.version) {
    case .allowDirect, .requireProposal:
      break
    case .deny(let code):
      audit(
        subject: .proposal(request.proposalID),
        action: .proposalCreated,
        outcome: .denied(code: code),
        participantID: request.participantID,
        sessionID: request.sessionID,
        provenance: request.provenance,
        version: current.version
      )
      throw CommandIssue.unauthorized(code: code)
    }
    if let existing {
      audit(
        subject: .proposal(request.proposalID),
        action: .proposalCreated,
        outcome: .duplicate,
        participantID: request.participantID,
        sessionID: request.sessionID,
        provenance: request.provenance,
        version: current.version
      )
      return existing.proposal
    }

    evictResolvedProposalsIfNeeded()
    guard proposals.count < limits.maximumProposals else {
      throw CommandIssue.proposalLimitExceeded(maximum: limits.maximumProposals)
    }
    proposals[proposal.proposalID] = FlowingGraphAutomationProposalEntry(
      proposal: proposal,
      resolution: nil
    )
    proposalOrder.append(proposal.proposalID)
    audit(
      subject: .proposal(request.proposalID),
      action: .proposalCreated,
      outcome: .succeeded,
      participantID: request.participantID,
      sessionID: request.sessionID,
      provenance: request.provenance,
      version: current.version
    )
    return proposal
  }

  public func accept<
    Policy: FlowingGraphAutomationCommandAuthorizer<Schema, Compiler.Intent>,
    Authorizer: FlowingCollaborationAuthorizer<OperationSchema>
  >(
    _ acceptance: FlowingGraphAutomationProposalAcceptance<Schema>,
    at currentTick: UInt64,
    policy: Policy,
    authorizer: Authorizer
  ) async throws -> FlowingGraphAutomationCommit<Schema> {
    guard let entry = proposals[acceptance.proposalID] else {
      throw CommandIssue.unknownProposal(acceptance.proposalID)
    }
    switch entry.resolution {
    case .accepting:
      throw CommandIssue.proposalAlreadyResolved(acceptance.proposalID)
    case .accepted(let operationID) where operationID == acceptance.operationID:
      break
    case .accepted, .rejected:
      throw CommandIssue.proposalAlreadyResolved(acceptance.proposalID)
    case nil:
      break
    }
    if let expiresAt = entry.proposal.expiresAt, expiresAt <= currentTick {
      throw CommandIssue.expiredProposal(acceptance.proposalID)
    }

    let request = FlowingGraphAutomationDirectRequest<Schema, Compiler.Intent>(
      operationID: acceptance.operationID,
      transactionID: acceptance.transactionID,
      participantID: acceptance.participantID,
      sessionID: acceptance.sessionID,
      documentID: acceptance.documentID,
      baseVersion: entry.proposal.baseVersion,
      schemaVersion: acceptance.schemaVersion,
      authorization: acceptance.authorization,
      provenance: acceptance.provenance,
      intents: entry.proposal.intents
    )
    proposals[acceptance.proposalID]?.resolution = .accepting(acceptance.operationID)
    let result: FlowingGraphAutomationCommit<Schema>
    do {
      result = try await commit(request, policy: policy, authorizer: authorizer)
    } catch {
      if case .accepting(acceptance.operationID) = proposals[acceptance.proposalID]?.resolution {
        proposals[acceptance.proposalID]?.resolution = nil
      }
      throw error
    }
    if result.receipt.status == .admitted || result.receipt.status == .duplicate {
      if result.outcome == .applied {
        proposals[acceptance.proposalID]?.resolution = .accepted(
          acceptance.operationID
        )
      }
    }
    if case .accepting(acceptance.operationID) = proposals[acceptance.proposalID]?.resolution {
      proposals[acceptance.proposalID]?.resolution = nil
    }
    audit(
      subject: .proposal(acceptance.proposalID),
      action: .proposalAccepted,
      outcome: result.outcome == .applied
        ? .succeeded
        : .failed(code: "proposal_not_applied"),
      participantID: acceptance.participantID,
      sessionID: acceptance.sessionID,
      provenance: acceptance.provenance,
      version: result.snapshotID.version
    )
    return result
  }

  public func reject<Policy: FlowingGraphAutomationCommandAuthorizer<
    Schema, Compiler.Intent
  >>(
    proposalID: FlowingCollaborationProposalID,
    participantID: FlowingParticipantID,
    sessionID: FlowingCollaborationSessionID,
    authorization: FlowingCollaborationAuthorizationContext = .init(),
    provenance: FlowingCollaborationProvenance,
    policy: Policy
  ) async throws {
    guard let entry = proposals[proposalID] else {
      throw CommandIssue.unknownProposal(proposalID)
    }
    guard entry.resolution == nil else {
      throw CommandIssue.proposalAlreadyResolved(proposalID)
    }
    let current = await collaboration.snapshot()
    let request = FlowingGraphAutomationCommandAuthorizationRequest<
      Schema, Compiler.Intent
    >(
      participantID: participantID,
      sessionID: sessionID,
      documentID: entry.proposal.documentID,
      baseVersion: entry.proposal.baseVersion,
      authorization: authorization,
      provenance: provenance,
      mode: .proposal,
      intents: entry.proposal.intents
    )
    if case .deny(let code) = policy.authorize(request, at: current.version) {
      audit(
        subject: .proposal(proposalID),
        action: .proposalRejected,
        outcome: .denied(code: code),
        participantID: participantID,
        sessionID: sessionID,
        provenance: provenance,
        version: current.version
      )
      throw CommandIssue.unauthorized(code: code)
    }
    proposals[proposalID]?.resolution = .rejected
    audit(
      subject: .proposal(proposalID),
      action: .proposalRejected,
      outcome: .succeeded,
      participantID: participantID,
      sessionID: sessionID,
      provenance: provenance,
      version: current.version
    )
  }

  private func validateCommon(
    documentID: Schema.DocumentID,
    schemaVersion: FlowingCollaborationSchemaVersion,
    intents: [Compiler.Intent],
    current: FlowingCollaborationSnapshot<
      Schema.DocumentID,
      FlowingGraphCollaborationState<Schema>,
      FlowingGraphCollaborationFailure<Schema>
    >
  ) throws {
    guard documentID == current.documentID else {
      throw CommandIssue.wrongDocument(
        expected: current.documentID,
        actual: documentID
      )
    }
    guard schemaVersion == current.schemaVersion else {
      throw CommandIssue.unsupportedSchemaVersion(
        expected: current.schemaVersion,
        actual: schemaVersion
      )
    }
    guard !intents.isEmpty else { throw CommandIssue.emptyIntent }
    guard intents.count <= limits.maximumIntentsPerRequest else {
      throw CommandIssue.intentLimitExceeded(
        maximum: limits.maximumIntentsPerRequest,
        actual: intents.count
      )
    }
  }

  private func validateProposal(
    _ request: FlowingGraphAutomationProposalRequest<Schema, Compiler.Intent>,
    current: FlowingCollaborationSnapshot<
      Schema.DocumentID,
      FlowingGraphCollaborationState<Schema>,
      FlowingGraphCollaborationFailure<Schema>
    >,
    currentTick: UInt64
  ) throws {
    guard request.documentID == current.documentID else {
      throw CommandIssue.wrongDocument(
        expected: current.documentID,
        actual: request.documentID
      )
    }
    guard !request.intents.isEmpty else { throw CommandIssue.emptyIntent }
    guard request.intents.count <= limits.maximumProposalIntents else {
      throw CommandIssue.intentLimitExceeded(
        maximum: limits.maximumProposalIntents,
        actual: request.intents.count
      )
    }
    if let expiresAt = request.expiresAt, expiresAt <= currentTick {
      throw CommandIssue.expiredProposal(request.proposalID)
    }
    guard current.version.dominates(request.baseVersion) else {
      throw CommandIssue.unknownBase
    }
  }

  private func compileEnvelope(
    _ request: FlowingGraphAutomationDirectRequest<Schema, Compiler.Intent>,
    snapshot: FlowingCollaborationSnapshot<
      Schema.DocumentID,
      FlowingGraphCollaborationState<Schema>,
      FlowingGraphCollaborationFailure<Schema>
    >
  ) throws -> FlowingCollaborationOperationEnvelope<OperationSchema> {
    let commands: [FlowingGraphCollaborationCommand<Schema>]
    switch compiler.compile(
      request.intents,
      operationID: request.operationID,
      snapshot: snapshot
    ) {
    case .success(let compiled):
      commands = compiled
    case .failure(let failure):
      throw CommandIssue.compilation(failure)
    }
    return FlowingCollaborationOperationEnvelope(
      operationID: request.operationID,
      transactionID: request.transactionID,
      participantID: request.participantID,
      replicaID: request.operationID.replicaID,
      sessionID: request.sessionID,
      documentID: request.documentID,
      dependencies: request.baseVersion,
      schemaVersion: request.schemaVersion,
      authorization: request.authorization,
      provenance: request.provenance,
      compensates: request.compensates,
      commands: commands
    )
  }

  private func evictResolvedProposalsIfNeeded() {
    while proposals.count >= limits.maximumProposals,
      let candidateIndex = proposalOrder.firstIndex(where: {
        proposals[$0]?.resolution != nil
      })
    {
      let proposalID = proposalOrder.remove(at: candidateIndex)
      proposals.removeValue(forKey: proposalID)
    }
  }

  private func makeCommit(
    envelope: FlowingCollaborationOperationEnvelope<OperationSchema>,
    receipt: FlowingCollaborationAdmissionReceipt<Schema.DocumentID>,
    snapshot: FlowingCollaborationSnapshot<
      Schema.DocumentID,
      FlowingGraphCollaborationState<Schema>,
      FlowingGraphCollaborationFailure<Schema>
    >,
    outcome: FlowingCollaborationTransactionOutcome<
      FlowingGraphCollaborationFailure<Schema>
    >?
  ) -> FlowingGraphAutomationCommit<Schema> {
    FlowingGraphAutomationCommit(
      envelope: envelope,
      receipt: receipt,
      snapshotID: FlowingAutomationSnapshotID(snapshot),
      outcome: outcome
    )
  }

  private func auditOutcome(
    receipt: FlowingCollaborationAdmissionReceipt<Schema.DocumentID>,
    snapshot: FlowingCollaborationSnapshot<
      Schema.DocumentID,
      FlowingGraphCollaborationState<Schema>,
      FlowingGraphCollaborationFailure<Schema>
    >
  ) -> FlowingAutomationAuditOutcome {
    switch receipt.status {
    case .duplicate, .compactedDuplicate:
      return .duplicate
    case .rejected:
      return .failed(code: "collaboration_rejected")
    case .admitted:
      guard let outcome = snapshot.audit.last.flatMap({ entry in
        entry.operationID == receipt.operationID ? entry.outcome : nil
      }) else {
        return .failed(code: "missing_transaction_outcome")
      }
      switch outcome {
      case .applied:
        return .succeeded
      case .rejected:
        return .failed(code: "transaction_rejected")
      }
    }
  }

  private func audit(
    subject: FlowingAutomationAuditSubject,
    action: FlowingAutomationAuditAction,
    outcome: FlowingAutomationAuditOutcome,
    participantID: FlowingParticipantID,
    sessionID: FlowingCollaborationSessionID,
    provenance: FlowingCollaborationProvenance,
    version: FlowingCausalVersion
  ) {
    auditSink.record(
      FlowingAutomationAuditEvent(
        subject: subject,
        action: action,
        outcome: outcome,
        participantID: participantID,
        sessionID: sessionID,
        provenance: provenance,
        version: version
      )
    )
  }
}
