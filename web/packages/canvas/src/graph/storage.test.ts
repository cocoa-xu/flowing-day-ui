import { describe, expect, it } from 'vitest'
import {
  FdGraphEdge,
  FdGraphEdgeEndpoints,
  FdGraphEndpoint,
  FdGraphNode,
  FdGraphOrderPosition,
  FdGraphPort,
  FdGraphPortKey,
  type FdGraphSchema,
} from './core.js'
import { FdGraph, FdGraphRemovalPolicy, type FdGraphUpdateResult } from './storage.js'

interface TestSchema extends FdGraphSchema {
  readonly NodeID: string
  readonly NodeValue: string
  readonly PortID: number
  readonly PortValue: string
  readonly EdgeID: string
  readonly EdgeValue: string
}

const node = (id: string): FdGraphNode<TestSchema> => new FdGraphNode(id, id)
const portKey = (nodeID: string, portID: number): FdGraphPortKey<TestSchema> =>
  new FdGraphPortKey(nodeID, portID)
const port = (nodeID: string, portID: number): FdGraphPort<TestSchema> =>
  new FdGraphPort(portKey(nodeID, portID), `${nodeID}-${portID}`)
const directedEdge = (
  id: string,
  source: ReturnType<typeof FdGraphEndpoint.node<TestSchema>>,
  target: ReturnType<typeof FdGraphEndpoint.node<TestSchema>>,
): FdGraphEdge<TestSchema> => new FdGraphEdge(id, FdGraphEdgeEndpoints.directed(source, target), id)

const committed = (result: FdGraphUpdateResult<TestSchema>) => {
  expect(result.kind).toBe('committed')
  if (result.kind !== 'committed') throw new Error('Expected a committed graph update')
  return result.changeSet
}

