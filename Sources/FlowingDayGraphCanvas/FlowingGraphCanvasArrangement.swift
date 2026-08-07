import CoreGraphics
import FlowingDayGraphComposition
import FlowingDayGraphCore
import FlowingDayGraphLayout

public struct FlowingGraphCanvasSnappingConfiguration: Equatable, Sendable {
  public static let standardTolerance: CGFloat = 6
  public static let standardSearchRadius: CGFloat = 600
  public static let standardMaximumCandidates = 512
  public static let standardGuideOffset: CGFloat = 8

  public let isEnabled: Bool
  public let targets: FlowingGraphCanvasSnapTargets
  public let tolerance: CGFloat
  public let searchRadius: CGFloat
  public let maximumCandidates: Int
  public let gridCellSize: CGSize?
  public let showsGuides: Bool
  public let guideOffset: CGFloat

  public init(
    isEnabled: Bool,
    targets: FlowingGraphCanvasSnapTargets = .standard,
    tolerance: CGFloat = standardTolerance,
    searchRadius: CGFloat = standardSearchRadius,
    maximumCandidates: Int = standardMaximumCandidates,
    gridCellSize: CGSize? = nil,
    showsGuides: Bool = true,
    guideOffset: CGFloat = standardGuideOffset
  ) {
    precondition(tolerance >= 0 && tolerance.isFinite)
    precondition(searchRadius >= 0 && searchRadius.isFinite)
    precondition(maximumCandidates > 0)
    precondition(guideOffset >= 0 && guideOffset.isFinite)
    if let gridCellSize {
      precondition(gridCellSize.width > 0 && gridCellSize.width.isFinite)
      precondition(gridCellSize.height > 0 && gridCellSize.height.isFinite)
    }
    self.isEnabled = isEnabled
    self.targets = targets
    self.tolerance = tolerance
    self.searchRadius = searchRadius
    self.maximumCandidates = maximumCandidates
    self.gridCellSize = gridCellSize
    self.showsGuides = showsGuides
    self.guideOffset = guideOffset
  }

  public static let disabled = Self(isEnabled: false, showsGuides: false)
  public static let standard = Self(isEnabled: true)
}

public struct FlowingGraphCanvasSnapTargets: OptionSet, Hashable, Sendable {
  public let rawValue: UInt8

  public init(rawValue: UInt8) {
    self.rawValue = rawValue
  }

  public static let alignment = Self(rawValue: 1 << 0)
  public static let grid = Self(rawValue: 1 << 1)
  public static let equalSpacing = Self(rawValue: 1 << 2)
  public static let equalSize = Self(rawValue: 1 << 3)
  public static let standard: Self = [.alignment, .grid, .equalSpacing, .equalSize]
}

public enum FlowingGraphCanvasGuideAxis: Hashable, Sendable {
  case horizontal
  case vertical
}

public enum FlowingGraphCanvasGuideKind: Hashable, Sendable {
  case alignment
  case equalSpacing
  case equalSize
  case grid
  case resize
}

public struct FlowingGraphCanvasGuide: Equatable, Sendable {
  public let axis: FlowingGraphCanvasGuideAxis
  public let position: CGFloat
  public let lowerBound: CGFloat
  public let upperBound: CGFloat
  public let kind: FlowingGraphCanvasGuideKind
  public let measurement: CGFloat?

  public init(
    axis: FlowingGraphCanvasGuideAxis,
    position: CGFloat,
    lowerBound: CGFloat,
    upperBound: CGFloat,
    kind: FlowingGraphCanvasGuideKind,
    measurement: CGFloat? = nil
  ) {
    precondition(position.isFinite)
    precondition(lowerBound.isFinite && upperBound.isFinite)
    precondition(measurement == nil || measurement?.isFinite == true)
    self.axis = axis
    self.position = position
    self.lowerBound = min(lowerBound, upperBound)
    self.upperBound = max(lowerBound, upperBound)
    self.kind = kind
    self.measurement = measurement
  }
}

public struct FlowingGraphCanvasResizeEdges: OptionSet, Hashable, Sendable {
  public let rawValue: UInt8

  public init(rawValue: UInt8) {
    self.rawValue = rawValue
  }

