import FlowingDayGraphComposition
import FlowingDayGraphCore
import XCTest

final class FlowingGraphEditingIntentTests: XCTestCase {
  func testProjectionIntentCarriesSnapshotAndCanonicalSite() {
    let snapshotID = FlowingGraphPresentationSnapshotID()
    let target = site(graphID: "root", nodeID: "composite")
    let intent = FlowingGraphProjectionIntent<TestCompositionSchema>(
      basePresentationSnapshotID: snapshotID,
      action: .setExpansion(.expanded, at: target)
    )

    XCTAssertEqual(intent.basePresentationSnapshotID, snapshotID)
    XCTAssertEqual(intent.action, .setExpansion(.expanded, at: target))
  }

  func testDocumentIntentCarriesSemanticInterfaceEdit() {
    let snapshotID = FlowingGraphDocumentSnapshotID()
    let binding = FlowingSubgraphInterfaceBinding<TestCompositionSchema>(
      externalPort: FlowingGraphPortKey(nodeID: "composite", portID: "output"),
      internalEndpoint: .port(
        FlowingGraphPortKey(nodeID: "result", portID: "value")
      )
    )
    let intent = FlowingGraphDocumentEditIntent<TestCompositionSchema>(
      baseDocumentSnapshotID: snapshotID,
      action: .createInterfaceBinding(
        linkID: "child-link",
        binding: binding,
        position: .last
      )
    )

    XCTAssertEqual(intent.baseDocumentSnapshotID, snapshotID)
    XCTAssertEqual(
      intent.action,
      .createInterfaceBinding(
        linkID: "child-link",
        binding: binding,
        position: .last
      )
    )
  }

  func testEditorIntentIsConditionallySendable() {
    let intent = FlowingGraphEditorIntent<TestCompositionSchema>.inspection(
      .definition(
        documentSnapshotID: FlowingGraphDocumentSnapshotID(),
        graphID: "root"
      )
    )

    requireSendable(intent)
  }

  private func requireSendable<T: Sendable>(_ value: T) {
    _ = value
  }
}
