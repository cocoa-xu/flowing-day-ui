public struct FlowingCollaborationSubmission<
  Schema: FlowingCollaborationSchema
>: Sendable {
  public let envelope: FlowingCollaborationOperationEnvelope<Schema>
  public let receipt: FlowingCollaborationAdmissionReceipt<Schema.DocumentID>
}

public enum FlowingCollaborationCoordinatorIssue: Error, Equatable, Sendable {
  case operationCounterExhausted
}

public actor FlowingCollaborationCoordinator<
  Schema: FlowingCollaborationSchema,
  Reducer: FlowingCollaborationReducer<Schema>
> {
  public let replicaID: FlowingReplicaID

  private var replica: FlowingCollaborationReplica<Schema, Reducer>
  private var state: Reducer.State
  private var version: FlowingCausalVersion
  private var operationOrder: [FlowingCollaborationOperationID]
  private var audit: [FlowingCollaborationAuditEntry<Reducer.Failure>]
  private var pendingOperations: [FlowingCollaborationPendingOperation]

  public init(
    replicaID: FlowingReplicaID = .init(),
    replica: FlowingCollaborationReplica<Schema, Reducer>
  ) {
    self.replicaID = replicaID
    self.replica = replica
    let snapshot = replica.materialize()
    state = snapshot.state
    version = snapshot.version
    operationOrder = snapshot.operationOrder
    audit = snapshot.audit
    pendingOperations = snapshot.pendingOperations
  }

  public func snapshot() -> FlowingCollaborationSnapshot<
    Schema.DocumentID,
    Reducer.State,
    Reducer.Failure
  > {
    makeSnapshot()
  }

  public func ingest<Authorizer: FlowingCollaborationAuthorizer<Schema>>(
    _ envelopes: [FlowingCollaborationOperationEnvelope<Schema>],
    authorizer: Authorizer
  ) -> FlowingCollaborationSnapshot<Schema.DocumentID, Reducer.State, Reducer.Failure> {
    _ = replica.ingest(envelopes, authorizer: authorizer)
    replaceCache(with: replica.materialize())
    return makeSnapshot()
  }

  public func ingest(
    _ envelopes: [FlowingCollaborationOperationEnvelope<Schema>]
  ) -> FlowingCollaborationSnapshot<Schema.DocumentID, Reducer.State, Reducer.Failure> {
    _ = replica.ingest(envelopes)
    replaceCache(with: replica.materialize())
    return makeSnapshot()
  }

  public func submit<Authorizer: FlowingCollaborationAuthorizer<Schema>>(
    participantID: FlowingParticipantID,
    sessionID: FlowingCollaborationSessionID,
    authorization: FlowingCollaborationAuthorizationContext = .init(),
    provenance: FlowingCollaborationProvenance = .unspecified,
    compensates: Set<FlowingCollaborationOperationID> = [],
    authorizer: Authorizer,
    commands: @Sendable (FlowingCollaborationOperationID) throws -> [Schema.Command]
  ) throws -> FlowingCollaborationSubmission<Schema> {
    let counter = version[replicaID]
    guard counter < UInt64.max else {
      throw FlowingCollaborationCoordinatorIssue.operationCounterExhausted
    }
    let operationID = FlowingCollaborationOperationID(
      replicaID: replicaID,
      counter: counter + 1
    )
    let envelope = FlowingCollaborationOperationEnvelope<Schema>(
      operationID: operationID,
      participantID: participantID,
      replicaID: replicaID,
      sessionID: sessionID,
      documentID: replica.documentID,
      dependencies: version,
      schemaVersion: replica.schemaVersion,
      authorization: authorization,
      provenance: provenance,
      compensates: compensates,
      commands: try commands(operationID)
    )
    let receipt = replica.ingest([envelope], authorizer: authorizer)[0]
    if receipt.status == .admitted, pendingOperations.isEmpty {
      appendToCache(envelope)
    } else if receipt.status == .admitted {
      replaceCache(with: replica.materialize())
    }
    return FlowingCollaborationSubmission(envelope: envelope, receipt: receipt)
  }

  public func submit(
    participantID: FlowingParticipantID,
    sessionID: FlowingCollaborationSessionID,
    authorization: FlowingCollaborationAuthorizationContext = .init(),
    provenance: FlowingCollaborationProvenance = .unspecified,
    compensates: Set<FlowingCollaborationOperationID> = [],
    commands: @Sendable (FlowingCollaborationOperationID) throws -> [Schema.Command]
  ) throws -> FlowingCollaborationSubmission<Schema> {
    try submit(
      participantID: participantID,
      sessionID: sessionID,
      authorization: authorization,
      provenance: provenance,
      compensates: compensates,
      authorizer: FlowingAllowAllCollaborationAuthorizer<Schema>(),
      commands: commands
    )
  }

  private func appendToCache(_ envelope: FlowingCollaborationOperationEnvelope<Schema>) {
    let outcome: FlowingCollaborationTransactionOutcome<Reducer.Failure>
    switch replica.reducer.applying(envelope, to: state) {
    case .success(let nextState):
      state = nextState
      outcome = .applied
    case .failure(let failure):
      outcome = .rejected(failure)
    }
    version.record(envelope.operationID)
    operationOrder.append(envelope.operationID)
    audit.append(
      FlowingCollaborationAuditEntry(
        operationID: envelope.operationID,
        transactionID: envelope.transactionID,
        participantID: envelope.participantID,
        replicaID: envelope.replicaID,
        sessionID: envelope.sessionID,
        dependencies: envelope.dependencies,
        provenance: envelope.provenance,
        compensates: envelope.compensates,
        outcome: outcome
      )
    )
  }

  private func replaceCache(
    with snapshot: FlowingCollaborationSnapshot<
      Schema.DocumentID,
      Reducer.State,
      Reducer.Failure
    >
  ) {
    state = snapshot.state
    version = snapshot.version
    operationOrder = snapshot.operationOrder
    audit = snapshot.audit
    pendingOperations = snapshot.pendingOperations
  }

  private func makeSnapshot() -> FlowingCollaborationSnapshot<
    Schema.DocumentID,
    Reducer.State,
    Reducer.Failure
  > {
    FlowingCollaborationSnapshot(
      documentID: replica.documentID,
      schemaVersion: replica.schemaVersion,
      reducerIdentity: replica.reducer.identity,
      state: state,
      version: version,
      operationOrder: operationOrder,
      audit: audit,
      pendingOperations: pendingOperations
    )
  }
}
