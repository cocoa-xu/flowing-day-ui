import type { FdGraphElementID } from './model.js'
import type { FdGraphElementAddress } from './presentation.js'

export interface FdGraphSchema {
  readonly NodeID: FdGraphElementID
  readonly NodeValue: unknown
  readonly PortID: FdGraphElementID
  readonly PortValue: unknown
  readonly EdgeID: FdGraphElementID
  readonly EdgeValue: unknown
}

export class FdGraphSnapshotID {
  readonly rawValue: string

  constructor(rawValue = globalThis.crypto.randomUUID()) {
    this.rawValue = rawValue
  }
}

export class FdGraphPortKey<Schema extends FdGraphSchema = FdGraphSchema> {
  readonly nodeID: Schema['NodeID']
  readonly portID: Schema['PortID']

  constructor(nodeID: Schema['NodeID'], portID: Schema['PortID']) {
    this.nodeID = nodeID
    this.portID = portID
  }
}

export type FdGraphEndpoint<Schema extends FdGraphSchema = FdGraphSchema> =
  | { readonly kind: 'node'; readonly nodeID: Schema['NodeID'] }
  | { readonly kind: 'port'; readonly key: FdGraphPortKey<Schema> }

export const FdGraphEndpoint = Object.freeze({
  node<Schema extends FdGraphSchema>(nodeID: Schema['NodeID']): FdGraphEndpoint<Schema> {
    return { kind: 'node', nodeID }
  },
  port<Schema extends FdGraphSchema>(key: FdGraphPortKey<Schema>): FdGraphEndpoint<Schema> {
    return { kind: 'port', key }
  },
})

export type FdGraphEdgeEndpoints<Schema extends FdGraphSchema = FdGraphSchema> =
  | {
      readonly kind: 'directed'
      readonly source: FdGraphEndpoint<Schema>
      readonly target: FdGraphEndpoint<Schema>
    }
  | {
      readonly kind: 'undirected'
      readonly first: FdGraphEndpoint<Schema>
      readonly second: FdGraphEndpoint<Schema>
    }

export const FdGraphEdgeEndpoints = Object.freeze({
  directed<Schema extends FdGraphSchema>(
    source: FdGraphEndpoint<Schema>,
    target: FdGraphEndpoint<Schema>,
  ): FdGraphEdgeEndpoints<Schema> {
    return { kind: 'directed', source, target }
  },
  undirected<Schema extends FdGraphSchema>(
    first: FdGraphEndpoint<Schema>,
    second: FdGraphEndpoint<Schema>,
  ): FdGraphEdgeEndpoints<Schema> {
    return { kind: 'undirected', first, second }
  },
  equals<Schema extends FdGraphSchema>(
    first: FdGraphEdgeEndpoints<Schema>,
    second: FdGraphEdgeEndpoints<Schema>,
  ): boolean {
    if (first.kind !== second.kind) return false
    if (first.kind === 'directed' && second.kind === 'directed') {
      return (
        endpointEquals(first.source, second.source) && endpointEquals(first.target, second.target)
      )
    }
    if (first.kind === 'undirected' && second.kind === 'undirected') {
      return (
        (endpointEquals(first.first, second.first) &&
          endpointEquals(first.second, second.second)) ||
        (endpointEquals(first.first, second.second) && endpointEquals(first.second, second.first))
      )
    }
    return false
  },
})

export class FdGraphNode<Schema extends FdGraphSchema = FdGraphSchema> {
  readonly id: Schema['NodeID']
  value: Schema['NodeValue']

  constructor(id: Schema['NodeID'], value: Schema['NodeValue']) {
    this.id = id
    this.value = value
  }
}

export class FdGraphPort<Schema extends FdGraphSchema = FdGraphSchema> {
  readonly key: FdGraphPortKey<Schema>
  value: Schema['PortValue']

  constructor(key: FdGraphPortKey<Schema>, value: Schema['PortValue']) {
    this.key = key
    this.value = value
  }
}

