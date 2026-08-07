import FlowingDayGraphCanvas
import XCTest

final class FlowingGraphCanvasRenderingBackendTests: XCTestCase {
  func testAutomaticPrefersMetalWhenTheCompleteBackendIsAvailable() {
    let resolved = FlowingGraphCanvasRenderingBackendResolver.resolve(
      preference: .automatic,
      capabilities: .init(hasMetalDevice: true, hasMetalVisualAdapter: true)
    )

    XCTAssertEqual(resolved, .metal)
  }

  func testAutomaticFallsBackWhenMetalHasNoVisualAdapter() {
    let resolved = FlowingGraphCanvasRenderingBackendResolver.resolve(
      preference: .automatic,
      capabilities: .init(hasMetalDevice: true, hasMetalVisualAdapter: false)
    )

    XCTAssertEqual(resolved, .swiftUI)
  }

  func testAutomaticFallsBackWhenMetalIsUnavailable() {
    let resolved = FlowingGraphCanvasRenderingBackendResolver.resolve(
      preference: .automatic,
      capabilities: .init(hasMetalDevice: false, hasMetalVisualAdapter: true)
    )

    XCTAssertEqual(resolved, .swiftUI)
  }

  func testExplicitSwiftUIDoesNotSelectMetal() {
    let resolved = FlowingGraphCanvasRenderingBackendResolver.resolve(
      preference: .swiftUI,
      capabilities: .init(hasMetalDevice: true, hasMetalVisualAdapter: true)
    )

    XCTAssertEqual(resolved, .swiftUI)
  }

  func testExplicitMetalFallsBackSafelyWhenUnavailable() {
    let resolved = FlowingGraphCanvasRenderingBackendResolver.resolve(
      preference: .metal,
      capabilities: .init(hasMetalDevice: false, hasMetalVisualAdapter: true)
    )

    XCTAssertEqual(resolved, .swiftUI)
  }
}
