import AppKit
import CoreGraphics
import XCTest

@testable import FlowingDayControls

final class FlowingContextMenuTests: XCTestCase {
  @MainActor
  func testItemCanOverrideTheInheritedMenuAccent() {
    let itemAccent = FlowingAccent.crimson
    let item = FlowingContextMenuItem("Remove", accent: itemAccent) {}

    guard case .action(let action) = item.content else {
      return XCTFail("Expected an action item")
    }

    XCTAssertEqual(action.accent, itemAccent)
  }

  @MainActor
  func testSelectionSkipsSeparatorsAndDisabledActions() {
    let items = [
      FlowingContextMenuItem("First") {},
      .separator(),
      FlowingContextMenuItem("Disabled", isEnabled: false) {},
      FlowingContextMenuItem("Last") {},
    ]
    var selection = FlowingContextMenuSelection(items: items)

    XCTAssertEqual(selection.selectedIndex, 0)
    selection.moveForward(in: items)
    XCTAssertEqual(selection.selectedIndex, 3)
    selection.moveForward(in: items)
    XCTAssertEqual(selection.selectedIndex, 0)
    selection.moveBackward(in: items)
    XCTAssertEqual(selection.selectedIndex, 3)
  }

  @MainActor
  func testSelectionPerformsOnlyEnabledAction() {
    var invocationCount = 0
    let items = [
      FlowingContextMenuItem("Disabled", isEnabled: false) {
        invocationCount += 100
      },
      FlowingContextMenuItem("Enabled") {
        invocationCount += 1
      },
    ]
    let selection = FlowingContextMenuSelection(items: items)

    selection.selectedAction(in: items)?.action()

    XCTAssertEqual(invocationCount, 1)
  }

  func testPlacementKeepsMenuInsideContainer() {
    let containerSize = CGSize(width: 500, height: 300)
    let menuSize = CGSize(width: 196, height: 120)

    XCTAssertEqual(
      FlowingContextMenuPlacement.origin(
        anchor: CGPoint(x: -30, y: -20),
        menuSize: menuSize,
        containerSize: containerSize
      ),
      CGPoint(x: 8, y: 8)
    )
    XCTAssertEqual(
      FlowingContextMenuPlacement.origin(
        anchor: CGPoint(x: 490, y: 290),
        menuSize: menuSize,
        containerSize: containerSize
      ),
      CGPoint(x: 296, y: 172)
    )
  }

  func testContextualClickOutsideMenuReplacesItOnlyInsideTheHostWindow() {
    XCTAssertTrue(
      FlowingContextMenuReplacementPolicy.shouldReplay(
        eventType: .rightMouseDown,
        modifierFlags: [],
        eventWindowNumber: 7,
        hostWindowNumber: 7,
        isInsideMenu: false
      )
    )
    XCTAssertTrue(
      FlowingContextMenuReplacementPolicy.shouldReplay(
        eventType: .leftMouseDown,
        modifierFlags: .control,
        eventWindowNumber: 7,
        hostWindowNumber: 7,
        isInsideMenu: false
      )
    )
    XCTAssertFalse(
      FlowingContextMenuReplacementPolicy.shouldReplay(
        eventType: .rightMouseDown,
        modifierFlags: [],
        eventWindowNumber: 7,
        hostWindowNumber: 7,
        isInsideMenu: true
      )
    )
    XCTAssertFalse(
      FlowingContextMenuReplacementPolicy.shouldReplay(
        eventType: .rightMouseDown,
        modifierFlags: [],
        eventWindowNumber: 8,
        hostWindowNumber: 7,
        isInsideMenu: false
      )
    )
    XCTAssertFalse(
      FlowingContextMenuReplacementPolicy.shouldReplay(
        eventType: .leftMouseDown,
        modifierFlags: [],
        eventWindowNumber: 7,
        hostWindowNumber: 7,
        isInsideMenu: false
      )
    )
  }
}
