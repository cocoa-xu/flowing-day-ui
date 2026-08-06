import CoreGraphics
import Foundation

public struct FlowingCompoundContainerGeometryContext<
  Schema: FlowingGraphLayoutSchema
>: Sendable {
  public let containerNodeID: Schema.NodeID
  public let intrinsicSize: CGSize
  public let contentSize: CGSize
  public let portAnchors: [FlowingGraphPortAnchor<Schema>]

  public init(
    containerNodeID: Schema.NodeID,
    intrinsicSize: CGSize,
    contentSize: CGSize,
    portAnchors: [FlowingGraphPortAnchor<Schema>]
  ) {
    self.containerNodeID = containerNodeID
    self.intrinsicSize = intrinsicSize
    self.contentSize = contentSize
    self.portAnchors = portAnchors
  }
}

public struct FlowingCompoundContainerGeometry<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let size: CGSize
  public let contentOrigin: CGPoint
  public let portAnchors: [FlowingGraphPortAnchor<Schema>]

  public init(
    size: CGSize,
    contentOrigin: CGPoint,
    portAnchors: [FlowingGraphPortAnchor<Schema>]
  ) {
    self.size = size
    self.contentOrigin = contentOrigin
    self.portAnchors = portAnchors
  }
}

public protocol FlowingCompoundContainerGeometryResolver<Schema>: Sendable {
  associatedtype Schema: FlowingGraphLayoutSchema

  var identity: FlowingLayoutComponentIdentity { get }

  func geometry(
    for context: FlowingCompoundContainerGeometryContext<Schema>
  ) throws -> FlowingCompoundContainerGeometry<Schema>
}

public struct FlowingPaddedCompoundContainerConfiguration: Sendable, Equatable {
  public let contentInsets: FlowingLayoutInsets
  public let headerHeight: CGFloat

  public init(contentInsets: FlowingLayoutInsets, headerHeight: CGFloat) {
    precondition(headerHeight.isFinite && headerHeight >= 0)
    self.contentInsets = contentInsets
    self.headerHeight = headerHeight
  }
}

public struct FlowingPaddedCompoundContainerGeometry<
  Schema: FlowingGraphLayoutSchema
>: Sendable {
  public let identity: FlowingLayoutComponentIdentity
  public let configuration: FlowingPaddedCompoundContainerConfiguration

  public init(
    configuration: FlowingPaddedCompoundContainerConfiguration,
    identity: FlowingLayoutComponentIdentity = .init()
  ) {
    self.configuration = configuration
    self.identity = identity
  }
}

extension FlowingPaddedCompoundContainerGeometry: FlowingCompoundContainerGeometryResolver {
  public func geometry(
    for context: FlowingCompoundContainerGeometryContext<Schema>
  ) throws -> FlowingCompoundContainerGeometry<Schema> {
    let insets = configuration.contentInsets
    let contentOrigin = CGPoint(
      x: insets.leading,
      y: insets.top + configuration.headerHeight
    )
    let size = CGSize(
      width: max(
        context.intrinsicSize.width,
        insets.leading + context.contentSize.width + insets.trailing
      ),
      height: max(
        context.intrinsicSize.height,
        contentOrigin.y + context.contentSize.height + insets.bottom
      )
    )
    return FlowingCompoundContainerGeometry(
      size: size,
      contentOrigin: contentOrigin,
      portAnchors: context.portAnchors.map {
        resizedAnchor($0, from: context.intrinsicSize, to: size)
      }
    )
  }

  private func resizedAnchor(
    _ anchor: FlowingGraphPortAnchor<Schema>,
    from originalSize: CGSize,
    to size: CGSize
  ) -> FlowingGraphPortAnchor<Schema> {
    let horizontalRatio = ratio(anchor.position.x, dimension: originalSize.width)
    let verticalRatio = ratio(anchor.position.y, dimension: originalSize.height)
    let position: CGPoint
    if abs(anchor.normal.dx) >= abs(anchor.normal.dy), anchor.normal.dx != 0 {
      position = CGPoint(
        x: anchor.normal.dx > 0 ? size.width : 0,
        y: verticalRatio * size.height
      )
    } else if anchor.normal.dy != 0 {
      position = CGPoint(
        x: horizontalRatio * size.width,
        y: anchor.normal.dy > 0 ? size.height : 0
      )
    } else {
      position = CGPoint(
        x: horizontalRatio * size.width,
        y: verticalRatio * size.height
      )
    }
    return FlowingGraphPortAnchor(
      key: anchor.key,
      position: position,
      normal: anchor.normal
    )
  }

