import Foundation

public struct FlowingGraphHistoryCapabilities: OptionSet, Sendable {
  public let rawValue: UInt8

  public init(rawValue: UInt8) {
    self.rawValue = rawValue
  }

  public static let localUndoRedo = Self(rawValue: 1 << 0)
  public static let collaborativeUndoRedo = Self(rawValue: 1 << 1)
  public static let conflictFeedback = Self(rawValue: 1 << 2)
  public static let standard: Self = [
    .localUndoRedo,
    .collaborativeUndoRedo,
    .conflictFeedback,
  ]
}

public struct FlowingGraphHistoryConfiguration: Sendable {
  public let capabilities: FlowingGraphHistoryCapabilities

  public init(capabilities: FlowingGraphHistoryCapabilities = .standard) {
    self.capabilities = capabilities
  }

  public static let standard = Self()
  public static let disabled = Self(capabilities: [])
}

public enum FlowingGraphHistoryExecutionMode: Sendable {
  case local
  case collaborative
}

public enum FlowingGraphHistoryDirection: Sendable {
  case undo
  case redo

  fileprivate var opposite: Self {
    switch self {
    case .undo: .redo
    case .redo: .undo
    }
  }
}

public struct FlowingGraphHistoryTransaction<Change: Sendable>: Sendable {
  public let id: UUID
  public let actionName: String
  public let mode: FlowingGraphHistoryExecutionMode
  public let undoChange: Change
  public let redoChange: Change

  public init(
    id: UUID = UUID(),
    actionName: String,
    mode: FlowingGraphHistoryExecutionMode,
    undoChange: Change,
    redoChange: Change
  ) {
    self.id = id
    self.actionName = actionName
    self.mode = mode
    self.undoChange = undoChange
    self.redoChange = redoChange
  }
}

public enum FlowingGraphHistoryApplyResult<Change: Sendable, Failure: Error & Sendable>:
  Sendable
{
  case applied
  case appliedWithReciprocal(Change)
  case rejected(Failure)
}

public struct FlowingGraphHistoryConflict<Change: Sendable, Failure: Error & Sendable>:
  Sendable
{
  public let transactionID: UUID
  public let actionName: String
  public let direction: FlowingGraphHistoryDirection
  public let change: Change
  public let failure: Failure

  public init(
    transactionID: UUID,
    actionName: String,
    direction: FlowingGraphHistoryDirection,
    change: Change,
    failure: Failure
  ) {
    self.transactionID = transactionID
    self.actionName = actionName
    self.direction = direction
    self.change = change
    self.failure = failure
  }
}

@MainActor
public final class FlowingGraphUndoManagerDriver<Change: Sendable, Failure: Error & Sendable> {
  public typealias Apply =
    @MainActor (
      Change,
      FlowingGraphHistoryDirection
    ) -> FlowingGraphHistoryApplyResult<Change, Failure>
  public typealias ConflictHandler =
    @MainActor (
      FlowingGraphHistoryConflict<Change, Failure>
    ) -> Void

  public let undoManager: UndoManager
  public let configuration: FlowingGraphHistoryConfiguration

  private let apply: Apply
  private let onConflict: ConflictHandler

  public init(
    undoManager: UndoManager = UndoManager(),
    configuration: FlowingGraphHistoryConfiguration = .standard,
    apply: @escaping Apply,
    onConflict: @escaping ConflictHandler = { _ in }
  ) {
    self.undoManager = undoManager
    self.configuration = configuration
    self.apply = apply
    self.onConflict = onConflict
  }

  public var canUndo: Bool {
    undoManager.canUndo
  }

  public var canRedo: Bool {
    undoManager.canRedo
  }

  public var undoActionName: String {
    undoManager.undoActionName
  }

  public var redoActionName: String {
    undoManager.redoActionName
  }

  public func register(_ transaction: FlowingGraphHistoryTransaction<Change>) {
    guard configuration.capabilities.contains(transaction.mode.capability) else { return }
    register(
      change: transaction.undoChange,
      reciprocal: transaction.redoChange,
      transactionID: transaction.id,
      actionName: transaction.actionName,
      direction: .undo
    )
  }

  public func undo() {
    guard undoManager.canUndo else { return }
    undoManager.undo()
  }

  public func redo() {
    guard undoManager.canRedo else { return }
    undoManager.redo()
  }

  public func removeAllActions() {
    undoManager.removeAllActions(withTarget: self)
  }

  private func register(
    change: Change,
    reciprocal: Change,
    transactionID: UUID,
    actionName: String,
    direction: FlowingGraphHistoryDirection
  ) {
    let opensGroup = undoManager.groupingLevel == 0
    if opensGroup {
      undoManager.beginUndoGrouping()
    }
    undoManager.registerUndo(withTarget: self) { driver in
      driver.perform(
        change: change,
        reciprocal: reciprocal,
        transactionID: transactionID,
        actionName: actionName,
        direction: direction
      )
    }
    undoManager.setActionName(actionName)
    if opensGroup {
      undoManager.endUndoGrouping()
    }
  }

  private func perform(
    change: Change,
    reciprocal: Change,
    transactionID: UUID,
    actionName: String,
    direction: FlowingGraphHistoryDirection
  ) {
    switch apply(change, direction) {
    case .applied:
      register(
        change: reciprocal,
        reciprocal: change,
        transactionID: transactionID,
        actionName: actionName,
        direction: direction.opposite
      )
    case .appliedWithReciprocal(let resolvedReciprocal):
      register(
        change: resolvedReciprocal,
        reciprocal: change,
        transactionID: transactionID,
        actionName: actionName,
        direction: direction.opposite
      )
    case .rejected(let failure):
      guard configuration.capabilities.contains(.conflictFeedback) else { return }
      onConflict(
        FlowingGraphHistoryConflict(
          transactionID: transactionID,
          actionName: actionName,
          direction: direction,
          change: change,
          failure: failure
        )
      )
    }
  }
}

extension FlowingGraphHistoryExecutionMode {
  fileprivate var capability: FlowingGraphHistoryCapabilities {
    switch self {
    case .local: .localUndoRedo
    case .collaborative: .collaborativeUndoRedo
    }
  }
}
