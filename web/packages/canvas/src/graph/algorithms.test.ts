import { describe, expect, it } from 'vitest'
import {
  FdDAGValidationConfiguration,
  FdGraphTraversalDirection,
  FdGraphTraversalPolicy,
} from './algorithms.js'
import {
  FdGraphEdge,
  FdGraphEdgeEndpoints,
  FdGraphEndpoint,
  FdGraphNode,
  FdGraphPort,
  FdGraphPortKey,
  type FdGraphSchema,
} from './core.js'
import { FdGraph, type FdGraphUpdateResult } from './storage.js'

interface TestSchema extends FdGraphSchema {
  readonly NodeID: number
  readonly NodeValue: number
  readonly PortID: number
  readonly PortValue: number
  readonly EdgeID: string
  readonly EdgeValue: string
}

const node = (id: number): FdGraphNode<TestSchema> => new FdGraphNode(id, id)
const portKey = (nodeID: number, portID: number): FdGraphPortKey<TestSchema> =>
  new FdGraphPortKey(nodeID, portID)
const edge = (
  id: string,
  source: ReturnType<typeof FdGraphEndpoint.node<TestSchema>>,
  target: ReturnType<typeof FdGraphEndpoint.node<TestSchema>>,
): FdGraphEdge<TestSchema> => new FdGraphEdge(id, FdGraphEdgeEndpoints.directed(source, target), id)
const undirectedEdge = (id: string, first: number, second: number): FdGraphEdge<TestSchema> =>
  new FdGraphEdge(
    id,
    FdGraphEdgeEndpoints.undirected(
      FdGraphEndpoint.node<TestSchema>(first),
      FdGraphEndpoint.node<TestSchema>(second),
    ),
    id,
  )

const commit = (result: FdGraphUpdateResult<TestSchema>): void => {
  if (result.kind !== 'committed') throw new Error(`Graph update rejected: ${result.issue.kind}`)
}

