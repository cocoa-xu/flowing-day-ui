import FlowingDayCanvas
import FlowingDayGraphCanvas
import XCTest

final class FlowingGraphCanvasGuideTests: XCTestCase {
  func testRenderContextMapsHorizontalGuidesIntoTheCurrentSurface() {
    let context = FlowingGraphCanvasGuideRenderContext(
      guide: FlowingGraphCanvasGuide(
        axis: .horizontal,
        position: 20,
        lowerBound: 10,
        upperBound: 30,
        kind: .equalSpacing,
        measurement: 20
      ),
      transform: FlowingCanvasTransform(
        zoom: 2,
        offset: CGSize(width: 5, height: 7)
      )
    )

    XCTAssertEqual(context.renderedStart, CGPoint(x: 25, y: 47))
    XCTAssertEqual(context.renderedEnd, CGPoint(x: 65, y: 47))
    XCTAssertEqual(context.renderedMidpoint, CGPoint(x: 45, y: 47))
    XCTAssertEqual(context.renderedLength, 40)
    XCTAssertTrue(context.usesEndpointTicks)
  }

  func testRenderContextMapsVerticalGuidesWithoutEndpointTicks() {
    let context = FlowingGraphCanvasGuideRenderContext(
      guide: FlowingGraphCanvasGuide(
        axis: .vertical,
        position: 12,
        lowerBound: 4,
        upperBound: 24,
        kind: .alignment
      ),
      transform: FlowingCanvasTransform(
        zoom: 1.5,
        offset: CGSize(width: 2, height: 3)
      )
    )

    XCTAssertEqual(context.renderedStart, CGPoint(x: 20, y: 9))
    XCTAssertEqual(context.renderedEnd, CGPoint(x: 20, y: 39))
    XCTAssertFalse(context.usesEndpointTicks)
  }

  func testDefaultGuideRenderingCanBeDisabledForACustomLayer() {
    XCTAssertTrue(FlowingGraphCanvasConfiguration().rendersDefaultGuides)
    XCTAssertFalse(
      FlowingGraphCanvasConfiguration(rendersDefaultGuides: false).rendersDefaultGuides
    )
  }
}