  public static let leading = Self(rawValue: 1 << 0)
  public static let trailing = Self(rawValue: 1 << 1)
  public static let top = Self(rawValue: 1 << 2)
  public static let bottom = Self(rawValue: 1 << 3)
}

public struct FlowingGraphCanvasSnapCandidate<ID: Hashable & Sendable>: Sendable {
  public let id: ID
  public let frame: CGRect

  public init(id: ID, frame: CGRect) {
    self.id = id
    self.frame = frame
  }
}

extension FlowingGraphCanvasSnapCandidate: Equatable where ID: Equatable {}

public struct FlowingGraphCanvasSnapResult: Equatable, Sendable {
  public let translation: CGSize
  public let guides: [FlowingGraphCanvasGuide]

  public init(translation: CGSize, guides: [FlowingGraphCanvasGuide]) {
    self.translation = translation
    self.guides = guides
  }
}

public struct FlowingGraphCanvasResizeResult: Equatable, Sendable {
  public let frame: CGRect
  public let guides: [FlowingGraphCanvasGuide]

  public init(frame: CGRect, guides: [FlowingGraphCanvasGuide]) {
    self.frame = frame
    self.guides = guides
  }
}

public enum FlowingGraphCanvasAlignment: Hashable, Sendable {
  case leading
  case horizontalCenter
  case trailing
  case top
  case verticalCenter
  case bottom
}

public enum FlowingGraphCanvasDistribution: Hashable, Sendable {
  case horizontal
  case vertical
}

public enum FlowingGraphCanvasArrangementAction: Hashable, Sendable {
  case align(FlowingGraphCanvasAlignment)
  case distribute(FlowingGraphCanvasDistribution)
}

public struct FlowingGraphCanvasNodeGeometry<ID: Hashable & Sendable>: Sendable {
  public let id: ID
  public let frame: CGRect

  public init(id: ID, frame: CGRect) {
    self.id = id
    self.frame = frame
  }
}

extension FlowingGraphCanvasNodeGeometry: Equatable where ID: Equatable {}

public enum FlowingGraphCanvasArrangement {
  public static func snap<ID: Hashable & Sendable>(
    movingBounds: CGRect,
    proposedTranslation: CGSize,
    candidates: [FlowingGraphCanvasSnapCandidate<ID>],
    configuration: FlowingGraphCanvasSnappingConfiguration,
    zoom: CGFloat
  ) -> FlowingGraphCanvasSnapResult {
    guard configuration.isEnabled, zoom > 0, zoom.isFinite else {
      return FlowingGraphCanvasSnapResult(
        translation: proposedTranslation,
        guides: []
      )
    }
    let proposedBounds = movingBounds.offsetBy(
      dx: proposedTranslation.width,
      dy: proposedTranslation.height
    )
    let tolerance = configuration.tolerance / zoom
    let effectiveCandidates = Array(candidates.prefix(configuration.maximumCandidates))
    let resolvedX = translationSnap(
      frame: proposedBounds,
      candidates: effectiveCandidates,
      axis: .horizontal,
      configuration: configuration,
      tolerance: tolerance,
      zoom: zoom
    )
    let resolvedY = translationSnap(
      frame: proposedBounds,
      candidates: effectiveCandidates,
      axis: .vertical,
      configuration: configuration,
      tolerance: tolerance,
      zoom: zoom
    )
    let translation = CGSize(
      width: proposedTranslation.width + (resolvedX?.delta ?? 0),
      height: proposedTranslation.height + (resolvedY?.delta ?? 0)
    )
    guard configuration.showsGuides else {
      return FlowingGraphCanvasSnapResult(translation: translation, guides: [])
    }
    let snappedBounds = movingBounds.offsetBy(dx: translation.width, dy: translation.height)
    var guides: [FlowingGraphCanvasGuide] = []
    if let resolvedX {
      guides.append(
        contentsOf: resolvedGuides(
          for: resolvedX,
          snappedFrame: snappedBounds,
          axis: .horizontal
        ))
    }
    if let resolvedY {
      guides.append(
        contentsOf: resolvedGuides(
          for: resolvedY,
          snappedFrame: snappedBounds,
          axis: .vertical
        ))
    }
    return FlowingGraphCanvasSnapResult(translation: translation, guides: guides)
  }

