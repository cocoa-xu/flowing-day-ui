import CoreGraphics
import Foundation

public struct FlowingGraphMiniMapSnapshotID: Hashable, Sendable {
  public let rawValue: UUID

  public init(rawValue: UUID = UUID()) {
    self.rawValue = rawValue
  }
}

public struct FlowingGraphMiniMapNode<NodeID: Hashable & Sendable>: Sendable {
  public let id: NodeID
  public let frame: CGRect

  public init(id: NodeID, frame: CGRect) {
    self.id = id
    self.frame = frame
  }
}

extension FlowingGraphMiniMapNode: Equatable where NodeID: Equatable {}

public struct FlowingGraphMiniMapEdge<EdgeID: Hashable & Sendable>: Sendable {
  public let id: EdgeID
  public let start: CGPoint
  public let end: CGPoint

  public init(id: EdgeID, start: CGPoint, end: CGPoint) {
    self.id = id
    self.start = start
    self.end = end
  }
}

extension FlowingGraphMiniMapEdge: Equatable where EdgeID: Equatable {}

public struct FlowingGraphMiniMapSnapshot<
  NodeID: Hashable & Sendable,
  EdgeID: Hashable & Sendable
>: Sendable {
  public let id: FlowingGraphMiniMapSnapshotID
  public let contentBounds: CGRect
  public let nodes: [FlowingGraphMiniMapNode<NodeID>]
  public let edges: [FlowingGraphMiniMapEdge<EdgeID>]
  public let changeSet: FlowingGraphMiniMapChangeSet<NodeID, EdgeID>?

  public init(
    id: FlowingGraphMiniMapSnapshotID = .init(),
    contentBounds: CGRect,
    nodes: [FlowingGraphMiniMapNode<NodeID>],
    edges: [FlowingGraphMiniMapEdge<EdgeID>] = [],
    changeSet: FlowingGraphMiniMapChangeSet<NodeID, EdgeID>? = nil
  ) {
    if let changeSet {
      precondition(changeSet.baseSnapshotID != id)
    }
    self.id = id
    self.contentBounds = contentBounds
    self.nodes = nodes
    self.edges = edges
    self.changeSet = changeSet
  }
}

public struct FlowingGraphMiniMapChangeSet<
  NodeID: Hashable & Sendable,
  EdgeID: Hashable & Sendable
>: Sendable {
  public let baseSnapshotID: FlowingGraphMiniMapSnapshotID
  public let insertedNodes: [FlowingGraphMiniMapNode<NodeID>]
  public let updatedNodes: [FlowingGraphMiniMapNode<NodeID>]
  public let removedNodeIDs: Set<NodeID>
  public let insertedEdges: [FlowingGraphMiniMapEdge<EdgeID>]
  public let updatedEdges: [FlowingGraphMiniMapEdge<EdgeID>]
  public let removedEdgeIDs: Set<EdgeID>
  public let orderingChanged: Bool
  public let contentBoundsChanged: Bool

  public init(
    baseSnapshotID: FlowingGraphMiniMapSnapshotID,
    insertedNodes: [FlowingGraphMiniMapNode<NodeID>] = [],
    updatedNodes: [FlowingGraphMiniMapNode<NodeID>] = [],
    removedNodeIDs: Set<NodeID> = [],
    insertedEdges: [FlowingGraphMiniMapEdge<EdgeID>] = [],
    updatedEdges: [FlowingGraphMiniMapEdge<EdgeID>] = [],
    removedEdgeIDs: Set<EdgeID> = [],
    orderingChanged: Bool = false,
    contentBoundsChanged: Bool = false
  ) {
    self.baseSnapshotID = baseSnapshotID
    self.insertedNodes = insertedNodes
    self.updatedNodes = updatedNodes
    self.removedNodeIDs = removedNodeIDs
    self.insertedEdges = insertedEdges
    self.updatedEdges = updatedEdges
    self.removedEdgeIDs = removedEdgeIDs
    self.orderingChanged = orderingChanged
    self.contentBoundsChanged = contentBoundsChanged
  }
}

