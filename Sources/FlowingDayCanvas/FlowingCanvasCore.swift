import CoreGraphics
import Foundation

public struct FlowingCanvasTransform: Equatable, Sendable {
  public let zoom: CGFloat
  public let offset: CGSize

  public static let identity = FlowingCanvasTransform(zoom: 1, offset: .zero)

  public init(zoom: CGFloat, offset: CGSize) {
    precondition(zoom > 0)
    self.zoom = zoom
    self.offset = offset
  }

  public func applying(to point: CGPoint) -> CGPoint {
    CGPoint(
      x: point.x * zoom + offset.width,
      y: point.y * zoom + offset.height
    )
  }

  public func applying(to rect: CGRect) -> CGRect {
    CGRect(
      x: rect.minX * zoom + offset.width,
      y: rect.minY * zoom + offset.height,
      width: rect.width * zoom,
      height: rect.height * zoom
    )
  }

  public func removing(from point: CGPoint) -> CGPoint {
    CGPoint(
      x: (point.x - offset.width) / zoom,
      y: (point.y - offset.height) / zoom
    )
  }

  public func removing(from rect: CGRect) -> CGRect {
    CGRect(
      x: (rect.minX - offset.width) / zoom,
      y: (rect.minY - offset.height) / zoom,
      width: rect.width / zoom,
      height: rect.height / zoom
    )
  }

  public static func centering(
    contentSize: CGSize,
    in viewportBounds: CGRect,
    zoom: CGFloat
  ) -> FlowingCanvasTransform {
    focusing(
      contentRect: CGRect(origin: .zero, size: contentSize),
      in: viewportBounds,
      zoom: zoom
    )
  }

  public static func focusing(
    contentRect: CGRect,
    in viewportBounds: CGRect,
    zoom: CGFloat
  ) -> FlowingCanvasTransform {
    anchoring(
      worldPoint: CGPoint(x: contentRect.midX, y: contentRect.midY),
      at: CGPoint(x: viewportBounds.midX, y: viewportBounds.midY),
      zoom: zoom
    )
  }

  public static func anchoring(
    worldPoint: CGPoint,
    at viewportPoint: CGPoint,
    zoom: CGFloat
  ) -> FlowingCanvasTransform {
    FlowingCanvasTransform(
      zoom: zoom,
      offset: CGSize(
        width: viewportPoint.x - worldPoint.x * zoom,
        height: viewportPoint.y - worldPoint.y * zoom
      )
    )
  }

  public static func fitting(
    contentRect: CGRect,
    in viewportBounds: CGRect,
    padding: CGFloat,
    zoomRange: ClosedRange<CGFloat>
  ) -> FlowingCanvasTransform {
    precondition(padding >= 0)
    precondition(zoomRange.lowerBound > 0)
    let availableWidth = max(viewportBounds.width - padding * 2, 1)
    let availableHeight = max(viewportBounds.height - padding * 2, 1)
    let width = max(contentRect.width, 1)
    let height = max(contentRect.height, 1)
    let zoom = min(
      max(min(availableWidth / width, availableHeight / height), zoomRange.lowerBound),
      zoomRange.upperBound
    )
    return focusing(contentRect: contentRect, in: viewportBounds, zoom: zoom)
  }
}

public struct FlowingCanvasViewport: Equatable, Sendable {
  public var transform: FlowingCanvasTransform
  public private(set) var size: CGSize
  public private(set) var contentBounds: CGRect

  public init(
    transform: FlowingCanvasTransform = .identity,
    size: CGSize = .zero,
    contentBounds: CGRect = .zero
  ) {
    self.transform = transform
    self.size = size
    self.contentBounds = contentBounds
  }

  public var visibleWorldRect: CGRect {
    guard !contentBounds.isEmpty else { return .zero }
    return transform.removing(from: contentBounds)
  }

  mutating func update(size: CGSize, contentBounds: CGRect) {
    self.size = size
    self.contentBounds = contentBounds
  }
}

public struct FlowingCanvasRenderSurface: Equatable, Sendable {
  public let localTransform: FlowingCanvasTransform
  public let displayedSize: CGSize
  public let viewportOffset: CGSize

