import CoreGraphics
import FlowingDayGraphCollaboration
import FlowingDayGraphComposition
import FlowingDayGraphCore

public protocol FlowingGraphCollaborativeUndoPolicy: Sendable {
  associatedtype Transaction: Sendable
  associatedtype State: Sendable
  associatedtype Compensation: Sendable
  associatedtype Conflict: Error & Sendable

  func resolveCompensation(
    for transaction: Transaction,
    direction: FlowingGraphHistoryDirection,
    in state: State
  ) -> Result<Compensation, Conflict>
}

public struct FlowingGraphSharedNodePlacementTransition<
  Schema: FlowingGraphCollaborationSchema
>: Equatable, Sendable {
  public typealias Address = FlowingGraphDefinitionNodeAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >

  public let address: Address
  public let before: CGPoint?
  public let after: CGPoint?

  public init(address: Address, before: CGPoint?, after: CGPoint?) {
    self.address = address
    self.before = before
    self.after = after
  }
}

public struct FlowingGraphSharedNodePlacementHistoryTransaction<
  Schema: FlowingGraphCollaborationSchema
>: Equatable, Sendable {
  public let operationIDs: Set<FlowingCollaborationOperationID>
  public let transitions: [FlowingGraphSharedNodePlacementTransition<Schema>]

  public init(
    operationIDs: Set<FlowingCollaborationOperationID>,
    transitions: [FlowingGraphSharedNodePlacementTransition<Schema>]
  ) {
    self.operationIDs = operationIDs
    self.transitions = transitions
  }
}

public struct FlowingGraphSharedNodePlacementMismatch<
  Schema: FlowingGraphCollaborationSchema
>: Equatable, Sendable {
  public typealias Address = FlowingGraphDefinitionNodeAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >

  public let address: Address
  public let expected: CGPoint?
  public let actual: CGPoint?

  public init(address: Address, expected: CGPoint?, actual: CGPoint?) {
    self.address = address
    self.expected = expected
    self.actual = actual
  }
}

public enum FlowingGraphSharedNodePlacementUndoConflict<
  Schema: FlowingGraphCollaborationSchema
>: Error, Equatable, Sendable {
  public typealias Address = FlowingGraphDefinitionNodeAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >

  case missingOperationIdentity
  case emptyTransaction
  case duplicateAddress(Address)
  case concurrentChanges([FlowingGraphSharedNodePlacementMismatch<Schema>])
}

public struct FlowingGraphSharedNodePlacementCompensation<
  Schema: FlowingGraphCollaborationSchema
>: Sendable {
  public let compensates: Set<FlowingCollaborationOperationID>
  public let commands: [FlowingGraphCollaborationCommand<Schema>]

  private let transitions: [FlowingGraphSharedNodePlacementTransition<Schema>]

  init(
    compensates: Set<FlowingCollaborationOperationID>,
    commands: [FlowingGraphCollaborationCommand<Schema>],
    transitions: [FlowingGraphSharedNodePlacementTransition<Schema>]
  ) {
    self.compensates = compensates
    self.commands = commands
    self.transitions = transitions
  }

  public func reciprocalTransaction(
    afterSubmitting operationID: FlowingCollaborationOperationID
  ) -> FlowingGraphSharedNodePlacementHistoryTransaction<Schema> {
    FlowingGraphSharedNodePlacementHistoryTransaction(
      operationIDs: [operationID],
      transitions: transitions
    )
  }
}

public struct FlowingGraphSharedNodePlacementUndoPolicy<
  Schema: FlowingGraphCollaborationSchema
>: FlowingGraphCollaborativeUndoPolicy {
  public init() {}

  public func resolveCompensation(
    for transaction: FlowingGraphSharedNodePlacementHistoryTransaction<Schema>,
    direction: FlowingGraphHistoryDirection,
    in state: FlowingGraphCollaborationState<Schema>
  ) -> Result<
    FlowingGraphSharedNodePlacementCompensation<Schema>,
    FlowingGraphSharedNodePlacementUndoConflict<Schema>
  > {
    guard !transaction.operationIDs.isEmpty else {
      return .failure(.missingOperationIdentity)
    }
    guard !transaction.transitions.isEmpty else {
      return .failure(.emptyTransaction)
    }

    var addresses = Set<FlowingGraphSharedNodePlacementTransition<Schema>.Address>()
    for transition in transaction.transitions where !addresses.insert(transition.address).inserted {
      return .failure(.duplicateAddress(transition.address))
    }

    let mismatches: [FlowingGraphSharedNodePlacementMismatch<Schema>] =
      transaction.transitions.compactMap { transition in
        let expected = direction == .undo ? transition.after : transition.before
        let actual = state.sharedNodePlacements[transition.address]
        guard actual != expected else { return nil }
        return FlowingGraphSharedNodePlacementMismatch<Schema>(
          address: transition.address,
          expected: expected,
          actual: actual
        )
      }
    guard mismatches.isEmpty else {
      return .failure(.concurrentChanges(mismatches))
    }

    let commands = transaction.transitions.map { transition in
      let expected = direction == .undo ? transition.after : transition.before
      let replacement = direction == .undo ? transition.before : transition.after
      return FlowingGraphCollaborationCommand<Schema>.compareAndSetSharedNodePlacement(
        address: transition.address,
        expected: expected,
        replacement: replacement
      )
    }
    return .success(
      FlowingGraphSharedNodePlacementCompensation(
        compensates: transaction.operationIDs,
        commands: commands,
        transitions: transaction.transitions
      )
    )
  }
}
