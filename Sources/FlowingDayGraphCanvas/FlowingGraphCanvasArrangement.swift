import CoreGraphics
import FlowingDayGraphComposition
import FlowingDayGraphCore

public struct FlowingGraphCanvasSnappingConfiguration: Equatable, Sendable {
  public static let standardTolerance: CGFloat = 6
  public static let standardSearchRadius: CGFloat = 600
  public static let standardMaximumCandidates = 512

  public let isEnabled: Bool
  public let tolerance: CGFloat
  public let searchRadius: CGFloat
  public let maximumCandidates: Int
  public let gridCellSize: CGSize?
  public let showsGuides: Bool

  public init(
    isEnabled: Bool,
    tolerance: CGFloat = standardTolerance,
    searchRadius: CGFloat = standardSearchRadius,
    maximumCandidates: Int = standardMaximumCandidates,
    gridCellSize: CGSize? = nil,
    showsGuides: Bool = true
  ) {
    precondition(tolerance >= 0 && tolerance.isFinite)
    precondition(searchRadius >= 0 && searchRadius.isFinite)
    precondition(maximumCandidates > 0)
    if let gridCellSize {
      precondition(gridCellSize.width > 0 && gridCellSize.width.isFinite)
      precondition(gridCellSize.height > 0 && gridCellSize.height.isFinite)
    }
    self.isEnabled = isEnabled
    self.tolerance = tolerance
    self.searchRadius = searchRadius
    self.maximumCandidates = maximumCandidates
    self.gridCellSize = gridCellSize
    self.showsGuides = showsGuides
  }

  public static let disabled = Self(isEnabled: false)
  public static let standard = Self(isEnabled: true)
}

public enum FlowingGraphCanvasGuideAxis: Hashable, Sendable {
  case horizontal
  case vertical
}

public enum FlowingGraphCanvasGuideKind: Hashable, Sendable {
  case alignment
  case grid
}

public struct FlowingGraphCanvasGuide: Equatable, Sendable {
  public let axis: FlowingGraphCanvasGuideAxis
  public let position: CGFloat
  public let lowerBound: CGFloat
  public let upperBound: CGFloat
  public let kind: FlowingGraphCanvasGuideKind

  public init(
    axis: FlowingGraphCanvasGuideAxis,
    position: CGFloat,
    lowerBound: CGFloat,
    upperBound: CGFloat,
    kind: FlowingGraphCanvasGuideKind
  ) {
    precondition(position.isFinite)
    precondition(lowerBound.isFinite && upperBound.isFinite)
    self.axis = axis
    self.position = position
    self.lowerBound = min(lowerBound, upperBound)
    self.upperBound = max(lowerBound, upperBound)
    self.kind = kind
  }
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
    let horizontal = bestSnap(
      movingValues: [proposedBounds.minX, proposedBounds.midX, proposedBounds.maxX],
      candidates: effectiveCandidates,
      candidateValues: { [$0.frame.minX, $0.frame.midX, $0.frame.maxX] },
      tolerance: tolerance
    )
    let vertical = bestSnap(
      movingValues: [proposedBounds.minY, proposedBounds.midY, proposedBounds.maxY],
      candidates: effectiveCandidates,
      candidateValues: { [$0.frame.minY, $0.frame.midY, $0.frame.maxY] },
      tolerance: tolerance
    )
    let gridX = gridSnap(
      value: proposedBounds.minX,
      cell: configuration.gridCellSize?.width,
      tolerance: tolerance
    )
    let gridY = gridSnap(
      value: proposedBounds.minY,
      cell: configuration.gridCellSize?.height,
      tolerance: tolerance
    )
    let resolvedX = preferred(alignment: horizontal, grid: gridX)
    let resolvedY = preferred(alignment: vertical, grid: gridY)
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
      let candidateBounds = resolvedX.candidateFrame ?? snappedBounds
      guides.append(
        FlowingGraphCanvasGuide(
          axis: .vertical,
          position: resolvedX.value,
          lowerBound: min(snappedBounds.minY, candidateBounds.minY),
          upperBound: max(snappedBounds.maxY, candidateBounds.maxY),
          kind: resolvedX.kind
        )
      )
    }
    if let resolvedY {
      let candidateBounds = resolvedY.candidateFrame ?? snappedBounds
      guides.append(
        FlowingGraphCanvasGuide(
          axis: .horizontal,
          position: resolvedY.value,
          lowerBound: min(snappedBounds.minX, candidateBounds.minX),
          upperBound: max(snappedBounds.maxX, candidateBounds.maxX),
          kind: resolvedY.kind
        )
      )
    }
    return FlowingGraphCanvasSnapResult(translation: translation, guides: guides)
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
  }

  private static func bestSnap<ID>(
    movingValues: [CGFloat],
    candidates: [FlowingGraphCanvasSnapCandidate<ID>],
    candidateValues: (FlowingGraphCanvasSnapCandidate<ID>) -> [CGFloat],
    tolerance: CGFloat
  ) -> Snap? {
    var best: Snap?
    for candidate in candidates {
      for movingValue in movingValues {
        for candidateValue in candidateValues(candidate) {
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

  private static func preferred(alignment: Snap?, grid: Snap?) -> Snap? {
    switch (alignment, grid) {
    case (nil, nil):
      nil
    case (let alignment?, nil):
      alignment
    case (nil, let grid?):
      grid
    case (let alignment?, let grid?):
      abs(alignment.delta) <= abs(grid.delta) ? alignment : grid
    }
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

  public init(
    action: FlowingGraphCanvasArrangementAction,
    translations: [ElementID: CGSize],
    basePresentationSnapshotID: FlowingGraphPresentationSnapshotID
  ) {
    self.action = action
    self.translations = translations
    self.basePresentationSnapshotID = basePresentationSnapshotID
  }
}
