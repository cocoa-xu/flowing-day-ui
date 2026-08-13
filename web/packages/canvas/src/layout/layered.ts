import type { FdCanvasRect, FdCanvasSize } from '../geometry.js'
import { unionCanvasRects } from '../geometry.js'
import type { FdGraphElementID } from '../graph/model.js'
import {
  type FdGraphLayoutDAGView,
  type FdGraphLayoutInput,
  FdLayoutComponentIdentity,
  FdLayoutPipelineIdentity,
  FdLayoutPipelineStageRole,
} from './model.js'
import { FdGraphNodePlacement, type FdGraphNodePlacementStrategy } from './pipeline.js'

export type FdLayerAssignmentIssueKind =
  | 'duplicateNode'
  | 'missingNode'
  | 'unknownNode'
  | 'negativeRank'

export class FdLayerAssignmentIssue<
  NodeID extends FdGraphElementID = FdGraphElementID,
> extends Error {
  readonly kind: FdLayerAssignmentIssueKind
  readonly nodeID: NodeID

  constructor(kind: FdLayerAssignmentIssueKind, nodeID: NodeID) {
    super(kind)
    this.name = 'FdLayerAssignmentIssue'
    this.kind = kind
    this.nodeID = nodeID
  }
}

export interface FdLayerRank<NodeID extends FdGraphElementID = FdGraphElementID> {
  readonly nodeID: NodeID
  readonly rank: number
}

export class FdLayerAssignment<NodeID extends FdGraphElementID = FdGraphElementID> {
  readonly ranks: ReadonlyMap<NodeID, number>

  constructor(
    input: FdGraphLayoutInput<NodeID, FdGraphElementID, FdGraphElementID>,
    ranks: readonly FdLayerRank<NodeID>[],
  ) {
    const knownNodeIDs = new Set(input.topology.nodeIDs)
    const nextRanks = new Map<NodeID, number>()
    for (const entry of ranks) {
      if (!knownNodeIDs.has(entry.nodeID)) {
        throw new FdLayerAssignmentIssue('unknownNode', entry.nodeID)
      }
      if (!Number.isSafeInteger(entry.rank) || entry.rank < 0) {
        throw new FdLayerAssignmentIssue('negativeRank', entry.nodeID)
      }
      if (nextRanks.has(entry.nodeID)) {
        throw new FdLayerAssignmentIssue('duplicateNode', entry.nodeID)
      }
      nextRanks.set(entry.nodeID, entry.rank)
    }
    for (const nodeID of input.topology.nodeIDs) {
      if (!nextRanks.has(nodeID)) throw new FdLayerAssignmentIssue('missingNode', nodeID)
    }
    this.ranks = nextRanks
  }

  rank(nodeID: NodeID): number | undefined {
    return this.ranks.get(nodeID)
  }
}

export interface FdLayerAssignmentStrategy<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly identity: FdLayoutComponentIdentity
  assignLayers(view: FdGraphLayoutDAGView<NodeID, PortID, EdgeID>): FdLayerAssignment<NodeID>
}

export class FdLongestPathLayerAssignment<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> implements FdLayerAssignmentStrategy<NodeID, PortID, EdgeID>
{
  readonly identity: FdLayoutComponentIdentity

  constructor(identity = new FdLayoutComponentIdentity()) {
    this.identity = identity
  }

  assignLayers(view: FdGraphLayoutDAGView<NodeID, PortID, EdgeID>): FdLayerAssignment<NodeID> {
    const ranks = new Map(view.input.topology.nodeIDs.map((nodeID) => [nodeID, 0]))
    for (const sourceID of view.topologicalNodeIDs) {
      for (const targetID of view.input.topology.directedSuccessorNodeIDs(sourceID)) {
        ranks.set(
          targetID,
          Math.max(resolvedRank(ranks, targetID), resolvedRank(ranks, sourceID) + 1),
        )
      }
    }
    return new FdLayerAssignment(
      view.input,
      view.input.topology.nodeIDs.map((nodeID) => ({ nodeID, rank: resolvedRank(ranks, nodeID) })),
    )
  }
}

export class FdLayer<NodeID extends FdGraphElementID = FdGraphElementID> {
  readonly rank: number
  readonly nodeIDs: readonly NodeID[]

