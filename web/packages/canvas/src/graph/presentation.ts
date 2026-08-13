import type { FdGraphElementID } from './model.js'
import { graphElementIDFromKey, graphElementKey } from './model.js'

export type FdGraphLocalElementID<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> =
  | { readonly kind: 'node'; readonly nodeID: NodeID }
  | {
      readonly kind: 'port'
      readonly key: { readonly nodeID: NodeID; readonly portID: PortID }
    }
  | { readonly kind: 'edge'; readonly edgeID: EdgeID }

export class FdGraphDefinitionNodeAddress<
  GraphID extends FdGraphElementID = FdGraphElementID,
  NodeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly graphID: GraphID
  readonly nodeID: NodeID

  constructor(graphID: GraphID, nodeID: NodeID) {
    this.graphID = graphID
    this.nodeID = nodeID
  }
}

export class FdGraphInstancePath<
  GraphID extends FdGraphElementID = FdGraphElementID,
  NodeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly components: readonly FdGraphDefinitionNodeAddress<GraphID, NodeID>[]

  constructor(components: readonly FdGraphDefinitionNodeAddress<GraphID, NodeID>[]) {
    this.components = components
  }

  static get root(): FdGraphInstancePath {
    return new FdGraphInstancePath([])
  }
}

export class FdGraphElementAddress<
  GraphID extends FdGraphElementID = FdGraphElementID,
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly instancePath: FdGraphInstancePath<GraphID, NodeID>
  readonly graphID: GraphID
  readonly elementID: FdGraphLocalElementID<NodeID, PortID, EdgeID>

  constructor(options: {
    readonly instancePath: FdGraphInstancePath<GraphID, NodeID>
    readonly graphID: GraphID
    readonly elementID: FdGraphLocalElementID<NodeID, PortID, EdgeID>
  }) {
    this.instancePath = options.instancePath
    this.graphID = options.graphID
    this.elementID = options.elementID
  }
}

export class FdGraphInstanceAddress<
  GraphID extends FdGraphElementID = FdGraphElementID,
  NodeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly path: FdGraphInstancePath<GraphID, NodeID>
  readonly graphID: GraphID

  constructor(path: FdGraphInstancePath<GraphID, NodeID>, graphID: GraphID) {
    this.path = path
    this.graphID = graphID
  }
}

export class FdGraphInstanceNodeAddress<
  GraphID extends FdGraphElementID = FdGraphElementID,
  NodeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly instance: FdGraphInstanceAddress<GraphID, NodeID>
  readonly nodeID: NodeID

  constructor(instance: FdGraphInstanceAddress<GraphID, NodeID>, nodeID: NodeID) {
    this.instance = instance
    this.nodeID = nodeID
  }
}

export class FdGraphInstanceHandle {
  readonly rawValue: number

  constructor(rawValue: number) {
    if (!Number.isSafeInteger(rawValue)) {
      throw new RangeError('instance handle must be a safe integer')
    }
    this.rawValue = rawValue
  }
}

declare const localElementIDBrand: unique symbol
export type FdGraphPresentationLocalElementID = string & {
  readonly [localElementIDBrand]: true
}

interface FdGraphPresentationSourceLocalElementID {
  readonly kind: 'source'
  readonly instanceHandle: FdGraphInstanceHandle
  readonly elementID: FdGraphLocalElementID
  readonly occurrenceID: FdGraphElementID | undefined
}

interface FdGraphPresentationContextLocalElementID {
  readonly kind: 'subgraphContext'
  readonly instanceHandle: FdGraphInstanceHandle
  readonly linkID: FdGraphElementID
}

export type FdDecodedGraphPresentationLocalElementID =
  | FdGraphPresentationSourceLocalElementID
  | FdGraphPresentationContextLocalElementID

