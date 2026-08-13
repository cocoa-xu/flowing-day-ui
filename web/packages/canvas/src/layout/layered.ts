import type { FdGraphElementID } from '../graph/model.js'
import {
  type FdGraphLayoutDAGView,
  type FdGraphLayoutInput,
  FdLayoutComponentIdentity,
} from './model.js'

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