  public static func resize<ID: Hashable & Sendable>(
    baseFrame: CGRect,
    proposedFrame: CGRect,
    edges: FlowingGraphCanvasResizeEdges,
    candidates: [FlowingGraphCanvasSnapCandidate<ID>],
    configuration: FlowingGraphCanvasSnappingConfiguration,
    minimumSize: CGSize,
    zoom: CGFloat
  ) -> FlowingGraphCanvasResizeResult {
    precondition(minimumSize.width >= 0 && minimumSize.width.isFinite)
    precondition(minimumSize.height >= 0 && minimumSize.height.isFinite)
    guard !edges.isEmpty, zoom > 0, zoom.isFinite else {
      return FlowingGraphCanvasResizeResult(frame: proposedFrame, guides: [])
    }
    let effectiveCandidates = Array(candidates.prefix(configuration.maximumCandidates))
    let tolerance = configuration.tolerance / zoom
    var frame = constrained(
      proposedFrame,
      relativeTo: baseFrame,
      edges: edges,
      minimumSize: minimumSize
    )
    var resolved: [(GeometryAxis, Snap)] = []
    if configuration.isEnabled {
      if let snap = resizeSnap(
        frame: frame,
        edges: edges,
        candidates: effectiveCandidates,
        axis: .horizontal,
        configuration: configuration,
        tolerance: tolerance
      ) {
        frame = applying(snap, to: frame, edges: edges, axis: .horizontal)
        resolved.append((.horizontal, snap))
      }
      if let snap = resizeSnap(
        frame: frame,
        edges: edges,
        candidates: effectiveCandidates,
        axis: .vertical,
        configuration: configuration,
        tolerance: tolerance
      ) {
        frame = applying(snap, to: frame, edges: edges, axis: .vertical)
        resolved.append((.vertical, snap))
      }
      frame = constrained(
        frame,
        relativeTo: baseFrame,
        edges: edges,
        minimumSize: minimumSize
      )
    }
    guard configuration.showsGuides else {
      return FlowingGraphCanvasResizeResult(frame: frame, guides: [])
    }
    var guides = resolved.flatMap {
      resolvedGuides(for: $0.1, snappedFrame: frame, axis: $0.0)
    }
    let offset = configuration.guideOffset / zoom
    if edges.intersection([.leading, .trailing]).isEmpty == false {
      guides.append(
        dimensionGuide(for: frame, axis: .horizontal, offset: offset, kind: .resize)
      )
    }
    if edges.intersection([.top, .bottom]).isEmpty == false {
      guides.append(
        dimensionGuide(for: frame, axis: .vertical, offset: offset, kind: .resize)
      )
    }
    return FlowingGraphCanvasResizeResult(frame: frame, guides: guides)
  }

  public static func translations<ID: Hashable & Sendable>(
    for nodes: [FlowingGraphCanvasNodeGeometry<ID>],
    action: FlowingGraphCanvasArrangementAction
  ) -> [ID: CGSize] {
    switch action {
    case .align(let alignment):
      return alignedTranslations(nodes, alignment: alignment)
    case .distribute(let distribution):
      return distributedTranslations(nodes, distribution: distribution)
    }
  }

  private struct Snap {
    let delta: CGFloat
    let value: CGFloat
    let candidateFrame: CGRect?
    let kind: FlowingGraphCanvasGuideKind
    let customGuides: [FlowingGraphCanvasGuide]

    init(
      delta: CGFloat,
      value: CGFloat,
      candidateFrame: CGRect?,
      kind: FlowingGraphCanvasGuideKind,
      customGuides: [FlowingGraphCanvasGuide] = []
    ) {
      self.delta = delta
      self.value = value
      self.candidateFrame = candidateFrame
      self.kind = kind
      self.customGuides = customGuides
    }
  }

  private enum GeometryAxis {
    case horizontal
    case vertical

    func lower(_ frame: CGRect) -> CGFloat {
      self == .horizontal ? frame.minX : frame.minY
    }