  private func ratio(_ coordinate: CGFloat, dimension: CGFloat) -> CGFloat {
    dimension > 0
      ? coordinate / dimension
      : FlowingCompoundLayoutLimits.zeroDimensionAnchorRatio
  }
}

public enum FlowingCompoundLayoutIssue<Schema: FlowingGraphLayoutSchema>: Error {
  case invalidContainerSize(Schema.NodeID)
  case invalidContentOrigin(Schema.NodeID)
  case contentExceedsContainer(Schema.NodeID)
  case duplicatePortAnchor(FlowingGraphLayoutPortKey<Schema>)
  case invalidPortAnchor(FlowingGraphLayoutPortKey<Schema>)
  case missingPortAnchor(FlowingGraphLayoutPortKey<Schema>)
  case unknownPortAnchor(FlowingGraphLayoutPortKey<Schema>)
  case missingNodeFrame(Schema.NodeID)
}

extension FlowingCompoundLayoutIssue: Equatable {}

public struct FlowingCompoundLayout<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let levelLayout: any FlowingGraphLayoutStrategy<Schema>
  public let containerGeometry: any FlowingCompoundContainerGeometryResolver<Schema>
  public let edgeRouter: any FlowingGraphEdgeRoutingStrategy<Schema>

  public init(
    levelLayout: some FlowingGraphLayoutStrategy<Schema>,
    containerGeometry: some FlowingCompoundContainerGeometryResolver<Schema>,
    edgeRouter: some FlowingGraphEdgeRoutingStrategy<Schema>
  ) {
    self.levelLayout = levelLayout
    self.containerGeometry = containerGeometry
    self.edgeRouter = edgeRouter
  }
}

extension FlowingCompoundLayout: FlowingGraphLayoutStrategy {
  public var identity: FlowingLayoutPipelineIdentity {
    FlowingLayoutPipelineIdentity(
      stages: [
        .group(role: .levelLayout, stages: levelLayout.identity.stages),
        .component(role: .containerGeometry, identity: containerGeometry.identity),
        .component(role: .edgeRouting, identity: edgeRouter.identity),
      ]
    )
  }

