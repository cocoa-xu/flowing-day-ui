import SwiftUI
import XCTest

@testable import FlowingDayCanvas

final class FlowingCanvasTests: XCTestCase {
  func testTransformRoundTripsWorldGeometry() {
    let transform = FlowingCanvasTransform(
      zoom: 2.4,
      offset: CGSize(width: -8_000, height: 370)
    )
    let point = CGPoint(x: 12_345, y: 678)
    let rect = CGRect(x: 11_900, y: 520, width: 1_200, height: 840)

    let roundTrippedPoint = transform.removing(from: transform.applying(to: point))
    let roundTrippedRect = transform.removing(from: transform.applying(to: rect))

    XCTAssertEqual(roundTrippedPoint.x, point.x, accuracy: 0.001)
    XCTAssertEqual(roundTrippedPoint.y, point.y, accuracy: 0.001)
    XCTAssertEqual(roundTrippedRect.minX, rect.minX, accuracy: 0.001)
    XCTAssertEqual(roundTrippedRect.minY, rect.minY, accuracy: 0.001)
    XCTAssertEqual(roundTrippedRect.width, rect.width, accuracy: 0.001)
    XCTAssertEqual(roundTrippedRect.height, rect.height, accuracy: 0.001)
  }

  func testFocusingCentersWorldRectInViewportBounds() {
    let viewportBounds = CGRect(x: 280, y: 20, width: 880, height: 700)
    let worldRect = CGRect(x: 600, y: 300, width: 220, height: 92)

    let transform = FlowingCanvasTransform.focusing(
      contentRect: worldRect,
      in: viewportBounds,
      zoom: 1.2
    )
    let displayedCenter = transform.applying(
      to: CGPoint(x: worldRect.midX, y: worldRect.midY)
    )

    XCTAssertEqual(displayedCenter.x, viewportBounds.midX, accuracy: 0.001)
    XCTAssertEqual(displayedCenter.y, viewportBounds.midY, accuracy: 0.001)
  }

  func testFittingKeepsWorldRectInsidePaddedViewportBounds() {
    let viewportBounds = CGRect(x: 280, y: 20, width: 880, height: 700)
    let worldRect = CGRect(x: 400, y: 120, width: 440, height: 420)

    let transform = FlowingCanvasTransform.fitting(
      contentRect: worldRect,
      in: viewportBounds,
      padding: 50,
      zoomRange: 0.4...1.6
    )
    let displayedRect = transform.applying(to: worldRect)

    XCTAssertGreaterThanOrEqual(displayedRect.minX, viewportBounds.minX + 50)
    XCTAssertLessThanOrEqual(displayedRect.maxX, viewportBounds.maxX - 50)
    XCTAssertGreaterThanOrEqual(displayedRect.minY, viewportBounds.minY + 50)
    XCTAssertLessThanOrEqual(displayedRect.maxY, viewportBounds.maxY - 50)
  }

  func testAnchoringKeepsWorldPointAtViewportPoint() {
    let worldPoint = CGPoint(x: 640, y: 280)
    let viewportPoint = CGPoint(x: 710, y: 360)

    let transform = FlowingCanvasTransform.anchoring(
      worldPoint: worldPoint,
      at: viewportPoint,
      zoom: 1.35
    )

    XCTAssertEqual(transform.applying(to: worldPoint).x, viewportPoint.x, accuracy: 0.001)
    XCTAssertEqual(transform.applying(to: worldPoint).y, viewportPoint.y, accuracy: 0.001)
  }

  func testViewportReportsVisibleWorldRect() {
    let viewport = FlowingCanvasViewport(
      transform: FlowingCanvasTransform(
        zoom: 2,
        offset: CGSize(width: -120, height: 40)
      ),
      size: CGSize(width: 800, height: 600),
      contentBounds: CGRect(x: 80, y: 40, width: 640, height: 520)
    )

    XCTAssertEqual(
      viewport.visibleWorldRect,
      CGRect(x: 100, y: 0, width: 320, height: 260)
    )
  }

  func testConfigurationClampsZoomToDeclaredRange() {
    let configuration = FlowingCanvasConfiguration(zoomRange: 0.5...3)

    XCTAssertEqual(configuration.clampedZoom(0.2), 0.5)
    XCTAssertEqual(configuration.clampedZoom(1.4), 1.4)
    XCTAssertEqual(configuration.clampedZoom(4), 3)
  }

