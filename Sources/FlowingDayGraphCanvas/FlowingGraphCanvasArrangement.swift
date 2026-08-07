import CoreGraphics
import FlowingDayGraphComposition
import FlowingDayGraphCore
import FlowingDayGraphLayout

public struct FlowingGraphCanvasGridAxes: OptionSet, Hashable, Sendable {
  public let rawValue: UInt8

  public init(rawValue: UInt8) {
    self.rawValue = rawValue
  }

  public static let x = Self(rawValue: 1 << 0)
  public static let y = Self(rawValue: 1 << 1)
  public static let both: Self = [.x, .y]
}

public enum FlowingGraphCanvasGridRoundingPolicy: Hashable, Sendable {
  case nearest
  case down
  case up
  case towardZero
  case awayFromZero

  fileprivate func rounded(_ value: CGFloat) -> CGFloat {
    switch self {
    case .nearest:
      value.rounded()
    case .down:
      value.rounded(.down)
    case .up:
      value.rounded(.up)
    case .towardZero:
      value.rounded(.towardZero)
    case .awayFromZero:
      value.rounded(.awayFromZero)
    }
  }
}

public struct FlowingGraphCanvasGridSubdivisions: Equatable, Sendable {
  public let x: Int
  public let y: Int

  public init(x: Int = 1, y: Int = 1) {
    precondition(x > 0)
    precondition(y > 0)
    self.x = x
    self.y = y
  }
}

public struct FlowingGraphCanvasGridConfiguration: Equatable, Sendable {
  public let origin: CGPoint
  public let majorCellSize: CGSize
  public let subdivisions: FlowingGraphCanvasGridSubdivisions
  public let enabledAxes: FlowingGraphCanvasGridAxes
  public let roundingPolicy: FlowingGraphCanvasGridRoundingPolicy

  public init(
    origin: CGPoint = .zero,
    majorCellSize: CGSize,
    subdivisions: FlowingGraphCanvasGridSubdivisions = .init(),
    enabledAxes: FlowingGraphCanvasGridAxes = .both,
    roundingPolicy: FlowingGraphCanvasGridRoundingPolicy = .nearest
  ) {
    precondition(origin.x.isFinite && origin.y.isFinite)
    precondition(majorCellSize.width > 0 && majorCellSize.width.isFinite)
    precondition(majorCellSize.height > 0 && majorCellSize.height.isFinite)
    self.origin = origin
    self.majorCellSize = majorCellSize
    self.subdivisions = subdivisions
    self.enabledAxes = enabledAxes
    self.roundingPolicy = roundingPolicy
  }

  public var minorCellSize: CGSize {
    CGSize(
      width: majorCellSize.width / CGFloat(subdivisions.x),
      height: majorCellSize.height / CGFloat(subdivisions.y)
    )
  }
}

public struct FlowingGraphCanvasSnappingConfiguration: Equatable, Sendable {
  public static let standardTolerance: CGFloat = 6
  public static let standardSearchRadius: CGFloat = 600
  public static let standardMaximumCandidates = 512
  public static let standardGuideOffset: CGFloat = 8
  public static let standardReleaseTolerance: CGFloat = 10

  public let isEnabled: Bool
  public let targets: FlowingGraphCanvasSnapTargets
  public let tolerance: CGFloat
  public let searchRadius: CGFloat
  public let maximumCandidates: Int
  public let grid: FlowingGraphCanvasGridConfiguration?
  public let showsGuides: Bool
  public let guideOffset: CGFloat
  public let releaseTolerance: CGFloat

