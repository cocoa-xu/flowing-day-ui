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

public struct FlowingLayeredLayoutConfiguration: Sendable, Equatable {
  public let horizontalNodeSpacing: CGFloat
  public let verticalNodeSpacing: CGFloat
  public let componentSpacing: CGFloat
  public let canvasInsets: FlowingLayoutInsets
  public let minimumCanvasSize: CGSize

  public init(
    horizontalNodeSpacing: CGFloat,
    verticalNodeSpacing: CGFloat,
    componentSpacing: CGFloat,
    canvasInsets: FlowingLayoutInsets,
    minimumCanvasSize: CGSize
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

    var rankHeights: [Int: CGFloat] = [:]
    for nodeID in input.topology.nodeIDs {
      let rank = assignment.resolvedRank(for: nodeID)
      rankHeights[rank] = max(
        rankHeights[rank, default: 0],
        input.resolvedSize(for: nodeID).height
      )
    }
    let occupiedRanks = rankHeights.keys.sorted()
    var rankOrigins: [Int: CGFloat] = [:]
    var precedingHeights: CGFloat = 0
    for rank in occupiedRanks {
      rankOrigins[rank] =
        configuration.canvasInsets.top + CGFloat(rank) * configuration.verticalNodeSpacing
        + precedingHeights
      precedingHeights += rankHeights[rank, default: 0]
    }

    var frameByNodeID: [Schema.NodeID: CGRect] = [:]
    frameByNodeID.reserveCapacity(input.topology.nodeIDs.count)
    var componentX = configuration.canvasInsets.leading

    for component in ordering.components {
      try Task.checkCancellation()
      let componentWidth =
        component.layers.map {
          layerWidth(nodeIDs: $0.nodeIDs, input: input)
        }.max() ?? 0

      for layer in component.layers.reversed() {
        let centers = layerCenters(
          nodeIDs: layer.nodeIDs,
          componentX: componentX,
          componentWidth: componentWidth,
          input: input,
          frames: frameByNodeID
        )
        for (nodeID, center) in zip(layer.nodeIDs, centers) {
          let size = input.resolvedSize(for: nodeID)
          let offset = input.resolvedPlacementOffset(for: nodeID)
          frameByNodeID[nodeID] = CGRect(
            x: center - size.width / 2 + offset.width,
            y: rankOrigins[layer.rank, default: configuration.canvasInsets.top]
              + (rankHeights[layer.rank, default: 0] - size.height) / 2 + offset.height,
            width: size.width,
            height: size.height
          )
        }
      }
      componentX += componentWidth + configuration.componentSpacing
    }

    let measuredWidth =
      componentX - configuration.componentSpacing + configuration.canvasInsets.trailing
    let lastRank = occupiedRanks.last ?? 0
    let measuredHeight =
      rankOrigins[lastRank, default: configuration.canvasInsets.top]
      + rankHeights[lastRank, default: 0] + configuration.canvasInsets.bottom
    let minimumBounds = CGRect(
      origin: .zero,
      size: CGSize(
        width: max(measuredWidth, configuration.minimumCanvasSize.width),
        height: max(measuredHeight, configuration.minimumCanvasSize.height)
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

  private func layerWidth(
    nodeIDs: [Schema.NodeID],
    input: FlowingGraphLayoutInput<Schema>
  ) -> CGFloat {
    guard !nodeIDs.isEmpty else { return 0 }
    return nodeIDs.reduce(0) { $0 + input.resolvedSize(for: $1).width } + CGFloat(nodeIDs.count - 1)
      * configuration.horizontalNodeSpacing
  }

  private func layerCenters(
    nodeIDs: [Schema.NodeID],
    componentX: CGFloat,
    componentWidth: CGFloat,
    input: FlowingGraphLayoutInput<Schema>,
    frames: [Schema.NodeID: CGRect]
  ) -> [CGFloat] {
    guard !nodeIDs.isEmpty else { return [] }
    let layerWidth = layerWidth(nodeIDs: nodeIDs, input: input)
    var cursor = componentX + (componentWidth - layerWidth) / 2
    var defaultCenters: [CGFloat] = []
    defaultCenters.reserveCapacity(nodeIDs.count)
    for nodeID in nodeIDs {
      let width = input.resolvedSize(for: nodeID).width
      defaultCenters.append(cursor + width / 2)
      cursor += width + configuration.horizontalNodeSpacing
    }
    var centers = zip(nodeIDs, defaultCenters).map { nodeID, fallback in
      let childCenters = input.topology.directedSuccessorNodeIDs(of: nodeID)
        .compactMap { frames[$0]?.midX }
      guard !childCenters.isEmpty else { return fallback }
      return childCenters.reduce(0, +) / CGFloat(childCenters.count)
    }

    if centers.count > 1 {
      for index in 1..<centers.count {
        let previousWidth = input.resolvedSize(for: nodeIDs[index - 1]).width
        let width = input.resolvedSize(for: nodeIDs[index]).width
        let minimum =
          centers[index - 1] + (previousWidth + width) / 2 + configuration.horizontalNodeSpacing
        centers[index] = max(centers[index], minimum)
      }
    }

    let firstWidth = input.resolvedSize(for: nodeIDs[0]).width
    let lastWidth = input.resolvedSize(for: nodeIDs[nodeIDs.count - 1]).width
    let minimumCenter = componentX + firstWidth / 2
    let maximumCenter = componentX + componentWidth - lastWidth / 2
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
