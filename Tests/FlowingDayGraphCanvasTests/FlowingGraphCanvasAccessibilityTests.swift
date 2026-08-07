import AppKit
import FlowingDayGraphCanvas
import XCTest

@MainActor
final class FlowingGraphCanvasAccessibilityTests: XCTestCase {
  func testStandardAndDisabledConfigurationsKeepCapabilitiesExplicit() {
    XCTAssertEqual(FlowingGraphCanvasAccessibilityConfiguration.standard.capabilities, .standard)
    XCTAssertTrue(FlowingGraphCanvasAccessibilityConfiguration.standard.isEnabled)
    XCTAssertTrue(FlowingGraphCanvasAccessibilityConfiguration.disabled.capabilities.isEmpty)
    XCTAssertFalse(FlowingGraphCanvasAccessibilityConfiguration.disabled.isEnabled)

    let readOnly = FlowingGraphCanvasAccessibilityConfiguration(
      capabilities: [.focusNavigation, .selection, .movement]
    )

    XCTAssertTrue(readOnly.capabilities.contains(.focusNavigation))
    XCTAssertTrue(readOnly.capabilities.contains(.selection))
    XCTAssertTrue(readOnly.capabilities.contains(.movement))
    XCTAssertFalse(readOnly.capabilities.contains(.connections))
    XCTAssertFalse(readOnly.capabilities.contains(.elementActions))
  }

  func testSnapshotRejectsDuplicateIdentifiersAndInvalidFrames() {
    XCTAssertThrowsError(
      try snapshot(items: [item(1), item(1)])
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphCanvasAccessibilitySnapshotIssue<Int>,
        .duplicateElementID(1)
      )
    }