  public init(
    isEnabled: Bool,
    targets: FlowingGraphCanvasSnapTargets = .standard,
    tolerance: CGFloat = standardTolerance,
    searchRadius: CGFloat = standardSearchRadius,
    maximumCandidates: Int = standardMaximumCandidates,
    grid: FlowingGraphCanvasGridConfiguration? = nil,
    showsGuides: Bool = true,
    guideOffset: CGFloat = standardGuideOffset,
    releaseTolerance: CGFloat? = nil
  ) {
    let resolvedReleaseTolerance = releaseTolerance ?? max(tolerance, Self.standardReleaseTolerance)
    precondition(tolerance >= 0 && tolerance.isFinite)
    precondition(searchRadius >= 0 && searchRadius.isFinite)
    precondition(maximumCandidates > 0)
    precondition(guideOffset >= 0 && guideOffset.isFinite)
    precondition(resolvedReleaseTolerance >= tolerance && resolvedReleaseTolerance.isFinite)
    self.isEnabled = isEnabled
    self.targets = targets
    self.tolerance = tolerance
    self.searchRadius = searchRadius
    self.maximumCandidates = maximumCandidates
    self.grid = grid
    self.showsGuides = showsGuides
    self.guideOffset = guideOffset
    self.releaseTolerance = resolvedReleaseTolerance
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

public enum FlowingGraphCanvasGeometryAxis: Hashable, Sendable {
  case horizontal
  case vertical

  fileprivate func lower(_ frame: CGRect) -> CGFloat {
    self == .horizontal ? frame.minX : frame.minY
  }

  fileprivate func middle(_ frame: CGRect) -> CGFloat {
    self == .horizontal ? frame.midX : frame.midY
  }

  fileprivate func upper(_ frame: CGRect) -> CGFloat {
    self == .horizontal ? frame.maxX : frame.maxY
  }

  fileprivate func length(_ frame: CGRect) -> CGFloat {
    self == .horizontal ? frame.width : frame.height
  }

  fileprivate func crossUpper(_ frame: CGRect) -> CGFloat {
    self == .horizontal ? frame.maxY : frame.maxX
  }
}

private typealias GeometryAxis = FlowingGraphCanvasGeometryAxis

private struct SnapLock: Equatable, Sendable {
  let axis: GeometryAxis
  let acquisitionValue: CGFloat
  let snappedValue: CGFloat
  let guideValue: CGFloat
  let candidateFrame: CGRect?
  let kind: FlowingGraphCanvasGuideKind
  let spacingReferenceFrames: [CGRect]
  let guideOffset: CGFloat

  init(
    axis: GeometryAxis,
    acquisitionValue: CGFloat,
    snappedValue: CGFloat,
    guideValue: CGFloat,
    candidateFrame: CGRect?,
    kind: FlowingGraphCanvasGuideKind,
    spacingReferenceFrames: [CGRect] = [],
    guideOffset: CGFloat = 0
  ) {
    precondition(acquisitionValue.isFinite)
    precondition(snappedValue.isFinite)
    precondition(guideValue.isFinite)
    precondition(guideOffset >= 0 && guideOffset.isFinite)
    self.axis = axis
    self.acquisitionValue = acquisitionValue
    self.snappedValue = snappedValue
    self.guideValue = guideValue
    self.candidateFrame = candidateFrame
    self.kind = kind
    self.spacingReferenceFrames = spacingReferenceFrames
    self.guideOffset = guideOffset
  }
}

public struct FlowingGraphCanvasSnapState: Equatable, Sendable {
  fileprivate var horizontal: SnapLock?
  fileprivate var vertical: SnapLock?

  public init() {}

  fileprivate init(horizontal: SnapLock?, vertical: SnapLock?) {
    precondition(horizontal == nil || horizontal?.axis == .horizontal)
    precondition(vertical == nil || vertical?.axis == .vertical)
    self.horizontal = horizontal
    self.vertical = vertical
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
  public static let standardHandles: [Self] = [
    [.leading, .top],
    [.top],
    [.trailing, .top],
    [.trailing],
    [.trailing, .bottom],
    [.bottom],
    [.leading, .bottom],
    [.leading],
  ]

  public var isValid: Bool {
    !isEmpty
      && !(contains(.leading) && contains(.trailing))
      && !(contains(.top) && contains(.bottom))
  }
}

public struct FlowingGraphCanvasResizeBehavior: Equatable, Sendable {
  public let preservesAspectRatio: Bool
  public let resizesFromCenter: Bool
  public let aspectRatioDrivingAxis: FlowingGraphCanvasGeometryAxis?

  public init(
    preservesAspectRatio: Bool = false,
    resizesFromCenter: Bool = false,
    aspectRatioDrivingAxis: FlowingGraphCanvasGeometryAxis? = nil
  ) {
    precondition(!preservesAspectRatio || aspectRatioDrivingAxis != nil)
    self.preservesAspectRatio = preservesAspectRatio
    self.resizesFromCenter = resizesFromCenter
    self.aspectRatioDrivingAxis = aspectRatioDrivingAxis
  }

  public static let standard = Self()
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
  public let snapState: FlowingGraphCanvasSnapState

  public init(
    translation: CGSize,
    guides: [FlowingGraphCanvasGuide],
    snapState: FlowingGraphCanvasSnapState = .init()
  ) {
    self.translation = translation
    self.guides = guides
    self.snapState = snapState
  }
}

public struct FlowingGraphCanvasResizeResult: Equatable, Sendable {
  public let frame: CGRect
  public let guides: [FlowingGraphCanvasGuide]
  public let snapState: FlowingGraphCanvasSnapState

  public init(
    frame: CGRect,
    guides: [FlowingGraphCanvasGuide],
    snapState: FlowingGraphCanvasSnapState = .init()
  ) {
    self.frame = frame
    self.guides = guides
    self.snapState = snapState
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
    zoom: CGFloat,
    snapState: FlowingGraphCanvasSnapState = .init(),
    allowsSnapping: Bool = true
  ) -> FlowingGraphCanvasSnapResult {
    guard configuration.isEnabled, allowsSnapping, zoom > 0, zoom.isFinite else {
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
    let releaseTolerance = configuration.releaseTolerance / zoom
    let effectiveCandidates = Array(candidates.prefix(configuration.maximumCandidates))
    let resolvedX =
      retainedSnap(
        snapState.horizontal,
        proposedValue: proposedTranslation.width,
        releaseTolerance: releaseTolerance
      )
      ?? translationSnap(
        frame: proposedBounds,
        candidates: effectiveCandidates,
        axis: .horizontal,
        configuration: configuration,
        tolerance: tolerance,
        zoom: zoom
      )
    let resolvedY =
      retainedSnap(
        snapState.vertical,
        proposedValue: proposedTranslation.height,
        releaseTolerance: releaseTolerance
      )
      ?? translationSnap(
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
    let resolvedState = FlowingGraphCanvasSnapState(
      horizontal: resolvedX.map {
        lock(
          from: $0,
          axis: .horizontal,
          proposedValue: proposedTranslation.width,
          snappedValue: translation.width
        )
      },
      vertical: resolvedY.map {
        lock(
          from: $0,
          axis: .vertical,
          proposedValue: proposedTranslation.height,
          snappedValue: translation.height
        )
      }
    )
    guard configuration.showsGuides else {
      return FlowingGraphCanvasSnapResult(
        translation: translation,
        guides: [],
        snapState: resolvedState
      )
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
    return FlowingGraphCanvasSnapResult(
      translation: translation,
      guides: guides,
      snapState: resolvedState
    )
  }

  public static func resize<ID: Hashable & Sendable>(
    baseFrame: CGRect,
    proposedFrame: CGRect,
    edges: FlowingGraphCanvasResizeEdges,
    candidates: [FlowingGraphCanvasSnapCandidate<ID>],
    configuration: FlowingGraphCanvasSnappingConfiguration,
    minimumSize: CGSize,
    maximumSize: CGSize? = nil,
    zoom: CGFloat,
    snapState: FlowingGraphCanvasSnapState = .init(),
    allowsSnapping: Bool = true,
    behavior: FlowingGraphCanvasResizeBehavior = .standard
  ) -> FlowingGraphCanvasResizeResult {
    precondition(edges.isValid)
    precondition(minimumSize.width >= 0 && minimumSize.width.isFinite)
    precondition(minimumSize.height >= 0 && minimumSize.height.isFinite)
    if let maximumSize {
      precondition(maximumSize.width >= minimumSize.width && maximumSize.width.isFinite)
      precondition(maximumSize.height >= minimumSize.height && maximumSize.height.isFinite)
    }
    guard !edges.isEmpty, zoom > 0, zoom.isFinite else {
      return FlowingGraphCanvasResizeResult(frame: proposedFrame, guides: [])
    }
    let effectiveCandidates = Array(candidates.prefix(configuration.maximumCandidates))
    let tolerance = configuration.tolerance / zoom
    let releaseTolerance = configuration.releaseTolerance / zoom
    let proposedConstrainedFrame = constrained(
      proposedFrame,
      relativeTo: baseFrame,
      edges: edges,
      minimumSize: minimumSize,
      maximumSize: maximumSize,
      behavior: behavior
    )
    var frame = proposedConstrainedFrame
    var resolved: [(GeometryAxis, Snap)] = []
    if configuration.isEnabled && allowsSnapping {
      let proposedHorizontalValue = resizeValue(frame, edges: edges, axis: .horizontal)
      if shouldResolve(axis: .horizontal, behavior: behavior),
        let snap = proposedHorizontalValue.flatMap({ value in
          retainedSnap(
            snapState.horizontal,
            proposedValue: value,
            releaseTolerance: releaseTolerance
          )
            ?? resizeSnap(
              frame: frame,
              edges: edges,
              candidates: effectiveCandidates,
              axis: .horizontal,
              configuration: configuration,
              tolerance: tolerance,
              behavior: behavior
            )
        })
      {
        frame = applying(
          snap,
          to: frame,
          baseFrame: baseFrame,
          edges: edges,
          axis: .horizontal,
          behavior: behavior
        )
        resolved.append((.horizontal, snap))
      }
      let proposedVerticalValue = resizeValue(frame, edges: edges, axis: .vertical)
      if shouldResolve(axis: .vertical, behavior: behavior),
        let snap = proposedVerticalValue.flatMap({ value in
          retainedSnap(
            snapState.vertical,
            proposedValue: value,
            releaseTolerance: releaseTolerance
          )
            ?? resizeSnap(
              frame: frame,
              edges: edges,
              candidates: effectiveCandidates,
              axis: .vertical,
              configuration: configuration,
              tolerance: tolerance,
              behavior: behavior
            )
        })
      {
        frame = applying(
          snap,
          to: frame,
          baseFrame: baseFrame,
          edges: edges,
          axis: .vertical,
          behavior: behavior
        )
        resolved.append((.vertical, snap))
      }
      frame = constrained(
        frame,
        relativeTo: baseFrame,
        edges: edges,
        minimumSize: minimumSize,
        maximumSize: maximumSize,
        behavior: behavior
      )
    }
    let resolvedState = FlowingGraphCanvasSnapState(
      horizontal: resizeLock(
        in: resolved,
        axis: .horizontal,
        proposedValue: resizeValue(
          proposedConstrainedFrame,
          edges: edges,
          axis: .horizontal
        ),
        snappedValue: resizeValue(frame, edges: edges, axis: .horizontal)
      ),
      vertical: resizeLock(
        in: resolved,
        axis: .vertical,
        proposedValue: resizeValue(
          proposedConstrainedFrame,
          edges: edges,
          axis: .vertical
        ),
        snappedValue: resizeValue(frame, edges: edges, axis: .vertical)
      )
    )
    guard configuration.showsGuides else {
      return FlowingGraphCanvasResizeResult(
        frame: frame,
        guides: [],
        snapState: resolvedState
      )
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
    return FlowingGraphCanvasResizeResult(
      frame: frame,
      guides: guides,
      snapState: resolvedState
    )
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
    let spacingReferenceFrames: [CGRect]
    let guideOffset: CGFloat
    let retainedLock: SnapLock?

    init(
      delta: CGFloat,
      value: CGFloat,
      candidateFrame: CGRect?,
      kind: FlowingGraphCanvasGuideKind,
      spacingReferenceFrames: [CGRect] = [],
      guideOffset: CGFloat = 0,
      retainedLock: SnapLock? = nil
    ) {
      self.delta = delta
      self.value = value
      self.candidateFrame = candidateFrame
      self.kind = kind
      self.spacingReferenceFrames = spacingReferenceFrames
      self.guideOffset = guideOffset
      self.retainedLock = retainedLock
    }
  }

  private static func retainedSnap(
    _ lock: SnapLock?,
    proposedValue: CGFloat,
    releaseTolerance: CGFloat
  ) -> Snap? {
    guard let lock,
      abs(proposedValue - lock.acquisitionValue) <= releaseTolerance
    else {
      return nil
    }
    return Snap(
      delta: lock.snappedValue - proposedValue,
      value: lock.guideValue,
      candidateFrame: lock.candidateFrame,
      kind: lock.kind,
      spacingReferenceFrames: lock.spacingReferenceFrames,
      guideOffset: lock.guideOffset,
      retainedLock: lock
    )
  }

  private static func lock(
    from snap: Snap,
    axis: GeometryAxis,
    proposedValue: CGFloat,
    snappedValue: CGFloat
  ) -> SnapLock {
    snap.retainedLock
      ?? SnapLock(
        axis: axis,
        acquisitionValue: proposedValue,
        snappedValue: snappedValue,
        guideValue: snap.value,
        candidateFrame: snap.candidateFrame,
        kind: snap.kind,
        spacingReferenceFrames: snap.spacingReferenceFrames,
        guideOffset: snap.guideOffset
      )
  }

  private static func resizeValue(
    _ frame: CGRect,
    edges: FlowingGraphCanvasResizeEdges,
    axis: GeometryAxis
  ) -> CGFloat? {
    let usesLower = axis == .horizontal ? edges.contains(.leading) : edges.contains(.top)
    let usesUpper = axis == .horizontal ? edges.contains(.trailing) : edges.contains(.bottom)
    guard usesLower != usesUpper else { return nil }
    return usesLower ? axis.lower(frame) : axis.upper(frame)
  }

  private static func resizeLock(
    in resolved: [(GeometryAxis, Snap)],
    axis: GeometryAxis,
    proposedValue: CGFloat?,
    snappedValue: CGFloat?
  ) -> SnapLock? {
    guard let proposedValue,
      let snappedValue,
      let snap = resolved.first(where: { $0.0 == axis })?.1
    else {
      return nil
    }
    return lock(
      from: snap,
      axis: axis,
      proposedValue: proposedValue,
      snappedValue: snappedValue
    )
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
      snaps.append(
        gridSnap(
          value: axis.lower(frame),
          axis: axis,
          grid: configuration.grid,
          tolerance: tolerance
        )
      )
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

  private static func gridSnap(
    value: CGFloat,
    axis: GeometryAxis,
    grid: FlowingGraphCanvasGridConfiguration?,
    tolerance: CGFloat
  ) -> Snap? {
    guard let grid else { return nil }
    let isHorizontal = axis == .horizontal
    let requiredAxis: FlowingGraphCanvasGridAxes = isHorizontal ? .x : .y
    guard grid.enabledAxes.contains(requiredAxis) else { return nil }
    let cell = isHorizontal ? grid.minorCellSize.width : grid.minorCellSize.height
    let origin = isHorizontal ? grid.origin.x : grid.origin.y
    let target = grid.roundingPolicy.rounded((value - origin) / cell) * cell + origin
    let delta = target - value
    guard abs(delta) <= tolerance else { return nil }
    return Snap(delta: delta, value: target, candidateFrame: nil, kind: .grid)
  }

  private static func preferred(_ snaps: [Snap?]) -> Snap? {
    var result: Snap?
    for case let snap? in snaps {
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

    if let chain = nearestEqualSpacingChain(
      in: before,
      axis: axis,
      fromEnd: true,
      tolerance: tolerance
    ),
      let last = chain.last
    {
      let gap = chainGap(chain, axis: axis)
      snaps.append(
        spacingSnap(
          targetLower: axis.upper(last) + gap,
          movingFrame: movingFrame,
          referenceFrames: chain,
          axis: axis,
          tolerance: tolerance,
          guideOffset: guideOffset
        )
      )
    }

    if let chain = nearestEqualSpacingChain(
      in: after,
      axis: axis,
      fromEnd: false,
      tolerance: tolerance
    ),
      let first = chain.first
    {
      let gap = chainGap(chain, axis: axis)
      snaps.append(
        spacingSnap(
          targetLower: axis.lower(first) - gap - movingLength,
          movingFrame: movingFrame,
          referenceFrames: chain,
          axis: axis,
          tolerance: tolerance,
          guideOffset: guideOffset
        )
      )
    }
    return preferred(snaps)
  }

  private static func nearestEqualSpacingChain(
    in frames: [CGRect],
    axis: GeometryAxis,
    fromEnd: Bool,
    tolerance: CGFloat
  ) -> [CGRect]? {
    guard frames.count > 1 else { return nil }
    let pairIndex: Int?
    if fromEnd {
      var index = frames.count - 2
      var match: Int?
      while true {
        if axis.upper(frames[index]) <= axis.lower(frames[index + 1]) {
          match = index
          break
        }
        guard index > 0 else { break }
        index -= 1
      }
      pairIndex = match
    } else {
      pairIndex = (0..<(frames.count - 1)).first { index in
        axis.upper(frames[index]) <= axis.lower(frames[index + 1])
      }
    }
    guard let pairIndex else { return nil }
    let gap = axis.lower(frames[pairIndex + 1]) - axis.upper(frames[pairIndex])
    var lowerIndex = pairIndex
    var upperIndex = pairIndex + 1
    while lowerIndex > 0 {
      let previousGap =
        axis.lower(frames[lowerIndex]) - axis.upper(frames[lowerIndex - 1])
      guard previousGap >= 0, abs(previousGap - gap) <= tolerance else { break }
      lowerIndex -= 1
    }
    while upperIndex + 1 < frames.count {
      let nextGap = axis.lower(frames[upperIndex + 1]) - axis.upper(frames[upperIndex])
      guard nextGap >= 0, abs(nextGap - gap) <= tolerance else { break }
      upperIndex += 1
    }
    return Array(frames[lowerIndex...upperIndex])
  }

  private static func chainGap(
    _ frames: [CGRect],
    axis: GeometryAxis
  ) -> CGFloat {
    guard frames.count > 1 else { return 0 }
    var total: CGFloat = 0
    for index in 0..<(frames.count - 1) {
      total += axis.lower(frames[index + 1]) - axis.upper(frames[index])
    }
    return total / CGFloat(frames.count - 1)
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
    return Snap(
      delta: delta,
      value: targetLower,
      candidateFrame: nil,
      kind: .equalSpacing,
      spacingReferenceFrames: referenceFrames,
      guideOffset: guideOffset
    )
  }

  private static func resizeSnap<ID>(
    frame: CGRect,
    edges: FlowingGraphCanvasResizeEdges,
    candidates: [FlowingGraphCanvasSnapCandidate<ID>],
    axis: GeometryAxis,
    configuration: FlowingGraphCanvasSnappingConfiguration,
    tolerance: CGFloat,
    behavior: FlowingGraphCanvasResizeBehavior
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
        let target: CGFloat
        if behavior.resizesFromCenter {
          target =
            axis.middle(frame)
            + (usesLower ? -1 : 1) * axis.length(candidate.frame) / 2
        } else {
          target =
            usesLower
            ? axis.upper(frame) - axis.length(candidate.frame)
            : axis.lower(frame) + axis.length(candidate.frame)
        }
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
      snaps.append(
        gridSnap(
          value: movingValue,
          axis: axis,
          grid: configuration.grid,
          tolerance: tolerance
        )
      )
    }
    return preferred(snaps)
  }

  private static func applying(
    _ snap: Snap,
    to frame: CGRect,
    baseFrame: CGRect,
    edges: FlowingGraphCanvasResizeEdges,
    axis: GeometryAxis,
    behavior: FlowingGraphCanvasResizeBehavior
  ) -> CGRect {
    var result = frame
    if axis == .horizontal {
      if edges.contains(.leading) {
        result.origin.x += snap.delta
        result.size.width -= snap.delta * (behavior.resizesFromCenter ? 2 : 1)
      } else if edges.contains(.trailing) {
        if behavior.resizesFromCenter {
          result.origin.x -= snap.delta
        }
        result.size.width += snap.delta * (behavior.resizesFromCenter ? 2 : 1)
      }
    } else if edges.contains(.top) {
      result.origin.y += snap.delta
      result.size.height -= snap.delta * (behavior.resizesFromCenter ? 2 : 1)
    } else if edges.contains(.bottom) {
      if behavior.resizesFromCenter {
        result.origin.y -= snap.delta
      }
      result.size.height += snap.delta * (behavior.resizesFromCenter ? 2 : 1)
    }
    return behavior.preservesAspectRatio
      ? preservingAspectRatio(
        result,
        relativeTo: baseFrame,
        edges: edges,
        behavior: behavior
      )
      : result
  }

  private static func constrained(
    _ frame: CGRect,
    relativeTo baseFrame: CGRect,
    edges: FlowingGraphCanvasResizeEdges,
    minimumSize: CGSize,
    maximumSize: CGSize?,
    behavior: FlowingGraphCanvasResizeBehavior
  ) -> CGRect {
    if behavior.preservesAspectRatio,
      baseFrame.width > 0,
      baseFrame.height > 0,
      let drivingAxis = behavior.aspectRatioDrivingAxis
    {
      let proposedScale =
        drivingAxis == .horizontal
        ? frame.width / baseFrame.width
        : frame.height / baseFrame.height
      let minimumScale = max(
        minimumSize.width / baseFrame.width,
        minimumSize.height / baseFrame.height
      )
      let maximumScale = maximumSize.map {
        min($0.width / baseFrame.width, $0.height / baseFrame.height)
      }
      return scaled(
        baseFrame,
        scale: min(
          max(proposedScale, minimumScale),
          maximumScale ?? .greatestFiniteMagnitude
        ),
        edges: edges,
        fromCenter: behavior.resizesFromCenter
      )
    }
    var result = frame
    if result.width < minimumSize.width {
      result.size.width = minimumSize.width
      if behavior.resizesFromCenter {
        result.origin.x = baseFrame.midX - minimumSize.width / 2
      } else {
        result.origin.x =
          edges.contains(.leading)
          ? baseFrame.maxX - minimumSize.width
          : baseFrame.minX
      }
    }
    if result.height < minimumSize.height {
      result.size.height = minimumSize.height
      if behavior.resizesFromCenter {
        result.origin.y = baseFrame.midY - minimumSize.height / 2
      } else {
        result.origin.y =
          edges.contains(.top)
          ? baseFrame.maxY - minimumSize.height
          : baseFrame.minY
      }
    }
    if let maximumSize, result.width > maximumSize.width {
      result.size.width = maximumSize.width
      if behavior.resizesFromCenter {
        result.origin.x = baseFrame.midX - maximumSize.width / 2
      } else {
        result.origin.x =
          edges.contains(.leading)
          ? baseFrame.maxX - maximumSize.width
          : baseFrame.minX
      }
    }
    if let maximumSize, result.height > maximumSize.height {
      result.size.height = maximumSize.height
      if behavior.resizesFromCenter {
        result.origin.y = baseFrame.midY - maximumSize.height / 2
      } else {
        result.origin.y =
          edges.contains(.top)
          ? baseFrame.maxY - maximumSize.height
          : baseFrame.minY
      }
    }
    return result
  }

  private static func shouldResolve(
    axis: GeometryAxis,
    behavior: FlowingGraphCanvasResizeBehavior
  ) -> Bool {
    !behavior.preservesAspectRatio || behavior.aspectRatioDrivingAxis == axis
  }

  private static func preservingAspectRatio(
    _ frame: CGRect,
    relativeTo baseFrame: CGRect,
    edges: FlowingGraphCanvasResizeEdges,
    behavior: FlowingGraphCanvasResizeBehavior
  ) -> CGRect {
    guard let drivingAxis = behavior.aspectRatioDrivingAxis else { return frame }
    let scale =
      drivingAxis == .horizontal
      ? frame.width / baseFrame.width
      : frame.height / baseFrame.height
    return scaled(
      baseFrame,
      scale: scale,
      edges: edges,
      fromCenter: behavior.resizesFromCenter
    )
  }

  private static func scaled(
    _ frame: CGRect,
    scale: CGFloat,
    edges: FlowingGraphCanvasResizeEdges,
    fromCenter: Bool
  ) -> CGRect {
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
    let anchorPoint = CGPoint(
      x: frame.minX + frame.width * horizontalAnchor,
      y: frame.minY + frame.height * verticalAnchor
    )
    let size = CGSize(width: frame.width * scale, height: frame.height * scale)
    return CGRect(
      x: anchorPoint.x - size.width * horizontalAnchor,
      y: anchorPoint.y - size.height * verticalAnchor,
      width: size.width,
      height: size.height
    )
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

  private static func resolvedGuides(
    for snap: Snap,
    snappedFrame: CGRect,
    axis: GeometryAxis
  ) -> [FlowingGraphCanvasGuide] {
    if snap.kind == .equalSpacing {
      return spacingGuides(
        movingFrame: snappedFrame,
        referenceFrames: snap.spacingReferenceFrames,
        axis: axis,
        guideOffset: snap.guideOffset
      )
    }
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

  private static func spacingGuides(
    movingFrame: CGRect,
    referenceFrames: [CGRect],
    axis: GeometryAxis,
    guideOffset: CGFloat
  ) -> [FlowingGraphCanvasGuide] {
    let orderedFrames = (referenceFrames + [movingFrame]).sorted {
      axis.lower($0) < axis.lower($1)
    }
    guard let crossUpper = orderedFrames.map({ axis.crossUpper($0) }).max() else {
      return []
    }
    let crossPosition = crossUpper + guideOffset
    let guideAxis: FlowingGraphCanvasGuideAxis =
      axis == .horizontal ? .horizontal : .vertical
    return zip(orderedFrames, orderedFrames.dropFirst()).compactMap {
      pair -> FlowingGraphCanvasGuide? in
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