public enum FlowingGraphMiniMapVisibility: Hashable, Sendable {
  case always
  case whenNavigationIsUseful

  func isVisible(contentBounds: CGRect, visibleWorldRect: CGRect) -> Bool {
    switch self {
    case .always:
      return true
    case .whenNavigationIsUseful:
      return !visibleWorldRect.contains(contentBounds)
    }
  }
}

public enum FlowingGraphMiniMapRepresentation: Hashable, Sendable {
  case adaptive
  case silhouette
  case structure
}

public enum FlowingGraphMiniMapInteraction: Hashable, Sendable {
  case displayOnly
  case pan
  case panAndZoom
}

public enum FlowingGraphMiniMapRefreshPolicy: Hashable, Sendable {
  case adaptiveLive
  case afterChangesSettle
}

public enum FlowingGraphMiniMapScope: Hashable, Sendable {
  case overview
  case localNavigator(surroundingScale: CGFloat)
  case custom(CGRect)

  func bounds(contentBounds: CGRect, visibleWorldRect: CGRect) -> CGRect {
    switch self {
    case .overview:
      return contentBounds.union(visibleWorldRect).flowingMiniMapUsableBounds
    case .localNavigator(let surroundingScale):
      let scale = surroundingScale.isFinite ? max(surroundingScale, 1) : 1
      let width = max(visibleWorldRect.width * scale, 1)
      let height = max(visibleWorldRect.height * scale, 1)
      return CGRect(
        x: visibleWorldRect.midX - width / 2,
        y: visibleWorldRect.midY - height / 2,
        width: width,
        height: height
      )
    case .custom(let bounds):
      return bounds.flowingMiniMapUsableBounds
    }
  }
}

public enum FlowingGraphMiniMapPlacement: Hashable, Sendable {
  case topLeading
  case topTrailing
  case bottomLeading
  case bottomTrailing
}

public struct FlowingGraphMiniMapPerformanceConfiguration: Hashable, Sendable {
  public let aggregationCellSize: CGFloat
  public let maximumNodePrimitiveDensity: CGFloat
  public let maximumEdgePrimitiveDensity: CGFloat
  public let maximumAdaptiveStyleCount: Int
  public let maximumAggregationCellCount: Int

  public init(
    aggregationCellSize: CGFloat = 2,
    maximumNodePrimitiveDensity: CGFloat = 0.2,
    maximumEdgePrimitiveDensity: CGFloat = 0.08,
    maximumAdaptiveStyleCount: Int = 32,
    maximumAggregationCellCount: Int = 1_000_000
  ) {
    precondition(aggregationCellSize > 0 && aggregationCellSize.isFinite)
    precondition(
      maximumNodePrimitiveDensity > 0 && maximumNodePrimitiveDensity.isFinite
    )
    precondition(
      maximumEdgePrimitiveDensity >= 0 && maximumEdgePrimitiveDensity.isFinite
    )
    precondition(maximumAdaptiveStyleCount > 0)
    precondition(maximumAggregationCellCount > 0)
    self.aggregationCellSize = aggregationCellSize
    self.maximumNodePrimitiveDensity = maximumNodePrimitiveDensity
    self.maximumEdgePrimitiveDensity = maximumEdgePrimitiveDensity
    self.maximumAdaptiveStyleCount = maximumAdaptiveStyleCount
    self.maximumAggregationCellCount = maximumAggregationCellCount
  }

  public static let standard = Self()
}

public struct FlowingGraphMiniMapConfiguration: Hashable, Sendable {
  public let size: CGSize
  public let contentPadding: CGFloat
  public let visibility: FlowingGraphMiniMapVisibility
  public let scope: FlowingGraphMiniMapScope
  public let representation: FlowingGraphMiniMapRepresentation
  public let interaction: FlowingGraphMiniMapInteraction
  public let refreshPolicy: FlowingGraphMiniMapRefreshPolicy
  public let performance: FlowingGraphMiniMapPerformanceConfiguration
  public let zoomSensitivity: CGFloat
  public let discreteScrollMultiplier: CGFloat
  public let accessibilityLabel: String

