import Foundation

public struct FlowingParticipantID: Hashable, Comparable, Sendable {
  public let rawValue: UUID

  public init(_ rawValue: UUID = UUID()) {
    self.rawValue = rawValue
  }

  public static func < (lhs: Self, rhs: Self) -> Bool {
    lhs.rawValue.lexicographicallyPrecedes(rhs.rawValue)
  }
}

public struct FlowingReplicaID: Hashable, Comparable, Sendable {
  public let rawValue: UUID

  public init(_ rawValue: UUID = UUID()) {
    self.rawValue = rawValue
  }

  public static func < (lhs: Self, rhs: Self) -> Bool {
    lhs.rawValue.lexicographicallyPrecedes(rhs.rawValue)
  }
}

public struct FlowingCollaborationSessionID: Hashable, Comparable, Sendable {
  public let rawValue: UUID

  public init(_ rawValue: UUID = UUID()) {
    self.rawValue = rawValue
  }

  public static func < (lhs: Self, rhs: Self) -> Bool {
    lhs.rawValue.lexicographicallyPrecedes(rhs.rawValue)
  }
}

public struct FlowingCollaborationTransactionID: Hashable, Comparable, Sendable {
  public let rawValue: UUID

  public init(_ rawValue: UUID = UUID()) {
    self.rawValue = rawValue
  }

  public static func < (lhs: Self, rhs: Self) -> Bool {
    lhs.rawValue.lexicographicallyPrecedes(rhs.rawValue)
  }
}

public struct FlowingCollaborationProposalID: Hashable, Comparable, Sendable {
  public let rawValue: UUID

  public init(_ rawValue: UUID = UUID()) {
    self.rawValue = rawValue
  }

  public static func < (lhs: Self, rhs: Self) -> Bool {
    lhs.rawValue.lexicographicallyPrecedes(rhs.rawValue)
  }
}

public struct FlowingCollaborationOperationID: Hashable, Comparable, Sendable {
  public let replicaID: FlowingReplicaID
  public let counter: UInt64

  public init(replicaID: FlowingReplicaID, counter: UInt64) {
    self.replicaID = replicaID
    self.counter = counter
  }

  public static func < (lhs: Self, rhs: Self) -> Bool {
    if lhs.counter != rhs.counter {
      return lhs.counter < rhs.counter
    }
    return lhs.replicaID < rhs.replicaID
  }
}

extension UUID {
  fileprivate func lexicographicallyPrecedes(_ other: UUID) -> Bool {
    var lhs = uuid
    var rhs = other.uuid
    return withUnsafeBytes(of: &lhs) { lhsBytes in
      withUnsafeBytes(of: &rhs) { rhsBytes in
        lhsBytes.lexicographicallyPrecedes(rhsBytes)
      }
    }
  }
}
