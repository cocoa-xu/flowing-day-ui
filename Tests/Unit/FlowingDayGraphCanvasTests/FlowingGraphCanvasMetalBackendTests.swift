import FlowingDayCanvas
import FlowingDayGraphCanvas
import SwiftUI
import XCTest

final class FlowingGraphCanvasMetalBackendTests: XCTestCase {
  func testCameraRoundTripsWorldCoordinates() {
    let camera = FlowingGraphCanvasMetalCamera(
      zoom: 1.75,
      offset: CGSize(width: 40, height: 70)
    )
    let worldPoint = CGPoint(x: 300, y: 220)

    let roundTrip = camera.worldPoint(for: camera.viewportPoint(for: worldPoint))

    XCTAssertEqual(roundTrip.x, worldPoint.x, accuracy: 0.000_001)
    XCTAssertEqual(roundTrip.y, worldPoint.y, accuracy: 0.000_001)
  }

  func testMagnificationKeepsViewportAnchorStable() {
    var camera = FlowingGraphCanvasMetalCamera(
      zoom: 1,
      offset: CGSize(width: 40, height: 70)
    )
    let viewportAnchor = CGPoint(x: 360, y: 240)
    let worldAnchor = camera.worldPoint(for: viewportAnchor)

    camera.magnify(
      by: 0.5,
      at: viewportAnchor,
      sensitivity: 1.6,
      range: 0.42...3
    )

    XCTAssertEqual(camera.zoom, 1.8, accuracy: 0.000_1)
    XCTAssertEqual(camera.viewportPoint(for: worldAnchor).x, viewportAnchor.x, accuracy: 0.000_1)
    XCTAssertEqual(camera.viewportPoint(for: worldAnchor).y, viewportAnchor.y, accuracy: 0.000_1)
  }

  func testFitCentersContentInsideViewportInsets() {
    var camera = FlowingGraphCanvasMetalCamera()
    let content = CGRect(x: 100, y: 80, width: 600, height: 400)
    let insets = EdgeInsets(top: 20, leading: 280, bottom: 20, trailing: 20)

    camera.fit(
      content,
      viewportSize: CGSize(width: 1_200, height: 760),
      contentInsets: insets,
      padding: 40,
      maximumZoom: 1,
      range: 0.42...3
    )

    let center = camera.viewportPoint(for: CGPoint(x: content.midX, y: content.midY))
    XCTAssertEqual(center.x, 730, accuracy: 0.000_1)
    XCTAssertEqual(center.y, 380, accuracy: 0.000_1)
  }

  func testVisibleWorldRectExcludesViewportInsets() {
    let camera = FlowingGraphCanvasMetalCamera(
      zoom: 2,
      offset: CGSize(width: 40, height: 20)
    )

    let visibleRect = camera.visibleWorldRect(
      viewportSize: CGSize(width: 1_200, height: 760),
      contentInsets: EdgeInsets(top: 20, leading: 280, bottom: 40, trailing: 20)
    )

    XCTAssertEqual(visibleRect.minX, 120, accuracy: 0.000_1)
    XCTAssertEqual(visibleRect.minY, 0, accuracy: 0.000_1)
    XCTAssertEqual(visibleRect.width, 450, accuracy: 0.000_1)
    XCTAssertEqual(visibleRect.height, 350, accuracy: 0.000_1)
  }

  func testConfigurationClampsInitialZoom() {
    let configuration = FlowingGraphCanvasMetalBackendConfiguration(
      initialZoom: 9,
      zoomRange: 0.5...3
    )

    XCTAssertEqual(configuration.initialZoom, 3)
  }
}
