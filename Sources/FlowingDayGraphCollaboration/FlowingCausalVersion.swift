public enum FlowingCausalRelation: Hashable, Sendable {
  case before
  case equal
  case after
  case concurrent
}

public struct FlowingCausalVersionEntry: Equatable, Sendable {
  public let replicaID: FlowingReplicaID
  public let counter: UInt64

  public init(replicaID: FlowingReplicaID, counter: UInt64) {
    self.replicaID = replicaID
    self.counter = counter
  }
}

public struct FlowingCausalVersion: Equatable, Sendable {
  private var counters: [FlowingReplicaID: UInt64]

  public init(_ counters: [FlowingReplicaID: UInt64] = [:]) {
    self.counters = counters.filter { $0.value > 0 }
  }

  public var entries: [FlowingCausalVersionEntry] {
    counters.keys.sorted().map {
      FlowingCausalVersionEntry(replicaID: $0, counter: counters[$0]!)
    }
  }

  public var count: Int {
    counters.count
  }

  public subscript(replicaID: FlowingReplicaID) -> UInt64 {
    counters[replicaID, default: 0]
  }

  public func observes(_ operationID: FlowingCollaborationOperationID) -> Bool {
    self[operationID.replicaID] >= operationID.counter
  }

  public func dominates(_ other: Self) -> Bool {
    other.counters.allSatisfy { self[$0.key] >= $0.value }
  }

  public func relation(to other: Self) -> FlowingCausalRelation {
    let selfDominates = dominates(other)
    let otherDominates = other.dominates(self)
    switch (selfDominates, otherDominates) {
    case (true, true): return .equal
    case (true, false): return .after
    case (false, true): return .before
    case (false, false): return .concurrent
    }
  }

  public func merged(with other: Self) -> Self {
    var result = self
    for entry in other.entries {
      result.record(replicaID: entry.replicaID, counter: entry.counter)
    }
    return result
  }

  mutating func record(_ operationID: FlowingCollaborationOperationID) {
    record(replicaID: operationID.replicaID, counter: operationID.counter)
  }

  private mutating func record(replicaID: FlowingReplicaID, counter: UInt64) {
    guard counter > self[replicaID] else { return }
    counters[replicaID] = counter
  }
}
