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
  FdGraphSnapshotID,
  FdPresentationElementID,
} from './core.js'
import { FdGraphElementAddress, FdGraphInstancePath } from './presentation.js'

interface TestSchema extends FdGraphSchema {
  readonly NodeID: string
  readonly NodeValue: { readonly title: string }
  readonly PortID: string
  readonly PortValue: { readonly direction: 'input' | 'output' }
  readonly EdgeID: string
  readonly EdgeValue: { readonly label: string }
}

describe('Swift-aligned graph core model', () => {
  it('keeps graph values and identities distinct', () => {
    const node = new FdGraphNode<TestSchema>('source', { title: 'Source' })
    const key = new FdGraphPortKey<TestSchema>('source', 'output')
    const port = new FdGraphPort<TestSchema>(key, { direction: 'output' })
    const edge = new FdGraphEdge<TestSchema>(
      'edge',
      FdGraphEdgeEndpoints.directed(
        FdGraphEndpoint.port<TestSchema>(key),
        FdGraphEndpoint.node<TestSchema>('target'),
      ),
      { label: 'Route' },
    )

    expect(node).toEqual({ id: 'source', value: { title: 'Source' } })
    expect(port).toEqual({ key, value: { direction: 'output' } })
    expect(edge.endpoints.kind).toBe('directed')
    expect(new FdGraphSnapshotID()).not.toEqual(new FdGraphSnapshotID())
  })

  it('compares undirected endpoints without imposing an order', () => {
    const first = FdGraphEndpoint.node<TestSchema>('first')
    const second = FdGraphEndpoint.node<TestSchema>('second')

    expect(
      FdGraphEdgeEndpoints.equals(
        FdGraphEdgeEndpoints.undirected(first, second),
        FdGraphEdgeEndpoints.undirected(second, first),
      ),
    ).toBe(true)
    expect(
      FdGraphEdgeEndpoints.equals(
        FdGraphEdgeEndpoints.directed(first, second),
        FdGraphEdgeEndpoints.directed(second, first),
      ),
    ).toBe(false)
  })

  it('provides the same order and presentation identity cases as Swift', () => {
    const address = new FdGraphElementAddress<'graph', string, string, string>({
      instancePath: new FdGraphInstancePath<'graph', string>([]),
      graphID: 'graph',
      elementID: { kind: 'node', nodeID: 'source' },
    })

    expect(FdGraphOrderPosition.before('target')).toEqual({ kind: 'before', id: 'target' })
    expect(FdPresentationElementID.source<'graph', TestSchema, string>(address, '0')).toEqual({
      kind: 'source',
      address,
      occurrenceID: '0',
    })
  })
})