  public init(
    size: CGSize = CGSize(width: 220, height: 144),
    contentPadding: CGFloat = 10,
    visibility: FlowingGraphMiniMapVisibility = .whenNavigationIsUseful,
    scope: FlowingGraphMiniMapScope = .overview,
    representation: FlowingGraphMiniMapRepresentation = .adaptive,
    interaction: FlowingGraphMiniMapInteraction = .panAndZoom,
    refreshPolicy: FlowingGraphMiniMapRefreshPolicy = .adaptiveLive,
    performance: FlowingGraphMiniMapPerformanceConfiguration = .standard,
    zoomSensitivity: CGFloat = 1,
    discreteScrollMultiplier: CGFloat = 12,
    accessibilityLabel: String = "Graph overview"
  ) {
    precondition(size.width > 0 && size.height > 0)
    precondition(size.width.isFinite && size.height.isFinite)
    precondition(contentPadding >= 0 && contentPadding.isFinite)
    precondition(zoomSensitivity > 0 && zoomSensitivity.isFinite)
    precondition(discreteScrollMultiplier > 0 && discreteScrollMultiplier.isFinite)
    self.size = size
    self.contentPadding = contentPadding
    self.visibility = visibility
    self.scope = scope
    self.representation = representation
    self.interaction = interaction
    self.refreshPolicy = refreshPolicy
    self.performance = performance
    self.zoomSensitivity = zoomSensitivity
    self.discreteScrollMultiplier = discreteScrollMultiplier
    self.accessibilityLabel = accessibilityLabel
  }
}

public struct FlowingGraphMiniMapTransform: Hashable, Sendable {
  public let worldBounds: CGRect
  public let viewSize: CGSize
  public let padding: CGFloat
  public let scale: CGFloat
  public let offset: CGSize

  public init(worldBounds: CGRect, viewSize: CGSize, padding: CGFloat) {
    precondition(viewSize.width > 0 && viewSize.height > 0)
    precondition(viewSize.width.isFinite && viewSize.height.isFinite)
    precondition(padding >= 0)
    let bounds = worldBounds.flowingMiniMapUsableBounds
    let availableWidth = max(viewSize.width - padding * 2, 1)
    let availableHeight = max(viewSize.height - padding * 2, 1)
    let resolvedScale = min(
      availableWidth / max(bounds.width, 1),
      availableHeight / max(bounds.height, 1)
    )
    let displayedWidth = bounds.width * resolvedScale
    let displayedHeight = bounds.height * resolvedScale
    self.worldBounds = bounds
    self.viewSize = viewSize
    self.padding = padding
    scale = resolvedScale
    offset = CGSize(
      width: (viewSize.width - displayedWidth) / 2 - bounds.minX * resolvedScale,
      height: (viewSize.height - displayedHeight) / 2 - bounds.minY * resolvedScale
    )
  }

  public func viewPoint(for worldPoint: CGPoint) -> CGPoint {
    CGPoint(
      x: worldPoint.x * scale + offset.width,
      y: worldPoint.y * scale + offset.height
    )
  }

  public func worldPoint(for viewPoint: CGPoint) -> CGPoint {
    CGPoint(
      x: (viewPoint.x - offset.width) / scale,
      y: (viewPoint.y - offset.height) / scale
    )
  }

  public func viewRect(for worldRect: CGRect) -> CGRect {
    CGRect(
      x: worldRect.minX * scale + offset.width,
      y: worldRect.minY * scale + offset.height,
      width: worldRect.width * scale,
      height: worldRect.height * scale
    )
  }

  public func worldSize(for viewSize: CGSize) -> CGSize {
    CGSize(width: viewSize.width / scale, height: viewSize.height / scale)
  }
}

struct FlowingGraphMiniMapRenderPlan: Sendable {
  struct NodeBatch: Sendable {
    let styleIndex: Int
    let rects: [CGRect]
    let drawsStroke: Bool
  }

  struct Segment: Sendable {
    let start: CGPoint
    let end: CGPoint
  }

