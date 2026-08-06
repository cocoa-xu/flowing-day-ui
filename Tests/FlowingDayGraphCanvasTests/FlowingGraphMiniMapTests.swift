import FlowingDayCanvas
import XCTest

@testable import FlowingDayGraphCanvas

final class FlowingGraphMiniMapTests: XCTestCase {
  func testTransformFitsAndRoundTripsWorldGeometry() {
    let transform = FlowingGraphMiniMapTransform(
      worldBounds: CGRect(x: 100, y: 200, width: 1_000, height: 500),
      viewSize: CGSize(width: 220, height: 144),
      padding: 10
    )
    let worldPoint = CGPoint(x: 740, y: 420)

    let roundTripped = transform.worldPoint(for: transform.viewPoint(for: worldPoint))

    XCTAssertEqual(transform.scale, 0.2, accuracy: 0.000_001)
    XCTAssertEqual(roundTripped.x, worldPoint.x, accuracy: 0.000_001)
    XCTAssertEqual(roundTripped.y, worldPoint.y, accuracy: 0.000_001)
  }

  func testOverviewScopeIncludesContentAndLocalViewport() {
    let bounds = FlowingGraphMiniMapScope.overview.bounds(
      contentBounds: CGRect(x: 100, y: 100, width: 400, height: 300),
      visibleWorldRect: CGRect(x: -200, y: 50, width: 200, height: 160)
    )

    XCTAssertEqual(bounds, CGRect(x: -200, y: 50, width: 700, height: 350))
  }

  func testLocalNavigatorUsesStableSurroundingScale() {
    let bounds = FlowingGraphMiniMapScope.localNavigator(surroundingScale: 3).bounds(
      contentBounds: CGRect(x: 0, y: 0, width: 10_000, height: 10_000),
      visibleWorldRect: CGRect(x: 400, y: 300, width: 800, height: 600)
    )

    XCTAssertEqual(bounds, CGRect(x: -400, y: -300, width: 2_400, height: 1_800))
  }

  func testAutomaticVisibilityOnlyAppearsWhenNavigationIsUseful() {
    let policy = FlowingGraphMiniMapVisibility.whenNavigationIsUseful
    let content = CGRect(x: 100, y: 100, width: 300, height: 200)

    XCTAssertFalse(
      policy.isVisible(
        contentBounds: content,
        visibleWorldRect: CGRect(x: 0, y: 0, width: 800, height: 600)
      )
    )
    XCTAssertTrue(
      policy.isVisible(
        contentBounds: content,
        visibleWorldRect: CGRect(x: 200, y: 100, width: 200, height: 200)
      )
    )
  }

  func testNavigationPreservesPointerOffsetInsideViewportIndicator() {
    let transform = FlowingGraphMiniMapTransform(
      worldBounds: CGRect(x: 0, y: 0, width: 1_000, height: 1_000),
      viewSize: CGSize(width: 200, height: 200),
      padding: 0
    )

    let center = FlowingGraphMiniMapNavigation.center(
      pointerLocation: CGPoint(x: 60, y: 80),
      transform: transform,
      centerOffset: CGSize(width: 50, height: -25)
    )

    XCTAssertEqual(center, CGPoint(x: 350, y: 375))
  }

  func testTrackpadPanUsesPinnedMiniMapTransform() {
    let transform = FlowingGraphMiniMapTransform(
      worldBounds: CGRect(x: 0, y: 0, width: 2_000, height: 1_000),
      viewSize: CGSize(width: 200, height: 100),
      padding: 0
    )

    let center = FlowingGraphMiniMapNavigation.pannedCenter(
      currentCenter: CGPoint(x: 1_000, y: 500),
      viewDelta: CGSize(width: 20, height: -10),
      transform: transform
    )

    XCTAssertEqual(center, CGPoint(x: 800, y: 600))
  }

  func testSilhouetteBatchesNodesByDeveloperStyleIndex() throws {
    let snapshot = FlowingGraphMiniMapSnapshot<Int, Int>(
      contentBounds: CGRect(x: 0, y: 0, width: 300, height: 100),
      nodes: [
        FlowingGraphMiniMapNode(id: 0, frame: CGRect(x: 0, y: 0, width: 40, height: 40)),
        FlowingGraphMiniMapNode(id: 1, frame: CGRect(x: 100, y: 0, width: 40, height: 40)),
        FlowingGraphMiniMapNode(id: 2, frame: CGRect(x: 200, y: 0, width: 40, height: 40)),
      ]
    )
    let transform = FlowingGraphMiniMapTransform(
      worldBounds: snapshot.contentBounds,
      viewSize: CGSize(width: 300, height: 100),
      padding: 0
    )

    let plan = try FlowingGraphMiniMapPlanner.plan(
      snapshot: snapshot,
      transform: transform,
      representation: .silhouette,
      performance: .standard,
      nodeStyleIndex: { $0.id % 2 }
    )

    XCTAssertFalse(plan.isAggregated)
    XCTAssertEqual(plan.nodeBatches.map(\.styleIndex), [0, 1])
    XCTAssertEqual(plan.nodeBatches.map(\.rects.count), [2, 1])
    XCTAssertTrue(plan.edgeSegments.isEmpty)
  }

