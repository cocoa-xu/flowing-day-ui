import CoreGraphics
import Foundation

public enum FlowingLayerAssignmentIssue<Schema: FlowingGraphLayoutSchema>: Error {
  case duplicateNode(Schema.NodeID)
  case missingNode(Schema.NodeID)
  case unknownNode(Schema.NodeID)
  case negativeRank(Schema.NodeID)
}

extension FlowingLayerAssignmentIssue: Equatable {}

public struct FlowingLayerAssignment<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let ranks: [Schema.NodeID: Int]

  public init(
    input: FlowingGraphLayoutInput<Schema>,
    ranks: [(nodeID: Schema.NodeID, rank: Int)]
  ) throws {
    let knownNodeIDs = Set(input.topology.nodeIDs)
    var nextRanks: [Schema.NodeID: Int] = [:]
    for entry in ranks {
      guard knownNodeIDs.contains(entry.nodeID) else {
        throw FlowingLayerAssignmentIssue<Schema>.unknownNode(entry.nodeID)
      }
      guard entry.rank >= 0 else {
        throw FlowingLayerAssignmentIssue<Schema>.negativeRank(entry.nodeID)
      }
      guard nextRanks.updateValue(entry.rank, forKey: entry.nodeID) == nil else {
        throw FlowingLayerAssignmentIssue<Schema>.duplicateNode(entry.nodeID)
      }
    }
    for nodeID in input.topology.nodeIDs where nextRanks[nodeID] == nil {
      throw FlowingLayerAssignmentIssue<Schema>.missingNode(nodeID)
    }
    self.ranks = nextRanks
  }

  public func rank(for nodeID: Schema.NodeID) -> Int? {
    ranks[nodeID]
  }

  func resolvedRank(for nodeID: Schema.NodeID) -> Int {
    ranks[nodeID]!
  }
}

public protocol FlowingLayerAssignmentStrategy<Schema>: Sendable {
  associatedtype Schema: FlowingGraphLayoutSchema

  var identity: FlowingLayoutComponentIdentity { get }

  func assignLayers(
    to view: FlowingGraphLayoutDAGView<Schema>
  ) throws -> FlowingLayerAssignment<Schema>
}

public struct FlowingLongestPathLayerAssignment<
  Schema: FlowingGraphLayoutSchema
>: Sendable {
  public let identity: FlowingLayoutComponentIdentity

  public init(identity: FlowingLayoutComponentIdentity = .init()) {
    self.identity = identity
  }
}

extension FlowingLongestPathLayerAssignment: FlowingLayerAssignmentStrategy {
  public func assignLayers(
    to view: FlowingGraphLayoutDAGView<Schema>
  ) throws -> FlowingLayerAssignment<Schema> {
    var ranks = Dictionary(
      uniqueKeysWithValues: view.input.topology.nodeIDs.map { ($0, 0) }
    )
    for sourceID in view.topologicalNodeIDs {
      try Task.checkCancellation()
      for targetID in view.input.topology.directedSuccessorNodeIDs(of: sourceID) {
        ranks[targetID] = max(ranks[targetID]!, ranks[sourceID]! + 1)
      }
    }
    return try FlowingLayerAssignment(
      input: view.input,
      ranks: view.input.topology.nodeIDs.map { ($0, ranks[$0]!) }
    )
  }
}

public struct FlowingLayer<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let rank: Int
  public let nodeIDs: [Schema.NodeID]

  public init(rank: Int, nodeIDs: [Schema.NodeID]) {
    self.rank = rank
    self.nodeIDs = nodeIDs
  }
}

public struct FlowingLayeredComponent<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let layers: [FlowingLayer<Schema>]

  public init(layers: [FlowingLayer<Schema>]) {
    self.layers = layers
  }
}

public enum FlowingLayerOrderingIssue<Schema: FlowingGraphLayoutSchema>: Error {
  case emptyComponent
  case emptyLayer(Int)
  case duplicateNode(Schema.NodeID)
  case missingNode(Schema.NodeID)
  case unknownNode(Schema.NodeID)
  case rankMismatch(Schema.NodeID)
  case duplicateRankInComponent(Int)
}

extension FlowingLayerOrderingIssue: Equatable {}