export const FdGraphPresentationLocalElementID = Object.freeze({
  source(options: {
    readonly instanceHandle: FdGraphInstanceHandle
    readonly elementID: FdGraphLocalElementID
    readonly occurrenceID?: FdGraphElementID
  }): FdGraphPresentationLocalElementID {
    return JSON.stringify([
      'source',
      options.instanceHandle.rawValue,
      encodeLocalElementID(options.elementID),
      options.occurrenceID === undefined ? null : graphElementKey(options.occurrenceID),
    ]) as FdGraphPresentationLocalElementID
  },

  subgraphContext(options: {
    readonly instanceHandle: FdGraphInstanceHandle
    readonly linkID: FdGraphElementID
  }): FdGraphPresentationLocalElementID {
    return JSON.stringify([
      'subgraphContext',
      options.instanceHandle.rawValue,
      graphElementKey(options.linkID),
    ]) as FdGraphPresentationLocalElementID
  },

  decode(localID: FdGraphPresentationLocalElementID): FdDecodedGraphPresentationLocalElementID {
    const value: unknown = JSON.parse(localID)
    if (!Array.isArray(value) || !Number.isSafeInteger(value[1])) {
      throw new TypeError('invalid presentation local element ID')
    }
    if (value[0] === 'source' && value.length === 4) {
      const occurrenceID = value[3] === null ? undefined : decodeElementKey(value[3])
      return {
        kind: 'source',
        instanceHandle: new FdGraphInstanceHandle(value[1] as number),
        elementID: decodeLocalElementID(value[2]),
        occurrenceID,
      }
    }
    if (value[0] === 'subgraphContext' && value.length === 3) {
      return {
        kind: 'subgraphContext',
        instanceHandle: new FdGraphInstanceHandle(value[1] as number),
        linkID: decodeElementKey(value[2]),
      }
    }
    throw new TypeError('invalid presentation local element ID')
  },
})

export interface FdGraphPresentationInstance<
  GraphID extends FdGraphElementID = FdGraphElementID,
  NodeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly handle: FdGraphInstanceHandle
  readonly address: FdGraphInstanceAddress<GraphID, NodeID>
  readonly parentSite?: FdGraphInstanceNodeAddress<GraphID, NodeID>
  readonly parentInstanceHandle?: FdGraphInstanceHandle
  readonly depth: number
}

export interface FdGraphPresentationNode<
  ElementID extends FdGraphElementID = FdGraphElementID,
  NodeValue = unknown,
> {
  readonly id: ElementID
  readonly localID: FdGraphPresentationLocalElementID
  readonly address: FdGraphElementAddress
  readonly value: NodeValue
}

export interface FdGraphPresentationPort<
  ElementID extends FdGraphElementID = FdGraphElementID,
  PortValue = unknown,
> {
  readonly id: ElementID
  readonly localID: FdGraphPresentationLocalElementID
  readonly address: FdGraphElementAddress
  readonly value: PortValue
}

export type FdGraphPresentationEndpoint<ElementID extends FdGraphElementID = FdGraphElementID> =
  | { readonly kind: 'node'; readonly id: ElementID }
  | { readonly kind: 'port'; readonly id: ElementID }

export type FdGraphPresentationEdgeEndpoints<
  ElementID extends FdGraphElementID = FdGraphElementID,
> =
  | {
      readonly kind: 'directed'
      readonly source: FdGraphPresentationEndpoint<ElementID>
      readonly target: FdGraphPresentationEndpoint<ElementID>
    }
  | {
      readonly kind: 'undirected'
      readonly first: FdGraphPresentationEndpoint<ElementID>
      readonly second: FdGraphPresentationEndpoint<ElementID>
    }

export interface FdGraphPresentationEdge<
  ElementID extends FdGraphElementID = FdGraphElementID,
  EdgeValue = unknown,
> {
  readonly id: ElementID
  readonly localID: FdGraphPresentationLocalElementID
  readonly address: FdGraphElementAddress
  readonly endpoints: FdGraphPresentationEdgeEndpoints<ElementID>
  readonly value: EdgeValue
}

export type FdGraphProjectionBudgetDimension =
  | 'instances'
  | 'depth'
  | 'nodes'
  | 'ports'
  | 'edges'
  | 'expansionWork'

export type FdGraphSubgraphBoundaryReason<GraphID extends FdGraphElementID = FdGraphElementID> =
  | { readonly kind: 'collapsed' }
  | { readonly kind: 'recursiveReference'; readonly graphID: GraphID }
  | { readonly kind: 'budgetExceeded'; readonly dimension: FdGraphProjectionBudgetDimension }

export type FdGraphSubgraphContextState<
  GraphID extends FdGraphElementID = FdGraphElementID,
  NodeID extends FdGraphElementID = FdGraphElementID,
> =
  | { readonly kind: 'expanded'; readonly instanceAddress: FdGraphInstanceAddress<GraphID, NodeID> }
  | { readonly kind: 'boundary'; readonly reason: FdGraphSubgraphBoundaryReason<GraphID> }

export interface FdGraphPresentationContextEdge<
  ElementID extends FdGraphElementID = FdGraphElementID,
  GraphID extends FdGraphElementID = FdGraphElementID,
  NodeID extends FdGraphElementID = FdGraphElementID,
  LinkID extends FdGraphElementID = FdGraphElementID,
