import CoreGraphics
import FlowingDayGraphCanvas
import FlowingDayGraphComposition
import FlowingDayGraphCore
import FlowingDayGraphLayout

enum ShowcaseLayoutMetrics {
  static let nodeSize = CGSize(width: 152, height: 72)
  static let nodeSpacing: CGFloat = 48
  static let layerSpacing: CGFloat = 82
  static let componentSpacing: CGFloat = 88
  static let canvasInsets = FlowingLayoutInsets(horizontal: 56, vertical: 56)
  static let containerInsets = FlowingLayoutInsets(horizontal: 28, vertical: 24)
  static let containerHeaderHeight: CGFloat = 38
  static let minimumCanvasSize = CGSize(width: 640, height: 440)
}

struct ShowcaseLayoutIdentities {
  let nodeSize = FlowingLayoutComponentIdentity()
  let portAnchor = FlowingLayoutComponentIdentity()
  let dagAssignment = FlowingLayoutComponentIdentity()
  let dagOrdering = FlowingLayoutComponentIdentity()
  let dagCoordinates = FlowingLayoutComponentIdentity()
  let dagRouter = FlowingLayoutComponentIdentity()
  let sccPlacement = FlowingLayoutComponentIdentity()
  let sccRouter = FlowingLayoutComponentIdentity()
  let forcePlacement = FlowingLayoutComponentIdentity()
  let forceRouter = FlowingLayoutComponentIdentity()
  let containerGeometry = FlowingLayoutComponentIdentity()
  let finalRouter = FlowingLayoutComponentIdentity()
}

enum ShowcaseLayoutBuilder {
  typealias CanvasSchema = ShowcaseCanvasSchema
  typealias LayoutSchema = FlowingGraphCanvasLayoutSchema<CanvasSchema>

  static func content(
    presentation: FlowingGraphPresentation<CanvasSchema>,
    layoutStyle: ShowcaseLayoutStyle,
    placementOffsets: [FlowingGraphCompositionElementID<CanvasSchema>: CGSize],
    layoutStateRevision: FlowingLayoutRevision,
    identities: ShowcaseLayoutIdentities
  ) throws -> FlowingGraphCanvasContent<CanvasSchema> {
    switch layoutStyle {
    case .dag:
      let level = FlowingLayeredDAGLayout<LayoutSchema>(
        layerAssignment: FlowingLongestPathLayerAssignment(identity: identities.dagAssignment),
        layerOrdering: FlowingStableLayerOrdering(identity: identities.dagOrdering),
        coordinateAssignment: FlowingCenteredLayerCoordinates(
          configuration: layeredConfiguration,
          identity: identities.dagCoordinates
        ),
        edgeRouter: FlowingCubicEdgeRouter(identity: identities.dagRouter)
      )
      return try resolve(
        presentation: presentation,
        levelLayout: level,
        placementOffsets: placementOffsets,
        layoutStateRevision: layoutStateRevision,
        identities: identities
      )
    case .cyclic:
      let level = FlowingSCCLayeredLayout<LayoutSchema>(
        placement: FlowingSCCLayeredPlacement(
          configuration: sccConfiguration,
          identity: identities.sccPlacement
        ),
        edgeRouter: FlowingCubicEdgeRouter(identity: identities.sccRouter)
      )
      return try resolve(
        presentation: presentation,
        levelLayout: level,
        placementOffsets: placementOffsets,
        layoutStateRevision: layoutStateRevision,
        identities: identities
      )
    case .mixed:
      let level = FlowingForceDirectedLayout<LayoutSchema>(
        placement: FlowingForceDirectedPlacement(
          configuration: forceConfiguration,
          identity: identities.forcePlacement
        ),
        edgeRouter: FlowingCubicEdgeRouter(identity: identities.forceRouter)
      )
      return try resolve(
        presentation: presentation,
        levelLayout: level,
        placementOffsets: placementOffsets,
        layoutStateRevision: layoutStateRevision,
        identities: identities
      )
    }
  }