public struct FlowingLayerOrdering<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let components: [FlowingLayeredComponent<Schema>]

  public init(
    input: FlowingGraphLayoutInput<Schema>,
    assignment: FlowingLayerAssignment<Schema>,
    components: [FlowingLayeredComponent<Schema>]
  ) throws {
    let knownNodeIDs = Set(input.topology.nodeIDs)
    var includedNodeIDs: Set<Schema.NodeID> = []
    var normalizedComponents: [FlowingLayeredComponent<Schema>] = []
    normalizedComponents.reserveCapacity(components.count)

    for component in components {
      guard !component.layers.isEmpty else {
        throw FlowingLayerOrderingIssue<Schema>.emptyComponent
      }
      var ranks: Set<Int> = []
      for layer in component.layers {
        guard !layer.nodeIDs.isEmpty else {
          throw FlowingLayerOrderingIssue<Schema>.emptyLayer(layer.rank)
        }
        guard ranks.insert(layer.rank).inserted else {
          throw FlowingLayerOrderingIssue<Schema>.duplicateRankInComponent(layer.rank)
        }
        for nodeID in layer.nodeIDs {
          guard knownNodeIDs.contains(nodeID) else {
            throw FlowingLayerOrderingIssue<Schema>.unknownNode(nodeID)
          }
          guard assignment.resolvedRank(for: nodeID) == layer.rank else {
            throw FlowingLayerOrderingIssue<Schema>.rankMismatch(nodeID)
          }
          guard includedNodeIDs.insert(nodeID).inserted else {
            throw FlowingLayerOrderingIssue<Schema>.duplicateNode(nodeID)
          }
        }
      }
      normalizedComponents.append(
        FlowingLayeredComponent(layers: component.layers.sorted { $0.rank < $1.rank })
      )
    }
    for nodeID in input.topology.nodeIDs where !includedNodeIDs.contains(nodeID) {
      throw FlowingLayerOrderingIssue<Schema>.missingNode(nodeID)
    }
    self.components = normalizedComponents
  }
}

public protocol FlowingLayerOrderingStrategy<Schema>: Sendable {
  associatedtype Schema: FlowingGraphLayoutSchema

  var identity: FlowingLayoutComponentIdentity { get }

  func orderLayers(
    in view: FlowingGraphLayoutDAGView<Schema>,
    assignment: FlowingLayerAssignment<Schema>
  ) throws -> FlowingLayerOrdering<Schema>
}

public struct FlowingStableLayerOrdering<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let identity: FlowingLayoutComponentIdentity

  public init(identity: FlowingLayoutComponentIdentity = .init()) {
    self.identity = identity
  }
}

extension FlowingStableLayerOrdering: FlowingLayerOrderingStrategy {
  public func orderLayers(
    in view: FlowingGraphLayoutDAGView<Schema>,
    assignment: FlowingLayerAssignment<Schema>
  ) throws -> FlowingLayerOrdering<Schema> {
    let order = Dictionary(
      uniqueKeysWithValues: view.input.topology.nodeIDs.enumerated().map { ($1, $0) }
    )
    let parentOrder = Dictionary(
      uniqueKeysWithValues: view.input.topology.nodeIDs.map { nodeID in
        let parent =
          view.input.topology.directedPredecessorNodeIDs(of: nodeID)
          .compactMap { order[$0] }
          .min() ?? .max
        return (nodeID, parent)
      }
    )
    let components = view.input.topology.weaklyConnectedComponents().map { nodeIDs in
      let layers = Dictionary(grouping: nodeIDs) { assignment.resolvedRank(for: $0) }
      return FlowingLayeredComponent<Schema>(
        layers: layers.keys.sorted().map { rank in
          let nodeIDs = layers[rank, default: []].sorted { left, right in
            let leftParent = parentOrder[left, default: .max]
            let rightParent = parentOrder[right, default: .max]
            if leftParent != rightParent { return leftParent < rightParent }
            return order[left]! < order[right]!
          }
          return FlowingLayer(rank: rank, nodeIDs: nodeIDs)
        }
      )
    }
    return try FlowingLayerOrdering(
      input: view.input,
      assignment: assignment,
      components: components
    )
  }
}

public struct FlowingLayoutInsets: Sendable, Equatable {
  public let top: CGFloat
  public let leading: CGFloat
  public let bottom: CGFloat
  public let trailing: CGFloat

  public init(top: CGFloat, leading: CGFloat, bottom: CGFloat, trailing: CGFloat) {
    precondition(top.isFinite && top >= 0)
    precondition(leading.isFinite && leading >= 0)
    precondition(bottom.isFinite && bottom >= 0)
    precondition(trailing.isFinite && trailing >= 0)
    self.top = top
    self.leading = leading
    self.bottom = bottom
    self.trailing = trailing
  }

  public init(horizontal: CGFloat, vertical: CGFloat) {
    self.init(
      top: vertical,
      leading: horizontal,
      bottom: vertical,
      trailing: horizontal
    )
  }
}