  public init(worldRect: CGRect, viewportTransform: FlowingCanvasTransform) {
    localTransform = FlowingCanvasTransform(
      zoom: viewportTransform.zoom,
      offset: CGSize(
        width: -worldRect.minX * viewportTransform.zoom,
        height: -worldRect.minY * viewportTransform.zoom
      )
    )
    displayedSize = CGSize(
      width: worldRect.width * viewportTransform.zoom,
      height: worldRect.height * viewportTransform.zoom
    )
    let origin = viewportTransform.applying(to: worldRect.origin)
    viewportOffset = CGSize(width: origin.x, height: origin.y)
  }
}

struct FlowingCanvasRenderCoverage: Equatable, Sendable {
  private(set) var worldRect = CGRect.zero

  mutating func update(
    for viewport: FlowingCanvasViewport,
    overscan: CGFloat,
    retentionRatio: CGFloat,
    force: Bool
  ) -> CGRect? {
    let visibleRect = viewport.visibleWorldRect
    guard !visibleRect.isEmpty else { return nil }
    let worldOverscan = overscan / viewport.transform.zoom
    let retainedRect = worldRect.insetBy(
      dx: worldOverscan * retentionRatio,
      dy: worldOverscan * retentionRatio
    )
    guard force || !retainedRect.contains(visibleRect) else { return nil }
    worldRect = visibleRect.insetBy(dx: -worldOverscan, dy: -worldOverscan)
    return worldRect
  }
}

public struct FlowingCanvasGridLevel: Equatable, Sendable {
  public let spacing: CGFloat
  public let opacity: CGFloat

  public init(spacing: CGFloat, opacity: CGFloat) {
    self.spacing = spacing
    self.opacity = opacity
  }
}

public struct FlowingCanvasGridLevels: Equatable, Sendable {
  public let coarse: FlowingCanvasGridLevel
  public let fine: FlowingCanvasGridLevel

  public init(
    baseSpacing: CGFloat,
    zoom: CGFloat,
    minimumVisualSpacing: CGFloat,
    scaleFactor: CGFloat
  ) {
    precondition(baseSpacing > 0)
    precondition(zoom > 0)
    precondition(minimumVisualSpacing > 0)
    precondition(scaleFactor > 1)

    let maximumVisualSpacing = minimumVisualSpacing * scaleFactor
    var fineSpacing = baseSpacing * zoom
    while fineSpacing < minimumVisualSpacing {
      fineSpacing *= scaleFactor
    }
    while fineSpacing >= maximumVisualSpacing {
      fineSpacing /= scaleFactor
    }

    let progress = min(
      max(
        (fineSpacing - minimumVisualSpacing) / (maximumVisualSpacing - minimumVisualSpacing),
        0
      ),
      1
    )
    coarse = FlowingCanvasGridLevel(
      spacing: fineSpacing * scaleFactor,
      opacity: 1 - progress
    )
    fine = FlowingCanvasGridLevel(
      spacing: fineSpacing,
      opacity: progress
    )
  }
}

public struct FlowingCanvasConfiguration: Equatable, Sendable {
  public let initialZoom: CGFloat
  public let focusedZoom: CGFloat
  public let zoomRange: ClosedRange<CGFloat>
  public let pinchSensitivity: CGFloat
  public let discreteScrollMultiplier: CGFloat
  public let renderOverscan: CGFloat
  public let renderRetentionRatio: CGFloat
  public let dragMinimumDistance: CGFloat
  public let viewportAnimationDuration: TimeInterval
  public let smartMagnifyZoomTolerance: CGFloat