    XCTAssertThrowsError(
      try snapshot(
        items: [
          FlowingGraphCanvasAccessibilityItem(
            id: 1,
            kind: .node,
            frame: CGRect(x: CGFloat.nan, y: 0, width: 20, height: 20),
            description: .init(label: "Invalid")
          )
        ]
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphCanvasAccessibilitySnapshotIssue<Int>,
        .invalidFrame(1)
      )
    }
  }

  func testSnapshotFiltersRelationsToElementsThatAreNotExposed() throws {
    let snapshot = try snapshot(
      items: [
        item(1, relatedElementIDs: [2, 99]),
        item(2, relatedElementIDs: [1]),
      ]
    )

    XCTAssertEqual(snapshot.item(for: 1)?.relatedElementIDs, [2])
    XCTAssertEqual(snapshot.nextRelatedElementID(after: 1), 2)
  }

  func testSnapshotTraversesHiddenIntermediariesWithoutExposingThem() throws {
    let snapshot = try FlowingGraphCanvasAccessibilitySnapshot(
      canvasDescription: .init(label: "Canvas"),
      items: [
        item(1, relatedElementIDs: [99]),
        item(2),
      ],
      relationships: [
        1: [99],
        99: [1, 100],
        100: [99, 2],
        2: [100],
      ]
    )

    XCTAssertTrue(snapshot.item(for: 1)?.relatedElementIDs.isEmpty == true)
    XCTAssertTrue(snapshot.item(for: 2)?.relatedElementIDs.isEmpty == true)
    XCTAssertEqual(snapshot.relatedElementIDs(for: 1), [2])
    XCTAssertEqual(snapshot.relatedElementIDs(for: 2), [1])
  }

  func testFocusReconciliationPreservesStableIdentifiersAndFallsBackDeterministically() throws {
    let snapshot = try snapshot(items: [item(1), item(2), item(3)])

    XCTAssertEqual(snapshot.reconciledFocus(2), 2)
    XCTAssertEqual(snapshot.reconciledFocus(99), 1)
    XCTAssertEqual(snapshot.reconciledFocus(nil), 1)
    XCTAssertEqual(snapshot.elementID(after: 1), 2)
    XCTAssertEqual(snapshot.elementID(before: 3), 2)
    XCTAssertNil(snapshot.elementID(before: 1))
    XCTAssertNil(snapshot.elementID(after: 3))
  }

  func testExposedWindowIsBoundedAndCenteredAroundFocus() throws {
    let snapshot = try snapshot(items: (0..<100).map { item($0) })

    XCTAssertEqual(snapshot.exposedItems(centeredAt: 50, maximumCount: 8).map(\.id), Array(46..<54))
    XCTAssertEqual(snapshot.exposedItems(centeredAt: 0, maximumCount: 8).map(\.id), Array(0..<8))
    XCTAssertEqual(
      snapshot.exposedItems(centeredAt: 99, maximumCount: 8).map(\.id), Array(92..<100))
  }

  func testBridgeMaterializesOnlyTheConfiguredAccessibilityWindow() throws {
    let snapshot = try largeSnapshot()
    let bridge = FlowingGraphCanvasAccessibilityBridge<Int>()
    let parent = NSView()

    bridge.update(
      snapshot: snapshot,
      configuration: .init(maximumExposedElementCount: 64),
      selectedElementIDs: [50_000],
      focusedElementID: 50_000,
      parent: parent,
      frameResolver: { $0 },
      onRequest: { _ in true }
    )

    let children = bridge.accessibilityChildren()
    XCTAssertEqual(children.count, 64)
    XCTAssertEqual(bridge.accessibilitySelectedChildren().count, 1)
    XCTAssertEqual(bridge.focusedElementID, 50_000)
    XCTAssertTrue(
      children.contains { child in
        (child as? NSAccessibilityElement)?.accessibilityLabel() == "Node 50000"
      })
  }

  func testBridgePreservesFocusedElementWhenConsumerDoesNotReplaceIt() throws {
    let snapshot = try snapshot(items: [item(1), item(2), item(3)])
    let bridge = FlowingGraphCanvasAccessibilityBridge<Int>()
    let parent = NSView()
    var requests: [FlowingGraphCanvasAccessibilityRequest<Int>] = []
    bridge.update(
      snapshot: snapshot,
      configuration: .standard,
      selectedElementIDs: [],
      focusedElementID: 2,
      parent: parent,
      frameResolver: { $0 },
      onRequest: {
        requests.append($0)
        return true
      }
    )

    bridge.update(
      snapshot: snapshot,
      configuration: .standard,
      selectedElementIDs: [],
      focusedElementID: nil,
      parent: parent,
      frameResolver: { $0 },
      onRequest: {
        requests.append($0)
        return true
      }
    )

    XCTAssertEqual(bridge.focusedElementID, 2)
    XCTAssertTrue(requests.isEmpty)
  }

  func testPlatformElementForwardsFocusAndSelectionWithoutMutatingTheGraph() throws {
    let snapshot = try snapshot(items: [item(1), item(2)])
    let bridge = FlowingGraphCanvasAccessibilityBridge<Int>()
    let parent = NSView()
    var requests: [FlowingGraphCanvasAccessibilityRequest<Int>] = []
    bridge.update(
      snapshot: snapshot,
      configuration: .standard,
      selectedElementIDs: [],
      focusedElementID: 1,
      parent: parent,
      frameResolver: { $0.offsetBy(dx: 10, dy: 20) },
      onRequest: {
        requests.append($0)
        return true
      }
    )
    let elements = bridge.accessibilityChildren().compactMap { $0 as? NSAccessibilityElement }
    let second = try XCTUnwrap(elements.first { $0.accessibilityLabel() == "Node 2" })

    second.setAccessibilityFocused(true)
    XCTAssertTrue(second.accessibilityPerformPress())

    XCTAssertEqual(requests, [.focus(2), .select(2)])
    XCTAssertEqual(bridge.focusedElementID, 2)
    XCTAssertEqual(second.accessibilityFrame(), CGRect(x: 50, y: 20, width: 20, height: 20))
  }

  func testCapabilitiesIndependentlyControlSelectionMovementConnectionsAndActions() throws {
    let describedItem = FlowingGraphCanvasAccessibilityItem(
      id: 1,
      kind: .node,
      frame: CGRect(x: 0, y: 0, width: 20, height: 20),
      description: .init(
        label: "Node",
        actions: [
          .init(action: .inspect, label: "Inspect Node"),
          .init(action: .beginConnection, label: "Start Connection"),
        ]
      )
    )
    let snapshot = try snapshot(items: [describedItem])
    let parent = NSView()

    let readOnlyBridge = FlowingGraphCanvasAccessibilityBridge<Int>()
    readOnlyBridge.update(
      snapshot: snapshot,
      configuration: .init(capabilities: [.focusNavigation, .selection, .movement]),
      selectedElementIDs: [],
      focusedElementID: 1,
      parent: parent,
      frameResolver: { $0 },
      onRequest: { _ in true }
    )
    let readOnlyElement = try XCTUnwrap(
      readOnlyBridge.accessibilityChildren().first as? NSAccessibilityElement
    )
    let readOnlyActions = Set(readOnlyElement.accessibilityCustomActions()?.map(\.name) ?? [])
    XCTAssertTrue(readOnlyElement.accessibilityPerformPress())
    XCTAssertTrue(
      readOnlyActions.isSuperset(of: ["Move Up", "Move Down", "Move Left", "Move Right"]))
    XCTAssertFalse(readOnlyActions.contains("Inspect Node"))
    XCTAssertFalse(readOnlyActions.contains("Start Connection"))

    let actionBridge = FlowingGraphCanvasAccessibilityBridge<Int>()
    actionBridge.update(
      snapshot: snapshot,
      configuration: .init(capabilities: [.elementActions, .connections]),
      selectedElementIDs: [],
      focusedElementID: 1,
      parent: parent,
      frameResolver: { $0 },
      onRequest: { _ in true }
    )
    let actionElement = try XCTUnwrap(
      actionBridge.accessibilityChildren().first as? NSAccessibilityElement
    )
    let actionNames = Set(actionElement.accessibilityCustomActions()?.map(\.name) ?? [])
    XCTAssertFalse(actionElement.accessibilityPerformPress())
    XCTAssertEqual(actionNames, ["Inspect Node", "Start Connection"])
  }

  func testOneHundredThousandElementWindowingPerformance() throws {
    let snapshot = try largeSnapshot()
    let options = XCTMeasureOptions()
    options.iterationCount = 5

    measure(options: options) {
      for focusedID in stride(from: 0, to: 100_000, by: 100) {
        XCTAssertEqual(
          snapshot.exposedItems(centeredAt: focusedID, maximumCount: 64).count,
          64
        )
      }
    }
  }

  private func snapshot(
    items: [FlowingGraphCanvasAccessibilityItem<Int>]
  ) throws -> FlowingGraphCanvasAccessibilitySnapshot<Int> {
    try FlowingGraphCanvasAccessibilitySnapshot(
      canvasDescription: .init(label: "Canvas"),
      items: items
    )
  }

  private func item(
    _ id: Int,
    relatedElementIDs: [Int] = []
  ) -> FlowingGraphCanvasAccessibilityItem<Int> {
    FlowingGraphCanvasAccessibilityItem(
      id: id,
      kind: .node,
      frame: CGRect(x: CGFloat(id * 20), y: 0, width: 20, height: 20),
      description: .init(label: "Node \(id)"),
      relatedElementIDs: relatedElementIDs
    )
  }

  private func largeSnapshot() throws -> FlowingGraphCanvasAccessibilitySnapshot<Int> {
    try snapshot(items: (0..<100_000).map { item($0) })
  }
}
