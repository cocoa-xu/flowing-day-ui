import Foundation

public struct FlowingCollaborationReducerIdentity: Hashable, Sendable {
  public let id: UUID
  public let revision: UInt64

  public init(id: UUID = UUID(), revision: UInt64 = 0) {
    self.id = id
    self.revision = revision
  }
}

public protocol FlowingCollaborationReducer<Schema>: Sendable {
  associatedtype Schema: FlowingCollaborationSchema
  associatedtype State: Sendable
  associatedtype Failure: Error & Equatable & Sendable

  var identity: FlowingCollaborationReducerIdentity { get }

  func applying(
    _ envelope: FlowingCollaborationOperationEnvelope<Schema>,
    to state: State
  ) -> Result<State, Failure>
}

public enum FlowingCollaborationAdmissionIssue<DocumentID: Hashable & Sendable>:
  Error,
  Equatable,
  Sendable
{
  case wrongDocument(expected: DocumentID, actual: DocumentID)
  case unsupportedSchemaVersion(
    expected: FlowingCollaborationSchemaVersion,
    actual: FlowingCollaborationSchemaVersion
  )
  case operationReplicaMismatch
  case invalidOperationCounter
  case invalidReplicaSequence(expectedDependency: UInt64, actualDependency: UInt64)
  case emptyOperation
  case commandLimitExceeded(maximum: Int, actual: Int)
  case causalEntryLimitExceeded(maximum: Int, actual: Int)
  case ingestLimitExceeded(maximum: Int, actual: Int)
  case historyLimitExceeded(maximum: Int)
  case pendingLimitExceeded(maximum: Int, actual: Int)
  case operationEquivocation(FlowingCollaborationOperationID)
  case transactionEquivocation(FlowingCollaborationTransactionID)
  case unauthorized(code: String)
}

public enum FlowingCollaborationAdmissionStatus<DocumentID: Hashable & Sendable>:
  Equatable,
  Sendable
{
  case admitted
  case duplicate
  case compactedDuplicate
  case rejected(FlowingCollaborationAdmissionIssue<DocumentID>)
}

public struct FlowingCollaborationAdmissionReceipt<DocumentID: Hashable & Sendable>:
  Equatable,
  Sendable
{
  public let operationID: FlowingCollaborationOperationID
  public let status: FlowingCollaborationAdmissionStatus<DocumentID>

  public init(
    operationID: FlowingCollaborationOperationID,
    status: FlowingCollaborationAdmissionStatus<DocumentID>
  ) {
    self.operationID = operationID
    self.status = status
  }
}

public enum FlowingCollaborationTransactionOutcome<Failure: Error & Equatable & Sendable>:
  Equatable,
  Sendable
{
  case applied
  case rejected(Failure)
}

public struct FlowingCollaborationAuditEntry<Failure: Error & Equatable & Sendable>:
  Equatable,
  Sendable
{
  public let operationID: FlowingCollaborationOperationID
  public let transactionID: FlowingCollaborationTransactionID
  public let participantID: FlowingParticipantID
  public let replicaID: FlowingReplicaID
  public let sessionID: FlowingCollaborationSessionID
  public let dependencies: FlowingCausalVersion
  public let provenance: FlowingCollaborationProvenance
  public let compensates: Set<FlowingCollaborationOperationID>
  public let outcome: FlowingCollaborationTransactionOutcome<Failure>
}

public struct FlowingCollaborationPendingOperation: Equatable, Sendable {
  public let operationID: FlowingCollaborationOperationID
  public let missingDependencies: [FlowingCollaborationOperationID]
  public let isCausallyBlocked: Bool
}

public struct FlowingCollaborationSnapshot<
  DocumentID: Hashable & Sendable,
  State: Sendable,
  Failure: Error & Equatable & Sendable
>: Sendable {
  public let documentID: DocumentID
  public let schemaVersion: FlowingCollaborationSchemaVersion
  public let reducerIdentity: FlowingCollaborationReducerIdentity
  public let state: State
  public let version: FlowingCausalVersion
  public let operationOrder: [FlowingCollaborationOperationID]
  public let audit: [FlowingCollaborationAuditEntry<Failure>]
  public let pendingOperations: [FlowingCollaborationPendingOperation]
}

public struct FlowingCollaborationCheckpoint<
  DocumentID: Hashable & Sendable,
  State: Sendable