  public init(
    initialZoom: CGFloat = 1,
    focusedZoom: CGFloat = 1,
    zoomRange: ClosedRange<CGFloat> = 0.25...4,
    pinchSensitivity: CGFloat = 1,
    discreteScrollMultiplier: CGFloat = 12,
    renderOverscan: CGFloat = 320,
    renderRetentionRatio: CGFloat = 0.45,
    dragMinimumDistance: CGFloat = 2,
    viewportAnimationDuration: TimeInterval = 0.25,
    smartMagnifyZoomTolerance: CGFloat = 0.04
  ) {
    precondition(initialZoom > 0)
    precondition(focusedZoom > 0)
    precondition(zoomRange.lowerBound > 0)
    precondition(pinchSensitivity > 0)
    precondition(discreteScrollMultiplier > 0)
    precondition(renderOverscan >= 0)
    precondition((0...1).contains(renderRetentionRatio))
    precondition(dragMinimumDistance >= 0)
    precondition(viewportAnimationDuration >= 0)
    precondition(smartMagnifyZoomTolerance >= 0)
    self.initialZoom = initialZoom
    self.focusedZoom = focusedZoom
    self.zoomRange = zoomRange
    self.pinchSensitivity = pinchSensitivity
    self.discreteScrollMultiplier = discreteScrollMultiplier
    self.renderOverscan = renderOverscan
    self.renderRetentionRatio = renderRetentionRatio
    self.dragMinimumDistance = dragMinimumDistance
    self.viewportAnimationDuration = viewportAnimationDuration
    self.smartMagnifyZoomTolerance = smartMagnifyZoomTolerance
  }

  public func clampedZoom(_ zoom: CGFloat) -> CGFloat {
    min(max(zoom, zoomRange.lowerBound), zoomRange.upperBound)
  }
}

public enum FlowingCanvasInteractionMode: Equatable, Sendable {
  case content
  case pan
}

public enum FlowingCanvasContentChangeBehavior: Equatable, Sendable {
  case preserveViewport
  case center
  case fit(padding: CGFloat, maximumZoom: CGFloat? = nil)
}

public struct FlowingCanvasDragContext: Equatable, Sendable {
  public let startLocation: CGPoint
  public let location: CGPoint
  public let translation: CGSize
  public let worldStartLocation: CGPoint
  public let worldLocation: CGPoint

  public init(
    startLocation: CGPoint,
    location: CGPoint,
    translation: CGSize,
    worldStartLocation: CGPoint,
    worldLocation: CGPoint
  ) {
    self.startLocation = startLocation
    self.location = location
    self.translation = translation
    self.worldStartLocation = worldStartLocation
    self.worldLocation = worldLocation
  }
}

public struct FlowingCanvasSmartMagnifyContext: Equatable, Sendable {
  public let location: CGPoint
  public let worldLocation: CGPoint
  public let viewport: FlowingCanvasViewport
  public let initialZoom: CGFloat
  public let zoomTolerance: CGFloat
  public let canRestoreViewport: Bool

  public init(
    location: CGPoint,
    worldLocation: CGPoint,
    viewport: FlowingCanvasViewport,
    initialZoom: CGFloat,
    zoomTolerance: CGFloat = 0,
    canRestoreViewport: Bool
  ) {
    self.location = location
    self.worldLocation = worldLocation
    self.viewport = viewport
    self.initialZoom = initialZoom
    self.zoomTolerance = zoomTolerance
    self.canRestoreViewport = canRestoreViewport
  }

  public var isZoomedIn: Bool {
    viewport.transform.zoom > initialZoom + zoomTolerance
  }
}

public enum FlowingCanvasViewportAction: Equatable, Sendable {
  case anchor(worldPoint: CGPoint, viewportPoint: CGPoint, zoom: CGFloat)
  case focus(rect: CGRect, zoom: CGFloat?)
  case fit(rect: CGRect, padding: CGFloat, maximumZoom: CGFloat?)
  case restore
  case none
}

public struct FlowingCanvasRequest: Equatable, Identifiable, Sendable {
  public let id: UUID
  public let action: FlowingCanvasViewportAction
  public let animated: Bool
  public let animationDuration: TimeInterval?

  public init(
    id: UUID = UUID(),
    action: FlowingCanvasViewportAction,
    animated: Bool = true,
    animationDuration: TimeInterval? = nil
  ) {
    if let animationDuration {
      precondition(animationDuration >= 0)
    }
    self.id = id
    self.action = action
    self.animated = animated
    self.animationDuration = animationDuration
  }
}

public enum FlowingCanvasViewportChangePhase: Equatable, Sendable {
  case continuous
  case ended
}