    func middle(_ frame: CGRect) -> CGFloat {
      self == .horizontal ? frame.midX : frame.midY
    }

    func upper(_ frame: CGRect) -> CGFloat {
      self == .horizontal ? frame.maxX : frame.maxY
    }

    func length(_ frame: CGRect) -> CGFloat {
      self == .horizontal ? frame.width : frame.height
    }

    func crossUpper(_ frame: CGRect) -> CGFloat {
      self == .horizontal ? frame.maxY : frame.maxX
    }
  }

  private static func translationSnap<ID>(
    frame: CGRect,
    candidates: [FlowingGraphCanvasSnapCandidate<ID>],
    axis: GeometryAxis,
    configuration: FlowingGraphCanvasSnappingConfiguration,
    tolerance: CGFloat,
    zoom: CGFloat
  ) -> Snap? {
    var snaps: [Snap?] = []
    if configuration.targets.contains(.alignment) {
      snaps.append(
        alignmentSnap(
          movingValues: [axis.lower(frame), axis.middle(frame), axis.upper(frame)],
          candidates: candidates,
          axis: axis,
          tolerance: tolerance
        )
      )
    }
    if configuration.targets.contains(.equalSpacing) {
      snaps.append(
        equalSpacingSnap(
          movingFrame: frame,
          candidates: candidates,
          axis: axis,
          tolerance: tolerance,
          guideOffset: configuration.guideOffset / zoom
        )
      )
    }
    if configuration.targets.contains(.grid) {
      let cell =
        axis == .horizontal
        ? configuration.gridCellSize?.width
        : configuration.gridCellSize?.height
      snaps.append(gridSnap(value: axis.lower(frame), cell: cell, tolerance: tolerance))
    }
    return preferred(snaps)
  }

  private static func alignmentSnap<ID>(
    movingValues: [CGFloat],
    candidates: [FlowingGraphCanvasSnapCandidate<ID>],
    axis: GeometryAxis,
    tolerance: CGFloat
  ) -> Snap? {
    var best: Snap?
    for candidate in candidates {
      for movingValue in movingValues {
        for candidateValue in [
          axis.lower(candidate.frame),
          axis.middle(candidate.frame),
          axis.upper(candidate.frame),
        ] {
          let delta = candidateValue - movingValue
          guard abs(delta) <= tolerance else { continue }
          if best == nil || abs(delta) < abs(best?.delta ?? .greatestFiniteMagnitude) {
            best = Snap(
              delta: delta,
              value: candidateValue,
              candidateFrame: candidate.frame,
              kind: .alignment
            )
          }
        }
      }
    }
    return best
  }

  private static func gridSnap(value: CGFloat, cell: CGFloat?, tolerance: CGFloat) -> Snap? {
    guard let cell else { return nil }
    let target = (value / cell).rounded() * cell
    let delta = target - value
    guard abs(delta) <= tolerance else { return nil }
    return Snap(delta: delta, value: target, candidateFrame: nil, kind: .grid)
  }

  private static func preferred(_ snaps: [Snap?]) -> Snap? {
    var result: Snap?
    for snap in snaps.compactMap({ $0 }) {
      if result == nil || abs(snap.delta) < abs(result?.delta ?? .greatestFiniteMagnitude) {
        result = snap
      }
    }
    return result
  }