  func testStructureIncludesSimplifiedEdges() throws {
    let snapshot = FlowingGraphMiniMapSnapshot<Int, Int>(
      contentBounds: CGRect(x: 0, y: 0, width: 200, height: 100),
      nodes: [
        FlowingGraphMiniMapNode(id: 0, frame: CGRect(x: 0, y: 0, width: 40, height: 40)),
        FlowingGraphMiniMapNode(id: 1, frame: CGRect(x: 160, y: 60, width: 40, height: 40)),
      ],
      edges: [
        FlowingGraphMiniMapEdge(
          id: 0,
          start: CGPoint(x: 40, y: 20),
          end: CGPoint(x: 160, y: 80)
        )
      ]
    )
    let transform = FlowingGraphMiniMapTransform(
      worldBounds: snapshot.contentBounds,
      viewSize: CGSize(width: 200, height: 100),
      padding: 0
    )

    let plan = try FlowingGraphMiniMapPlanner.plan(
      snapshot: snapshot,
      transform: transform,
      representation: .structure,
      performance: .standard,
      nodeStyleIndex: { _ in 0 }
    )

    XCTAssertEqual(plan.edgeSegments.count, 1)
    XCTAssertEqual(plan.edgeSegments[0].start, CGPoint(x: 40, y: 20))
    XCTAssertEqual(plan.edgeSegments[0].end, CGPoint(x: 160, y: 80))
  }

  func testSnapshotCarriesIncrementalChangesForCustomRenderBackends() {
    let baseSnapshotID = FlowingGraphMiniMapSnapshotID()
    let changes = FlowingGraphMiniMapChangeSet<Int, Int>(
      baseSnapshotID: baseSnapshotID,
      insertedNodes: [
        FlowingGraphMiniMapNode(id: 4, frame: CGRect(x: 40, y: 0, width: 10, height: 10))
      ],
      updatedNodes: [
        FlowingGraphMiniMapNode(id: 2, frame: CGRect(x: 20, y: 0, width: 12, height: 12))
      ],
      removedEdgeIDs: [9],
      contentBoundsChanged: true
    )
    let snapshot = FlowingGraphMiniMapSnapshot<Int, Int>(
      contentBounds: CGRect(x: 0, y: 0, width: 100, height: 100),
      nodes: [],
      changeSet: changes
    )

    XCTAssertEqual(snapshot.changeSet?.baseSnapshotID, baseSnapshotID)
    XCTAssertEqual(snapshot.changeSet?.insertedNodes.map(\.id), [4])
    XCTAssertEqual(snapshot.changeSet?.updatedNodes.map(\.id), [2])
    XCTAssertEqual(snapshot.changeSet?.removedEdgeIDs, [9])
    XCTAssertEqual(snapshot.changeSet?.contentBoundsChanged, true)
  }

  func testAdaptiveAggregationHonorsTheExplicitCellMemoryBudget() throws {
    let snapshot = largeSnapshot()
    let performance = FlowingGraphMiniMapPerformanceConfiguration(
      aggregationCellSize: 1,
      maximumNodePrimitiveDensity: 0.001,
      maximumEdgePrimitiveDensity: 0.08,
      maximumAdaptiveStyleCount: 4,
      maximumAggregationCellCount: 10_000
    )
    let transform = FlowingGraphMiniMapTransform(
      worldBounds: snapshot.contentBounds,
      viewSize: CGSize(width: 4_000, height: 4_000),
      padding: 0
    )

    let plan = try FlowingGraphMiniMapPlanner.plan(
      snapshot: snapshot,
      transform: transform,
      representation: .adaptive,
      performance: performance,
      nodeStyleIndex: { _ in 0 }
    )

    XCTAssertLessThanOrEqual(plan.nodePrimitiveCount, 10_000)
  }