  constructor(rank: number, nodeIDs: readonly NodeID[]) {
    this.rank = rank
    this.nodeIDs = nodeIDs
  }
}

export class FdLayeredComponent<NodeID extends FdGraphElementID = FdGraphElementID> {
  readonly layers: readonly FdLayer<NodeID>[]

  constructor(layers: readonly FdLayer<NodeID>[]) {
    this.layers = layers
  }
}

export type FdLayerOrderingIssueKind =
  | 'emptyComponent'
  | 'emptyLayer'
  | 'duplicateNode'
  | 'missingNode'
  | 'unknownNode'
  | 'rankMismatch'
  | 'duplicateRankInComponent'

export class FdLayerOrderingIssue<
  NodeID extends FdGraphElementID = FdGraphElementID,
> extends Error {
  readonly kind: FdLayerOrderingIssueKind
  readonly nodeID: NodeID | undefined
  readonly rank: number | undefined

  constructor(kind: FdLayerOrderingIssueKind, details: { nodeID?: NodeID; rank?: number } = {}) {
    super(kind)
    this.name = 'FdLayerOrderingIssue'
    this.kind = kind
    this.nodeID = details.nodeID
    this.rank = details.rank
  }
}

export class FdLayerOrdering<NodeID extends FdGraphElementID = FdGraphElementID> {
  readonly components: readonly FdLayeredComponent<NodeID>[]

  constructor(
    input: FdGraphLayoutInput<NodeID, FdGraphElementID, FdGraphElementID>,
    assignment: FdLayerAssignment<NodeID>,
    components: readonly FdLayeredComponent<NodeID>[],
  ) {
    const knownNodeIDs = new Set(input.topology.nodeIDs)
    const includedNodeIDs = new Set<NodeID>()
    const normalizedComponents: FdLayeredComponent<NodeID>[] = []
    for (const component of components) {
      if (component.layers.length === 0) throw new FdLayerOrderingIssue('emptyComponent')
      const ranks = new Set<number>()
      for (const layer of component.layers) {
        if (layer.nodeIDs.length === 0) {
          throw new FdLayerOrderingIssue('emptyLayer', { rank: layer.rank })
        }
        if (ranks.has(layer.rank)) {
          throw new FdLayerOrderingIssue('duplicateRankInComponent', { rank: layer.rank })
        }
        ranks.add(layer.rank)
        for (const nodeID of layer.nodeIDs) {
          if (!knownNodeIDs.has(nodeID)) {
            throw new FdLayerOrderingIssue('unknownNode', { nodeID })
          }
          if (assignment.rank(nodeID) !== layer.rank) {
            throw new FdLayerOrderingIssue('rankMismatch', { nodeID })
          }
          if (includedNodeIDs.has(nodeID)) {
            throw new FdLayerOrderingIssue('duplicateNode', { nodeID })
          }
          includedNodeIDs.add(nodeID)
        }
      }
      normalizedComponents.push(
        new FdLayeredComponent([...component.layers].sort((left, right) => left.rank - right.rank)),
      )
    }
    for (const nodeID of input.topology.nodeIDs) {
      if (!includedNodeIDs.has(nodeID)) {
        throw new FdLayerOrderingIssue('missingNode', { nodeID })
      }
    }
    this.components = normalizedComponents
  }
}

export interface FdLayerOrderingStrategy<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly identity: FdLayoutComponentIdentity
  orderLayers(
    view: FdGraphLayoutDAGView<NodeID, PortID, EdgeID>,
    assignment: FdLayerAssignment<NodeID>,
  ): FdLayerOrdering<NodeID>
}

export class FdStableLayerOrdering<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> implements FdLayerOrderingStrategy<NodeID, PortID, EdgeID>
{
  readonly identity: FdLayoutComponentIdentity

  constructor(identity = new FdLayoutComponentIdentity()) {
    this.identity = identity
  }

