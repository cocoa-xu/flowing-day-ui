import FlowingDayGraphHistory
import Foundation
import XCTest

final class FlowingGraphUndoManagerDriverTests: XCTestCase {
  @MainActor
  func testStandardConfigurationEnablesEveryCapability() {
    let capabilities = FlowingGraphHistoryConfiguration.standard.capabilities

    XCTAssertTrue(capabilities.contains(.localUndoRedo))
    XCTAssertTrue(capabilities.contains(.collaborativeUndoRedo))
    XCTAssertTrue(capabilities.contains(.conflictFeedback))
  }

  @MainActor
  func testLocalTransactionUsesNativeUndoAndRedoStacks() {
    var value = 10
    let driver = FlowingGraphUndoManagerDriver<Int, TestFailure> { change, _ in
      value += change
      return .applied
    }
    driver.undoManager.groupsByEvent = false
    driver.register(
      FlowingGraphHistoryTransaction(
        actionName: "Move Nodes",
        mode: .local,
        undoChange: -4,
        redoChange: 4
      )
    )

    XCTAssertTrue(driver.canUndo)
    driver.undo()
    XCTAssertEqual(value, 6)
    XCTAssertTrue(driver.canRedo)

    driver.redo()
    XCTAssertEqual(value, 10)
    XCTAssertTrue(driver.canUndo)
  }

  @MainActor
  func testCapabilitiesCanDisableOrSelectExecutionModes() {
    let driver = FlowingGraphUndoManagerDriver<Int, TestFailure>(
      configuration: FlowingGraphHistoryConfiguration(
        capabilities: [.collaborativeUndoRedo]
      )
    ) { _, _ in
      .applied
    }
    driver.undoManager.groupsByEvent = false

    driver.register(
      FlowingGraphHistoryTransaction(
        actionName: "Local",
        mode: .local,
        undoChange: 1,
        redoChange: 2
      )
    )
    XCTAssertFalse(driver.canUndo)

    driver.register(
      FlowingGraphHistoryTransaction(
        actionName: "Collaborative",
        mode: .collaborative,
        undoChange: 1,
        redoChange: 2
      )
    )
    XCTAssertTrue(driver.canUndo)
  }

  @MainActor
  func testDisabledConfigurationRegistersNoActions() {
    let driver = FlowingGraphUndoManagerDriver<Int, TestFailure>(
      configuration: .disabled,
      apply: { _, _ in .applied }
    )
    driver.undoManager.groupsByEvent = false

    driver.register(
      FlowingGraphHistoryTransaction(
        actionName: "Local",
        mode: .local,
        undoChange: 1,
        redoChange: 2
      )
    )
    driver.register(
      FlowingGraphHistoryTransaction(
        actionName: "Collaborative",
        mode: .collaborative,
        undoChange: 1,
        redoChange: 2
      )
    )

    XCTAssertFalse(driver.canUndo)
  }

  @MainActor
  func testRejectedChangeReportsConflictOnlyWhenEnabled() {
    var reportedFailures: [TestFailure] = []
    let driver = FlowingGraphUndoManagerDriver<Int, TestFailure>(
      configuration: FlowingGraphHistoryConfiguration(
        capabilities: [.localUndoRedo, .conflictFeedback]
      ),
      apply: { _, _ in .rejected(.staleState) },
      onConflict: { reportedFailures.append($0.failure) }
    )
    driver.undoManager.groupsByEvent = false
    driver.register(
      FlowingGraphHistoryTransaction(
        actionName: "Move Nodes",
        mode: .local,
        undoChange: -1,
        redoChange: 1
      )
    )

    driver.undo()

    XCTAssertEqual(reportedFailures, [.staleState])
    XCTAssertFalse(driver.canRedo)
  }

  @MainActor
  func testConflictFeedbackCanBeDisabledIndependently() {
    var conflictCount = 0
    let driver = FlowingGraphUndoManagerDriver<Int, TestFailure>(
      configuration: FlowingGraphHistoryConfiguration(capabilities: [.localUndoRedo]),
      apply: { _, _ in .rejected(.staleState) },
      onConflict: { _ in conflictCount += 1 }
    )
    driver.undoManager.groupsByEvent = false
    driver.register(
      FlowingGraphHistoryTransaction(
        actionName: "Move Nodes",
        mode: .local,
        undoChange: -1,
        redoChange: 1
      )
    )

    driver.undo()

    XCTAssertEqual(conflictCount, 0)
  }

  @MainActor
  func testAppliedChangeCanReplaceItsReciprocal() {
    var appliedChanges: [Int] = []
    let driver = FlowingGraphUndoManagerDriver<Int, TestFailure> { change, direction in
      appliedChanges.append(change)
      return direction == .undo ? .appliedWithReciprocal(99) : .applied
    }
    driver.undoManager.groupsByEvent = false
    driver.register(
      FlowingGraphHistoryTransaction(
        actionName: "Compensate Move",
        mode: .collaborative,
        undoChange: 10,
        redoChange: 20
      )
    )

    driver.undo()
    driver.redo()

    XCTAssertEqual(appliedChanges, [10, 99])
  }

  @MainActor
  func testRemovingActionsDoesNotRemoveAnotherTargetsActions() {
    final class OtherTarget {}

    let undoManager = UndoManager()
    undoManager.groupsByEvent = false
    let otherTarget = OtherTarget()
    undoManager.beginUndoGrouping()
    undoManager.registerUndo(withTarget: otherTarget) { _ in }
    undoManager.endUndoGrouping()
    let driver = FlowingGraphUndoManagerDriver<Int, TestFailure>(
      undoManager: undoManager,
      apply: { _, _ in .applied }
    )
    driver.register(
      FlowingGraphHistoryTransaction(
        actionName: "Move Nodes",
        mode: .local,
        undoChange: 1,
        redoChange: 2
      )
    )

    driver.removeAllActions()

    XCTAssertTrue(undoManager.canUndo)
  }
}

private enum TestFailure: Error, Equatable, Sendable {
  case staleState
}
