import type { FdCanvasPoint, FdCanvasRect } from '../geometry.js'
import type { FdGraphElementID } from '../graph/model.js'
import { graphElementKey } from '../graph/model.js'
import {
  FdCenteredLayerCoordinates,
  type FdLayerAssignmentStrategy,
  type FdLayerCoordinateAssignmentStrategy,
  FdLayeredDAGPlacement,
  FdLayeredLayoutConfiguration,
  type FdLayerOrderingStrategy,
  FdLongestPathLayerAssignment,
  FdStableLayerOrdering,
} from './layered.js'
import {
  type FdGraphLayoutEdge,
  type FdGraphLayoutEndpoint,
  type FdGraphLayoutInput,
  FdLayoutComponentIdentity,
  type FdLayoutPipelineIdentity,
} from './model.js'
import {
  FdGraphEdgeRoute,
  type FdGraphEdgeRoutingStrategy,
  type FdGraphLayoutEdgeRoute,
  FdGraphLayoutPipeline,
  type FdGraphLayoutPostprocessor,
  type FdGraphLayoutResult,
  type FdGraphLayoutStrategy,
  type FdGraphNodePlacement,
} from './pipeline.js'

export class FdCubicEdgeRouterConfiguration {
  readonly minimumControlDistance: number
  readonly maximumControlDistance: number
  readonly controlDistanceRatio: number
  readonly parallelEdgeSpacing: number
  readonly selfLoopRadius: number

  constructor(
    minimumControlDistance: number,
    maximumControlDistance: number,
    controlDistanceRatio: number,
    parallelEdgeSpacing: number,
    selfLoopRadius: number,
  ) {
    const values = [
      minimumControlDistance,
      maximumControlDistance,
      controlDistanceRatio,
      parallelEdgeSpacing,
      selfLoopRadius,
    ]
    if (
      values.some((value) => !Number.isFinite(value) || value < 0) ||
      maximumControlDistance < minimumControlDistance
    ) {
      throw new RangeError('cubic edge router values must be finite and nonnegative')
    }
    this.minimumControlDistance = minimumControlDistance
    this.maximumControlDistance = maximumControlDistance
    this.controlDistanceRatio = controlDistanceRatio
    this.parallelEdgeSpacing = parallelEdgeSpacing
    this.selfLoopRadius = selfLoopRadius
  }

  static readonly standard = new FdCubicEdgeRouterConfiguration(28, 54, 0.45, 12, 34)
}

export class FdCubicEdgeRouter<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> implements FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>
{
  readonly identity: FdLayoutComponentIdentity
  readonly configuration: FdCubicEdgeRouterConfiguration

  constructor(
    configuration = FdCubicEdgeRouterConfiguration.standard,
    identity = new FdLayoutComponentIdentity(),
  ) {
    this.configuration = configuration
    this.identity = identity
  }

  routes(
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
    placement: FdGraphNodePlacement<NodeID, PortID, EdgeID>,
  ): readonly FdGraphLayoutEdgeRoute<EdgeID>[] {
    const indexByPair = new Map<string, number>()
    const countByPair = new Map<string, number>()
    for (const edge of input.topology.edges) {
      const pair = nodePair(edge, input)
      countByPair.set(pair, (countByPair.get(pair) ?? 0) + 1)
    }

    return input.topology.edges.map((edge) => {
      const pair = nodePair(edge, input)
      const index = indexByPair.get(pair) ?? 0
      indexByPair.set(pair, index + 1)
      const count = countByPair.get(pair) ?? 1
      const separation = (index - (count - 1) / 2) * this.configuration.parallelEdgeSpacing
      return {
        edgeID: edge.id,
        route: this.route(edge, input, placement, separation, index),
      }
    })
  }