  orderLayers(
    view: FdGraphLayoutDAGView<NodeID, PortID, EdgeID>,
    assignment: FdLayerAssignment<NodeID>,
  ): FdLayerOrdering<NodeID> {
    const order = new Map(view.input.topology.nodeIDs.map((nodeID, index) => [nodeID, index]))
    const parentOrder = new Map(
      view.input.topology.nodeIDs.map((nodeID) => {
        const parent = view.input.topology
          .directedPredecessorNodeIDs(nodeID)
          .reduce((minimum, parentID) => Math.min(minimum, resolvedRank(order, parentID)), Infinity)
        return [nodeID, parent] as const
      }),
    )
    const components = view.input.topology.weaklyConnectedComponents().map((nodeIDs) => {
      const layers = new Map<number, NodeID[]>()
      for (const nodeID of nodeIDs) {
        const rank = resolvedAssignmentRank(assignment, nodeID)
        const layer = layers.get(rank) ?? []
        layer.push(nodeID)
        layers.set(rank, layer)
      }
      return new FdLayeredComponent(
        [...layers.entries()]
          .sort(([left], [right]) => left - right)
          .map(([rank, layerNodeIDs]) => {
            const orderedNodeIDs = [...layerNodeIDs].sort((left, right) => {
              const parentDifference =
                resolvedRank(parentOrder, left) - resolvedRank(parentOrder, right)
              return parentDifference === 0
                ? resolvedRank(order, left) - resolvedRank(order, right)
                : parentDifference
            })
            return new FdLayer(rank, orderedNodeIDs)
          }),
      )
    })
    return new FdLayerOrdering(view.input, assignment, components)
  }
}

export class FdLayoutInsets {
  readonly top: number
  readonly leading: number
  readonly bottom: number
  readonly trailing: number

  constructor(top: number, leading: number, bottom: number, trailing: number)
  constructor(horizontal: number, vertical: number)
  constructor(first: number, second: number, third?: number, fourth?: number) {
    const values =
      third === undefined || fourth === undefined
        ? { top: second, leading: first, bottom: second, trailing: first }
        : { top: first, leading: second, bottom: third, trailing: fourth }
    validateNonnegativeValues(Object.values(values), 'layout insets')
    this.top = values.top
    this.leading = values.leading
    this.bottom = values.bottom
    this.trailing = values.trailing
  }
}

export type FdLayeredLayoutDirection = 'topToBottom' | 'leftToRight'

export class FdLayeredLayoutConfiguration {
  readonly horizontalNodeSpacing: number
  readonly verticalNodeSpacing: number
  readonly componentSpacing: number
  readonly canvasInsets: FdLayoutInsets
  readonly minimumCanvasSize: FdCanvasSize
  readonly direction: FdLayeredLayoutDirection

  constructor(
    horizontalNodeSpacing: number,
    verticalNodeSpacing: number,
    componentSpacing: number,
    canvasInsets: FdLayoutInsets,
    minimumCanvasSize: FdCanvasSize,
    direction: FdLayeredLayoutDirection = 'topToBottom',
  ) {
    validateNonnegativeValues(
      [
        horizontalNodeSpacing,
        verticalNodeSpacing,
        componentSpacing,
        minimumCanvasSize.width,
        minimumCanvasSize.height,
      ],
      'layered layout configuration',
    )
    this.horizontalNodeSpacing = horizontalNodeSpacing
    this.verticalNodeSpacing = verticalNodeSpacing
    this.componentSpacing = componentSpacing
    this.canvasInsets = canvasInsets
    this.minimumCanvasSize = minimumCanvasSize
    this.direction = direction
  }
}

export interface FdLayerCoordinateAssignmentStrategy<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly identity: FdLayoutComponentIdentity
  place(
    view: FdGraphLayoutDAGView<NodeID, PortID, EdgeID>,
    assignment: FdLayerAssignment<NodeID>,
    ordering: FdLayerOrdering<NodeID>,
  ): FdGraphNodePlacement<NodeID, PortID, EdgeID>
}

export class FdCenteredLayerCoordinates<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> implements FdLayerCoordinateAssignmentStrategy<NodeID, PortID, EdgeID>
{
  readonly identity: FdLayoutComponentIdentity
  readonly configuration: FdLayeredLayoutConfiguration

  constructor(
    configuration: FdLayeredLayoutConfiguration,
    identity = new FdLayoutComponentIdentity(),
  ) {
    this.configuration = configuration
    this.identity = identity
  }

