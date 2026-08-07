import CoreGraphics
import FlowingDayGraphLayout

public enum FlowingGraphCanvasTransientGeometry {
  public static func resizing(
    _ frame: CGRect,
    edges: FlowingGraphCanvasResizeEdges,
    translation: CGSize,
    modifiers: FlowingGraphCanvasInteractionModifiers = []
  ) -> CGRect {
    let preservesAspectRatio = modifiers.contains(.preserveResizeAspectRatio)
    let hasHorizontalEdge = edges.intersection([.leading, .trailing]).isEmpty == false
    let hasVerticalEdge = edges.intersection([.top, .bottom]).isEmpty == false
    let drivingAxis: FlowingGraphCanvasGeometryAxis?
    if !preservesAspectRatio {
      drivingAxis = nil
    } else if hasHorizontalEdge && hasVerticalEdge {
      drivingAxis = dominantAxis(for: translation, relativeTo: frame.size)
    } else {
      drivingAxis = hasHorizontalEdge ? .horizontal : .vertical
    }
    return resizing(
      frame,
      edges: edges,
      translation: translation,
      behavior: FlowingGraphCanvasResizeBehavior(
        preservesAspectRatio: preservesAspectRatio,
        resizesFromCenter: modifiers.contains(.resizeFromCenter),
        aspectRatioDrivingAxis: drivingAxis
      )
    )
  }

  public static func resizing(
    _ frame: CGRect,
    edges: FlowingGraphCanvasResizeEdges,
    translation: CGSize,
    behavior: FlowingGraphCanvasResizeBehavior
  ) -> CGRect {
    precondition(edges.isValid)
    var result = frame
    let fromCenter = behavior.resizesFromCenter
    if edges.contains(.leading) {
      result.origin.x += translation.width
      result.size.width -= translation.width * (fromCenter ? 2 : 1)
    } else if edges.contains(.trailing) {
      if fromCenter {
        result.origin.x -= translation.width
      }
      result.size.width += translation.width * (fromCenter ? 2 : 1)
    }
    if edges.contains(.top) {
      result.origin.y += translation.height
      result.size.height -= translation.height * (fromCenter ? 2 : 1)
    } else if edges.contains(.bottom) {
      if fromCenter {
        result.origin.y -= translation.height
      }
      result.size.height += translation.height * (fromCenter ? 2 : 1)
    }
    guard behavior.preservesAspectRatio,
      frame.width > 0,
      frame.height > 0
    else {
      return result
    }
    let horizontalScale = result.width / frame.width
    let verticalScale = result.height / frame.height
    let scale: CGFloat
    if behavior.aspectRatioDrivingAxis == .horizontal {
      scale = horizontalScale
    } else {
      scale = verticalScale
    }
    let horizontalAnchor = anchor(
      lower: edges.contains(.leading),
      upper: edges.contains(.trailing),
      fromCenter: fromCenter
    )
    let verticalAnchor = anchor(
      lower: edges.contains(.top),
      upper: edges.contains(.bottom),
      fromCenter: fromCenter
    )
    return scaled(
      frame,
      scale: scale,
      horizontalAnchor: horizontalAnchor,
      verticalAnchor: verticalAnchor
    )
  }

  public static func constrainingToDominantAxis(_ translation: CGSize) -> CGSize {
    constraining(translation, to: dominantAxis(for: translation))
  }

  public static func dominantAxis(
    for translation: CGSize,
    relativeTo size: CGSize? = nil
  ) -> FlowingGraphCanvasGeometryAxis {
    let horizontal = normalizedChange(translation.width, length: size?.width)
    let vertical = normalizedChange(translation.height, length: size?.height)
    return horizontal >= vertical ? .horizontal : .vertical
  }

  public static func constraining(
    _ translation: CGSize,
    to axis: FlowingGraphCanvasGeometryAxis
  ) -> CGSize {
    axis == .horizontal
      ? CGSize(width: translation.width, height: 0)
      : CGSize(width: 0, height: translation.height)
  }

  public static func resizing(
    _ anchor: FlowingGraphCanvasAnchor,
    from source: CGRect,
    to destination: CGRect
  ) -> FlowingGraphCanvasAnchor {
    let horizontal = source.width == 0 ? 0.5 : (anchor.position.x - source.minX) / source.width
    let vertical = source.height == 0 ? 0.5 : (anchor.position.y - source.minY) / source.height
    return FlowingGraphCanvasAnchor(
      position: CGPoint(
        x: destination.minX + destination.width * horizontal,
        y: destination.minY + destination.height * vertical
      ),
      normal: anchor.normal
    )
  }