> {
  readonly id: ElementID
  readonly localID: FdGraphPresentationLocalElementID
  readonly linkID: LinkID
  readonly sourceInstanceHandle: FdGraphInstanceHandle
  readonly site: FdGraphInstanceNodeAddress<GraphID, NodeID>
  readonly targetGraphID: GraphID
  readonly targetInstanceHandle?: FdGraphInstanceHandle
  readonly state: FdGraphSubgraphContextState<GraphID, NodeID>
}

export interface FdGraphPresentationOptions<
  ElementID extends FdGraphElementID,
  GraphID extends FdGraphElementID,
  NodeID extends FdGraphElementID,
  LinkID extends FdGraphElementID,
  EntryPointID extends FdGraphElementID,
  NodeValue,
  PortValue,
  EdgeValue,
> {
  readonly snapshotID: string | number
  readonly documentSnapshotID: string | number
  readonly entryPointID: EntryPointID
  readonly focusPath: FdGraphInstancePath<GraphID, NodeID>
  readonly instances: readonly FdGraphPresentationInstance<GraphID, NodeID>[]
  readonly nodes: readonly FdGraphPresentationNode<ElementID, NodeValue>[]
  readonly ports: readonly FdGraphPresentationPort<ElementID, PortValue>[]
  readonly edges: readonly FdGraphPresentationEdge<ElementID, EdgeValue>[]
  readonly contextEdges: readonly FdGraphPresentationContextEdge<
    ElementID,
    GraphID,
    NodeID,
    LinkID
  >[]
}

export class FdGraphPresentation<
  ElementID extends FdGraphElementID = FdGraphElementID,
  GraphID extends FdGraphElementID = FdGraphElementID,
  NodeID extends FdGraphElementID = FdGraphElementID,
  LinkID extends FdGraphElementID = FdGraphElementID,
  EntryPointID extends FdGraphElementID = FdGraphElementID,
  NodeValue = unknown,
  PortValue = unknown,
  EdgeValue = unknown,
> {
  readonly snapshotID: string | number
  readonly documentSnapshotID: string | number
  readonly entryPointID: EntryPointID
  readonly focusPath: FdGraphInstancePath<GraphID, NodeID>
  readonly instances: readonly FdGraphPresentationInstance<GraphID, NodeID>[]
  readonly nodes: readonly FdGraphPresentationNode<ElementID, NodeValue>[]
  readonly ports: readonly FdGraphPresentationPort<ElementID, PortValue>[]
  readonly edges: readonly FdGraphPresentationEdge<ElementID, EdgeValue>[]
  readonly contextEdges: readonly FdGraphPresentationContextEdge<
    ElementID,
    GraphID,
    NodeID,
    LinkID
  >[]

  constructor(
    options: FdGraphPresentationOptions<
      ElementID,
      GraphID,
      NodeID,
      LinkID,
      EntryPointID,
      NodeValue,
      PortValue,
      EdgeValue
    >,
  ) {
    this.snapshotID = options.snapshotID
    this.documentSnapshotID = options.documentSnapshotID
    this.entryPointID = options.entryPointID
    this.focusPath = options.focusPath
    this.instances = options.instances
    this.nodes = options.nodes
    this.ports = options.ports
    this.edges = options.edges
    this.contextEdges = options.contextEdges
  }
}

const encodeLocalElementID = (elementID: FdGraphLocalElementID): readonly unknown[] => {
  switch (elementID.kind) {
    case 'node':
      return ['node', graphElementKey(elementID.nodeID)]
    case 'port':
      return ['port', graphElementKey(elementID.key.nodeID), graphElementKey(elementID.key.portID)]
    case 'edge':
      return ['edge', graphElementKey(elementID.edgeID)]
  }
}

const decodeLocalElementID = (value: unknown): FdGraphLocalElementID => {
  if (!Array.isArray(value)) throw new TypeError('invalid local element ID')
  if (value[0] === 'node' && value.length === 2) {
    return { kind: 'node', nodeID: decodeElementKey(value[1]) }
  }
  if (value[0] === 'port' && value.length === 3) {
    return {
      kind: 'port',
      key: { nodeID: decodeElementKey(value[1]), portID: decodeElementKey(value[2]) },
    }
  }
  if (value[0] === 'edge' && value.length === 2) {
    return { kind: 'edge', edgeID: decodeElementKey(value[1]) }
  }
  throw new TypeError('invalid local element ID')
}

const decodeElementKey = (value: unknown): FdGraphElementID => {
  if (typeof value !== 'string') throw new TypeError('invalid graph element key')
  const id = graphElementIDFromKey(value)
  if (id === undefined) throw new TypeError('invalid graph element key')
  return id
}