  place(
    view: FdGraphLayoutDAGView<NodeID, PortID, EdgeID>,
    assignment: FdLayerAssignment<NodeID>,
    ordering: FdLayerOrdering<NodeID>,
  ): FdGraphNodePlacement<NodeID, PortID, EdgeID> {
    const input = view.input
    if (input.topology.nodeIDs.length === 0) {
      return new FdGraphNodePlacement(input, [], {
        x: 0,
        y: 0,
        ...this.configuration.minimumCanvasSize,
      })
    }

    const rankPrimarySizes = new Map<number, number>()
    for (const nodeID of input.topology.nodeIDs) {
      const rank = resolvedAssignmentRank(assignment, nodeID)
      rankPrimarySizes.set(
        rank,
        Math.max(rankPrimarySizes.get(rank) ?? 0, this.primarySize(resolvedSize(input, nodeID))),
      )
    }
    const occupiedRanks = [...rankPrimarySizes.keys()].sort((left, right) => left - right)
    const rankPrimaryOrigins = new Map<number, number>()
    let precedingPrimarySizes = 0
    for (const rank of occupiedRanks) {
      rankPrimaryOrigins.set(
        rank,
        this.primaryLeadingInset + rank * this.primarySpacing + precedingPrimarySizes,
      )
      precedingPrimarySizes += resolvedRank(rankPrimarySizes, rank)
    }

    const frameByNodeID = new Map<NodeID, FdCanvasRect>()
    let componentCrossOrigin = this.crossLeadingInset
    for (const component of ordering.components) {
      const componentCrossSize = component.layers.reduce(
        (maximum, layer) => Math.max(maximum, this.layerCrossSize(layer.nodeIDs, input)),
        0,
      )
      for (let index = component.layers.length - 1; index >= 0; index -= 1) {
        const layer = component.layers[index]
        if (!layer) continue
        const centers = this.layerCrossCenters(
          layer.nodeIDs,
          componentCrossOrigin,
          componentCrossSize,
          input,
          frameByNodeID,
        )
        for (const [nodeIndex, nodeID] of layer.nodeIDs.entries()) {
          const size = resolvedSize(input, nodeID)
          const offset = resolvedPlacementOffset(input, nodeID)
          frameByNodeID.set(
            nodeID,
            this.frame(
              resolvedArrayValue(centers, nodeIndex) - this.crossSize(size) / 2,
              resolvedRank(rankPrimaryOrigins, layer.rank) +
                (resolvedRank(rankPrimarySizes, layer.rank) - this.primarySize(size)) / 2,
              size,
              offset,
            ),
          )
        }
      }
      componentCrossOrigin += componentCrossSize + this.configuration.componentSpacing
    }

    const measuredCrossSize =
      componentCrossOrigin - this.configuration.componentSpacing + this.crossTrailingInset
    const lastRank = resolvedArrayValue(occupiedRanks, occupiedRanks.length - 1)
    const measuredPrimarySize =
      resolvedRank(rankPrimaryOrigins, lastRank) +
      resolvedRank(rankPrimarySizes, lastRank) +
      this.primaryTrailingInset
    const measuredSize = this.canvasSize(measuredPrimarySize, measuredCrossSize)
    let contentBounds: FdCanvasRect = {
      x: 0,
      y: 0,
      width: Math.max(measuredSize.width, this.configuration.minimumCanvasSize.width),
      height: Math.max(measuredSize.height, this.configuration.minimumCanvasSize.height),
    }
    for (const frame of frameByNodeID.values())
      contentBounds = unionCanvasRects(contentBounds, frame)
    return new FdGraphNodePlacement(
      input,
      input.topology.nodeIDs.map((nodeID) => ({
        nodeID,
        frame: resolvedFrame(frameByNodeID, nodeID),
      })),
      contentBounds,
    )
  }

  private layerCrossSize(
    nodeIDs: readonly NodeID[],
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
  ): number {
    if (nodeIDs.length === 0) return 0
    return (
      nodeIDs.reduce((total, nodeID) => total + this.crossSize(resolvedSize(input, nodeID)), 0) +
      (nodeIDs.length - 1) * this.crossSpacing
    )
  }