  private static func equalSpacingSnap<ID>(
    movingFrame: CGRect,
    candidates: [FlowingGraphCanvasSnapCandidate<ID>],
    axis: GeometryAxis,
    tolerance: CGFloat,
    guideOffset: CGFloat
  ) -> Snap? {
    let frames = candidates.map(\.frame).sorted {
      let first = axis.lower($0)
      let second = axis.lower($1)
      return first == second ? axis.upper($0) < axis.upper($1) : first < second
    }
    guard frames.count > 1 else { return nil }

    let movingLower = axis.lower(movingFrame)
    let movingUpper = axis.upper(movingFrame)
    let movingLength = axis.length(movingFrame)
    let before = frames.filter { axis.upper($0) <= movingLower + tolerance }
    let after = frames.filter { axis.lower($0) >= movingUpper - tolerance }
    var snaps: [Snap?] = []

    if let left = before.max(by: { axis.upper($0) < axis.upper($1) }),
      let right = after.min(by: { axis.lower($0) < axis.lower($1) })
    {
      let available = axis.lower(right) - axis.upper(left) - movingLength
      if available >= 0 {
        snaps.append(
          spacingSnap(
            targetLower: axis.upper(left) + available / 2,
            movingFrame: movingFrame,
            referenceFrames: [left, right],
            axis: axis,
            tolerance: tolerance,
            guideOffset: guideOffset
          )
        )
      }
    }

    if let pair = nearestNonoverlappingPair(in: before, axis: axis, fromEnd: true) {
      let gap = axis.lower(pair.second) - axis.upper(pair.first)
      snaps.append(
        spacingSnap(
          targetLower: axis.upper(pair.second) + gap,
          movingFrame: movingFrame,
          referenceFrames: [pair.first, pair.second],
          axis: axis,
          tolerance: tolerance,
          guideOffset: guideOffset
        )
      )
    }

    if let pair = nearestNonoverlappingPair(in: after, axis: axis, fromEnd: false) {
      let gap = axis.lower(pair.second) - axis.upper(pair.first)
      snaps.append(
        spacingSnap(
          targetLower: axis.lower(pair.first) - gap - movingLength,
          movingFrame: movingFrame,
          referenceFrames: [pair.first, pair.second],
          axis: axis,
          tolerance: tolerance,
          guideOffset: guideOffset
        )
      )
    }
    return preferred(snaps)
  }

  private static func nearestNonoverlappingPair(
    in frames: [CGRect],
    axis: GeometryAxis,
    fromEnd: Bool
  ) -> (first: CGRect, second: CGRect)? {
    guard frames.count > 1 else { return nil }
    let indices =
      fromEnd
      ? Array(stride(from: frames.count - 2, through: 0, by: -1))
      : Array(0..<(frames.count - 1))
    for index in indices {
      let first = frames[index]
      let second = frames[index + 1]
      if axis.upper(first) <= axis.lower(second) {
        return (first, second)
      }
    }
    return nil
  }

  private static func spacingSnap(
    targetLower: CGFloat,
    movingFrame: CGRect,
    referenceFrames: [CGRect],
    axis: GeometryAxis,
    tolerance: CGFloat,
    guideOffset: CGFloat
  ) -> Snap? {
    let delta = targetLower - axis.lower(movingFrame)
    guard abs(delta) <= tolerance else { return nil }
    let targetFrame = offset(movingFrame, by: delta, axis: axis)
    let orderedFrames = (referenceFrames + [targetFrame]).sorted {
      axis.lower($0) < axis.lower($1)
    }
    guard let crossUpper = orderedFrames.map({ axis.crossUpper($0) }).max() else {
      return nil
    }
    let crossPosition = crossUpper + guideOffset
    let guideAxis: FlowingGraphCanvasGuideAxis =
      axis == .horizontal ? .horizontal : .vertical
    let guides: [FlowingGraphCanvasGuide] = zip(
      orderedFrames,
      orderedFrames.dropFirst()
    ).compactMap { pair -> FlowingGraphCanvasGuide? in
      let (first, second) = pair
      let lower = axis.upper(first)
      let upper = axis.lower(second)
      guard upper >= lower else { return nil }
      return FlowingGraphCanvasGuide(
        axis: guideAxis,
        position: crossPosition,
        lowerBound: lower,
        upperBound: upper,
        kind: .equalSpacing,
        measurement: upper - lower
      )
    }
    return Snap(
      delta: delta,
      value: targetLower,
      candidateFrame: nil,
      kind: .equalSpacing,
      customGuides: guides
    )
  }