public enum FlowingLayeredLayoutDirection: Sendable, Equatable {
  case topToBottom
  case leftToRight
}

public struct FlowingLayeredLayoutConfiguration: Sendable, Equatable {
  public let horizontalNodeSpacing: CGFloat
  public let verticalNodeSpacing: CGFloat
  public let componentSpacing: CGFloat
  public let canvasInsets: FlowingLayoutInsets
  public let minimumCanvasSize: CGSize
  public let direction: FlowingLayeredLayoutDirection

  public init(
    horizontalNodeSpacing: CGFloat,
    verticalNodeSpacing: CGFloat,
    componentSpacing: CGFloat,
    canvasInsets: FlowingLayoutInsets,
    minimumCanvasSize: CGSize,
    direction: FlowingLayeredLayoutDirection = .topToBottom
  ) {
    precondition(horizontalNodeSpacing.isFinite && horizontalNodeSpacing >= 0)
    precondition(verticalNodeSpacing.isFinite && verticalNodeSpacing >= 0)
    precondition(componentSpacing.isFinite && componentSpacing >= 0)
    precondition(
      minimumCanvasSize.width.isFinite && minimumCanvasSize.width >= 0
        && minimumCanvasSize.height.isFinite && minimumCanvasSize.height >= 0
    )
    self.horizontalNodeSpacing = horizontalNodeSpacing
    self.verticalNodeSpacing = verticalNodeSpacing
    self.componentSpacing = componentSpacing
    self.canvasInsets = canvasInsets
    self.minimumCanvasSize = minimumCanvasSize
    self.direction = direction
  }
}

public protocol FlowingLayerCoordinateAssignmentStrategy<Schema>: Sendable {
  associatedtype Schema: FlowingGraphLayoutSchema

  var identity: FlowingLayoutComponentIdentity { get }

  func place(
    view: FlowingGraphLayoutDAGView<Schema>,
    assignment: FlowingLayerAssignment<Schema>,
    ordering: FlowingLayerOrdering<Schema>
  ) throws -> FlowingGraphNodePlacement<Schema>
}

public struct FlowingCenteredLayerCoordinates<
  Schema: FlowingGraphLayoutSchema
>: Sendable {
  public let identity: FlowingLayoutComponentIdentity
  public let configuration: FlowingLayeredLayoutConfiguration

  public init(
    configuration: FlowingLayeredLayoutConfiguration,
    identity: FlowingLayoutComponentIdentity = .init()
  ) {
    self.configuration = configuration
    self.identity = identity
  }
}

extension FlowingCenteredLayerCoordinates: FlowingLayerCoordinateAssignmentStrategy {
  public func place(
    view: FlowingGraphLayoutDAGView<Schema>,
    assignment: FlowingLayerAssignment<Schema>,
    ordering: FlowingLayerOrdering<Schema>
  ) throws -> FlowingGraphNodePlacement<Schema> {
    let input = view.input
    guard !input.topology.nodeIDs.isEmpty else {
      return try FlowingGraphNodePlacement(
        input: input,
        nodeFrames: [],
        contentBounds: CGRect(origin: .zero, size: configuration.minimumCanvasSize)
      )
    }

    var rankPrimarySizes: [Int: CGFloat] = [:]
    for nodeID in input.topology.nodeIDs {
      let rank = assignment.resolvedRank(for: nodeID)
      rankPrimarySizes[rank] = max(
        rankPrimarySizes[rank, default: 0],
        primarySize(input.resolvedSize(for: nodeID))
      )
    }
    let occupiedRanks = rankPrimarySizes.keys.sorted()
    var rankPrimaryOrigins: [Int: CGFloat] = [:]
    var precedingPrimarySizes: CGFloat = 0
    for rank in occupiedRanks {
      rankPrimaryOrigins[rank] = primaryLeadingInset + CGFloat(rank) * primarySpacing
        + precedingPrimarySizes
      precedingPrimarySizes += rankPrimarySizes[rank, default: 0]
    }

    var frameByNodeID: [Schema.NodeID: CGRect] = [:]
    frameByNodeID.reserveCapacity(input.topology.nodeIDs.count)
    var componentCrossOrigin = crossLeadingInset

    for component in ordering.components {
      try Task.checkCancellation()
      let componentCrossSize =
        component.layers.map {
          layerCrossSize(nodeIDs: $0.nodeIDs, input: input)
        }.max() ?? 0

      for layer in component.layers.reversed() {
        let centers = layerCrossCenters(
          nodeIDs: layer.nodeIDs,
          componentCrossOrigin: componentCrossOrigin,
          componentCrossSize: componentCrossSize,
          input: input,
          frames: frameByNodeID
        )
        for (nodeID, center) in zip(layer.nodeIDs, centers) {
          let size = input.resolvedSize(for: nodeID)
          let offset = input.resolvedPlacementOffset(for: nodeID)
          frameByNodeID[nodeID] = frame(
            crossOrigin: center - crossSize(size) / 2,
            primaryOrigin: rankPrimaryOrigins[layer.rank, default: primaryLeadingInset]
              + (rankPrimarySizes[layer.rank, default: 0] - primarySize(size)) / 2,
            size: size,
            offset: offset
          )
        }
      }
      componentCrossOrigin += componentCrossSize + configuration.componentSpacing
    }

    let measuredCrossSize = componentCrossOrigin - configuration.componentSpacing
      + crossTrailingInset
    let lastRank = occupiedRanks.last ?? 0
    let measuredPrimarySize = rankPrimaryOrigins[lastRank, default: primaryLeadingInset]
      + rankPrimarySizes[lastRank, default: 0] + primaryTrailingInset
    let measuredSize = canvasSize(primary: measuredPrimarySize, cross: measuredCrossSize)
    let minimumBounds = CGRect(
      origin: .zero,
      size: CGSize(
        width: max(measuredSize.width, configuration.minimumCanvasSize.width),
        height: max(measuredSize.height, configuration.minimumCanvasSize.height)
      )
    )
    let contentBounds = frameByNodeID.values.reduce(minimumBounds) {
      $0.union($1)
    }
    return try FlowingGraphNodePlacement(
      input: input,
      nodeFrames: input.topology.nodeIDs.map {
        FlowingGraphNodeFrame(nodeID: $0, frame: frameByNodeID[$0]!)
      },
      contentBounds: contentBounds
    )
  }