  private route(
    edge: FdGraphLayoutEdge<NodeID, PortID, EdgeID>,
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
    placement: FdGraphNodePlacement<NodeID, PortID, EdgeID>,
    separation: number,
    loopIndex: number,
  ): FdGraphEdgeRoute {
    const [firstEndpoint, secondEndpoint] = endpointElements(edge)
    const firstNodeID = input.topology.nodeID(firstEndpoint)
    const secondNodeID = input.topology.nodeID(secondEndpoint)
    const firstFrame = resolvedFrame(placement, firstNodeID)
    const secondFrame = resolvedFrame(placement, secondNodeID)
    if (firstNodeID === secondNodeID) {
      return this.selfLoop(firstEndpoint, secondEndpoint, firstFrame, input, loopIndex)
    }

    const first = resolvedEndpoint(firstEndpoint, firstFrame, midpoint(secondFrame), input)
    const second = resolvedEndpoint(secondEndpoint, secondFrame, midpoint(firstFrame), input)
    const delta = { dx: second.point.x - first.point.x, dy: second.point.y - first.point.y }
    const distance = Math.hypot(delta.dx, delta.dy)
    const controlDistance = Math.min(
      Math.max(
        distance * this.configuration.controlDistanceRatio,
        this.configuration.minimumControlDistance,
      ),
      this.configuration.maximumControlDistance,
    )
    const perpendicular = normalized({ dx: -delta.dy, dy: delta.dx })
    const offset = {
      dx: perpendicular.dx * separation,
      dy: perpendicular.dy * separation,
    }
    return new FdGraphEdgeRoute(first.point, [
      {
        kind: 'cubic',
        control1: {
          x: first.point.x + first.normal.dx * controlDistance + offset.dx,
          y: first.point.y + first.normal.dy * controlDistance + offset.dy,
        },
        control2: {
          x: second.point.x + second.normal.dx * controlDistance + offset.dx,
          y: second.point.y + second.normal.dy * controlDistance + offset.dy,
        },
        end: second.point,
      },
    ])
  }

  private selfLoop(
    firstEndpoint: FdGraphLayoutEndpoint<NodeID, PortID>,
    secondEndpoint: FdGraphLayoutEndpoint<NodeID, PortID>,
    frame: FdCanvasRect,
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
    loopIndex: number,
  ): FdGraphEdgeRoute {
    const radius =
      this.configuration.selfLoopRadius + loopIndex * this.configuration.parallelEdgeSpacing
    const start = resolvedEndpoint(
      firstEndpoint,
      frame,
      { x: frame.x + frame.width + radius, y: frame.y - radius },
      input,
    )
    const end = resolvedEndpoint(
      secondEndpoint,
      frame,
      { x: frame.x - radius, y: frame.y - radius },
      input,
    )
    const apex = { x: frame.x + frame.width / 2, y: frame.y - radius }
    return new FdGraphEdgeRoute(start.point, [
      {
        kind: 'cubic',
        control1: { x: frame.x + frame.width + radius, y: start.point.y },
        control2: { x: frame.x + frame.width + radius, y: frame.y - radius },
        end: apex,
      },
      {
        kind: 'cubic',
        control1: { x: frame.x - radius, y: frame.y - radius },
        control2: { x: frame.x - radius, y: end.point.y },
        end: end.point,
      },
    ])
  }
}

export class FdLayeredDAGLayout<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> implements FdGraphLayoutStrategy<NodeID, PortID, EdgeID>
{
  readonly #pipeline: FdGraphLayoutPipeline<NodeID, PortID, EdgeID>

  constructor(configuration: FdLayeredLayoutConfiguration)
  constructor(
    layerAssignment: FdLayerAssignmentStrategy<NodeID, PortID, EdgeID>,
    layerOrdering: FdLayerOrderingStrategy<NodeID, PortID, EdgeID>,
    coordinateAssignment: FdLayerCoordinateAssignmentStrategy<NodeID, PortID, EdgeID>,
    edgeRouter: FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
  )
  constructor(
    layerAssignment: FdLayerAssignmentStrategy<NodeID, PortID, EdgeID>,
    layerOrdering: FdLayerOrderingStrategy<NodeID, PortID, EdgeID>,
    coordinateAssignment: FdLayerCoordinateAssignmentStrategy<NodeID, PortID, EdgeID>,
    postprocessors: readonly FdGraphLayoutPostprocessor<NodeID, PortID, EdgeID>[],
    edgeRouter: FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
  )
  constructor(
    configurationOrAssignment:
      | FdLayeredLayoutConfiguration
      | FdLayerAssignmentStrategy<NodeID, PortID, EdgeID>,
    layerOrdering?: FdLayerOrderingStrategy<NodeID, PortID, EdgeID>,
    coordinateAssignment?: FdLayerCoordinateAssignmentStrategy<NodeID, PortID, EdgeID>,
    postprocessorsOrRouter?:
      | readonly FdGraphLayoutPostprocessor<NodeID, PortID, EdgeID>[]
      | FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
    edgeRouter?: FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
  ) {
    if (configurationOrAssignment instanceof FdLayeredLayoutConfiguration) {
      this.#pipeline = new FdGraphLayoutPipeline(
        new FdLayeredDAGPlacement(
          new FdLongestPathLayerAssignment(),
          new FdStableLayerOrdering(),
          new FdCenteredLayerCoordinates(configurationOrAssignment),
        ),
        new FdCubicEdgeRouter(),
      )
      return
    }
    if (!layerOrdering || !coordinateAssignment || !postprocessorsOrRouter) {
      throw new TypeError('layered DAG layout requires a complete pipeline')
    }
    const placement = new FdLayeredDAGPlacement(
      configurationOrAssignment,
      layerOrdering,
      coordinateAssignment,
    )
    if (Array.isArray(postprocessorsOrRouter) && !edgeRouter) {
      throw new TypeError('layered DAG layout requires an edge router')
    }
    this.#pipeline = Array.isArray(postprocessorsOrRouter)
      ? new FdGraphLayoutPipeline(
          placement,
          postprocessorsOrRouter,
          edgeRouter as FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
        )
      : new FdGraphLayoutPipeline(
          placement,
          postprocessorsOrRouter as FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
        )
  }

  get identity(): FdLayoutPipelineIdentity {
    return this.#pipeline.identity
  }

  layout(
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
  ): FdGraphLayoutResult<NodeID, PortID, EdgeID> {
    return this.#pipeline.layout(input)
  }
}

