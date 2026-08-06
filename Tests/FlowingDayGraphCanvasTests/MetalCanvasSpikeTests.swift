import XCTest

@testable import FlowingDayGraphCanvasExample

final class MetalCanvasSpikeTests: XCTestCase {
  func testCameraPanPreservesFractionalInput() {
    var camera = MetalCanvasSpikeCamera(
      zoom: 1.25,
      offset: CGSize(width: 40, height: -18)
    )

    camera.pan(by: CGSize(width: 3.375, height: -7.625))

    XCTAssertEqual(camera.offset.width, 43.375)
    XCTAssertEqual(camera.offset.height, -25.625)
  }

  func testMagnificationKeepsWorldAnchorUnderPointer() {
    var camera = MetalCanvasSpikeCamera(
      zoom: 0.8,
      offset: CGSize(width: 120, height: 64)
    )
    let pointer = CGPoint(x: 470, y: 315)
    let worldAnchor = camera.worldPoint(for: pointer)

    camera.magnify(by: 0.18, at: pointer)

    let anchoredPoint = CGPoint(
      x: worldAnchor.x * camera.zoom + camera.offset.width,
      y: worldAnchor.y * camera.zoom + camera.offset.height
    )
    XCTAssertEqual(anchoredPoint.x, pointer.x, accuracy: 0.001)
    XCTAssertEqual(anchoredPoint.y, pointer.y, accuracy: 0.001)
  }

  func testFitKeepsContentInsidePaddedViewport() {
    var camera = MetalCanvasSpikeCamera()
    let content = CGRect(x: 200, y: 100, width: 1_600, height: 900)
    let viewport = CGSize(width: 1_180, height: 760)

    camera.fit(content, in: viewport, padding: 64)

    let displayed = CGRect(
      x: content.minX * camera.zoom + camera.offset.width,
      y: content.minY * camera.zoom + camera.offset.height,
      width: content.width * camera.zoom,
      height: content.height * camera.zoom
    )
    XCTAssertGreaterThanOrEqual(displayed.minX, 64)
    XCTAssertGreaterThanOrEqual(displayed.minY, 64)
    XCTAssertLessThanOrEqual(displayed.maxX, viewport.width - 64)
    XCTAssertLessThanOrEqual(displayed.maxY, viewport.height - 64)
  }

  func testSceneMovesOnlySelectedNodesFromStableOrigins() {
    var scene = MetalCanvasSpikeScene.make(nodeCount: 12)
    let firstOrigin = scene.nodes[2].frame.origin
    let secondOrigin = scene.nodes[7].frame.origin
    let untouchedOrigin = scene.nodes[5].frame.origin

    scene.moveNodes(
      from: [2: firstOrigin, 7: secondOrigin],
      by: CGSize(width: 14.5, height: -9.25)
    )

    XCTAssertEqual(scene.nodes[2].frame.origin.x, firstOrigin.x + 14.5)
    XCTAssertEqual(scene.nodes[2].frame.origin.y, firstOrigin.y - 9.25)
    XCTAssertEqual(scene.nodes[7].frame.origin.x, secondOrigin.x + 14.5)
    XCTAssertEqual(scene.nodes[7].frame.origin.y, secondOrigin.y - 9.25)
    XCTAssertEqual(scene.nodes[5].frame.origin, untouchedOrigin)
  }

  func testMarqueeIntersectionFindsOnlyCoveredNodes() {
    let scene = MetalCanvasSpikeScene.make(nodeCount: 9)
    let firstFrame = scene.nodes[0].frame
    let secondFrame = scene.nodes[1].frame
    let marquee = firstFrame.union(secondFrame)

    XCTAssertEqual(scene.nodeIDs(intersecting: marquee), [0, 1])
  }
}