  private static func resizeSnap<ID>(
    frame: CGRect,
    edges: FlowingGraphCanvasResizeEdges,
    candidates: [FlowingGraphCanvasSnapCandidate<ID>],
    axis: GeometryAxis,
    configuration: FlowingGraphCanvasSnappingConfiguration,
    tolerance: CGFloat
  ) -> Snap? {
    let usesLower = axis == .horizontal ? edges.contains(.leading) : edges.contains(.top)
    let usesUpper = axis == .horizontal ? edges.contains(.trailing) : edges.contains(.bottom)
    guard usesLower != usesUpper else { return nil }
    let movingValue = usesLower ? axis.lower(frame) : axis.upper(frame)
    var snaps: [Snap?] = []
    if configuration.targets.contains(.alignment) {
      snaps.append(
        alignmentSnap(
          movingValues: [movingValue],
          candidates: candidates,
          axis: axis,
          tolerance: tolerance
        )
      )
    }
    if configuration.targets.contains(.equalSize) {
      var best: Snap?
      for candidate in candidates {
        let target =
          usesLower
          ? axis.upper(frame) - axis.length(candidate.frame)
          : axis.lower(frame) + axis.length(candidate.frame)
        let delta = target - movingValue
        guard abs(delta) <= tolerance else { continue }
        let snap = Snap(
          delta: delta,
          value: target,
          candidateFrame: candidate.frame,
          kind: .equalSize
        )
        if best == nil || abs(delta) < abs(best?.delta ?? .greatestFiniteMagnitude) {
          best = snap
        }
      }
      snaps.append(best)
    }
    if configuration.targets.contains(.grid) {
      let cell =
        axis == .horizontal
        ? configuration.gridCellSize?.width
        : configuration.gridCellSize?.height
      snaps.append(gridSnap(value: movingValue, cell: cell, tolerance: tolerance))
    }
    return preferred(snaps)
  }

  private static func applying(
    _ snap: Snap,
    to frame: CGRect,
    edges: FlowingGraphCanvasResizeEdges,
    axis: GeometryAxis
  ) -> CGRect {
    var result = frame
    if axis == .horizontal {
      if edges.contains(.leading) {
        result.origin.x += snap.delta
        result.size.width -= snap.delta
      } else if edges.contains(.trailing) {
        result.size.width += snap.delta
      }
    } else if edges.contains(.top) {
      result.origin.y += snap.delta
      result.size.height -= snap.delta
    } else if edges.contains(.bottom) {
      result.size.height += snap.delta
    }
    return result
  }

  private static func constrained(
    _ frame: CGRect,
    relativeTo baseFrame: CGRect,
    edges: FlowingGraphCanvasResizeEdges,
    minimumSize: CGSize
  ) -> CGRect {
    var result = frame
    if result.width < minimumSize.width {
      result.size.width = minimumSize.width
      result.origin.x =
        edges.contains(.leading)
        ? baseFrame.maxX - minimumSize.width
        : baseFrame.minX
    }
    if result.height < minimumSize.height {
      result.size.height = minimumSize.height
      result.origin.y =
        edges.contains(.top)
        ? baseFrame.maxY - minimumSize.height
        : baseFrame.minY
    }
    return result
  }

  private static func resolvedGuides(
    for snap: Snap,
    snappedFrame: CGRect,
    axis: GeometryAxis
  ) -> [FlowingGraphCanvasGuide] {
    guard snap.customGuides.isEmpty else { return snap.customGuides }
    let candidateFrame = snap.candidateFrame ?? snappedFrame
    if axis == .horizontal {
      return [
        FlowingGraphCanvasGuide(
          axis: .vertical,
          position: snap.value,
          lowerBound: min(snappedFrame.minY, candidateFrame.minY),
          upperBound: max(snappedFrame.maxY, candidateFrame.maxY),
          kind: snap.kind
        )
      ]
    }
    return [
      FlowingGraphCanvasGuide(
        axis: .horizontal,
        position: snap.value,
        lowerBound: min(snappedFrame.minX, candidateFrame.minX),
        upperBound: max(snappedFrame.maxX, candidateFrame.maxX),
        kind: snap.kind
      )
    ]
  }

  private static func dimensionGuide(
    for frame: CGRect,
    axis: GeometryAxis,
    offset: CGFloat,
    kind: FlowingGraphCanvasGuideKind
  ) -> FlowingGraphCanvasGuide {
    if axis == .horizontal {
      return FlowingGraphCanvasGuide(
        axis: .horizontal,
        position: frame.maxY + offset,
        lowerBound: frame.minX,
        upperBound: frame.maxX,
        kind: kind,
        measurement: frame.width
      )
    }
    return FlowingGraphCanvasGuide(
      axis: .vertical,
      position: frame.maxX + offset,
      lowerBound: frame.minY,
      upperBound: frame.maxY,
      kind: kind,
      measurement: frame.height
    )
  }