describe('Swift-aligned graph storage', () => {
  it('commits nodes, ports, edges, and adjacency in stable order', () => {
    const graph = new FdGraph<TestSchema>()

    committed(
      graph.update((transaction) => {
        transaction.insert(node('source'))
        transaction.insert(node('first'))
        transaction.insert(node('second'))
        transaction.insert(port('source', 1))
        transaction.insert(port('source', 2))
        transaction.insert(
          new FdGraphEdge(
            'a',
            FdGraphEdgeEndpoints.directed(
              FdGraphEndpoint.port(portKey('source', 1)),
              FdGraphEndpoint.node<TestSchema>('first'),
            ),
            'a',
          ),
        )
        transaction.insert(
          directedEdge(
            'b',
            FdGraphEndpoint.node<TestSchema>('source'),
            FdGraphEndpoint.node<TestSchema>('second'),
          ),
        )
      }),
    )

    expect(graph.nodeIDs).toEqual(['source', 'first', 'second'])
    expect(graph.portsForNode('source').map(({ key }) => key.portID)).toEqual([1, 2])
    expect(graph.edgeIDs).toEqual(['a', 'b'])
    expect(graph.outgoingEdgeIDs('source')).toEqual(['a', 'b'])
    expect(graph.incidentEdgeIDs(FdGraphEndpoint.port(portKey('source', 1)))).toEqual(['a'])
  })

  it('rejects the entire transaction when an endpoint is unknown', () => {
    const graph = new FdGraph<TestSchema>()
    const snapshotID = graph.snapshotID

    const result = graph.update((transaction) => {
      transaction.insert(node('source'))
      transaction.insert(
        directedEdge(
          'edge',
          FdGraphEndpoint.node<TestSchema>('source'),
          FdGraphEndpoint.node<TestSchema>('missing'),
        ),
      )
    })

    expect(result).toMatchObject({
      kind: 'rejected',
      issue: { kind: 'unknownEndpoint', endpoint: { kind: 'node', nodeID: 'missing' } },
    })
    expect(graph.isEmpty).toBe(true)
    expect(graph.snapshotID).toBe(snapshotID)
  })

  it('supports strict and cascading removal with atomic rejection', () => {
    const graph = new FdGraph<TestSchema>()
    committed(
      graph.update((transaction) => {
        transaction.insert(node('source'))
        transaction.insert(node('target'))
        transaction.insert(port('source', 1))
        transaction.insert(
          new FdGraphEdge(
            'edge',
            FdGraphEdgeEndpoints.directed(
              FdGraphEndpoint.port(portKey('source', 1)),
              FdGraphEndpoint.node<TestSchema>('target'),
            ),
            'edge',
          ),
        )
      }),
    )

    const rejected = graph.update((transaction) => {
      transaction.removePort(portKey('source', 1), FdGraphRemovalPolicy.strict)
    })
    expect(rejected).toMatchObject({
      kind: 'rejected',
      issue: { kind: 'incidentEdgesPreventRemoval' },
    })
    expect(graph.edge('edge')).toBeDefined()

    committed(
      graph.update((transaction) => {
        transaction.removeNode('source')
      }),
    )
    expect(graph.node('source')).toBeUndefined()
    expect(graph.port(portKey('source', 1))).toBeUndefined()
    expect(graph.edge('edge')).toBeUndefined()
  })

  it('reorders stable identities and records Swift-equivalent order changes', () => {
    const graph = new FdGraph<TestSchema>()
    committed(
      graph.update((transaction) => {
        transaction.insert(node('first'))
        transaction.insert(node('second'))
        transaction.insert(node('third'))
        transaction.insert(port('first', 1))
        transaction.insert(port('first', 2))
        transaction.insert(port('first', 3))
        transaction.insert(
          directedEdge(
            'a',
            FdGraphEndpoint.node<TestSchema>('first'),
            FdGraphEndpoint.node<TestSchema>('second'),
          ),
        )
        transaction.insert(
          directedEdge(
            'b',
            FdGraphEndpoint.node<TestSchema>('first'),
            FdGraphEndpoint.node<TestSchema>('third'),
          ),
        )
      }),
    )

    const changeSet = committed(
      graph.update((transaction) => {
        transaction.moveNode('third', FdGraphOrderPosition.before('second'))
        transaction.movePort(portKey('first', 3), FdGraphOrderPosition.before(2))
        transaction.moveEdge('b', FdGraphOrderPosition.before('a'))
      }),
    )

    expect(graph.nodeIDs).toEqual(['first', 'third', 'second'])
    expect(graph.portsForNode('first').map(({ key }) => key.portID)).toEqual([1, 3, 2])
    expect(graph.outgoingEdgeIDs('first')).toEqual(['b', 'a'])
    expect(changeSet.nodeOrderChanges[0]).toMatchObject({
      id: 'third',
      oldPosition: { kind: 'after', id: 'second' },
      newPosition: { kind: 'after', id: 'first' },
    })
    expect(changeSet.portOrderChanges[0]).toMatchObject({
      id: { nodeID: 'first', portID: 3 },
      oldPosition: { kind: 'after', id: { nodeID: 'first', portID: 2 } },
      newPosition: { kind: 'after', id: { nodeID: 'first', portID: 1 } },
    })
  })

  it('retargets and reorients edges without retaining stale connectivity', () => {
    const graph = new FdGraph<TestSchema>()
    committed(
      graph.update((transaction) => {
        transaction.insert(node('first'))
        transaction.insert(node('second'))
        transaction.insert(node('third'))
        transaction.insert(port('third', 1))
        transaction.insert(
          directedEdge(
            'edge',
            FdGraphEndpoint.node<TestSchema>('first'),
            FdGraphEndpoint.node<TestSchema>('second'),
          ),
        )
      }),
    )

    committed(
      graph.update((transaction) => {
        transaction.update(
          new FdGraphEdge<TestSchema>(
            'edge',
            FdGraphEdgeEndpoints.undirected(
              FdGraphEndpoint.node<TestSchema>('second'),
              FdGraphEndpoint.port(portKey('third', 1)),
            ),
            'edge',
          ),
        )
        transaction.removeNode('first', FdGraphRemovalPolicy.strict)
      }),
    )

    expect(graph.incidentEdgeIDs('first')).toEqual([])
    expect(graph.outgoingEdgeIDs('second')).toEqual(['edge'])
    expect(graph.incomingEdgeIDs('third')).toEqual(['edge'])
    expect(graph.incidentEdgeIDs(FdGraphEndpoint.port(portKey('third', 1)))).toEqual(['edge'])
  })

  it('normalizes insert-then-remove and no-op transactions without advancing identity', () => {
    const graph = new FdGraph<TestSchema>()
    const snapshotID = graph.snapshotID

    const transient = committed(
      graph.update((transaction) => {
        transaction.insert(node('temporary'))
        transaction.removeNode('temporary')
      }),
    )
    const noOp = committed(graph.update(() => {}))

    expect(transient.isEmpty).toBe(true)
    expect(noOp.isEmpty).toBe(true)
    expect(graph.snapshotID).toBe(snapshotID)
    expect(graph.localRevision).toBe(0)
  })

  it('inverts values, ordering, and snapshot identities', () => {
    const graph = new FdGraph<TestSchema>()
    const changeSet = committed(
      graph.update((transaction) => {
        transaction.insert(node('node'))
      }),
    )
    const inverted = changeSet.inverted()

    expect(inverted.oldSnapshotID).toBe(changeSet.newSnapshotID)
    expect(inverted.newSnapshotID).toBe(changeSet.oldSnapshotID)
    expect(inverted.nodeChanges[0]).toMatchObject({
      oldValue: { id: 'node', value: 'node' },
      newValue: undefined,
    })
    expect(inverted.nodeOrderChanges[0]).toMatchObject({
      id: 'node',
      oldPosition: { kind: 'first' },
      newPosition: undefined,
    })
  })
})
