import CoreGraphics
import FlowingDayCanvas
import SwiftUI

public struct FlowingGraphCanvasMetalCamera: Equatable, Sendable {
  public var zoom: CGFloat
  public var offset: CGSize

  public init(zoom: CGFloat = 1, offset: CGSize = .zero) {
    precondition(zoom > 0 && zoom.isFinite)
    self.zoom = zoom
    self.offset = offset
  }

  public var transform: FlowingCanvasTransform {
    FlowingCanvasTransform(zoom: zoom, offset: offset)
  }

  public func worldPoint(for viewportPoint: CGPoint) -> CGPoint {
    transform.removing(from: viewportPoint)
  }

  public func viewportPoint(for worldPoint: CGPoint) -> CGPoint {
    transform.applying(to: worldPoint)
  }

  public func visibleWorldRect(
    viewportSize: CGSize,
    contentInsets: EdgeInsets = EdgeInsets(),
    overscan: CGFloat = 0
  ) -> CGRect {
    let viewportRect = Self.availableViewportRect(
      viewportSize: viewportSize,
      contentInsets: contentInsets
    ).insetBy(dx: -overscan, dy: -overscan)
    return transform.removing(from: viewportRect)
  }

  public mutating func pan(by translation: CGSize) {
    offset.width += translation.width
    offset.height += translation.height
  }

  public mutating func anchor(
    worldPoint: CGPoint,
    at viewportPoint: CGPoint,
    zoom requestedZoom: CGFloat,
    range: ClosedRange<CGFloat>
  ) {
    zoom = requestedZoom.clamped(to: range)
    offset = CGSize(
      width: viewportPoint.x - worldPoint.x * zoom,
      height: viewportPoint.y - worldPoint.y * zoom
    )
  }

  public mutating func magnify(
    by magnification: CGFloat,
    at viewportPoint: CGPoint,
    sensitivity: CGFloat,
    range: ClosedRange<CGFloat>
  ) {
    let anchor = worldPoint(for: viewportPoint)
    self.anchor(
      worldPoint: anchor,
      at: viewportPoint,
      zoom: zoom * (1 + magnification * sensitivity),
      range: range
    )
  }

  public mutating func focus(
    _ worldRect: CGRect,
    zoom requestedZoom: CGFloat,
    viewportSize: CGSize,
    contentInsets: EdgeInsets,
    range: ClosedRange<CGFloat>
  ) {
    let available = Self.availableViewportRect(
      viewportSize: viewportSize,
      contentInsets: contentInsets
    )
    zoom = requestedZoom.clamped(to: range)
    offset = CGSize(
      width: available.midX - worldRect.midX * zoom,
      height: available.midY - worldRect.midY * zoom
    )
  }

  public mutating func fit(
    _ worldRect: CGRect,
    viewportSize: CGSize,
    contentInsets: EdgeInsets,
    padding: CGFloat,
    maximumZoom: CGFloat?,
    range: ClosedRange<CGFloat>
  ) {
    guard worldRect.width > 0, worldRect.height > 0 else { return }
    let available = Self.availableViewportRect(
      viewportSize: viewportSize,
      contentInsets: contentInsets
    ).insetBy(dx: padding, dy: padding)
    let fittedZoom = min(
      max(available.width, 1) / worldRect.width,
      max(available.height, 1) / worldRect.height
    )
    zoom = min(fittedZoom, maximumZoom ?? range.upperBound).clamped(to: range)
    offset = CGSize(
      width: available.midX - worldRect.midX * zoom,
      height: available.midY - worldRect.midY * zoom
    )
  }

  public static func availableViewportRect(
    viewportSize: CGSize,
    contentInsets: EdgeInsets
  ) -> CGRect {
    CGRect(
      x: contentInsets.leading,
      y: contentInsets.top,
      width: max(viewportSize.width - contentInsets.leading - contentInsets.trailing, 1),
      height: max(viewportSize.height - contentInsets.top - contentInsets.bottom, 1)
    )
  }
}

public struct FlowingGraphCanvasMetalBackendConfiguration: Equatable, Sendable {
  public let initialZoom: CGFloat
  public let zoomRange: ClosedRange<CGFloat>
  public let pinchSensitivity: CGFloat
  public let discreteScrollMultiplier: CGFloat
  public let preferredFramesPerSecond: Int
  public let preferredSampleCount: Int

  public init(
    initialZoom: CGFloat = 1,
    zoomRange: ClosedRange<CGFloat> = 0.25...4,
    pinchSensitivity: CGFloat = 1,
    discreteScrollMultiplier: CGFloat = 12,
    preferredFramesPerSecond: Int = 120,
    preferredSampleCount: Int = 4
  ) {
    precondition(initialZoom > 0 && initialZoom.isFinite)
    precondition(zoomRange.lowerBound > 0 && zoomRange.upperBound >= zoomRange.lowerBound)
    precondition(pinchSensitivity > 0 && pinchSensitivity.isFinite)
    precondition(discreteScrollMultiplier > 0 && discreteScrollMultiplier.isFinite)
    precondition(preferredFramesPerSecond > 0)
    precondition(preferredSampleCount > 0)
    self.initialZoom = initialZoom.clamped(to: zoomRange)
    self.zoomRange = zoomRange
    self.pinchSensitivity = pinchSensitivity
    self.discreteScrollMultiplier = discreteScrollMultiplier
    self.preferredFramesPerSecond = preferredFramesPerSecond
    self.preferredSampleCount = preferredSampleCount
  }

  public static let standard = Self()
}

extension Comparable {
  fileprivate func clamped(to range: ClosedRange<Self>) -> Self {
    min(max(self, range.lowerBound), range.upperBound)
  }
}
