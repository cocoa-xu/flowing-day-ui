import type { FdCanvasRect, FdCanvasSize } from '../geometry.js'
import type { FdGraphElementID } from '../graph/model.js'
import { FdCubicEdgeRouter } from './edge-routing.js'
import type { FdLayoutInsets } from './layered.js'
import { materializedGraph } from './materialization.js'
import {
  type FdGraphLayoutInput,
  FdLayoutComponentIdentity,
  FdLayoutPipelineIdentity,
} from './model.js'
import {
  type FdGraphEdgeRoutingStrategy,
  FdGraphLayoutPipeline,
  type FdGraphLayoutPostprocessor,
  type FdGraphLayoutResult,
  type FdGraphLayoutStrategy,
  type FdGraphNodeFrame,
  FdGraphNodePlacement,
  type FdGraphNodePlacementStrategy,
} from './pipeline.js'

export class FdSCCLayeredLayoutConfiguration {
  readonly horizontalComponentSpacing: number
  readonly verticalLayerSpacing: number
  readonly weakComponentSpacing: number
  readonly cyclicNodeSpacing: number
  readonly cyclicComponentPadding: number
  readonly canvasInsets: FdLayoutInsets
  readonly minimumCanvasSize: FdCanvasSize

  constructor(
    horizontalComponentSpacing: number,
    verticalLayerSpacing: number,
    weakComponentSpacing: number,
    cyclicNodeSpacing: number,
    cyclicComponentPadding: number,
    canvasInsets: FdLayoutInsets,
    minimumCanvasSize: FdCanvasSize,
  ) {
    for (const [name, value] of [
      ['horizontalComponentSpacing', horizontalComponentSpacing],
      ['verticalLayerSpacing', verticalLayerSpacing],
      ['weakComponentSpacing', weakComponentSpacing],
      ['cyclicNodeSpacing', cyclicNodeSpacing],
      ['cyclicComponentPadding', cyclicComponentPadding],
      ['minimumCanvasSize.width', minimumCanvasSize.width],
      ['minimumCanvasSize.height', minimumCanvasSize.height],
    ] as const) {
      if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${name} must be nonnegative and finite`)
      }
    }
    this.horizontalComponentSpacing = horizontalComponentSpacing
    this.verticalLayerSpacing = verticalLayerSpacing
    this.weakComponentSpacing = weakComponentSpacing
    this.cyclicNodeSpacing = cyclicNodeSpacing
    this.cyclicComponentPadding = cyclicComponentPadding
    this.canvasInsets = canvasInsets
    this.minimumCanvasSize = minimumCanvasSize
  }
}

export class FdSCCLayeredPlacement<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> implements FdGraphNodePlacementStrategy<NodeID, PortID, EdgeID>
{
  readonly identity: FdLayoutPipelineIdentity
  readonly configuration: FdSCCLayeredLayoutConfiguration

  constructor(
    configuration: FdSCCLayeredLayoutConfiguration,
    identity = new FdLayoutComponentIdentity(),
  ) {
    this.configuration = configuration
    this.identity = new FdLayoutPipelineIdentity(identity)
  }

  place(
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
  ): FdGraphNodePlacement<NodeID, PortID, EdgeID> {
    if (input.topology.nodeIDs.length === 0) {
      return new FdGraphNodePlacement(input, [], {
        x: 0,
        y: 0,
        ...this.configuration.minimumCanvasSize,
      })
    }
    const analysis = analyze(input)
    const geometries = analysis.components.map((nodeIDs) => this.componentGeometry(nodeIDs, input))
    const rankOrigins = this.layerOrigins(analysis, geometries)
    const frames = new Map<NodeID, FdCanvasRect>()
    let weakComponentX = this.configuration.canvasInsets.leading
    for (const weakComponent of analysis.weakComponents) {
      const componentIDsByRank = new Map<number, number[]>()
      for (const componentID of weakComponent) {
        const rank = required(analysis.ranks[componentID], 'SCC rank')
        const componentIDs = componentIDsByRank.get(rank)
        if (componentIDs === undefined) componentIDsByRank.set(rank, [componentID])
        else componentIDs.push(componentID)
      }
      const layerWidths = new Map<number, number>()
      for (const [rank, componentIDs] of componentIDsByRank) {
        layerWidths.set(rank, this.layerWidth(componentIDs, geometries))
      }
      const weakComponentWidth = maximum(layerWidths.values())
      for (const rank of [...componentIDsByRank.keys()].sort((first, second) => first - second)) {
        const componentIDs = componentIDsByRank.get(rank) ?? []
        const width = layerWidths.get(rank) ?? 0
        let componentX = weakComponentX + (weakComponentWidth - width) / 2
        for (const componentID of componentIDs) {
          const geometry = required(geometries[componentID], 'SCC geometry')
          const componentY = required(rankOrigins[rank], 'SCC layer origin')
          for (const entry of geometry.frames) {
            const offset = input.placementOffset(entry.nodeID) ?? { width: 0, height: 0 }
            frames.set(
              entry.nodeID,
              offsetRect(entry.frame, componentX + offset.width, componentY + offset.height),
            )
          }
          componentX += geometry.size.width + this.configuration.horizontalComponentSpacing
        }
      }
      weakComponentX += weakComponentWidth + this.configuration.weakComponentSpacing
    }
    const measuredWidth =
      weakComponentX -
      this.configuration.weakComponentSpacing +
      this.configuration.canvasInsets.trailing
    const lastRank = maximum(analysis.ranks)
    const lastRankHeight = maximum(
      geometries.flatMap((geometry, componentID) =>
        analysis.ranks[componentID] === lastRank ? [geometry.size.height] : [],
      ),
    )
    const measuredHeight =
      required(rankOrigins[lastRank], 'last SCC rank origin') +
      lastRankHeight +
      this.configuration.canvasInsets.bottom
    const minimumBounds: FdCanvasRect = {
      x: 0,
      y: 0,
      width: Math.max(measuredWidth, this.configuration.minimumCanvasSize.width),
      height: Math.max(measuredHeight, this.configuration.minimumCanvasSize.height),
    }
    const contentBounds = [...frames.values()].reduce(unionRects, minimumBounds)
    return new FdGraphNodePlacement(
      input,
      input.topology.nodeIDs.map((nodeID) => ({
        nodeID,
        frame: required(frames.get(nodeID), 'SCC node frame'),
      })),
      contentBounds,
    )
  }

  private layerOrigins(
    analysis: SCCAnalysis<NodeID>,
    geometries: readonly SCCGeometry<NodeID>[],
  ): number[] {
    const heights = new Map<number, number>()
    for (let componentID = 0; componentID < analysis.components.length; componentID += 1) {
      const rank = required(analysis.ranks[componentID], 'SCC component rank')
      const geometry = required(geometries[componentID], 'SCC component geometry')
      heights.set(rank, Math.max(heights.get(rank) ?? 0, geometry.size.height))
    }
    const origins: number[] = []
    let y = this.configuration.canvasInsets.top
    for (const rank of [...heights.keys()].sort((first, second) => first - second)) {
      if (rank !== origins.length) throw new Error('SCC ranks must be contiguous')
      origins.push(y)
      y += (heights.get(rank) ?? 0) + this.configuration.verticalLayerSpacing
    }
    return origins
  }

  private layerWidth(
    componentIDs: readonly number[],
    geometries: readonly SCCGeometry<NodeID>[],
  ): number {
    return (
      componentIDs.reduce(
        (sum, componentID) => sum + required(geometries[componentID], 'SCC geometry').size.width,
        0,
      ) +
      Math.max(componentIDs.length - 1, 0) * this.configuration.horizontalComponentSpacing
    )
  }

  private componentGeometry(
    nodeIDs: readonly NodeID[],
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
  ): SCCGeometry<NodeID> {
    const first = required(nodeIDs[0], 'SCC component node')
    if (nodeIDs.length === 1) {
      const size = required(input.size(first), 'SCC node size')
      return { frames: [{ nodeID: first, frame: { x: 0, y: 0, ...size } }], size }
    }
    const maximumDiameter = maximum(
      nodeIDs.map((nodeID) => {
        const size = required(input.size(nodeID), 'SCC node size')
        return Math.hypot(size.width, size.height)
      }),
    )
    const radius =
      nodeIDs.length === 2
        ? (maximumDiameter + this.configuration.cyclicNodeSpacing) / 2
        : (maximumDiameter + this.configuration.cyclicNodeSpacing) /
          (2 * Math.sin(Math.PI / nodeIDs.length))
    let bounds: FdCanvasRect | undefined
    const frames = nodeIDs.map((nodeID, index): FdGraphNodeFrame<NodeID> => {
      const angle =
        nodeIDs.length === 2
          ? index * Math.PI
          : -Math.PI / 2 + (index * 2 * Math.PI) / nodeIDs.length
      const size = required(input.size(nodeID), 'SCC node size')
      const center = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
      const frame = {
        x: center.x - size.width / 2,
        y: center.y - size.height / 2,
        ...size,
      }
      bounds = bounds === undefined ? frame : unionRects(bounds, frame)
      return { nodeID, frame }
    })
    const resolvedBounds = required(bounds, 'SCC component bounds')
    const dx = this.configuration.cyclicComponentPadding - resolvedBounds.x
    const dy = this.configuration.cyclicComponentPadding - resolvedBounds.y
    return {
      frames: frames.map(({ nodeID, frame }) => ({ nodeID, frame: offsetRect(frame, dx, dy) })),
      size: {
        width: resolvedBounds.width + 2 * this.configuration.cyclicComponentPadding,
        height: resolvedBounds.height + 2 * this.configuration.cyclicComponentPadding,
      },
    }
  }
}

export class FdSCCLayeredLayout<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> implements FdGraphLayoutStrategy<NodeID, PortID, EdgeID>
{
  readonly #pipeline: FdGraphLayoutPipeline<NodeID, PortID, EdgeID>

  constructor(configuration: FdSCCLayeredLayoutConfiguration)
  constructor(
    placement: FdSCCLayeredPlacement<NodeID, PortID, EdgeID>,
    edgeRouter: FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
  )
  constructor(
    placement: FdSCCLayeredPlacement<NodeID, PortID, EdgeID>,
    postprocessors: readonly FdGraphLayoutPostprocessor<NodeID, PortID, EdgeID>[],
    edgeRouter: FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
  )
  constructor(
    configurationOrPlacement:
      | FdSCCLayeredLayoutConfiguration
      | FdSCCLayeredPlacement<NodeID, PortID, EdgeID>,
    postprocessorsOrRouter?:
      | readonly FdGraphLayoutPostprocessor<NodeID, PortID, EdgeID>[]
      | FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
    edgeRouter?: FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
  ) {
    if (configurationOrPlacement instanceof FdSCCLayeredLayoutConfiguration) {
      this.#pipeline = new FdGraphLayoutPipeline(
        new FdSCCLayeredPlacement(configurationOrPlacement),
        new FdCubicEdgeRouter(),
      )
      return
    }
    if (postprocessorsOrRouter === undefined) {
      throw new TypeError('SCC layered layout requires an edge router')
    }
    if (Array.isArray(postprocessorsOrRouter)) {
      if (edgeRouter === undefined)
        throw new TypeError('SCC layered layout requires an edge router')
      this.#pipeline = new FdGraphLayoutPipeline(
        configurationOrPlacement,
        postprocessorsOrRouter,
        edgeRouter,
      )
    } else {
      this.#pipeline = new FdGraphLayoutPipeline(
        configurationOrPlacement,
        postprocessorsOrRouter as FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
      )
    }
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

interface SCCAnalysis<NodeID> {
  readonly components: readonly (readonly NodeID[])[]
  readonly ranks: readonly number[]
  readonly weakComponents: readonly (readonly number[])[]
}

interface SCCGeometry<NodeID extends FdGraphElementID> {
  readonly frames: readonly FdGraphNodeFrame<NodeID>[]
  readonly size: FdCanvasSize
}

const analyze = <
  NodeID extends FdGraphElementID,
  PortID extends FdGraphElementID,
  EdgeID extends FdGraphElementID,
>(
  input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
): SCCAnalysis<NodeID> => {
  const graph = materializedGraph(input.topology)
  const components = graph.stronglyConnectedComponents()
  const componentByNodeID = new Map<NodeID, number>()
  components.forEach((nodeIDs, componentID) => {
    for (const nodeID of nodeIDs) componentByNodeID.set(nodeID, componentID)
  })
  const successors = components.map((): number[] => [])
  const indegrees = components.map(() => 0)
  const knownArcs = new Set<string>()
  for (const edge of input.topology.edges) {
    if (edge.endpoints.kind !== 'directed') continue
    const sourceID = required(
      componentByNodeID.get(input.topology.nodeID(edge.endpoints.source)),
      'SCC source component',
    )
    const targetID = required(
      componentByNodeID.get(input.topology.nodeID(edge.endpoints.target)),
      'SCC target component',
    )
    if (sourceID === targetID) continue
    const arc = `${sourceID}:${targetID}`
    if (knownArcs.has(arc)) continue
    knownArcs.add(arc)
    required(successors[sourceID], 'SCC successors').push(targetID)
    indegrees[targetID] = required(indegrees[targetID], 'SCC indegree') + 1
  }
  const ranks = components.map(() => 0)
  const queue = components.flatMap((_, componentID) =>
    indegrees[componentID] === 0 ? [componentID] : [],
  )
  for (let index = 0; index < queue.length; index += 1) {
    const sourceID = required(queue[index], 'SCC queue entry')
    for (const targetID of required(successors[sourceID], 'SCC successors')) {
      ranks[targetID] = Math.max(
        required(ranks[targetID], 'SCC target rank'),
        required(ranks[sourceID], 'SCC source rank') + 1,
      )
      indegrees[targetID] = required(indegrees[targetID], 'SCC indegree') - 1
      if (indegrees[targetID] === 0) queue.push(targetID)
    }
  }
  if (queue.length !== components.length) throw new Error('SCC condensation must be acyclic')
  const weakComponents = input.topology.weaklyConnectedComponents().map((nodeIDs) => {
    const seen = new Set<number>()
    return nodeIDs
      .flatMap((nodeID) => {
        const componentID = required(componentByNodeID.get(nodeID), 'weak SCC component')
        if (seen.has(componentID)) return []
        seen.add(componentID)
        return [componentID]
      })
      .sort((first, second) => {
        const rankDifference =
          required(ranks[first], 'first SCC rank') - required(ranks[second], 'second SCC rank')
        return rankDifference === 0 ? first - second : rankDifference
      })
  })
  return { components, ranks, weakComponents }
}

const offsetRect = (rect: FdCanvasRect, dx: number, dy: number): FdCanvasRect => ({
  ...rect,
  x: rect.x + dx,
  y: rect.y + dy,
})

const unionRects = (first: FdCanvasRect, second: FdCanvasRect): FdCanvasRect => {
  const x = Math.min(first.x, second.x)
  const y = Math.min(first.y, second.y)
  const maximumX = Math.max(first.x + first.width, second.x + second.width)
  const maximumY = Math.max(first.y + first.height, second.y + second.height)
  return { x, y, width: maximumX - x, height: maximumY - y }
}

const maximum = (values: Iterable<number>): number => {
  let result = 0
  for (const value of values) result = Math.max(result, value)
  return result
}

const required = <Value>(value: Value | undefined, name: string): Value => {
  if (value === undefined) throw new Error(`${name} invariant failed`)
  return value
}