  public func layout(
    _ input: FlowingGraphLayoutInput<Schema>
  ) throws -> FlowingGraphLayoutResult<Schema> {
    guard input.id.pipelineIdentity == identity else {
      throw FlowingGraphLayoutPipelineError.inputIdentityMismatch
    }
    var sizeByNodeID = Dictionary(
      uniqueKeysWithValues: input.nodeSizes.map { ($0.nodeID, $0.size) }
    )
    var anchorByKey = Dictionary(
      uniqueKeysWithValues: input.portAnchors.map { ($0.key, $0) }
    )
    let bottomUpContainerNodeIDs = try bottomUpContainers(topology: input.topology)
    let scopeIndex = try FlowingCompoundScopeIndex(input: input)
    var childPlacementByContainerNodeID: [Schema.NodeID: FlowingCompoundChildPlacement<Schema>] =
      [:]
    childPlacementByContainerNodeID.reserveCapacity(bottomUpContainerNodeIDs.count)

    for containerNodeID in bottomUpContainerNodeIDs {
      try Task.checkCancellation()
      let memberNodeIDs = input.topology.memberNodeIDs(of: containerNodeID)
      let childResult = try layoutScope(
        scope: .container(containerNodeID),
        nodeIDs: memberNodeIDs,
        input: input,
        scopeIndex: scopeIndex,
        sizeByNodeID: sizeByNodeID,
        anchorByKey: anchorByKey
      )
      let containerPortKeys = input.topology.ports.compactMap { port in
        port.nodeID == containerNodeID ? port.key : nil
      }
      let context = FlowingCompoundContainerGeometryContext(
        containerNodeID: containerNodeID,
        intrinsicSize: input.resolvedSize(for: containerNodeID),
        contentSize: childResult.contentBounds.size,
        portAnchors: containerPortKeys.map { anchorByKey[$0]! }
      )
      let geometry = try containerGeometry.geometry(for: context)
      try validate(
        geometry: geometry,
        context: context,
        expectedPortKeys: containerPortKeys
      )
      sizeByNodeID[containerNodeID] = geometry.size
      for anchor in geometry.portAnchors {
        anchorByKey[anchor.key] = anchor
      }
      let translation = CGSize(
        width: geometry.contentOrigin.x - childResult.contentBounds.minX,
        height: geometry.contentOrigin.y - childResult.contentBounds.minY
      )
      childPlacementByContainerNodeID[containerNodeID] = FlowingCompoundChildPlacement(
        frames: childResult.nodeFrames.map {
          FlowingGraphNodeFrame(
            nodeID: $0.nodeID,
            frame: $0.frame.offsetBy(dx: translation.width, dy: translation.height)
          )
        }
      )
    }

    let rootResult = try layoutScope(
      scope: .root,
      nodeIDs: input.topology.rootNodeIDs,
      input: input,
      scopeIndex: scopeIndex,
      sizeByNodeID: sizeByNodeID,
      anchorByKey: anchorByKey
    )
    var worldFrameByNodeID = Dictionary(
      uniqueKeysWithValues: rootResult.nodeFrames.map { ($0.nodeID, $0.frame) }
    )
    for containerNodeID in bottomUpContainerNodeIDs.reversed() {
      guard let containerFrame = worldFrameByNodeID[containerNodeID] else {
        throw FlowingCompoundLayoutIssue<Schema>.missingNodeFrame(containerNodeID)
      }
      guard let childPlacement = childPlacementByContainerNodeID[containerNodeID] else {
        continue
      }
      for (index, entry) in childPlacement.frames.enumerated() {
        if index.isMultiple(of: FlowingCompoundLayoutLimits.cancellationStride) {
          try Task.checkCancellation()
        }
        worldFrameByNodeID[entry.nodeID] = entry.frame.offsetBy(
          dx: containerFrame.minX,
          dy: containerFrame.minY
        )
      }
    }
    for nodeID in input.topology.nodeIDs where worldFrameByNodeID[nodeID] == nil {
      throw FlowingCompoundLayoutIssue<Schema>.missingNodeFrame(nodeID)
    }

    let resolvedInput = try FlowingGraphLayoutInput(
      id: input.id,
      topology: input.topology,
      nodeSizes: input.topology.nodeIDs.map {
        FlowingGraphLayoutNodeSize(nodeID: $0, size: sizeByNodeID[$0]!)
      },
      portAnchors: input.topology.ports.map { anchorByKey[$0.key]! },
      placementState: input.placementState
    )
    let rootBounds = rootResult.contentBounds
    let contentBounds = worldFrameByNodeID.values.reduce(rootBounds) { $0.union($1) }
    let placement = try FlowingGraphNodePlacement(
      input: resolvedInput,
      nodeFrames: input.topology.nodeIDs.map {
        FlowingGraphNodeFrame(nodeID: $0, frame: worldFrameByNodeID[$0]!)
      },
      contentBounds: contentBounds
    )
    let routes = try edgeRouter.routes(for: resolvedInput, placement: placement)
    return try FlowingGraphLayoutResult(
      input: resolvedInput,
      placement: placement,
      edgeRoutes: routes
    )
  }