  let snapshotID: FlowingGraphMiniMapSnapshotID
  let transform: FlowingGraphMiniMapTransform
  let nodeBatches: [NodeBatch]
  let edgeSegments: [Segment]
  let isAggregated: Bool

  var nodePrimitiveCount: Int {
    nodeBatches.reduce(0) { $0 + $1.rects.count }
  }
}

enum FlowingGraphMiniMapPlanner {
  private static let minimumVisibleNodeDimension: CGFloat = 1
  private static let cancellationCheckStride = 2_048

  static func plan<NodeID, EdgeID>(
    snapshot: FlowingGraphMiniMapSnapshot<NodeID, EdgeID>,
    transform: FlowingGraphMiniMapTransform,
    representation: FlowingGraphMiniMapRepresentation,
    performance: FlowingGraphMiniMapPerformanceConfiguration,
    availableNodeStyleCount: Int = .max,
    nodeStyleIndex: @Sendable (FlowingGraphMiniMapNode<NodeID>) -> Int
  ) throws -> FlowingGraphMiniMapRenderPlan
  where NodeID: Hashable & Sendable, EdgeID: Hashable & Sendable {
    let viewArea = max(transform.viewSize.width * transform.viewSize.height, 1)
    let nodeBudget = max(Int(viewArea * performance.maximumNodePrimitiveDensity), 1)
    let shouldAggregate = representation == .adaptive && snapshot.nodes.count > nodeBudget
    let maximumStyleCount = min(
      max(availableNodeStyleCount, 1),
      performance.maximumAdaptiveStyleCount
    )
    let nodeBatches =
      shouldAggregate
      ? try aggregateNodes(
        snapshot.nodes,
        transform: transform,
        performance: performance,
        maximumStyleCount: maximumStyleCount,
        styleIndex: nodeStyleIndex
      )
      : try batchNodes(
        snapshot.nodes,
        transform: transform,
        maximumStyleCount:
          representation == .adaptive ? maximumStyleCount : nil,
        styleIndex: nodeStyleIndex
      )
    let edgeSegments = try edges(
      snapshot.edges,
      transform: transform,
      representation: representation,
      viewArea: viewArea,
      performance: performance
    )
    return FlowingGraphMiniMapRenderPlan(
      snapshotID: snapshot.id,
      transform: transform,
      nodeBatches: nodeBatches,
      edgeSegments: edgeSegments,
      isAggregated: shouldAggregate
    )
  }

  private static func batchNodes<NodeID>(
    _ nodes: [FlowingGraphMiniMapNode<NodeID>],
    transform: FlowingGraphMiniMapTransform,
    maximumStyleCount: Int?,
    styleIndex: @Sendable (FlowingGraphMiniMapNode<NodeID>) -> Int
  ) throws -> [FlowingGraphMiniMapRenderPlan.NodeBatch]
  where NodeID: Hashable & Sendable {
    var rectsByStyle: [Int: [CGRect]] = [:]
    var fallbackStyleIndex: Int?
    for (index, node) in nodes.enumerated() where node.frame.flowingMiniMapIsFinite {
      if index.isMultiple(of: cancellationCheckStride) {
        try Task.checkCancellation()
      }
      let requestedStyle = styleIndex(node)
      let admitsNewStyle = maximumStyleCount.map { rectsByStyle.count < $0 } ?? true
      let resolvedStyle: Int
      if rectsByStyle[requestedStyle] != nil || admitsNewStyle {
        resolvedStyle = requestedStyle
      } else {
        resolvedStyle = fallbackStyleIndex ?? requestedStyle
      }
      if fallbackStyleIndex == nil {
        fallbackStyleIndex = resolvedStyle
      }
      rectsByStyle[resolvedStyle, default: []].append(
        visibleNodeRect(transform.viewRect(for: node.frame))
      )
    }
    return rectsByStyle.keys.sorted().compactMap { style in
      rectsByStyle[style].map {
        FlowingGraphMiniMapRenderPlan.NodeBatch(
          styleIndex: style,
          rects: $0,
          drawsStroke: true
        )
      }
    }
  }

