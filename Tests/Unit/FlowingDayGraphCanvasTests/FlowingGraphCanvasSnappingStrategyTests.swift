import FlowingDayGraphCanvas
import FlowingDayGraphComposition
import FlowingDayGraphCore
import XCTest

private enum SnappingGraphSchema: FlowingGraphSchema {
  typealias NodeID = String
  typealias NodeValue = String
  typealias PortID = String
  typealias PortValue = String
  typealias EdgeID = String
  typealias EdgeValue = String
}

private enum SnappingCanvasSchema: FlowingGraphCanvasSchema {
  typealias DocumentID = String
  typealias GraphID = String
  typealias EntryPointID = String
  typealias LinkID = String
  typealias LinkValue = String
  typealias OccurrenceID = String
  typealias GraphSchema = SnappingGraphSchema
}

final class FlowingGraphCanvasSnappingStrategyTests: XCTestCase {
  func testStandardStrategyUsesTheBuiltInTranslationSolver() {
    let request = FlowingGraphCanvasTranslationSnapRequest<SnappingCanvasSchema>(
      movingBounds: CGRect(x: 0, y: 0, width: 20, height: 20),
      proposedTranslation: CGSize(width: 18, height: 0),
      candidates: [],
      configuration: FlowingGraphCanvasSnappingConfiguration(
        isEnabled: true,
        targets: [.grid],
        grid: FlowingGraphCanvasGridConfiguration(
          majorCellSize: CGSize(width: 20, height: 20)
        )
      ),
      zoom: 1
    )

    XCTAssertEqual(
      FlowingGraphCanvasSnappingStrategy<SnappingCanvasSchema>.standard
        .snap(request).translation,
      CGSize(width: 20, height: 0)
    )
  }

  func testCustomStrategyCanModifyTheStandardResult() {
    let strategy = FlowingGraphCanvasSnappingStrategy<SnappingCanvasSchema>(
      translation: { request in
        let standard = request.standardResult()
        return FlowingGraphCanvasSnapResult(
          translation: CGSize(
            width: standard.translation.width + 1,
            height: standard.translation.height
          ),
          guides: standard.guides,
          snapState: standard.snapState
        )
      }
    )
    let request = FlowingGraphCanvasTranslationSnapRequest<SnappingCanvasSchema>(
      movingBounds: CGRect(x: 0, y: 0, width: 20, height: 20),
      proposedTranslation: CGSize(width: 18, height: 0),
      candidates: [],
      configuration: FlowingGraphCanvasSnappingConfiguration(
        isEnabled: true,
        targets: [.grid],
        grid: FlowingGraphCanvasGridConfiguration(
          majorCellSize: CGSize(width: 20, height: 20)
        )
      ),
      zoom: 1
    )

    XCTAssertEqual(strategy.snap(request).translation.width, 21)
  }

  func testCustomTranslationDoesNotReplaceTheDefaultResizeBehavior() {
    let strategy = FlowingGraphCanvasSnappingStrategy<SnappingCanvasSchema>(
      translation: { request in
        FlowingGraphCanvasSnapResult(
          translation: CGSize(width: 42, height: request.proposedTranslation.height),
          guides: []
        )
      }
    )
    let resizeRequest = FlowingGraphCanvasResizeSnapRequest<SnappingCanvasSchema>(
      baseFrame: CGRect(x: 10, y: 20, width: 100, height: 60),
      proposedFrame: CGRect(x: 10, y: 20, width: 260, height: 200),
      edges: [.trailing, .bottom],
      candidates: [],
      configuration: .disabled,
      minimumSize: CGSize(width: 40, height: 30),
      maximumSize: CGSize(width: 140, height: 90),
      zoom: 1
    )

    XCTAssertEqual(
      strategy.resize(resizeRequest).frame,
      CGRect(x: 10, y: 20, width: 140, height: 90)
    )
  }

  func testCustomStrategyCanFullyReplaceResizeResolution() {
    let replacement = CGRect(x: 12, y: 24, width: 88, height: 44)
    let strategy = FlowingGraphCanvasSnappingStrategy<SnappingCanvasSchema>(
      resize: { _ in
        FlowingGraphCanvasResizeResult(frame: replacement, guides: [])
      }
    )
    let request = FlowingGraphCanvasResizeSnapRequest<SnappingCanvasSchema>(
      baseFrame: CGRect(x: 0, y: 0, width: 100, height: 60),
      proposedFrame: CGRect(x: 0, y: 0, width: 120, height: 80),
      edges: [.trailing, .bottom],
      candidates: [],
      configuration: .standard,
      minimumSize: CGSize(width: 40, height: 30),
      zoom: 1
    )

    XCTAssertEqual(strategy.resize(request).frame, replacement)
  }
}
