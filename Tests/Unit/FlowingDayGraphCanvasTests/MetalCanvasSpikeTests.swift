import XCTest

@testable import FlowingDayGraphCanvasExample

final class MetalCanvasSpikeTests: XCTestCase {
  func testConfigurationUsesRequestedNodeCountAndPanBenchmark() {
    let configuration = MetalCanvasSpikeConfiguration(
      arguments: [
        "example",
        "--canvas-metal-node-count", "10000",
        "--canvas-metal-pan-benchmark",
      ]
    )

    XCTAssertEqual(configuration.nodeCount, 10_000)
    XCTAssertEqual(configuration.benchmarkInteraction, .pan)
  }

  func testConfigurationEnablesZoomBenchmark() {
    let configuration = MetalCanvasSpikeConfiguration(
      arguments: ["example", "--canvas-metal-zoom-benchmark"]
    )

    XCTAssertEqual(configuration.benchmarkInteraction, .zoom)
  }

  func testConfigurationRejectsInvalidNodeCounts() {
    for value in ["0", "-1", "not-a-number"] {
      let configuration = MetalCanvasSpikeConfiguration(
        arguments: ["example", "--canvas-metal-node-count", value]
      )

      XCTAssertEqual(configuration.nodeCount, MetalCanvasSpikeConfiguration.defaultNodeCount)
      XCTAssertEqual(configuration.benchmarkInteraction, .none)
    }
  }

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

  func testVisibleWorldRectIncludesViewportOverscan() {
    let camera = MetalCanvasSpikeCamera(
      zoom: 2,
      offset: CGSize(width: 100, height: -40)
    )

    let visibleRect = camera.visibleWorldRect(
      viewportSize: CGSize(width: 800, height: 600),
      overscan: 120
    )

    XCTAssertEqual(visibleRect.minX, -110)
    XCTAssertEqual(visibleRect.minY, -40)
    XCTAssertEqual(visibleRect.width, 520)
    XCTAssertEqual(visibleRect.height, 420)
  }

  func testNodeLevelOfDetailUsesRenderedPixelHeight() {
    let nodeHeight: CGFloat = 66

    XCTAssertEqual(
      MetalCanvasSpikeNodeLevelOfDetail.resolve(
        nodeHeight: nodeHeight,
        zoom: 17 / nodeHeight
      ),
      .overview
    )
    XCTAssertEqual(
      MetalCanvasSpikeNodeLevelOfDetail.resolve(
        nodeHeight: nodeHeight,
        zoom: 18 / nodeHeight
      ),
      .compact
    )
    XCTAssertEqual(
      MetalCanvasSpikeNodeLevelOfDetail.resolve(
        nodeHeight: nodeHeight,
        zoom: 44 / nodeHeight
      ),
      .full
    )
  }

  func testRenderSliceCoverageReusesOverscanUntilViewportOrLevelOfDetailChanges() {
    let coverage = MetalCanvasSpikeRenderSliceCoverage(
      retainedWorldRect: CGRect(x: 0, y: 0, width: 800, height: 600),
      levelOfDetail: .compact
    )

    XCTAssertTrue(
      coverage.covers(
        viewportWorldRect: CGRect(x: 50, y: 50, width: 700, height: 500),
        levelOfDetail: .compact
      )
    )
    XCTAssertFalse(
      coverage.covers(
        viewportWorldRect: CGRect(x: 200, y: 0, width: 800, height: 600),
        levelOfDetail: .compact
      )
    )
    XCTAssertFalse(
      coverage.covers(
        viewportWorldRect: CGRect(x: 0, y: 0, width: 800, height: 600),
        levelOfDetail: .full
      )
    )
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

  func testRenderIndexExcludesOffscreenElements() {
    let scene = MetalCanvasSpikeScene.make(nodeCount: 10_000)
    let viewport = scene.nodes[0].frame.insetBy(dx: -20, dy: -20)

    let visible = scene.renderElementIDs(intersecting: viewport)

    XCTAssertEqual(visible.nodeIDs, [0])
    XCTAssertLessThan(visible.edgeIDs.count, scene.edges.count)
  }

  func testMovedNodeAndIncidentEdgeRemainVisibleBeforeAndAfterIndexCommit() {
    var scene = MetalCanvasSpikeScene.make(nodeCount: 40)
    let nodeID = 39
    let edgeID = 38
    let origin = scene.node(for: nodeID)!.frame.origin

    scene.moveNodes(
      from: [nodeID: origin],
      by: CGSize(width: 20_000, height: 0)
    )
    let movedFrame = scene.node(for: nodeID)!.frame

    XCTAssertEqual(scene.nodeID(at: CGPoint(x: movedFrame.midX, y: movedFrame.midY)), nodeID)
    var visible = scene.renderElementIDs(intersecting: movedFrame)
    XCTAssertTrue(visible.nodeIDs.contains(nodeID))
    XCTAssertTrue(visible.edgeIDs.contains(edgeID))

    scene.commitMoves()
    XCTAssertEqual(scene.nodeID(at: CGPoint(x: movedFrame.midX, y: movedFrame.midY)), nodeID)
    visible = scene.renderElementIDs(intersecting: movedFrame)
    XCTAssertTrue(visible.nodeIDs.contains(nodeID))
    XCTAssertTrue(visible.edgeIDs.contains(edgeID))
  }

  func testRenderIndexRejectsStaleBackgroundUpdate() {
    var scene = MetalCanvasSpikeScene.make(nodeCount: 40)
    let nodeID = 39
    let firstOrigin = scene.node(for: nodeID)!.frame.origin
    scene.moveNodes(
      from: [nodeID: firstOrigin],
      by: CGSize(width: 1_000, height: 0)
    )
    let staleUpdate = scene.renderIndexSnapshot().build()

    let secondOrigin = scene.node(for: nodeID)!.frame.origin
    scene.moveNodes(
      from: [nodeID: secondOrigin],
      by: CGSize(width: 1_000, height: 0)
    )

    XCTAssertFalse(scene.install(staleUpdate))
    XCTAssertTrue(scene.hasPendingIndexChanges)

    XCTAssertTrue(scene.install(scene.renderIndexSnapshot().build()))
    XCTAssertFalse(scene.hasPendingIndexChanges)
  }
}