  private static func aggregateNodes<NodeID>(
    _ nodes: [FlowingGraphMiniMapNode<NodeID>],
    transform: FlowingGraphMiniMapTransform,
    performance: FlowingGraphMiniMapPerformanceConfiguration,
    maximumStyleCount: Int,
    styleIndex: @Sendable (FlowingGraphMiniMapNode<NodeID>) -> Int
  ) throws -> [FlowingGraphMiniMapRenderPlan.NodeBatch]
  where NodeID: Hashable & Sendable {
    let requestedCellSize = performance.aggregationCellSize
    let requestedCellCount =
      ceil(transform.viewSize.width / requestedCellSize)
      * ceil(transform.viewSize.height / requestedCellSize)
    let cellScale = max(
      sqrt(requestedCellCount / CGFloat(performance.maximumAggregationCellCount)),
      1
    )
    let cellSize = requestedCellSize * cellScale
    let columns = max(Int(ceil(transform.viewSize.width / cellSize)), 1)
    let rows = max(Int(ceil(transform.viewSize.height / cellSize)), 1)
    let stride = columns + 1
    let differenceCount = stride * (rows + 1)
    if maximumStyleCount == 1 {
      return try aggregateSingleStyleNodes(
        nodes,
        transform: transform,
        columns: columns,
        rows: rows,
        stride: stride,
        differenceCount: differenceCount,
        cellSize: cellSize
      )
    }
    var cellRangesByStyle: [Int: [SIMD4<Int32>]] = [:]
    var fallbackStyleIndex: Int?
    cellRangesByStyle.reserveCapacity(
      min(maximumStyleCount, nodes.count)
    )
    for (index, node) in nodes.enumerated() where node.frame.flowingMiniMapIsFinite {
      if index.isMultiple(of: cancellationCheckStride) {
        try Task.checkCancellation()
      }
      let rect = visibleNodeRect(transform.viewRect(for: node.frame))
      guard
        let range = cellRange(
          for: rect,
          columns: columns,
          rows: rows,
          cellSize: cellSize
        )
      else {
        continue
      }
      let requestedStyle = styleIndex(node)
      let resolvedStyle: Int
      if cellRangesByStyle[requestedStyle] != nil
        || cellRangesByStyle.count < maximumStyleCount
      {
        resolvedStyle = requestedStyle
      } else {
        resolvedStyle = fallbackStyleIndex ?? requestedStyle
      }
      if fallbackStyleIndex == nil {
        fallbackStyleIndex = resolvedStyle
      }
      cellRangesByStyle[resolvedStyle, default: []].append(
        SIMD4(
          Int32(range.minimumColumn),
          Int32(range.maximumColumn),
          Int32(range.minimumRow),
          Int32(range.maximumRow)
        )
      )
    }

    var winningCounts = [Int32](repeating: 0, count: columns * rows)
    var winningStyles = [Int](
      repeating: fallbackStyleIndex ?? 0,
      count: columns * rows
    )
    for style in cellRangesByStyle.keys.sorted() {
      try Task.checkCancellation()
      guard let cellRanges = cellRangesByStyle[style] else { continue }
      var difference = [Int32](repeating: 0, count: differenceCount)
      for (index, range) in cellRanges.enumerated() {
        if index.isMultiple(of: cancellationCheckStride) {
          try Task.checkCancellation()
        }
        let minimumColumn = Int(range.x)
        let maximumColumn = Int(range.y)
        let minimumRow = Int(range.z)
        let maximumRow = Int(range.w)
        difference[minimumRow * stride + minimumColumn] += 1
        difference[minimumRow * stride + maximumColumn + 1] -= 1
        difference[(maximumRow + 1) * stride + minimumColumn] -= 1
        difference[(maximumRow + 1) * stride + maximumColumn + 1] += 1
      }
      for row in 0..<rows {
        if row.isMultiple(of: cancellationCheckStride) {
          try Task.checkCancellation()
        }
        for column in 0..<columns {
          let index = row * stride + column
          let left = column > 0 ? difference[index - 1] : 0
          let above = row > 0 ? difference[index - stride] : 0
          let diagonal = row > 0 && column > 0 ? difference[index - stride - 1] : 0
          difference[index] += left + above - diagonal
          let count = difference[index]
          let cellIndex = row * columns + column
          if count > winningCounts[cellIndex] {
            winningCounts[cellIndex] = count
            winningStyles[cellIndex] = style
          }
        }
      }
    }

    var rectsByStyle: [Int: [CGRect]] = [:]
    for row in 0..<rows {
      for column in 0..<columns {
        let index = row * columns + column
        guard winningCounts[index] > 0 else { continue }
        rectsByStyle[winningStyles[index], default: []].append(
          CGRect(
            x: CGFloat(column) * cellSize,
            y: CGFloat(row) * cellSize,
            width: min(cellSize, transform.viewSize.width - CGFloat(column) * cellSize),
            height: min(cellSize, transform.viewSize.height - CGFloat(row) * cellSize)
          )
        )
      }
    }
    return rectsByStyle.keys.sorted().compactMap { style in
      rectsByStyle[style].map {
        FlowingGraphMiniMapRenderPlan.NodeBatch(
          styleIndex: style,
          rects: $0,
          drawsStroke: false
        )
      }
    }
  }