  public static func scaling<ID: Hashable>(
    _ frames: [ID: CGRect],
    from source: CGRect,
    to destination: CGRect
  ) -> [ID: CGRect] {
    Dictionary(
      uniqueKeysWithValues: frames.map { id, frame in
        (id, resizing(frame, from: source, to: destination))
      }
    )
  }

  public static func resizing(
    _ frame: CGRect,
    from source: CGRect,
    to destination: CGRect
  ) -> CGRect {
    let horizontalScale = source.width == 0 ? 1 : destination.width / source.width
    let verticalScale = source.height == 0 ? 1 : destination.height / source.height
    let horizontalPosition =
      source.width == 0 ? 0.5 : (frame.minX - source.minX) / source.width
    let verticalPosition =
      source.height == 0 ? 0.5 : (frame.minY - source.minY) / source.height
    return CGRect(
      x: destination.minX + destination.width * horizontalPosition,
      y: destination.minY + destination.height * verticalPosition,
      width: frame.width * horizontalScale,
      height: frame.height * verticalScale
    )
  }

  public static func deforming(
    _ route: FlowingGraphEdgeRoute,
    firstEndpointDelta: CGSize,
    secondEndpointDelta: CGSize
  ) -> FlowingGraphEdgeRoute {
    let segmentCount = route.segments.count
    guard segmentCount > 0 else {
      return FlowingGraphEdgeRoute(
        start: translated(route.start, by: firstEndpointDelta),
        segments: []
      )
    }

    let count = CGFloat(segmentCount)
    let segments = route.segments.enumerated().map { index, segment in
      let startProgress = CGFloat(index) / count
      let endProgress = CGFloat(index + 1) / count
      switch segment {
      case .line(let end):
        return FlowingGraphEdgePathSegment.line(
          end: translated(
            end,
            by: interpolatedDelta(
              from: firstEndpointDelta,
              to: secondEndpointDelta,
              progress: endProgress
            )
          )
        )
      case .quadratic(let control, let end):
        return FlowingGraphEdgePathSegment.quadratic(
          control: translated(
            control,
            by: interpolatedDelta(
              from: firstEndpointDelta,
              to: secondEndpointDelta,
              progress: (startProgress + endProgress) / 2
            )
          ),
          end: translated(
            end,
            by: interpolatedDelta(
              from: firstEndpointDelta,
              to: secondEndpointDelta,
              progress: endProgress
            )
          )
        )
      case .cubic(let control1, let control2, let end):
        let interval = endProgress - startProgress
        return FlowingGraphEdgePathSegment.cubic(
          control1: translated(
            control1,
            by: interpolatedDelta(
              from: firstEndpointDelta,
              to: secondEndpointDelta,
              progress: startProgress + interval / 3
            )
          ),
          control2: translated(
            control2,
            by: interpolatedDelta(
              from: firstEndpointDelta,
              to: secondEndpointDelta,
              progress: startProgress + interval * 2 / 3
            )
          ),
          end: translated(
            end,
            by: interpolatedDelta(
              from: firstEndpointDelta,
              to: secondEndpointDelta,
              progress: endProgress
            )
          )
        )
      }
    }
    return FlowingGraphEdgeRoute(
      start: translated(route.start, by: firstEndpointDelta),
      segments: segments
    )
  }

  private static func interpolatedDelta(
    from first: CGSize,
    to second: CGSize,
    progress: CGFloat
  ) -> CGSize {
    CGSize(
      width: first.width + (second.width - first.width) * progress,
      height: first.height + (second.height - first.height) * progress
    )
  }

  private static func translated(_ point: CGPoint, by delta: CGSize) -> CGPoint {
    CGPoint(x: point.x + delta.width, y: point.y + delta.height)
  }

  private static func normalizedChange(_ delta: CGFloat, length: CGFloat?) -> CGFloat {
    guard let length, length != 0 else { return abs(delta) }
    return abs(delta / length)
  }

  private static func anchor(
    lower: Bool,
    upper: Bool,
    fromCenter: Bool
  ) -> CGFloat {
    if fromCenter || lower == upper {
      return 0.5
    }
    return lower ? 1 : 0
  }

  private static func scaled(
    _ frame: CGRect,
    scale: CGFloat,
    horizontalAnchor: CGFloat,
    verticalAnchor: CGFloat
  ) -> CGRect {
    let anchor = CGPoint(
      x: frame.minX + frame.width * horizontalAnchor,
      y: frame.minY + frame.height * verticalAnchor
    )
    let size = CGSize(width: frame.width * scale, height: frame.height * scale)
    return CGRect(
      x: anchor.x - size.width * horizontalAnchor,
      y: anchor.y - size.height * verticalAnchor,
      width: size.width,
      height: size.height
    )
  }
}