  private static func offset(
    _ frame: CGRect,
    by delta: CGFloat,
    axis: GeometryAxis
  ) -> CGRect {
    axis == .horizontal
      ? frame.offsetBy(dx: delta, dy: 0)
      : frame.offsetBy(dx: 0, dy: delta)
  }

  private static func alignedTranslations<ID: Hashable & Sendable>(
    _ nodes: [FlowingGraphCanvasNodeGeometry<ID>],
    alignment: FlowingGraphCanvasAlignment
  ) -> [ID: CGSize] {
    guard nodes.count > 1 else { return [:] }
    let bounds = nodes.map(\.frame).reduce(CGRect.null) { $0.union($1) }
    return Dictionary(
      uniqueKeysWithValues: nodes.compactMap { node in
        let delta: CGSize
        switch alignment {
        case .leading:
          delta = CGSize(width: bounds.minX - node.frame.minX, height: 0)
        case .horizontalCenter:
          delta = CGSize(width: bounds.midX - node.frame.midX, height: 0)
        case .trailing:
          delta = CGSize(width: bounds.maxX - node.frame.maxX, height: 0)
        case .top:
          delta = CGSize(width: 0, height: bounds.minY - node.frame.minY)
        case .verticalCenter:
          delta = CGSize(width: 0, height: bounds.midY - node.frame.midY)
        case .bottom:
          delta = CGSize(width: 0, height: bounds.maxY - node.frame.maxY)
        }
        return delta == .zero ? nil : (node.id, delta)
      }
    )
  }

  private static func distributedTranslations<ID: Hashable & Sendable>(
    _ nodes: [FlowingGraphCanvasNodeGeometry<ID>],
    distribution: FlowingGraphCanvasDistribution
  ) -> [ID: CGSize] {
    guard nodes.count > 2 else { return [:] }
    let horizontal = distribution == .horizontal
    let sorted = nodes.enumerated().sorted { first, second in
      let firstValue = horizontal ? first.element.frame.minX : first.element.frame.minY
      let secondValue = horizontal ? second.element.frame.minX : second.element.frame.minY
      return firstValue == secondValue ? first.offset < second.offset : firstValue < secondValue
    }.map(\.element)
    let first = sorted[0].frame
    let last = sorted[sorted.count - 1].frame
    let totalLength = sorted.reduce(CGFloat.zero) {
      $0 + (horizontal ? $1.frame.width : $1.frame.height)
    }
    let available = (horizontal ? last.maxX - first.minX : last.maxY - first.minY)
    let gap = (available - totalLength) / CGFloat(sorted.count - 1)
    var cursor = horizontal ? first.minX : first.minY
    var result: [ID: CGSize] = [:]
    for node in sorted {
      let current = horizontal ? node.frame.minX : node.frame.minY
      let delta = cursor - current
      if delta != 0 {
        result[node.id] =
          horizontal
          ? CGSize(width: delta, height: 0)
          : CGSize(width: 0, height: delta)
      }
      cursor += (horizontal ? node.frame.width : node.frame.height) + gap
    }
    return result
  }
}

public struct FlowingGraphCanvasNodeArrangementIntent<Schema: FlowingGraphCanvasSchema>:
  Equatable, Sendable
{
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  public let action: FlowingGraphCanvasArrangementAction
  public let translations: [ElementID: CGSize]
  public let basePresentationSnapshotID: FlowingGraphPresentationSnapshotID
  public let baseLayoutInputID: FlowingLayoutInputID

  public init(
    action: FlowingGraphCanvasArrangementAction,
    translations: [ElementID: CGSize],
    basePresentationSnapshotID: FlowingGraphPresentationSnapshotID,
    baseLayoutInputID: FlowingLayoutInputID
  ) {
    self.action = action
    self.translations = translations
    self.basePresentationSnapshotID = basePresentationSnapshotID
    self.baseLayoutInputID = baseLayoutInputID
  }
}