  private func layerCrossSize(
    nodeIDs: [Schema.NodeID],
    input: FlowingGraphLayoutInput<Schema>
  ) -> CGFloat {
    guard !nodeIDs.isEmpty else { return 0 }
    return nodeIDs.reduce(0) { $0 + crossSize(input.resolvedSize(for: $1)) }
      + CGFloat(nodeIDs.count - 1) * crossSpacing
  }

  private func layerCrossCenters(
    nodeIDs: [Schema.NodeID],
    componentCrossOrigin: CGFloat,
    componentCrossSize: CGFloat,
    input: FlowingGraphLayoutInput<Schema>,
    frames: [Schema.NodeID: CGRect]
  ) -> [CGFloat] {
    guard !nodeIDs.isEmpty else { return [] }
    let layerCrossSize = layerCrossSize(nodeIDs: nodeIDs, input: input)
    var cursor = componentCrossOrigin + (componentCrossSize - layerCrossSize) / 2
    var defaultCenters: [CGFloat] = []
    defaultCenters.reserveCapacity(nodeIDs.count)
    for nodeID in nodeIDs {
      let size = crossSize(input.resolvedSize(for: nodeID))
      defaultCenters.append(cursor + size / 2)
      cursor += size + crossSpacing
    }
    var centers = zip(nodeIDs, defaultCenters).map { nodeID, fallback in
      let childCenters = input.topology.directedSuccessorNodeIDs(of: nodeID)
        .compactMap { frames[$0].map(crossMidpoint) }
      guard !childCenters.isEmpty else { return fallback }
      return childCenters.reduce(0, +) / CGFloat(childCenters.count)
    }

    if centers.count > 1 {
      for index in 1..<centers.count {
        let previousSize = crossSize(input.resolvedSize(for: nodeIDs[index - 1]))
        let size = crossSize(input.resolvedSize(for: nodeIDs[index]))
        let minimum = centers[index - 1] + (previousSize + size) / 2 + crossSpacing
        centers[index] = max(centers[index], minimum)
      }
    }

    let firstSize = crossSize(input.resolvedSize(for: nodeIDs[0]))
    let lastSize = crossSize(input.resolvedSize(for: nodeIDs[nodeIDs.count - 1]))
    let minimumCenter = componentCrossOrigin + firstSize / 2
    let maximumCenter = componentCrossOrigin + componentCrossSize - lastSize / 2
    if centers[0] < minimumCenter {
      let adjustment = minimumCenter - centers[0]
      centers = centers.map { $0 + adjustment }
    }
    if centers[centers.count - 1] > maximumCenter {
      let adjustment = centers[centers.count - 1] - maximumCenter
      centers = centers.map { $0 - adjustment }
    }
    guard centers[0] >= minimumCenter else { return defaultCenters }
    return centers
  }