  private func bottomUpContainers(
    topology: FlowingGraphLayoutTopology<Schema>
  ) throws -> [Schema.NodeID] {
    let containerNodeIDs = topology.containments.map(\.containerNodeID)
    let knownContainerNodeIDs = Set(containerNodeIDs)
    var unresolvedChildrenByContainerNodeID: [Schema.NodeID: Int] = [:]
    for containerNodeID in containerNodeIDs {
      unresolvedChildrenByContainerNodeID[containerNodeID] =
        topology.memberNodeIDs(
          of: containerNodeID
        ).filter { knownContainerNodeIDs.contains($0) }.count
    }
    var queue = containerNodeIDs.filter {
      unresolvedChildrenByContainerNodeID[$0] == 0
    }
    var result: [Schema.NodeID] = []
    result.reserveCapacity(containerNodeIDs.count)
    var queueIndex = 0
    while queueIndex < queue.count {
      if queueIndex.isMultiple(of: FlowingCompoundLayoutLimits.cancellationStride) {
        try Task.checkCancellation()
      }
      let containerNodeID = queue[queueIndex]
      queueIndex += 1
      result.append(containerNodeID)
      guard let parent = topology.containerNodeID(of: containerNodeID),
        knownContainerNodeIDs.contains(parent)
      else {
        continue
      }
      unresolvedChildrenByContainerNodeID[parent]! -= 1
      if unresolvedChildrenByContainerNodeID[parent] == 0 {
        queue.append(parent)
      }
    }
    precondition(result.count == containerNodeIDs.count)
    return result
  }

  private func layoutScope(
    scope: FlowingCompoundScope<Schema>,
    nodeIDs: [Schema.NodeID],
    input: FlowingGraphLayoutInput<Schema>,
    scopeIndex: FlowingCompoundScopeIndex<Schema>,
    sizeByNodeID: [Schema.NodeID: CGSize],
    anchorByKey: [FlowingGraphLayoutPortKey<Schema>: FlowingGraphPortAnchor<Schema>]
  ) throws -> FlowingGraphLayoutResult<Schema> {
    let topology = try FlowingGraphLayoutTopology(
      snapshotID: input.topology.snapshotID,
      nodeIDs: nodeIDs,
      ports: scopeIndex.portsByScope[scope, default: []],
      edges: scopeIndex.edgesByScope[scope, default: []]
    )
    let scopeInput = try FlowingGraphLayoutInput(
      id: FlowingLayoutInputID(
        presentationSnapshotID: topology.snapshotID,
        pipelineIdentity: levelLayout.identity,
        nodeSizeRevision: input.id.nodeSizeRevision,
        portAnchorRevision: input.id.portAnchorRevision,
        layoutStateRevision: input.id.layoutStateRevision
      ),
      topology: topology,
      nodeSizes: nodeIDs.map {
        FlowingGraphLayoutNodeSize(nodeID: $0, size: sizeByNodeID[$0]!)
      },
      portAnchors: topology.ports.map { anchorByKey[$0.key]! },
      placementState: scopeIndex.placementStateByScope[scope, default: []]
    )
    return try levelLayout.layout(scopeInput)
  }

  private func validate(
    geometry: FlowingCompoundContainerGeometry<Schema>,
    context: FlowingCompoundContainerGeometryContext<Schema>,
    expectedPortKeys: [FlowingGraphLayoutPortKey<Schema>]
  ) throws {
    guard geometry.size.isFinite,
      geometry.size.width >= 0,
      geometry.size.height >= 0
    else {
      throw FlowingCompoundLayoutIssue<Schema>.invalidContainerSize(
        context.containerNodeID
      )
    }
    guard geometry.contentOrigin.isFinite,
      geometry.contentOrigin.x >= 0,
      geometry.contentOrigin.y >= 0
    else {
      throw FlowingCompoundLayoutIssue<Schema>.invalidContentOrigin(
        context.containerNodeID
      )
    }
    guard geometry.contentOrigin.x + context.contentSize.width <= geometry.size.width,
      geometry.contentOrigin.y + context.contentSize.height <= geometry.size.height
    else {
      throw FlowingCompoundLayoutIssue<Schema>.contentExceedsContainer(
        context.containerNodeID
      )
    }
    let expected = Set(expectedPortKeys)
    var actual: Set<FlowingGraphLayoutPortKey<Schema>> = []
    for anchor in geometry.portAnchors {
      guard expected.contains(anchor.key) else {
        throw FlowingCompoundLayoutIssue<Schema>.unknownPortAnchor(anchor.key)
      }
      guard actual.insert(anchor.key).inserted else {
        throw FlowingCompoundLayoutIssue<Schema>.duplicatePortAnchor(anchor.key)
      }
      guard anchor.position.isFinite, anchor.normal.isFinite else {
        throw FlowingCompoundLayoutIssue<Schema>.invalidPortAnchor(anchor.key)
      }
    }
    if let missing = expectedPortKeys.first(where: { !actual.contains($0) }) {
      throw FlowingCompoundLayoutIssue<Schema>.missingPortAnchor(missing)
    }
  }
}