  func testRenderSurfaceDependsOnCoverageInsteadOfWorldExtent() {
    let coverage = CGRect(x: 8_000_000, y: 4_000, width: 1_840, height: 1_400)
    let transform = FlowingCanvasTransform(
      zoom: 0.5,
      offset: CGSize(width: -3_999_200, height: -1_900)
    )

    let surface = FlowingCanvasRenderSurface(
      worldRect: coverage,
      viewportTransform: transform
    )

    XCTAssertEqual(surface.displayedSize, CGSize(width: 920, height: 700))
    XCTAssertEqual(surface.viewportOffset, CGSize(width: 800, height: 100))
    XCTAssertEqual(surface.localTransform.applying(to: coverage.origin), .zero)
  }

  func testGridLevelsRemainWithinConfiguredVisualSpacing() {
    let levels = FlowingCanvasGridLevels(
      baseSpacing: 12,
      zoom: 3,
      minimumVisualSpacing: 12,
      scaleFactor: 2
    )

    XCTAssertEqual(levels.fine, FlowingCanvasGridLevel(spacing: 18, opacity: 0.5))
    XCTAssertEqual(levels.coarse, FlowingCanvasGridLevel(spacing: 36, opacity: 0.5))
  }

  func testRenderCoverageRetainsOverscanUntilVisibleBoundsEscape() {
    var coverage = FlowingCanvasRenderCoverage()
    let initialViewport = viewport(offsetX: 0)

    XCTAssertEqual(
      coverage.update(
        for: initialViewport,
        overscan: 20,
        retentionRatio: 0.5,
        force: false
      ),
      CGRect(x: -20, y: -20, width: 140, height: 140)
    )
    XCTAssertNil(
      coverage.update(
        for: viewport(offsetX: -5),
        overscan: 20,
        retentionRatio: 0.5,
        force: false
      )
    )
    XCTAssertEqual(
      coverage.update(
        for: viewport(offsetX: -15),
        overscan: 20,
        retentionRatio: 0.5,
        force: false
      ),
      CGRect(x: -5, y: -20, width: 140, height: 140)
    )
  }

  func testSmartMagnifyContextUsesConfiguredZoomTolerance() {
    let nearInitialZoom = smartMagnifyContext(zoom: 1.03, tolerance: 0.04)
    let focusedZoom = smartMagnifyContext(zoom: 1.05, tolerance: 0.04)

    XCTAssertFalse(nearInitialZoom.isZoomedIn)
    XCTAssertTrue(focusedZoom.isZoomedIn)
  }

  func testRequestCarriesDistinctIdentityAndAnimationPolicy() {
    let first = FlowingCanvasRequest(
      action: .focus(rect: CGRect(x: 10, y: 20, width: 30, height: 40), zoom: 1.2),
      animationDuration: 0.18
    )
    let second = FlowingCanvasRequest(
      action: .focus(rect: CGRect(x: 10, y: 20, width: 30, height: 40), zoom: 1.2),
      animationDuration: 0.18
    )

    XCTAssertNotEqual(first, second)
    XCTAssertEqual(first.animationDuration, 0.18)
  }

  @MainActor
  func testPublicCanvasCompositionBuildsFromIndependentViews() {
    let canvas = FlowingCanvas(
      viewport: .constant(FlowingCanvasViewport()),
      contentRect: CGRect(x: 0, y: 0, width: 400, height: 300),
      contentID: 1
    ) { _ in
      Color.white
    } world: { context in
      FlowingCanvasWorldLayer(context: context) { surface in
        let frame = surface.localTransform.applying(
          to: CGRect(x: 40, y: 40, width: 120, height: 80)
        )
        Rectangle()
          .frame(width: frame.width, height: frame.height)
          .position(x: frame.midX, y: frame.midY)
      }
    } overlays: { _ in
      FlowingCanvasViewportOverlay(alignment: .bottomTrailing) {
        Text("Tools")
      }
    }

    XCTAssertNotNil(type(of: canvas))
  }

  private func viewport(offsetX: CGFloat) -> FlowingCanvasViewport {
    FlowingCanvasViewport(
      transform: FlowingCanvasTransform(
        zoom: 1,
        offset: CGSize(width: offsetX, height: 0)
      ),
      size: CGSize(width: 100, height: 100),
      contentBounds: CGRect(x: 0, y: 0, width: 100, height: 100)
    )
  }

  private func smartMagnifyContext(
    zoom: CGFloat,
    tolerance: CGFloat
  ) -> FlowingCanvasSmartMagnifyContext {
    FlowingCanvasSmartMagnifyContext(
      location: .zero,
      worldLocation: .zero,
      viewport: FlowingCanvasViewport(
        transform: FlowingCanvasTransform(zoom: zoom, offset: .zero)
      ),
      initialZoom: 1,
      zoomTolerance: tolerance,
      canRestoreViewport: false
    )
  }
}
