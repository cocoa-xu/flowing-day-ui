import CoreGraphics
import FlowingDayCanvas
import Foundation

public struct FlowingCanvasExportInsets: Equatable, Sendable {
  public let top: CGFloat
  public let leading: CGFloat
  public let bottom: CGFloat
  public let trailing: CGFloat

  public init(
    top: CGFloat = 0,
    leading: CGFloat = 0,
    bottom: CGFloat = 0,
    trailing: CGFloat = 0
  ) {
    self.top = top
    self.leading = leading
    self.bottom = bottom
    self.trailing = trailing
  }

  public init(_ value: CGFloat) {
    self.init(top: value, leading: value, bottom: value, trailing: value)
  }

  public var horizontal: CGFloat {
    leading + trailing
  }

  public var vertical: CGFloat {
    top + bottom
  }
}

public enum FlowingCanvasExportPageScaling: Equatable, Sendable {
  case fit
  case fitWithoutUpscaling
}

public enum FlowingCanvasExportDestination: Equatable, Sendable {
  case tight
  case page(
    size: CGSize,
    insets: FlowingCanvasExportInsets,
    scaling: FlowingCanvasExportPageScaling
  )
}

public struct FlowingCanvasExportGeometryConfiguration: Equatable, Sendable {
  public let destination: FlowingCanvasExportDestination
  public let padding: FlowingCanvasExportInsets
  public let visualOutsets: FlowingCanvasExportInsets

  public init(
    destination: FlowingCanvasExportDestination = .tight,
    padding: FlowingCanvasExportInsets = .init(),
    visualOutsets: FlowingCanvasExportInsets = .init()
  ) {
    self.destination = destination
    self.padding = padding
    self.visualOutsets = visualOutsets
  }
}

public enum FlowingCanvasExportGeometryIssue: Error, Equatable, Sendable {
  case invalidContentBounds
  case invalidPageSize
  case invalidInsets
}

public struct FlowingCanvasExportGeometry: Equatable, Sendable {
  private enum Constants {
    static let minimumDimension: CGFloat = 1
  }

  public let contentBounds: CGRect
  public let exportBounds: CGRect
  public let outputSize: CGSize
  public let worldTransform: FlowingCanvasTransform

  public init(
    contentBounds: CGRect,
    configuration: FlowingCanvasExportGeometryConfiguration = .init()
  ) throws {
    guard Self.isFinite(contentBounds), !contentBounds.isNull else {
      throw FlowingCanvasExportGeometryIssue.invalidContentBounds
    }
    guard Self.isValid(configuration.padding), Self.isValid(configuration.visualOutsets) else {
      throw FlowingCanvasExportGeometryIssue.invalidInsets
    }

    let resolvedBounds = contentBounds.standardized
    let leading = configuration.padding.leading + configuration.visualOutsets.leading
    let top = configuration.padding.top + configuration.visualOutsets.top
    let trailing = configuration.padding.trailing + configuration.visualOutsets.trailing
    let bottom = configuration.padding.bottom + configuration.visualOutsets.bottom
    let expandedBounds = CGRect(
      x: resolvedBounds.minX - leading,
      y: resolvedBounds.minY - top,
      width: resolvedBounds.width + leading + trailing,
      height: resolvedBounds.height + top + bottom
    )

    self.contentBounds = resolvedBounds
    exportBounds = expandedBounds
    switch configuration.destination {
    case .tight:
      let size = CGSize(
        width: max(expandedBounds.width, Constants.minimumDimension),
        height: max(expandedBounds.height, Constants.minimumDimension)
      )
      outputSize = size
      worldTransform = FlowingCanvasTransform(
        zoom: 1,
        offset: CGSize(width: -expandedBounds.minX, height: -expandedBounds.minY)
      )
    case .page(let pageSize, let pageInsets, let scaling):
      guard Self.isFinite(pageSize), pageSize.width > 0, pageSize.height > 0 else {
        throw FlowingCanvasExportGeometryIssue.invalidPageSize
      }
      guard Self.isValid(pageInsets),
        pageInsets.horizontal < pageSize.width,
        pageInsets.vertical < pageSize.height
      else {
        throw FlowingCanvasExportGeometryIssue.invalidInsets
      }
      let availableSize = CGSize(
        width: pageSize.width - pageInsets.horizontal,
        height: pageSize.height - pageInsets.vertical
      )
      let fittedScale = min(
        availableSize.width / max(expandedBounds.width, Constants.minimumDimension),
        availableSize.height / max(expandedBounds.height, Constants.minimumDimension)
      )
      let scale = scaling == .fitWithoutUpscaling ? min(fittedScale, 1) : fittedScale
      let pageCenter = CGPoint(
        x: pageInsets.leading + availableSize.width / 2,
        y: pageInsets.top + availableSize.height / 2
      )
      outputSize = pageSize
      worldTransform = FlowingCanvasTransform.anchoring(
        worldPoint: CGPoint(x: expandedBounds.midX, y: expandedBounds.midY),
        at: pageCenter,
        zoom: scale
      )
    }
  }

  private static func isValid(_ insets: FlowingCanvasExportInsets) -> Bool {
    let values = [insets.top, insets.leading, insets.bottom, insets.trailing]
    return values.allSatisfy { $0.isFinite && $0 >= 0 }
  }

  private static func isFinite(_ rect: CGRect) -> Bool {
    [rect.minX, rect.minY, rect.width, rect.height].allSatisfy(\.isFinite)
  }

  private static func isFinite(_ size: CGSize) -> Bool {
    size.width.isFinite && size.height.isFinite
  }
}