interface ResolvedEndpoint {
  readonly point: FdCanvasPoint
  readonly normal: { readonly dx: number; readonly dy: number }
}

const resolvedEndpoint = <
  NodeID extends FdGraphElementID,
  PortID extends FdGraphElementID,
  EdgeID extends FdGraphElementID,
>(
  endpoint: FdGraphLayoutEndpoint<NodeID, PortID>,
  frame: FdCanvasRect,
  target: FdCanvasPoint,
  input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
): ResolvedEndpoint => {
  if (endpoint.kind === 'node') return frameBoundaryEndpoint(frame, target)
  const anchor = input.anchor(endpoint.key)
  if (!anchor) throw new Error('edge routing anchor invariant failed')
  const point = { x: frame.x + anchor.position.x, y: frame.y + anchor.position.y }
  const normal =
    anchor.normal.dx === 0 && anchor.normal.dy === 0
      ? normalized({ dx: target.x - point.x, dy: target.y - point.y })
      : normalized(anchor.normal)
  return { point, normal }
}

const frameBoundaryEndpoint = (frame: FdCanvasRect, target: FdCanvasPoint): ResolvedEndpoint => {
  const center = midpoint(frame)
  const dx = target.x - center.x
  const dy = target.y - center.y
  if (Math.abs(dy) >= Math.abs(dx)) {
    const isBelow = dy >= 0
    return {
      point: { x: center.x, y: isBelow ? frame.y + frame.height : frame.y },
      normal: { dx: 0, dy: isBelow ? 1 : -1 },
    }
  }
  const isTrailing = dx >= 0
  return {
    point: { x: isTrailing ? frame.x + frame.width : frame.x, y: center.y },
    normal: { dx: isTrailing ? 1 : -1, dy: 0 },
  }
}

const endpointElements = <
  NodeID extends FdGraphElementID,
  PortID extends FdGraphElementID,
  EdgeID extends FdGraphElementID,
>(
  edge: FdGraphLayoutEdge<NodeID, PortID, EdgeID>,
): readonly [FdGraphLayoutEndpoint<NodeID, PortID>, FdGraphLayoutEndpoint<NodeID, PortID>] =>
  edge.endpoints.kind === 'directed'
    ? [edge.endpoints.source, edge.endpoints.target]
    : [edge.endpoints.first, edge.endpoints.second]

const nodePair = <
  NodeID extends FdGraphElementID,
  PortID extends FdGraphElementID,
  EdgeID extends FdGraphElementID,
>(
  edge: FdGraphLayoutEdge<NodeID, PortID, EdgeID>,
  input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
): string => {
  const [first, second] = endpointElements(edge)
  const firstKey = graphElementKey(input.topology.nodeID(first))
  const secondKey = graphElementKey(input.topology.nodeID(second))
  return `${firstKey.length}:${firstKey}${secondKey.length}:${secondKey}`
}

const resolvedFrame = <
  NodeID extends FdGraphElementID,
  PortID extends FdGraphElementID,
  EdgeID extends FdGraphElementID,
>(
  placement: FdGraphNodePlacement<NodeID, PortID, EdgeID>,
  nodeID: NodeID,
): FdCanvasRect => {
  const frame = placement.frame(nodeID)
  if (!frame) throw new Error('edge routing frame invariant failed')
  return frame
}

const midpoint = (frame: FdCanvasRect): FdCanvasPoint => ({
  x: frame.x + frame.width / 2,
  y: frame.y + frame.height / 2,
})

const normalized = (vector: {
  readonly dx: number
  readonly dy: number
}): { readonly dx: number; readonly dy: number } => {
  const length = Math.hypot(vector.dx, vector.dy)
  return length > 0 ? { dx: vector.dx / length, dy: vector.dy / length } : { dx: 0, dy: 0 }
}
