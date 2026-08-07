import XCTest

@MainActor
final class FlowingDayGraphCanvasUITests: XCTestCase {
  func testWorldLayerNodeReceivesPointerSequence() {
    let app = launchApp(scenario: "worldLayerDrag")
    drag(element("world-layer-drag-target", in: app), by: CGVector(dx: 72, dy: 48))

    XCTAssertTrue(waitForValue("Ended", of: "world-layer-node-state", in: app))
  }

  func testPortLayerDoesNotInterceptNodeDrag() {
    let app = launchApp(scenario: "graphPortHitTesting")
    drag(app.staticTexts["Node A"], by: CGVector(dx: 72, dy: 48))

    XCTAssertTrue(waitForValue("Ended", of: "graph-port-hit-testing-state", in: app))
  }

  func testCompleteExampleCommitsNodeDragIntent() {
    let app = launchApp(scenario: "graphCanvas")
    drag(app.groups["Node A"], by: CGVector(dx: 72, dy: 48))

    XCTAssertTrue(
      waitForValue("Applied node placement intent", of: "showcase-last-intent", in: app))
  }

  func testCompleteExampleCommitsKeyboardNudgeIntent() {
    let app = launchApp(scenario: "graphCanvas")
    let node = app.groups["Node A"]
    XCTAssertTrue(node.waitForExistence(timeout: 5))
    node.click()
    app.typeKey(XCUIKeyboardKey.rightArrow.rawValue, modifierFlags: .shift)

    XCTAssertTrue(
      waitForValue("Applied node placement intent", of: "showcase-last-intent", in: app))
  }

  func testCompleteExampleCommitsResizeIntent() {
    let app = launchApp(scenario: "graphCanvas")
    let node = app.groups["Node A"]
    XCTAssertTrue(node.waitForExistence(timeout: 5))
    node.click()
    drag(element("showcase-resize-handle-bottom-trailing", in: app), by: CGVector(dx: 48, dy: 32))

    XCTAssertTrue(waitForValue("Applied node resize intent", of: "showcase-last-intent", in: app))
  }

  func testCompleteExampleCreatesAValidatedConnection() {
    let app = launchApp(scenario: "graphCanvas")
    let source = element("showcase-port-output", in: app)
    let target = element("showcase-port-input", in: app)
    XCTAssertTrue(source.waitForExistence(timeout: 5))
    XCTAssertTrue(target.waitForExistence(timeout: 5))

    source.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).click(
      forDuration: 0.05,
      thenDragTo: target.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)),
      withVelocity: .slow,
      thenHoldForDuration: 0.05
    )

    XCTAssertTrue(waitForValue("Created connection", of: "showcase-last-intent", in: app))
  }

  func testCompleteExampleSearchesAndJumpsToElement() {
    let app = launchApp(scenario: "graphCanvas")
    let field = element("graph-canvas-search-field", in: app)
    XCTAssertTrue(field.waitForExistence(timeout: 5))
    field.click()
    field.typeText("Node B")

    let result = app.descendants(matching: .any).matching(
      NSPredicate(format: "identifier BEGINSWITH %@", "graph-canvas-search-result-")
    ).firstMatch
    XCTAssertTrue(result.waitForExistence(timeout: 3))
    result.click()

    XCTAssertTrue(waitForValue("Jumped to Node B", of: "showcase-last-intent", in: app))
  }

  private func launchApp(scenario: String) -> XCUIApplication {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchArguments = [
      "-ApplePersistenceIgnoreState",
      "YES",
      "--scenario",
      scenario,
    ]
    app.launch()
    app.activate()
    XCTAssertTrue(app.windows.firstMatch.waitForExistence(timeout: 5))
    return app
  }

  private func element(_ identifier: String, in app: XCUIApplication) -> XCUIElement {
    app.descendants(matching: .any).matching(identifier: identifier).firstMatch
  }

  private func drag(_ element: XCUIElement, by translation: CGVector) {
    XCTAssertTrue(element.waitForExistence(timeout: 5))
    drag(
      from: element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)),
      by: translation
    )
  }

  private func drag(from start: XCUICoordinate, by translation: CGVector) {
    start.click(
      forDuration: 0.05,
      thenDragTo: start.withOffset(translation),
      withVelocity: .slow,
      thenHoldForDuration: 0.05
    )
  }

  private func waitForValue(
    _ value: String,
    of identifier: String,
    in app: XCUIApplication
  ) -> Bool {
    let state = element(identifier, in: app)
    guard state.waitForExistence(timeout: 3) else { return false }
    let predicate = NSPredicate { evaluated, _ in
      (evaluated as? XCUIElement)?.value as? String == value
    }
    return XCTWaiter.wait(
      for: [XCTNSPredicateExpectation(predicate: predicate, object: state)],
      timeout: 3
    ) == .completed
  }
}