  private static func aggregateSingleStyleNodes<NodeID>(
    _ nodes: [FlowingGraphMiniMapNode<NodeID>],
    transform: FlowingGraphMiniMapTransform,
    columns: Int,
    rows: Int,
    stride: Int,
    differenceCount: Int,
    cellSize: CGFloat
  ) throws -> [FlowingGraphMiniMapRenderPlan.NodeBatch]
  where NodeID: Hashable & Sendable {
    var difference = [Int32](repeating: 0, count: differenceCount)
    for (index, node) in nodes.enumerated() where node.frame.flowingMiniMapIsFinite {
      if index.isMultiple(of: cancellationCheckStride) {
        try Task.checkCancellation()
      }
      let rect = visibleNodeRect(transform.viewRect(for: node.frame))
      guard
        let range = cellRange(
          for: rect,
          columns: columns,
          rows: rows,
          cellSize: cellSize
        )
      else {
        continue
      }
      difference[range.minimumRow * stride + range.minimumColumn] += 1
      difference[range.minimumRow * stride + range.maximumColumn + 1] -= 1
      difference[(range.maximumRow + 1) * stride + range.minimumColumn] -= 1
      difference[(range.maximumRow + 1) * stride + range.maximumColumn + 1] += 1
    }

    var rects: [CGRect] = []
    rects.reserveCapacity(min(columns * rows, nodes.count))
    for row in 0..<rows {
      for column in 0..<columns {
        let index = row * stride + column
        let left = column > 0 ? difference[index - 1] : 0
        let above = row > 0 ? difference[index - stride] : 0
        let diagonal = row > 0 && column > 0 ? difference[index - stride - 1] : 0
        difference[index] += left + above - diagonal
        guard difference[index] > 0 else { continue }
        rects.append(
          CGRect(
            x: CGFloat(column) * cellSize,
            y: CGFloat(row) * cellSize,
            width: min(cellSize, transform.viewSize.width - CGFloat(column) * cellSize),
            height: min(cellSize, transform.viewSize.height - CGFloat(row) * cellSize)
          )
        )
      }
    }
    guard !rects.isEmpty else { return [] }
    return [
      FlowingGraphMiniMapRenderPlan.NodeBatch(
        styleIndex: 0,
        rects: rects,
        drawsStroke: false
      )
    ]
  }