  private layerCrossCenters(
    nodeIDs: readonly NodeID[],
    componentCrossOrigin: number,
    componentCrossSize: number,
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
    frames: ReadonlyMap<NodeID, FdCanvasRect>,
  ): readonly number[] {
    if (nodeIDs.length === 0) return []
    const occupiedCrossSize = this.layerCrossSize(nodeIDs, input)
    let cursor = componentCrossOrigin + (componentCrossSize - occupiedCrossSize) / 2
    const defaultCenters = nodeIDs.map((nodeID) => {
      const size = this.crossSize(resolvedSize(input, nodeID))
      const center = cursor + size / 2
      cursor += size + this.crossSpacing
      return center
    })
    let centers = nodeIDs.map((nodeID, index) => {
      const childCenters = input.topology.directedSuccessorNodeIDs(nodeID).flatMap((childID) => {
        const frame = frames.get(childID)
        return frame ? [this.crossMidpoint(frame)] : []
      })
      return childCenters.length === 0
        ? resolvedArrayValue(defaultCenters, index)
        : childCenters.reduce((sum, value) => sum + value, 0) / childCenters.length
    })
    for (let index = 1; index < centers.length; index += 1) {
      const previousSize = this.crossSize(
        resolvedSize(input, resolvedArrayValue(nodeIDs, index - 1)),
      )
      const size = this.crossSize(resolvedSize(input, resolvedArrayValue(nodeIDs, index)))
      const minimum =
        resolvedArrayValue(centers, index - 1) + (previousSize + size) / 2 + this.crossSpacing
      centers[index] = Math.max(resolvedArrayValue(centers, index), minimum)
    }

    const firstSize = this.crossSize(resolvedSize(input, resolvedArrayValue(nodeIDs, 0)))
    const lastSize = this.crossSize(
      resolvedSize(input, resolvedArrayValue(nodeIDs, nodeIDs.length - 1)),
    )
    const minimumCenter = componentCrossOrigin + firstSize / 2
    const maximumCenter = componentCrossOrigin + componentCrossSize - lastSize / 2
    if (resolvedArrayValue(centers, 0) < minimumCenter) {
      const adjustment = minimumCenter - resolvedArrayValue(centers, 0)
      centers = centers.map((center) => center + adjustment)
    }
    if (resolvedArrayValue(centers, centers.length - 1) > maximumCenter) {
      const adjustment = resolvedArrayValue(centers, centers.length - 1) - maximumCenter
      centers = centers.map((center) => center - adjustment)
    }
    return resolvedArrayValue(centers, 0) >= minimumCenter ? centers : defaultCenters
  }

  private get primarySpacing(): number {
    return this.configuration.direction === 'topToBottom'
      ? this.configuration.verticalNodeSpacing
      : this.configuration.horizontalNodeSpacing
  }

  private get crossSpacing(): number {
    return this.configuration.direction === 'topToBottom'
      ? this.configuration.horizontalNodeSpacing
      : this.configuration.verticalNodeSpacing
  }

  private get primaryLeadingInset(): number {
    return this.configuration.direction === 'topToBottom'
      ? this.configuration.canvasInsets.top
      : this.configuration.canvasInsets.leading
  }

  private get primaryTrailingInset(): number {
    return this.configuration.direction === 'topToBottom'
      ? this.configuration.canvasInsets.bottom
      : this.configuration.canvasInsets.trailing
  }

  private get crossLeadingInset(): number {
    return this.configuration.direction === 'topToBottom'
      ? this.configuration.canvasInsets.leading
      : this.configuration.canvasInsets.top
  }

  private get crossTrailingInset(): number {
    return this.configuration.direction === 'topToBottom'
      ? this.configuration.canvasInsets.trailing
      : this.configuration.canvasInsets.bottom
  }

  private primarySize(size: FdCanvasSize): number {
    return this.configuration.direction === 'topToBottom' ? size.height : size.width
  }

  private crossSize(size: FdCanvasSize): number {
    return this.configuration.direction === 'topToBottom' ? size.width : size.height
  }

  private crossMidpoint(frame: FdCanvasRect): number {
    return this.configuration.direction === 'topToBottom'
      ? frame.x + frame.width / 2
      : frame.y + frame.height / 2
  }

  private frame(
    crossOrigin: number,
    primaryOrigin: number,
    size: FdCanvasSize,
    offset: FdCanvasSize,
  ): FdCanvasRect {
    return this.configuration.direction === 'topToBottom'
      ? {
          x: crossOrigin + offset.width,
          y: primaryOrigin + offset.height,
          ...size,
        }
      : {
          x: primaryOrigin + offset.width,
          y: crossOrigin + offset.height,
          ...size,
        }
  }