describe('Swift-aligned graph algorithms', () => {
  it('respects traversal direction and undirected policy', () => {
    const graph = new FdGraph<TestSchema>()
    commit(
      graph.update((transaction) => {
        for (const id of [1, 2, 3, 4]) transaction.insert(node(id))
        transaction.insert(edge('a', FdGraphEndpoint.node(1), FdGraphEndpoint.node(2)))
        transaction.insert(edge('b', FdGraphEndpoint.node(2), FdGraphEndpoint.node(3)))
        transaction.insert(undirectedEdge('c', 3, 4))
      }),
    )

    expect(graph.reachableNodeIDs(1)).toEqual([1, 2, 3, 4])
    expect(graph.ancestorNodeIDs(3)).toEqual([2, 1])
    expect(graph.descendantNodeIDs(1)).toEqual([2, 3])
    expect(
      graph.reachableNodeIDs(
        4,
        new FdGraphTraversalPolicy(FdGraphTraversalDirection.incident, false),
      ),
    ).toEqual([4])
  })

  it('returns the stable shortest path and connected components', () => {
    const graph = new FdGraph<TestSchema>()
    commit(
      graph.update((transaction) => {
        for (const id of [1, 2, 3, 4, 5]) transaction.insert(node(id))
        transaction.insert(edge('a', FdGraphEndpoint.node(1), FdGraphEndpoint.node(2)))
        transaction.insert(edge('b', FdGraphEndpoint.node(1), FdGraphEndpoint.node(3)))
        transaction.insert(edge('c', FdGraphEndpoint.node(2), FdGraphEndpoint.node(4)))
        transaction.insert(edge('d', FdGraphEndpoint.node(3), FdGraphEndpoint.node(4)))
      }),
    )

    expect(graph.shortestPath(1, 4)).toEqual({ nodeIDs: [1, 2, 4], edgeIDs: ['a', 'c'] })
    expect(graph.weaklyConnectedComponents()).toEqual([[1, 2, 4, 3], [5]])
    expect(graph.stronglyConnectedComponents()).toEqual([[1], [2], [3], [4], [5]])
  })

  it('detects directed, undirected, parallel, and port-level cycles', () => {
    const directed = new FdGraph<TestSchema>()
    commit(
      directed.update((transaction) => {
        transaction.insert(node(1))
        transaction.insert(node(2))
        transaction.insert(edge('a', FdGraphEndpoint.node(1), FdGraphEndpoint.node(2)))
        transaction.insert(edge('b', FdGraphEndpoint.node(2), FdGraphEndpoint.node(1)))
      }),
    )
    expect(directed.firstCycleEdgeIDs()).toEqual(['a', 'b'])

    const undirected = new FdGraph<TestSchema>()
    commit(
      undirected.update((transaction) => {
        transaction.insert(node(1))
        transaction.insert(node(2))
        transaction.insert(undirectedEdge('first', 1, 2))
        transaction.insert(undirectedEdge('second', 1, 2))
      }),
    )
    expect(undirected.firstCycleEdgeIDs()).toEqual(['first', 'second'])

    const ports = new FdGraph<TestSchema>()
    commit(
      ports.update((transaction) => {
        transaction.insert(node(1))
        transaction.insert(new FdGraphPort(portKey(1, 1), 1))
        transaction.insert(new FdGraphPort(portKey(1, 2), 2))
        transaction.insert(
          edge('self', FdGraphEndpoint.port(portKey(1, 1)), FdGraphEndpoint.port(portKey(1, 2))),
        )
      }),
    )
    expect(ports.firstCycleEdgeIDs()).toEqual(['self'])
  })

  it('validates DAGs with stable diagnostics and a snapshot-pinned view', () => {
    const graph = new FdGraph<TestSchema>()
    commit(
      graph.update((transaction) => {
        for (const id of [1, 2, 3]) transaction.insert(node(id))
        transaction.insert(edge('a', FdGraphEndpoint.node(1), FdGraphEndpoint.node(2)))
        transaction.insert(edge('b', FdGraphEndpoint.node(2), FdGraphEndpoint.node(3)))
      }),
    )
    const validatedSnapshotID = graph.snapshotID
    const result = graph.validateDAG(new FdDAGValidationConfiguration())
    expect(result).toMatchObject({ kind: 'valid', view: { topologicalNodeIDs: [1, 2, 3] } })

    commit(
      graph.update((transaction) => {
        transaction.insert(node(4))
      }),
    )
    if (result.kind !== 'valid') throw new Error('Expected a valid DAG')
    expect(result.view.snapshotID).toBe(validatedSnapshotID)
    expect(result.view.graph.nodeIDs).toEqual([1, 2, 3])

    commit(
      graph.update((transaction) => {
        transaction.insert(edge('c', FdGraphEndpoint.node(3), FdGraphEndpoint.node(1)))
      }),
    )
    expect(graph.validateDAG()).toMatchObject({
      kind: 'invalid',
      issue: { kind: 'cycle', edgePath: ['a', 'b', 'c'] },
    })
  })

  it('rejects undirected edges with stable DAG diagnostics', () => {
    const graph = new FdGraph<TestSchema>()
    commit(
      graph.update((transaction) => {
        transaction.insert(node(1))
        transaction.insert(node(2))
        transaction.insert(undirectedEdge('edge', 1, 2))
      }),
    )

    expect(graph.validateDAG()).toMatchObject({
      kind: 'invalid',
      issue: { kind: 'undirectedEdges', edgeIDs: ['edge'] },
    })
  })

  it('is stack-safe on a one-hundred-thousand-node path', () => {
    const graph = new FdGraph<TestSchema>()
    const count = 100_000
    commit(
      graph.update((transaction) => {
        for (let id = 0; id < count; id += 1) transaction.insert(node(id))
        for (let id = 1; id < count; id += 1) {
          transaction.insert(
            edge(
              `edge-${id}`,
              FdGraphEndpoint.node<TestSchema>(id - 1),
              FdGraphEndpoint.node<TestSchema>(id),
            ),
          )
        }
      }),
    )

    expect(graph.reachableNodeIDs(0).length).toBe(count)
    expect(graph.shortestPath(0, count - 1)?.edgeIDs.length).toBe(count - 1)
    expect(graph.stronglyConnectedComponents().length).toBe(count)
    expect(graph.validateDAG()).toMatchObject({
      kind: 'valid',
      view: { topologicalNodeIDs: expect.arrayContaining([0, count - 1]) },
    })
  }, 30_000)
})