>: Sendable {
  public let documentID: DocumentID
  public let schemaVersion: FlowingCollaborationSchemaVersion
  public let reducerIdentity: FlowingCollaborationReducerIdentity
  public let state: State
  public let version: FlowingCausalVersion

  init<Failure>(
    snapshot: FlowingCollaborationSnapshot<DocumentID, State, Failure>
  ) where Failure: Error & Equatable & Sendable {
    documentID = snapshot.documentID
    schemaVersion = snapshot.schemaVersion
    reducerIdentity = snapshot.reducerIdentity
    state = snapshot.state
    version = snapshot.version
  }
}

public enum FlowingCollaborationCheckpointIssue: Error, Equatable, Sendable {
  case incompatibleDocument
  case incompatibleSchemaVersion
  case incompatibleReducer
  case checkpointPrecedesBase
}

public struct FlowingCollaborationReplica<
  Schema: FlowingCollaborationSchema,
  Reducer: FlowingCollaborationReducer<Schema>
>: Sendable {
  public let documentID: Schema.DocumentID
  public let schemaVersion: FlowingCollaborationSchemaVersion
  public let reducer: Reducer
  public let limits: FlowingCollaborationLimits

  private var baseState: Reducer.State
  private var baseVersion: FlowingCausalVersion
  private var envelopesByID: [
    FlowingCollaborationOperationID: FlowingCollaborationOperationEnvelope<Schema>
  ] = [:]
  private var operationIDByTransactionID: [
    FlowingCollaborationTransactionID: FlowingCollaborationOperationID
  ] = [:]

  public init(
    documentID: Schema.DocumentID,
    schemaVersion: FlowingCollaborationSchemaVersion,
    initialState: Reducer.State,
    reducer: Reducer,
    limits: FlowingCollaborationLimits = .standard
  ) {
    self.documentID = documentID
    self.schemaVersion = schemaVersion
    self.reducer = reducer
    self.limits = limits
    baseState = initialState
    baseVersion = .init()
  }

  public var admittedOperationCount: Int {
    envelopesByID.count
  }

  public mutating func ingest<Authorizer: FlowingCollaborationAuthorizer<Schema>>(
    _ envelopes: [FlowingCollaborationOperationEnvelope<Schema>],
    authorizer: Authorizer
  ) -> [FlowingCollaborationAdmissionReceipt<Schema.DocumentID>] {
    guard envelopes.count <= limits.maximumOperationsPerIngest else {
      let issue = FlowingCollaborationAdmissionIssue<Schema.DocumentID>.ingestLimitExceeded(
        maximum: limits.maximumOperationsPerIngest,
        actual: envelopes.count
      )
      return envelopes.map {
        FlowingCollaborationAdmissionReceipt(
          operationID: $0.operationID,
          status: .rejected(issue)
        )
      }
    }

    let originalEnvelopes = envelopesByID
    let originalTransactionIndex = operationIDByTransactionID
    let authorizationVersion = causalOrder().version
    var receipts: [FlowingCollaborationAdmissionReceipt<Schema.DocumentID>] = []
    var admittedReceiptIndices: [Int] = []
    receipts.reserveCapacity(envelopes.count)

    for envelope in envelopes {
      let status = admissionStatus(
        for: envelope,
        authorizer: authorizer,
        authorizationVersion: authorizationVersion
      )
      if status == .admitted {
        envelopesByID[envelope.operationID] = envelope
        operationIDByTransactionID[envelope.transactionID] = envelope.operationID
        admittedReceiptIndices.append(receipts.count)
      }
      receipts.append(
        FlowingCollaborationAdmissionReceipt(
          operationID: envelope.operationID,
          status: status
        )
      )
    }

    let pendingCount = causalOrder().pending.count
    guard pendingCount <= limits.maximumPendingOperations else {
      envelopesByID = originalEnvelopes
      operationIDByTransactionID = originalTransactionIndex
      let issue = FlowingCollaborationAdmissionIssue<Schema.DocumentID>.pendingLimitExceeded(
        maximum: limits.maximumPendingOperations,
        actual: pendingCount
      )
      for index in admittedReceiptIndices {
        receipts[index] = FlowingCollaborationAdmissionReceipt(
          operationID: receipts[index].operationID,
          status: .rejected(issue)
        )
      }
      return receipts
    }

    return receipts
  }

  public mutating func ingest(
    _ envelopes: [FlowingCollaborationOperationEnvelope<Schema>]
  ) -> [FlowingCollaborationAdmissionReceipt<Schema.DocumentID>] {
    ingest(envelopes, authorizer: FlowingAllowAllCollaborationAuthorizer<Schema>())
  }

  public func materialize() -> FlowingCollaborationSnapshot<
    Schema.DocumentID,
    Reducer.State,
    Reducer.Failure
  > {
    let order = causalOrder()
    var state = baseState
    var audit: [FlowingCollaborationAuditEntry<Reducer.Failure>] = []
    audit.reserveCapacity(order.operationIDs.count)

    for operationID in order.operationIDs {
      let envelope = envelopesByID[operationID]!
      let outcome: FlowingCollaborationTransactionOutcome<Reducer.Failure>
      switch reducer.applying(envelope, to: state) {
      case .success(let nextState):
        state = nextState
        outcome = .applied
      case .failure(let failure):
        outcome = .rejected(failure)
      }
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

    return FlowingCollaborationSnapshot(
      documentID: documentID,
      schemaVersion: schemaVersion,
      reducerIdentity: reducer.identity,
      state: state,
      version: order.version,
      operationOrder: order.operationIDs,
      audit: audit,
      pendingOperations: order.pending
    )
  }

  public func checkpoint(
    from snapshot: FlowingCollaborationSnapshot<
      Schema.DocumentID,
      Reducer.State,
      Reducer.Failure
    >
  ) -> FlowingCollaborationCheckpoint<Schema.DocumentID, Reducer.State> {
    FlowingCollaborationCheckpoint(snapshot: snapshot)
  }

  public mutating func compact(
    through checkpoint: FlowingCollaborationCheckpoint<Schema.DocumentID, Reducer.State>
  ) throws {
    guard checkpoint.documentID == documentID else {
      throw FlowingCollaborationCheckpointIssue.incompatibleDocument
    }
    guard checkpoint.schemaVersion == schemaVersion else {
      throw FlowingCollaborationCheckpointIssue.incompatibleSchemaVersion
    }
    guard checkpoint.reducerIdentity == reducer.identity else {
      throw FlowingCollaborationCheckpointIssue.incompatibleReducer
    }
    guard checkpoint.version.dominates(baseVersion) else {
      throw FlowingCollaborationCheckpointIssue.checkpointPrecedesBase
    }

    baseState = checkpoint.state
    baseVersion = checkpoint.version
    envelopesByID = envelopesByID.filter { !checkpoint.version.observes($0.key) }
    operationIDByTransactionID = Dictionary(
      uniqueKeysWithValues: envelopesByID.values.map { ($0.transactionID, $0.operationID) }
    )
  }

  private func admissionStatus<Authorizer: FlowingCollaborationAuthorizer<Schema>>(
    for envelope: FlowingCollaborationOperationEnvelope<Schema>,
    authorizer: Authorizer,
    authorizationVersion: FlowingCausalVersion
  ) -> FlowingCollaborationAdmissionStatus<Schema.DocumentID> {
    if envelope.documentID != documentID {
      return .rejected(.wrongDocument(expected: documentID, actual: envelope.documentID))
    }
    if envelope.schemaVersion != schemaVersion {
      return .rejected(
        .unsupportedSchemaVersion(expected: schemaVersion, actual: envelope.schemaVersion)
      )
    }
    if envelope.operationID.replicaID != envelope.replicaID {
      return .rejected(.operationReplicaMismatch)
    }
    if envelope.operationID.counter == 0 {
      return .rejected(.invalidOperationCounter)
    }
    let expectedDependency = envelope.operationID.counter - 1
    let actualDependency = envelope.dependencies[envelope.replicaID]
    if actualDependency != expectedDependency {
      return .rejected(
        .invalidReplicaSequence(
          expectedDependency: expectedDependency,
          actualDependency: actualDependency
        )
      )
    }
    if envelope.commands.isEmpty {
      return .rejected(.emptyOperation)
    }
    if envelope.commands.count > limits.maximumCommandsPerOperation {
      return .rejected(
        .commandLimitExceeded(
          maximum: limits.maximumCommandsPerOperation,
          actual: envelope.commands.count
        )
      )
    }
    if envelope.dependencies.count > limits.maximumCausalEntries {
      return .rejected(
        .causalEntryLimitExceeded(
          maximum: limits.maximumCausalEntries,
          actual: envelope.dependencies.count
        )
      )
    }
    if baseVersion.observes(envelope.operationID) {
      return .compactedDuplicate
    }
    if let existing = envelopesByID[envelope.operationID] {
      return existing == envelope
        ? .duplicate
        : .rejected(.operationEquivocation(envelope.operationID))
    }
    if operationIDByTransactionID[envelope.transactionID] != nil {
      return .rejected(.transactionEquivocation(envelope.transactionID))
    }
    if envelopesByID.count >= limits.maximumHistoryOperations {
      return .rejected(.historyLimitExceeded(maximum: limits.maximumHistoryOperations))
    }
    switch authorizer.authorize(envelope, at: authorizationVersion) {
    case .allow:
      return .admitted
    case .deny(let code):
      return .rejected(.unauthorized(code: code))
    }
  }

  private func causalOrder() -> FlowingCollaborationCausalOrder {
    var indegree = Dictionary(
      uniqueKeysWithValues: envelopesByID.keys.map { ($0, 0) }
    )
    var dependents: [
      FlowingCollaborationOperationID: [FlowingCollaborationOperationID]
    ] = [:]
    var missingByOperation: [
      FlowingCollaborationOperationID: [FlowingCollaborationOperationID]
    ] = [:]

    for envelope in envelopesByID.values {
      for entry in envelope.dependencies.entries {
        guard entry.counter > baseVersion[entry.replicaID] else { continue }
        let dependencyID = FlowingCollaborationOperationID(
          replicaID: entry.replicaID,
          counter: entry.counter
        )
        guard envelopesByID[dependencyID] != nil else {
          missingByOperation[envelope.operationID, default: []].append(dependencyID)
          continue
        }
        indegree[envelope.operationID, default: 0] += 1
        dependents[dependencyID, default: []].append(envelope.operationID)
      }
    }

    var ready = FlowingOperationIDHeap()
    for operationID in envelopesByID.keys
    where indegree[operationID] == 0 && missingByOperation[operationID] == nil {
      ready.insert(operationID)
    }

    var version = baseVersion
    var operationIDs: [FlowingCollaborationOperationID] = []
    operationIDs.reserveCapacity(envelopesByID.count)
    while let operationID = ready.removeMinimum() {
      operationIDs.append(operationID)
      version.record(operationID)
      for dependentID in dependents[operationID, default: []] {
        let nextIndegree = indegree[dependentID, default: 0] - 1
        indegree[dependentID] = nextIndegree
        if nextIndegree == 0, missingByOperation[dependentID] == nil {
          ready.insert(dependentID)
        }
      }
    }

    let processed = Set(operationIDs)
    let pending = envelopesByID.keys.filter { !processed.contains($0) }.sorted().map {
      FlowingCollaborationPendingOperation(
        operationID: $0,
        missingDependencies: missingByOperation[$0, default: []].sorted(),
        isCausallyBlocked: missingByOperation[$0] == nil
      )
    }
    return FlowingCollaborationCausalOrder(
      operationIDs: operationIDs,
      version: version,
      pending: pending
    )
  }
}

private struct FlowingCollaborationCausalOrder {
  let operationIDs: [FlowingCollaborationOperationID]
  let version: FlowingCausalVersion
  let pending: [FlowingCollaborationPendingOperation]
}

private struct FlowingOperationIDHeap {
  private var values: [FlowingCollaborationOperationID] = []

  mutating func insert(_ value: FlowingCollaborationOperationID) {
    values.append(value)
    var index = values.count - 1
    while index > 0 {
      let parent = (index - 1) / 2
      guard values[index] < values[parent] else { break }
      values.swapAt(index, parent)
      index = parent
    }
  }

  mutating func removeMinimum() -> FlowingCollaborationOperationID? {
    guard !values.isEmpty else { return nil }
    if values.count == 1 {
      return values.removeLast()
    }
    let result = values[0]
    values[0] = values.removeLast()
    var index = 0
    while true {
      let left = index * 2 + 1
      guard left < values.count else { break }
      let right = left + 1
      let child = right < values.count && values[right] < values[left] ? right : left
      guard values[child] < values[index] else { break }
      values.swapAt(child, index)
      index = child
    }
    return result
  }
}