private struct FlowingCompoundChildPlacement<Schema: FlowingGraphLayoutSchema> {
  let frames: [FlowingGraphNodeFrame<Schema>]
}

private enum FlowingCompoundScope<Schema: FlowingGraphLayoutSchema>: Hashable {
  case root
  case container(Schema.NodeID)
}

private struct FlowingCompoundScopeIndex<Schema: FlowingGraphLayoutSchema> {
  let portsByScope: [FlowingCompoundScope<Schema>: [FlowingGraphLayoutPort<Schema>]]
  let edgesByScope: [FlowingCompoundScope<Schema>: [FlowingGraphLayoutEdge<Schema>]]
  let placementStateByScope:
    [FlowingCompoundScope<Schema>: [FlowingGraphNodePlacementState<Schema>]]

  init(input: FlowingGraphLayoutInput<Schema>) throws {
    var scopeByNodeID: [Schema.NodeID: FlowingCompoundScope<Schema>] = [:]
    scopeByNodeID.reserveCapacity(input.topology.nodeIDs.count)
    for (index, nodeID) in input.topology.nodeIDs.enumerated() {
      if index.isMultiple(of: FlowingCompoundLayoutLimits.cancellationStride) {
        try Task.checkCancellation()
      }
      scopeByNodeID[nodeID] =
        input.topology.containerNodeID(of: nodeID).map {
          .container($0)
        } ?? .root
    }
    var nextPortsByScope: [FlowingCompoundScope<Schema>: [FlowingGraphLayoutPort<Schema>]] = [:]
    for (index, port) in input.topology.ports.enumerated() {
      if index.isMultiple(of: FlowingCompoundLayoutLimits.cancellationStride) {
        try Task.checkCancellation()
      }
      nextPortsByScope[scopeByNodeID[port.nodeID]!, default: []].append(port)
    }
    var nextEdgesByScope: [FlowingCompoundScope<Schema>: [FlowingGraphLayoutEdge<Schema>]] = [:]
    for (index, edge) in input.topology.edges.enumerated() {
      if index.isMultiple(of: FlowingCompoundLayoutLimits.cancellationStride) {
        try Task.checkCancellation()
      }
      let endpointScopes = edge.endpoints.elements.map {
        scopeByNodeID[input.topology.nodeID(for: $0)]!
      }
      guard endpointScopes[0] == endpointScopes[1] else { continue }
      nextEdgesByScope[endpointScopes[0], default: []].append(edge)
    }
    var nextPlacementStateByScope:
      [FlowingCompoundScope<Schema>: [FlowingGraphNodePlacementState<Schema>]] = [:]
    for (index, state) in input.placementState.enumerated() {
      if index.isMultiple(of: FlowingCompoundLayoutLimits.cancellationStride) {
        try Task.checkCancellation()
      }
      nextPlacementStateByScope[scopeByNodeID[state.nodeID]!, default: []].append(state)
    }
    portsByScope = nextPortsByScope
    edgesByScope = nextEdgesByScope
    placementStateByScope = nextPlacementStateByScope
  }
}

private enum FlowingCompoundLayoutLimits {
  static let cancellationStride = 256
  static let zeroDimensionAnchorRatio: CGFloat = 0.5
}

extension FlowingGraphLayoutEdgeEndpoints {
  fileprivate var elements: [FlowingGraphLayoutEndpoint<Schema>] {
    switch self {
    case .directed(let source, let target):
      [source, target]
    case .undirected(let first, let second):
      [first, second]
    }
  }
}

extension CGSize {
  fileprivate var isFinite: Bool {
    width.isFinite && height.isFinite
  }
}

extension CGPoint {
  fileprivate var isFinite: Bool {
    x.isFinite && y.isFinite
  }
}

extension CGVector {
  fileprivate var isFinite: Bool {
    dx.isFinite && dy.isFinite
  }
}
