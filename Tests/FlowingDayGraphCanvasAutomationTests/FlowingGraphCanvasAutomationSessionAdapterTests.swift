import FlowingDayGraphCanvas
import FlowingDayGraphCanvasAutomation
import FlowingDayGraphComposition
import FlowingDayGraphCore
import XCTest

private enum AutomationCanvasGraphSchema: FlowingGraphSchema {
  typealias NodeID = String
  typealias NodeValue = String
  typealias PortID = String
  typealias PortValue = String
  typealias EdgeID = String
  typealias EdgeValue = String
}

private enum AutomationCanvasSchema: FlowingGraphCanvasSchema {
  typealias DocumentID = String
  typealias GraphID = String
  typealias EntryPointID = String
  typealias LinkID = String
  typealias LinkValue = String
  typealias OccurrenceID = String
  typealias GraphSchema = AutomationCanvasGraphSchema
}

private typealias ElementID = FlowingGraphCompositionElementID<AutomationCanvasSchema>

final class FlowingGraphCanvasAutomationSessionAdapterTests: XCTestCase {
  func testAdapterPreservesIdentityActionAndExplicitCanvasSession() {
    let sessionID = FlowingGraphCanvasSessionID()
    let elementID = testElementID("node")
    let command = FlowingGraphCanvasAutomationCommand<AutomationCanvasSchema>(
      action: .focus(elementID: elementID, zoom: 2),
      animated: false
    )

    let canvasCommand = FlowingGraphCanvasAutomationSessionAdapter<AutomationCanvasSchema>(
      sessionID: sessionID
    ).canvasCommand(for: command)

    XCTAssertEqual(canvasCommand.id, command.id)
    XCTAssertEqual(canvasCommand.targetSessionID, sessionID)
    XCTAssertEqual(canvasCommand.action, command.action)
    XCTAssertFalse(canvasCommand.animated)
  }

  func testReadRequirementsDescribePresentationSessionAndElementAccess() {
    let first = testElementID("first")
    let second = testElementID("second")

    let focus = FlowingGraphCanvasAutomationCommand<AutomationCanvasSchema>(
      action: .focus(elementID: first)
    )
    XCTAssertEqual(focus.readRequirement.elementIDs, [first])
    XCTAssertFalse(focus.readRequirement.includesSessionState)
    XCTAssertFalse(focus.readRequirement.includesPresentation)

    let selection = FlowingGraphCanvasAutomationCommand<AutomationCanvasSchema>(
      action: .select(.toggle([first, second]))
    )
    XCTAssertEqual(selection.readRequirement.elementIDs, [first, second])
    XCTAssertTrue(selection.readRequirement.includesSessionState)

    let fit = FlowingGraphCanvasAutomationCommand<AutomationCanvasSchema>(
      action: .fit(scope: .selection, padding: 24)
    )
    XCTAssertTrue(fit.readRequirement.includesSessionState)
    XCTAssertTrue(fit.readRequirement.includesPresentation)
    XCTAssertTrue(fit.readRequirement.elementIDs.isEmpty)

    let arrangement = FlowingGraphCanvasAutomationCommand<AutomationCanvasSchema>(
      action: .arrange(.align(.leading))
    )
    XCTAssertTrue(arrangement.readRequirement.includesSessionState)
    XCTAssertTrue(arrangement.readRequirement.includesPresentation)
    XCTAssertTrue(arrangement.readRequirement.elementIDs.isEmpty)
  }
}

private func testElementID(_ nodeID: String) -> ElementID {
  .source(
    address: .init(
      instancePath: .root,
      graphID: "graph",
      elementID: .node(nodeID)
    ),
    occurrenceID: nil
  )
}