export class FdGraphEdge<Schema extends FdGraphSchema = FdGraphSchema> {
  readonly id: Schema['EdgeID']
  endpoints: FdGraphEdgeEndpoints<Schema>
  value: Schema['EdgeValue']

  constructor(
    id: Schema['EdgeID'],
    endpoints: FdGraphEdgeEndpoints<Schema>,
    value: Schema['EdgeValue'],
  ) {
    this.id = id
    this.endpoints = endpoints
    this.value = value
  }
}

export type FdGraphOrderPosition<ID extends FdGraphElementID = FdGraphElementID> =
  | { readonly kind: 'first' }
  | { readonly kind: 'last' }
  | { readonly kind: 'before'; readonly id: ID }
  | { readonly kind: 'after'; readonly id: ID }

export const FdGraphOrderPosition = Object.freeze({
  first: { kind: 'first' } as const,
  last: { kind: 'last' } as const,
  before<ID extends FdGraphElementID>(id: ID): FdGraphOrderPosition<ID> {
    return { kind: 'before', id }
  },
  after<ID extends FdGraphElementID>(id: ID): FdGraphOrderPosition<ID> {
    return { kind: 'after', id }
  },
})

export type FdPresentationElementID<
  GraphID extends FdGraphElementID = FdGraphElementID,
  Schema extends FdGraphSchema = FdGraphSchema,
  OccurrenceID extends FdGraphElementID = FdGraphElementID,
  SyntheticRole extends FdGraphElementID = FdGraphElementID,
> =
  | {
      readonly kind: 'source'
      readonly address: FdGraphElementAddress<
        GraphID,
        Schema['NodeID'],
        Schema['PortID'],
        Schema['EdgeID']
      >
      readonly occurrenceID?: OccurrenceID
    }
  | {
      readonly kind: 'synthetic'
      readonly role: SyntheticRole
      readonly sourceAddresses: readonly FdGraphElementAddress<
        GraphID,
        Schema['NodeID'],
        Schema['PortID'],
        Schema['EdgeID']
      >[]
      readonly occurrenceID?: OccurrenceID
    }

export const FdPresentationElementID = Object.freeze({
  source<
    GraphID extends FdGraphElementID,
    Schema extends FdGraphSchema,
    OccurrenceID extends FdGraphElementID,
  >(
    address: FdGraphElementAddress<GraphID, Schema['NodeID'], Schema['PortID'], Schema['EdgeID']>,
    occurrenceID?: OccurrenceID,
  ): FdPresentationElementID<GraphID, Schema, OccurrenceID> {
    return { kind: 'source', address, ...(occurrenceID === undefined ? {} : { occurrenceID }) }
  },
  synthetic<
    GraphID extends FdGraphElementID,
    Schema extends FdGraphSchema,
    OccurrenceID extends FdGraphElementID,
    SyntheticRole extends FdGraphElementID,
  >(
    role: SyntheticRole,
    sourceAddresses: readonly FdGraphElementAddress<
      GraphID,
      Schema['NodeID'],
      Schema['PortID'],
      Schema['EdgeID']
    >[],
    occurrenceID?: OccurrenceID,
  ): FdPresentationElementID<GraphID, Schema, OccurrenceID, SyntheticRole> {
    return {
      kind: 'synthetic',
      role,
      sourceAddresses,
      ...(occurrenceID === undefined ? {} : { occurrenceID }),
    }
  },
})

const endpointEquals = <Schema extends FdGraphSchema>(
  first: FdGraphEndpoint<Schema>,
  second: FdGraphEndpoint<Schema>,
): boolean => {
  if (first.kind !== second.kind) return false
  if (first.kind === 'node' && second.kind === 'node') return first.nodeID === second.nodeID
  return (
    first.kind === 'port' &&
    second.kind === 'port' &&
    first.key.nodeID === second.key.nodeID &&
    first.key.portID === second.key.portID
  )
}