  func testAdaptiveDetailPlanCapsDeveloperStyleCardinality() throws {
    let snapshot = FlowingGraphMiniMapSnapshot<Int, Int>(
      contentBounds: CGRect(x: 0, y: 0, width: 100, height: 100),
      nodes: (0..<20).map {
        FlowingGraphMiniMapNode(
          id: $0,
          frame: CGRect(x: CGFloat($0), y: 0, width: 1, height: 1)
        )
      }
    )
    let performance = FlowingGraphMiniMapPerformanceConfiguration(
      maximumAdaptiveStyleCount: 4
    )
    let transform = FlowingGraphMiniMapTransform(
      worldBounds: snapshot.contentBounds,
      viewSize: CGSize(width: 220, height: 144),
      padding: 10
    )

    let plan = try FlowingGraphMiniMapPlanner.plan(
      snapshot: snapshot,
      transform: transform,
      representation: .adaptive,
      performance: performance,
      nodeStyleIndex: { $0.id }
    )

    XCTAssertFalse(plan.isAggregated)
    XCTAssertEqual(plan.nodeBatches.count, 4)
  }

  func testAdaptivePlanningCooperativelyCancels() async {
    let snapshot = largeSnapshot()
    let transform = FlowingGraphMiniMapTransform(
      worldBounds: snapshot.contentBounds,
      viewSize: CGSize(width: 220, height: 144),
      padding: 10
    )
    let task = Task.detached {
      try FlowingGraphMiniMapPlanner.plan(
        snapshot: snapshot,
        transform: transform,
        representation: .adaptive,
        performance: .standard,
        availableNodeStyleCount: 1,
        nodeStyleIndex: { _ in 0 }
      )
    }
    task.cancel()

    do {
      _ = try await task.value
      XCTFail("Cancelled planning unexpectedly completed")
    } catch is CancellationError {
    } catch {
      XCTFail("Unexpected cancellation error: \(error)")
    }
  }

  func testAdaptivePlanBoundsOneHundredThousandNodesByPixelBudget() throws {
    let snapshot = largeSnapshot()
    let transform = FlowingGraphMiniMapTransform(
      worldBounds: snapshot.contentBounds,
      viewSize: CGSize(width: 220, height: 144),
      padding: 10
    )

    let plan = try FlowingGraphMiniMapPlanner.plan(
      snapshot: snapshot,
      transform: transform,
      representation: .adaptive,
      performance: .standard,
      nodeStyleIndex: { $0.id % 4 }
    )
    let maximumGridCells = Int(ceil(220.0 / 2.0) * ceil(144.0 / 2.0))

    XCTAssertTrue(plan.isAggregated)
    XCTAssertLessThanOrEqual(plan.nodePrimitiveCount, maximumGridCells)
    XCTAssertLessThanOrEqual(plan.nodeBatches.count, 4)
    XCTAssertTrue(plan.edgeSegments.isEmpty)
  }

  func testOneHundredThousandNodeAdaptivePlanningPerformance() {
    let snapshot = largeSnapshot()
    let transform = FlowingGraphMiniMapTransform(
      worldBounds: snapshot.contentBounds,
      viewSize: CGSize(width: 220, height: 144),
      padding: 10
    )
    let options = XCTMeasureOptions()
    options.iterationCount = 3

    measure(options: options) {
      do {
        let plan = try FlowingGraphMiniMapPlanner.plan(
          snapshot: snapshot,
          transform: transform,
          representation: .adaptive,
          performance: .standard,
          availableNodeStyleCount: 1,
          nodeStyleIndex: { _ in 0 }
        )
        XCTAssertTrue(plan.isAggregated)
      } catch {
        XCTFail("Planning failed: \(error)")
      }
    }
  }

  private func largeSnapshot() -> FlowingGraphMiniMapSnapshot<Int, Int> {
    let columnCount = 400
    let rowCount = 250
    let spacing: CGFloat = 12
    var nodes: [FlowingGraphMiniMapNode<Int>] = []
    nodes.reserveCapacity(columnCount * rowCount)
    for row in 0..<rowCount {
      for column in 0..<columnCount {
        let id = row * columnCount + column
        nodes.append(
          FlowingGraphMiniMapNode(
            id: id,
            frame: CGRect(
              x: CGFloat(column) * spacing,
              y: CGFloat(row) * spacing,
              width: 8,
              height: 8
            )
          )
        )
      }
    }
    return FlowingGraphMiniMapSnapshot(
      contentBounds: CGRect(
        x: 0,
        y: 0,
        width: CGFloat(columnCount) * spacing,
        height: CGFloat(rowCount) * spacing
      ),
      nodes: nodes
    )
  }
}
