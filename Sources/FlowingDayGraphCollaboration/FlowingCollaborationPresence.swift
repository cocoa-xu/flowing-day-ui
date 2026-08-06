public struct FlowingCollaborationPresenceKey: Hashable, Comparable, Sendable {
  public let participantID: FlowingParticipantID
  public let sessionID: FlowingCollaborationSessionID

  public init(
    participantID: FlowingParticipantID,
    sessionID: FlowingCollaborationSessionID
  ) {
    self.participantID = participantID
    self.sessionID = sessionID
  }

  public static func < (lhs: Self, rhs: Self) -> Bool {
    if lhs.participantID != rhs.participantID {
      return lhs.participantID < rhs.participantID
    }
    return lhs.sessionID < rhs.sessionID
  }
}

public enum FlowingCollaborationPresenceEvent<Value: Equatable & Sendable>:
  Equatable,
  Sendable
{
  case update(Value)
  case leave
}

public struct FlowingCollaborationPresenceUpdate<
  DocumentID: Hashable & Sendable,
  Value: Equatable & Sendable
>: Equatable, Sendable {
  public let documentID: DocumentID
  public let key: FlowingCollaborationPresenceKey
  public let sequence: UInt64
  public let event: FlowingCollaborationPresenceEvent<Value>

  public init(
    documentID: DocumentID,
    key: FlowingCollaborationPresenceKey,
    sequence: UInt64,
    event: FlowingCollaborationPresenceEvent<Value>
  ) {
    self.documentID = documentID
    self.key = key
    self.sequence = sequence
    self.event = event
  }
}

public struct FlowingCollaborationPresenceRecord<Value: Equatable & Sendable>:
  Equatable,
  Sendable
{
  public let key: FlowingCollaborationPresenceKey
  public let sequence: UInt64
  public let value: Value
  public let expiresAt: UInt64
}

public enum FlowingCollaborationPresenceIssue<DocumentID: Hashable & Sendable>:
  Error,
  Equatable,
  Sendable
{
  case wrongDocument(expected: DocumentID, actual: DocumentID)
  case invalidSequence
  case invalidExpiration
  case sessionLimitExceeded(maximum: Int)
}

public enum FlowingCollaborationPresenceReceipt<DocumentID: Hashable & Sendable>:
  Equatable,
  Sendable
{
  case updated
  case left
  case stale
  case rejected(FlowingCollaborationPresenceIssue<DocumentID>)
}

public struct FlowingCollaborationPresenceStore<
  DocumentID: Hashable & Sendable,
  Value: Equatable & Sendable
>: Sendable {
  public let documentID: DocumentID
  public let maximumSessions: Int

  private var sessions: [FlowingCollaborationPresenceKey: Session] = [:]

  public init(
    documentID: DocumentID,
    maximumSessions: Int = FlowingCollaborationLimits.standard.maximumPresenceSessions
  ) {
    precondition(maximumSessions > 0)
    self.documentID = documentID
    self.maximumSessions = maximumSessions
  }

  public var activeRecords: [FlowingCollaborationPresenceRecord<Value>] {
    sessions.keys.sorted().compactMap { key in
      guard let session = sessions[key], let value = session.value else { return nil }
      return FlowingCollaborationPresenceRecord(
        key: key,
        sequence: session.sequence,
        value: value,
        expiresAt: session.expiresAt
      )
    }
  }

  public var retainedSessionCount: Int {
    sessions.count
  }

  public mutating func ingest(
    _ update: FlowingCollaborationPresenceUpdate<DocumentID, Value>,
    expiresAt: UInt64,
    receivedAt: UInt64
  ) -> FlowingCollaborationPresenceReceipt<DocumentID> {
    guard update.documentID == documentID else {
      return .rejected(.wrongDocument(expected: documentID, actual: update.documentID))
    }
    guard update.sequence > 0 else {
      return .rejected(.invalidSequence)
    }
    guard expiresAt > receivedAt else {
      return .rejected(.invalidExpiration)
    }
    if let session = sessions[update.key], update.sequence <= session.sequence {
      return .stale
    }
    guard sessions[update.key] != nil || sessions.count < maximumSessions else {
      return .rejected(.sessionLimitExceeded(maximum: maximumSessions))
    }

    switch update.event {
    case .update(let value):
      sessions[update.key] = Session(
        sequence: update.sequence,
        value: value,
        expiresAt: expiresAt,
        retiredAt: nil
      )
      return .updated
    case .leave:
      sessions[update.key] = Session(
        sequence: update.sequence,
        value: nil,
        expiresAt: expiresAt,
        retiredAt: receivedAt
      )
      return .left
    }
  }

  @discardableResult
  public mutating func expire(at tick: UInt64) -> [FlowingCollaborationPresenceKey] {
    var expired: [FlowingCollaborationPresenceKey] = []
    for key in sessions.keys.sorted() {
      guard var session = sessions[key] else { continue }
      guard session.value != nil, session.expiresAt <= tick else { continue }
      session.value = nil
      session.retiredAt = tick
      sessions[key] = session
      expired.append(key)
    }
    return expired
  }

  @discardableResult
  public mutating func purgeRetired(through tick: UInt64) -> Int {
    let keys: [FlowingCollaborationPresenceKey] = sessions.compactMap { key, session in
      guard let retiredAt = session.retiredAt, retiredAt <= tick else { return nil }
      return key
    }
    for key in keys {
      sessions.removeValue(forKey: key)
    }
    return keys.count
  }

  private struct Session: Sendable {
    let sequence: UInt64
    var value: Value?
    let expiresAt: UInt64
    var retiredAt: UInt64?
  }
}