  private static func resolve<LevelLayout: FlowingGraphLayoutStrategy<LayoutSchema>>(
    presentation: FlowingGraphPresentation<CanvasSchema>,
    levelLayout: LevelLayout,
    placementOffsets: [FlowingGraphCompositionElementID<CanvasSchema>: CGSize],
    layoutStateRevision: FlowingLayoutRevision,
    identities: ShowcaseLayoutIdentities
  ) throws -> FlowingGraphCanvasContent<CanvasSchema> {
    let strategy = FlowingCompoundLayout(
      levelLayout: levelLayout,
      containerGeometry: FlowingPaddedCompoundContainerGeometry<LayoutSchema>(
        configuration: FlowingPaddedCompoundContainerConfiguration(
          contentInsets: ShowcaseLayoutMetrics.containerInsets,
          headerHeight: ShowcaseLayoutMetrics.containerHeaderHeight
        ),
        identity: identities.containerGeometry
      ),
      edgeRouter: FlowingCubicEdgeRouter(identity: identities.finalRouter)
    )
    let topology = try FlowingGraphCanvasLayoutAdapter.topology(for: presentation)
    let offsetsByLocalID = Dictionary(
      uniqueKeysWithValues: presentation.nodes.compactMap { node in
        placementOffsets[node.id].map { (node.localID, $0) }
      }
    )
    let placementState = topology.nodeIDs.compactMap { nodeID in
      offsetsByLocalID[nodeID].map {
        FlowingGraphNodePlacementState<LayoutSchema>(nodeID: nodeID, offset: $0)
      }
    }
    let input = try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: FlowingFixedNodeSizeResolver<LayoutSchema>(
        size: ShowcaseLayoutMetrics.nodeSize,
        identity: identities.nodeSize
      ),
      portAnchorResolver: ShowcasePortAnchorResolver(identity: identities.portAnchor),
      pipelineIdentity: strategy.identity,
      layoutStateRevision: layoutStateRevision,
      placementState: placementState
    )
    return try FlowingGraphCanvasContent(
      presentation: presentation,
      layoutInput: input,
      layoutResult: strategy.layout(input)
    )
  }

  private static let layeredConfiguration = FlowingLayeredLayoutConfiguration(
    horizontalNodeSpacing: ShowcaseLayoutMetrics.nodeSpacing,
    verticalNodeSpacing: ShowcaseLayoutMetrics.layerSpacing,
    componentSpacing: ShowcaseLayoutMetrics.componentSpacing,
    canvasInsets: ShowcaseLayoutMetrics.canvasInsets,
    minimumCanvasSize: ShowcaseLayoutMetrics.minimumCanvasSize
  )

  private static let sccConfiguration = FlowingSCCLayeredLayoutConfiguration(
    horizontalComponentSpacing: ShowcaseLayoutMetrics.nodeSpacing,
    verticalLayerSpacing: ShowcaseLayoutMetrics.layerSpacing,
    weakComponentSpacing: ShowcaseLayoutMetrics.componentSpacing,
    cyclicNodeSpacing: 36,
    cyclicComponentPadding: 24,
    canvasInsets: ShowcaseLayoutMetrics.canvasInsets,
    minimumCanvasSize: ShowcaseLayoutMetrics.minimumCanvasSize
  )

  private static let forceConfiguration = FlowingForceDirectedLayoutConfiguration(
    simulation: FlowingForceSimulationConfiguration(
      iterationLimit: 180,
      idealEdgeLength: 170,
      repulsionStrength: 16_000,
      attractionStrength: 0.024,
      centeringStrength: 0.018,
      collisionStrength: 0.7,
      collisionPadding: 26,
      timeStep: 0.2,
      damping: 0.84,
      maximumDisplacement: 18,
      convergenceTolerance: 0.05,
      barnesHutTheta: 0.72,
      maximumTreeDepth: 20
    ),
    packing: FlowingForceComponentPackingConfiguration(
      componentSpacing: ShowcaseLayoutMetrics.componentSpacing,
      componentPadding: 28,
      targetAspectRatio: 1.5,
      canvasInsets: ShowcaseLayoutMetrics.canvasInsets,
      minimumCanvasSize: ShowcaseLayoutMetrics.minimumCanvasSize
    )
  )
}

private struct ShowcasePortAnchorResolver: FlowingGraphPortAnchorResolver {
  typealias Schema = FlowingGraphCanvasLayoutSchema<ShowcaseCanvasSchema>

  let identity: FlowingLayoutComponentIdentity

  func anchor(
    for port: FlowingGraphLayoutPort<Schema>,
    nodeSize: CGSize
  ) throws -> FlowingGraphPortAnchor<Schema> {
    let isInput: Bool
    if case .source(_, .port(let key), _) = port.id {
      isInput = key.portID == "input"
    } else {
      isInput = true
    }
    return FlowingGraphPortAnchor(
      key: port.key,
      position: CGPoint(
        x: isInput ? 0 : nodeSize.width,
        y: nodeSize.height / 2
      ),
      normal: CGVector(dx: isInput ? -1 : 1, dy: 0)
    )
  }
}
