import AppKit
import FlowingDayCanvasExport
import SwiftUI
import XCTest

final class FlowingCanvasExportGeometryTests: XCTestCase {
  func testTightGeometryIncludesDirectionalPaddingAndVisualOutsets() throws {
    let geometry = try FlowingCanvasExportGeometry(
      contentBounds: CGRect(x: -20, y: 10, width: 100, height: 50),
      configuration: FlowingCanvasExportGeometryConfiguration(
        padding: FlowingCanvasExportInsets(top: 2, leading: 3, bottom: 4, trailing: 5),
        visualOutsets: FlowingCanvasExportInsets(1)
      )
    )

    XCTAssertEqual(geometry.exportBounds, CGRect(x: -24, y: 7, width: 110, height: 58))
    XCTAssertEqual(geometry.outputSize, CGSize(width: 110, height: 58))
    XCTAssertEqual(geometry.worldTransform.zoom, 1)
    XCTAssertEqual(geometry.worldTransform.offset, CGSize(width: 24, height: -7))
  }

  func testPageGeometryFitsAndCentersExpandedBounds() throws {
    let geometry = try FlowingCanvasExportGeometry(
      contentBounds: CGRect(x: 0, y: 0, width: 200, height: 100),
      configuration: FlowingCanvasExportGeometryConfiguration(
        destination: .page(
          size: CGSize(width: 200, height: 100),
          insets: FlowingCanvasExportInsets(10),
          scaling: .fit
        )
      )
    )

    XCTAssertEqual(geometry.outputSize, CGSize(width: 200, height: 100))
    XCTAssertEqual(geometry.worldTransform.zoom, 0.8, accuracy: 0.000_001)
    XCTAssertEqual(geometry.worldTransform.offset.width, 20, accuracy: 0.000_001)
    XCTAssertEqual(geometry.worldTransform.offset.height, 10, accuracy: 0.000_001)
  }

  func testPageGeometryCanAvoidUpscaling() throws {
    let geometry = try FlowingCanvasExportGeometry(
      contentBounds: CGRect(x: 40, y: 20, width: 20, height: 10),
      configuration: FlowingCanvasExportGeometryConfiguration(
        destination: .page(
          size: CGSize(width: 200, height: 100),
          insets: FlowingCanvasExportInsets(10),
          scaling: .fitWithoutUpscaling
        )
      )
    )

    XCTAssertEqual(geometry.worldTransform.zoom, 1)
    XCTAssertEqual(
      geometry.worldTransform.applying(to: CGPoint(x: 50, y: 25)),
      CGPoint(x: 100, y: 50)
    )
  }

  func testGeometryRejectsInvalidInputs() {
    XCTAssertThrowsError(
      try FlowingCanvasExportGeometry(
        contentBounds: CGRect(x: CGFloat.nan, y: 0, width: 10, height: 10)
      )
    )
    XCTAssertThrowsError(
      try FlowingCanvasExportGeometry(
        contentBounds: CGRect(x: 0, y: 0, width: 10, height: 10),
        configuration: FlowingCanvasExportGeometryConfiguration(
          destination: .page(
            size: .zero,
            insets: .init(),
            scaling: .fit
          )
        )
      )
    )
    XCTAssertThrowsError(
      try FlowingCanvasExportGeometry(
        contentBounds: CGRect(x: 0, y: 0, width: 10, height: 10),
        configuration: FlowingCanvasExportGeometryConfiguration(
          padding: FlowingCanvasExportInsets(-1)
        )
      )
    )
  }

  @MainActor
  func testRendererProducesEverySupportedFormat() throws {
    for format in FlowingCanvasExportFormat.allCases {
      let data = try FlowingCanvasExportRenderer().data(
        content: Rectangle().fill(Color.orange),
        size: CGSize(width: 20, height: 10),
        configuration: FlowingCanvasExportRenderingConfiguration(
          format: format,
          rasterDPI: 144
        )
      )
      XCTAssertFalse(data.isEmpty, "Missing \(format.rawValue) output")
    }
  }

  @MainActor
  func testRasterResolutionControlsPixelDimensions() throws {
    let data = try FlowingCanvasExportRenderer().data(
      content: Rectangle().fill(Color.blue),
      size: CGSize(width: 20, height: 10),
      configuration: FlowingCanvasExportRenderingConfiguration(
        format: .png,
        rasterDPI: 144
      )
    )
    let representation = try XCTUnwrap(NSBitmapImageRep(data: data))

    XCTAssertEqual(representation.pixelsWide, 40)
    XCTAssertEqual(representation.pixelsHigh, 20)
  }
}