  private static func edges<EdgeID>(
    _ edges: [FlowingGraphMiniMapEdge<EdgeID>],
    transform: FlowingGraphMiniMapTransform,
    representation: FlowingGraphMiniMapRepresentation,
    viewArea: CGFloat,
    performance: FlowingGraphMiniMapPerformanceConfiguration
  ) throws -> [FlowingGraphMiniMapRenderPlan.Segment]
  where EdgeID: Hashable & Sendable {
    guard representation != .silhouette else { return [] }
    if representation == .adaptive {
      let budget = Int(viewArea * performance.maximumEdgePrimitiveDensity)
      guard edges.count <= budget else { return [] }
    }
    var segments: [FlowingGraphMiniMapRenderPlan.Segment] = []
    segments.reserveCapacity(edges.count)
    for (index, edge) in edges.enumerated() {
      if index.isMultiple(of: cancellationCheckStride) {
        try Task.checkCancellation()
      }
      guard edge.start.flowingMiniMapIsFinite, edge.end.flowingMiniMapIsFinite else {
        continue
      }
      segments.append(
        FlowingGraphMiniMapRenderPlan.Segment(
          start: transform.viewPoint(for: edge.start),
          end: transform.viewPoint(for: edge.end)
        )
      )
    }
    return segments
  }

  private static func cellRange(
    for rect: CGRect,
    columns: Int,
    rows: Int,
    cellSize: CGFloat
  ) -> (
    minimumColumn: Int,
    maximumColumn: Int,
    minimumRow: Int,
    maximumRow: Int
  )? {
    let clipped = rect.intersection(
      CGRect(
        origin: .zero,
        size: CGSize(width: CGFloat(columns) * cellSize, height: CGFloat(rows) * cellSize)
      )
    )
    guard !clipped.isNull, !clipped.isEmpty else { return nil }
    let minimumColumn = min(max(Int(floor(clipped.minX / cellSize)), 0), columns - 1)
    let maximumColumn = min(
      max(Int(floor(max(clipped.maxX.nextDown, clipped.minX) / cellSize)), 0),
      columns - 1
    )
    let minimumRow = min(max(Int(floor(clipped.minY / cellSize)), 0), rows - 1)
    let maximumRow = min(
      max(Int(floor(max(clipped.maxY.nextDown, clipped.minY) / cellSize)), 0),
      rows - 1
    )
    return (minimumColumn, maximumColumn, minimumRow, maximumRow)
  }

  private static func visibleNodeRect(_ rect: CGRect) -> CGRect {
    let width = max(rect.width, minimumVisibleNodeDimension)
    let height = max(rect.height, minimumVisibleNodeDimension)
    return CGRect(
      x: rect.midX - width / 2,
      y: rect.midY - height / 2,
      width: width,
      height: height
    )
  }
}

enum FlowingGraphMiniMapNavigation {
  static func center(
    pointerLocation: CGPoint,
    transform: FlowingGraphMiniMapTransform,
    centerOffset: CGSize = .zero
  ) -> CGPoint {
    let worldPoint = transform.worldPoint(for: pointerLocation)
    return CGPoint(
      x: worldPoint.x + centerOffset.width,
      y: worldPoint.y + centerOffset.height
    )
  }

  static func pannedCenter(
    currentCenter: CGPoint,
    viewDelta: CGSize,
    transform: FlowingGraphMiniMapTransform
  ) -> CGPoint {
    let worldDelta = transform.worldSize(for: viewDelta)
    return CGPoint(
      x: currentCenter.x - worldDelta.width,
      y: currentCenter.y - worldDelta.height
    )
  }
}

extension CGRect {
  fileprivate var flowingMiniMapUsableBounds: CGRect {
    guard flowingMiniMapIsFinite, !isNull, !isInfinite else {
      return CGRect(x: 0, y: 0, width: 1, height: 1)
    }
    let resolvedWidth = max(width, 1)
    let resolvedHeight = max(height, 1)
    return CGRect(
      x: midX - resolvedWidth / 2,
      y: midY - resolvedHeight / 2,
      width: resolvedWidth,
      height: resolvedHeight
    )
  }

  fileprivate var flowingMiniMapIsFinite: Bool {
    origin.x.isFinite && origin.y.isFinite && width.isFinite && height.isFinite
  }
}

extension CGPoint {
  fileprivate var flowingMiniMapIsFinite: Bool {
    x.isFinite && y.isFinite
  }
}