  private var primarySpacing: CGFloat {
    switch configuration.direction {
    case .topToBottom: configuration.verticalNodeSpacing
    case .leftToRight: configuration.horizontalNodeSpacing
    }
  }

  private var crossSpacing: CGFloat {
    switch configuration.direction {
    case .topToBottom: configuration.horizontalNodeSpacing
    case .leftToRight: configuration.verticalNodeSpacing
    }
  }

  private var primaryLeadingInset: CGFloat {
    switch configuration.direction {
    case .topToBottom: configuration.canvasInsets.top
    case .leftToRight: configuration.canvasInsets.leading
    }
  }

  private var primaryTrailingInset: CGFloat {
    switch configuration.direction {
    case .topToBottom: configuration.canvasInsets.bottom
    case .leftToRight: configuration.canvasInsets.trailing
    }
  }

  private var crossLeadingInset: CGFloat {
    switch configuration.direction {
    case .topToBottom: configuration.canvasInsets.leading
    case .leftToRight: configuration.canvasInsets.top
    }
  }

  private var crossTrailingInset: CGFloat {
    switch configuration.direction {
    case .topToBottom: configuration.canvasInsets.trailing
    case .leftToRight: configuration.canvasInsets.bottom
    }
  }

  private func primarySize(_ size: CGSize) -> CGFloat {
    switch configuration.direction {
    case .topToBottom: size.height
    case .leftToRight: size.width
    }
  }

  private func crossSize(_ size: CGSize) -> CGFloat {
    switch configuration.direction {
    case .topToBottom: size.width
    case .leftToRight: size.height
    }
  }

  private func crossMidpoint(_ frame: CGRect) -> CGFloat {
    switch configuration.direction {
    case .topToBottom: frame.midX
    case .leftToRight: frame.midY
    }
  }

  private func frame(
    crossOrigin: CGFloat,
    primaryOrigin: CGFloat,
    size: CGSize,
    offset: CGSize
  ) -> CGRect {
    switch configuration.direction {
    case .topToBottom:
      CGRect(
        x: crossOrigin + offset.width,
        y: primaryOrigin + offset.height,
        width: size.width,
        height: size.height
      )
    case .leftToRight:
      CGRect(
        x: primaryOrigin + offset.width,
        y: crossOrigin + offset.height,
        width: size.width,
        height: size.height
      )
    }
  }

  private func canvasSize(primary: CGFloat, cross: CGFloat) -> CGSize {
    switch configuration.direction {
    case .topToBottom: CGSize(width: cross, height: primary)
    case .leftToRight: CGSize(width: primary, height: cross)
    }
  }
}

public struct FlowingLayeredDAGPlacement<
  Schema: FlowingGraphLayoutSchema
>: Sendable {
  public let layerAssignment: any FlowingLayerAssignmentStrategy<Schema>
  public let layerOrdering: any FlowingLayerOrderingStrategy<Schema>
  public let coordinateAssignment: any FlowingLayerCoordinateAssignmentStrategy<Schema>

  public init(
    layerAssignment: some FlowingLayerAssignmentStrategy<Schema>,
    layerOrdering: some FlowingLayerOrderingStrategy<Schema>,
    coordinateAssignment: some FlowingLayerCoordinateAssignmentStrategy<Schema>
  ) {
    self.layerAssignment = layerAssignment
    self.layerOrdering = layerOrdering
    self.coordinateAssignment = coordinateAssignment
  }
}

extension FlowingLayeredDAGPlacement: FlowingGraphNodePlacementStrategy {
  public var identity: FlowingLayoutPipelineIdentity {
    FlowingLayoutPipelineIdentity(
      stages: [
        .component(role: .layerAssignment, identity: layerAssignment.identity),
        .component(role: .layerOrdering, identity: layerOrdering.identity),
        .component(role: .coordinateAssignment, identity: coordinateAssignment.identity),
      ]
    )
  }

  public func place(
    _ input: FlowingGraphLayoutInput<Schema>
  ) throws -> FlowingGraphNodePlacement<Schema> {
    let view: FlowingGraphLayoutDAGView<Schema>
    switch input.validateDAG() {
    case .valid(let validatedView):
      view = validatedView
    case .invalid(let issue):
      throw issue
    }
    let assignment = try layerAssignment.assignLayers(to: view)
    let ordering = try layerOrdering.orderLayers(
      in: view,
      assignment: assignment
    )
    return try coordinateAssignment.place(
      view: view,
      assignment: assignment,
      ordering: ordering
    )
  }
}