  private canvasSize(primary: number, cross: number): FdCanvasSize {
    return this.configuration.direction === 'topToBottom'
      ? { width: cross, height: primary }
      : { width: primary, height: cross }
  }
}

export class FdLayeredDAGPlacement<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> implements FdGraphNodePlacementStrategy<NodeID, PortID, EdgeID>
{
  readonly layerAssignment: FdLayerAssignmentStrategy<NodeID, PortID, EdgeID>
  readonly layerOrdering: FdLayerOrderingStrategy<NodeID, PortID, EdgeID>
  readonly coordinateAssignment: FdLayerCoordinateAssignmentStrategy<NodeID, PortID, EdgeID>

  constructor(
    layerAssignment: FdLayerAssignmentStrategy<NodeID, PortID, EdgeID>,
    layerOrdering: FdLayerOrderingStrategy<NodeID, PortID, EdgeID>,
    coordinateAssignment: FdLayerCoordinateAssignmentStrategy<NodeID, PortID, EdgeID>,
  ) {
    this.layerAssignment = layerAssignment
    this.layerOrdering = layerOrdering
    this.coordinateAssignment = coordinateAssignment
  }

  get identity(): FdLayoutPipelineIdentity {
    return new FdLayoutPipelineIdentity([
      {
        kind: 'component',
        role: FdLayoutPipelineStageRole.layerAssignment,
        identity: this.layerAssignment.identity,
      },
      {
        kind: 'component',
        role: FdLayoutPipelineStageRole.layerOrdering,
        identity: this.layerOrdering.identity,
      },
      {
        kind: 'component',
        role: FdLayoutPipelineStageRole.coordinateAssignment,
        identity: this.coordinateAssignment.identity,
      },
    ])
  }

  place(
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
  ): FdGraphNodePlacement<NodeID, PortID, EdgeID> {
    const validation = input.validateDAG()
    if (validation.kind === 'invalid') throw validation.issue
    const assignment = this.layerAssignment.assignLayers(validation.view)
    const ordering = this.layerOrdering.orderLayers(validation.view, assignment)
    return this.coordinateAssignment.place(validation.view, assignment, ordering)
  }
}

const resolvedAssignmentRank = <NodeID extends FdGraphElementID>(
  assignment: FdLayerAssignment<NodeID>,
  nodeID: NodeID,
): number => {
  const rank = assignment.rank(nodeID)
  if (rank === undefined) throw new Error('layer assignment invariant failed')
  return rank
}

const resolvedRank = <Key>(ranks: ReadonlyMap<Key, number>, key: Key): number => {
  const rank = ranks.get(key)
  if (rank === undefined) throw new Error('layered layout invariant failed')
  return rank
}

const resolvedSize = <
  NodeID extends FdGraphElementID,
  PortID extends FdGraphElementID,
  EdgeID extends FdGraphElementID,
>(
  input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
  nodeID: NodeID,
): FdCanvasSize => {
  const size = input.size(nodeID)
  if (!size) throw new Error('layered layout size invariant failed')
  return size
}

const resolvedPlacementOffset = <
  NodeID extends FdGraphElementID,
  PortID extends FdGraphElementID,
  EdgeID extends FdGraphElementID,
>(
  input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
  nodeID: NodeID,
): FdCanvasSize => {
  const offset = input.placementOffset(nodeID)
  if (!offset) throw new Error('layered layout placement invariant failed')
  return offset
}

const resolvedFrame = <NodeID extends FdGraphElementID>(
  frames: ReadonlyMap<NodeID, FdCanvasRect>,
  nodeID: NodeID,
): FdCanvasRect => {
  const frame = frames.get(nodeID)
  if (!frame) throw new Error('layered layout frame invariant failed')
  return frame
}

const resolvedArrayValue = <Value>(values: readonly Value[], index: number): Value => {
  const value = values[index]
  if (value === undefined) throw new Error('layered layout array invariant failed')
  return value
}

const validateNonnegativeValues = (values: readonly number[], name: string): void => {
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError(`${name} values must be finite and nonnegative`)
  }
}
