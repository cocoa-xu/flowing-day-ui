import FlowingDayGraphCanvas
import XCTest

final class FlowingGraphCanvasArrangementTests: XCTestCase {
  func testDisabledSnappingPreservesTheProposedTranslation() {
    let result = FlowingGraphCanvasArrangement.snap(
      movingBounds: CGRect(x: 0, y: 0, width: 100, height: 60),
      proposedTranslation: CGSize(width: 4, height: 7),
      candidates: [
        FlowingGraphCanvasSnapCandidate(
          id: "candidate",
          frame: CGRect(x: 105, y: 200, width: 80, height: 40)
        )
      ],
      configuration: .disabled,
      zoom: 1
    )

    XCTAssertEqual(result.translation, CGSize(width: 4, height: 7))
    XCTAssertTrue(result.guides.isEmpty)
  }

  func testAlignmentSnapWinsWhenItRequiresLessCorrectionThanTheGrid() {
    let result = FlowingGraphCanvasArrangement.snap(
      movingBounds: CGRect(x: 0, y: 0, width: 100, height: 60),
      proposedTranslation: CGSize(width: 3, height: 0),
      candidates: [
        FlowingGraphCanvasSnapCandidate(
          id: "candidate",
          frame: CGRect(x: 105, y: 200, width: 80, height: 40)
        )
      ],
      configuration: FlowingGraphCanvasSnappingConfiguration(
        isEnabled: true,
        gridCellSize: CGSize(width: 20, height: 20)
      ),
      zoom: 1
    )

    XCTAssertEqual(result.translation, CGSize(width: 5, height: 0))
    XCTAssertEqual(
      result.guides,
      [
        FlowingGraphCanvasGuide(
          axis: .vertical,
          position: 105,
          lowerBound: 0,
          upperBound: 240,
          kind: .alignment
        ),
        FlowingGraphCanvasGuide(
          axis: .horizontal,
          position: 0,
          lowerBound: 5,
          upperBound: 105,
          kind: .grid
        ),
      ]
    )
  }

  func testSnapToleranceIsMeasuredInRenderedPoints() {
    let candidate = FlowingGraphCanvasSnapCandidate(
      id: "candidate",
      frame: CGRect(x: 106, y: 200, width: 80, height: 40)
    )
    let configuration = FlowingGraphCanvasSnappingConfiguration(isEnabled: true)
    let movingBounds = CGRect(x: 0, y: 0, width: 100, height: 60)

    let normalZoom = FlowingGraphCanvasArrangement.snap(
      movingBounds: movingBounds,
      proposedTranslation: CGSize(width: 2, height: 0),
      candidates: [candidate],
      configuration: configuration,
      zoom: 1
    )
    let enlarged = FlowingGraphCanvasArrangement.snap(
      movingBounds: movingBounds,
      proposedTranslation: CGSize(width: 2, height: 0),
      candidates: [candidate],
      configuration: configuration,
      zoom: 2
    )

    XCTAssertEqual(normalZoom.translation.width, 6)
    XCTAssertEqual(enlarged.translation.width, 2)
  }

  func testSnappingHonorsTheCandidateBudget() {
    let result = FlowingGraphCanvasArrangement.snap(
      movingBounds: CGRect(x: 0, y: 0, width: 100, height: 60),
      proposedTranslation: .zero,
      candidates: [
        FlowingGraphCanvasSnapCandidate(
          id: "outside-budget",
          frame: CGRect(x: 300, y: 300, width: 80, height: 40)
        ),
        FlowingGraphCanvasSnapCandidate(
          id: "would-snap",
          frame: CGRect(x: 104, y: 200, width: 80, height: 40)
        ),
      ],
      configuration: FlowingGraphCanvasSnappingConfiguration(
        isEnabled: true,
        maximumCandidates: 1
      ),
      zoom: 1
    )

    XCTAssertEqual(result.translation, .zero)
    XCTAssertTrue(result.guides.isEmpty)
  }

  func testAlignmentHandlesNodesWithDifferentSizes() {
    let nodes = [
      FlowingGraphCanvasNodeGeometry(
        id: "small",
        frame: CGRect(x: 10, y: 10, width: 20, height: 20)
      ),
      FlowingGraphCanvasNodeGeometry(
        id: "large",
        frame: CGRect(x: 30, y: 40, width: 40, height: 60)
      ),
    ]

    XCTAssertEqual(
      FlowingGraphCanvasArrangement.translations(for: nodes, action: .align(.trailing)),
      ["small": CGSize(width: 40, height: 0)]
    )
    XCTAssertEqual(
      FlowingGraphCanvasArrangement.translations(
        for: nodes,
        action: .align(.horizontalCenter)
      ),
      [
        "small": CGSize(width: 20, height: 0),
        "large": CGSize(width: -10, height: 0),
      ]
    )
  }

  func testDistributionPreservesOuterNodesAndUsesEqualGaps() {
    let nodes = [
      FlowingGraphCanvasNodeGeometry(
        id: "first",
        frame: CGRect(x: 0, y: 0, width: 10, height: 20)
      ),
      FlowingGraphCanvasNodeGeometry(
        id: "middle",
        frame: CGRect(x: 20, y: 0, width: 20, height: 20)
      ),
      FlowingGraphCanvasNodeGeometry(
        id: "last",
        frame: CGRect(x: 100, y: 0, width: 10, height: 20)
      ),
    ]

    XCTAssertEqual(
      FlowingGraphCanvasArrangement.translations(
        for: nodes,
        action: .distribute(.horizontal)
      ),
      ["middle": CGSize(width: 25, height: 0)]
    )
  }

  func testArrangementRequiresEnoughParticipatingNodes() {
    let nodes = [
      FlowingGraphCanvasNodeGeometry(
        id: "first",
        frame: CGRect(x: 0, y: 0, width: 10, height: 10)
      ),
      FlowingGraphCanvasNodeGeometry(
        id: "second",
        frame: CGRect(x: 20, y: 0, width: 10, height: 10)
      ),
    ]

    XCTAssertTrue(
      FlowingGraphCanvasArrangement.translations(
        for: Array(nodes.prefix(1)),
        action: .align(.leading)
      ).isEmpty
    )
    XCTAssertTrue(
      FlowingGraphCanvasArrangement.translations(
        for: nodes,
        action: .distribute(.horizontal)
      ).isEmpty
    )
  }
}
