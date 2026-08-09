import { describe, expect, it } from 'vitest'
import {
  type FdAnyGraphSnapshot,
  FdGraphSnapshotValidationError,
  graphElementIDFromKey,
  graphElementKey,
  graphPortPoint,
} from './model.js'
import { FdGraphSnapshotIndex } from './snapshot-index.js'

const snapshot = (): FdAnyGraphSnapshot => ({
  id: 'snapshot-1',
  nodes: [
    {
      id: 'source',
      frame: { x: 0, y: 20, width: 100, height: 60 },
      ports: [{ id: 'output', side: 'right' }],
    },
    {
      id: 'target',
      frame: { x: 900, y: 220, width: 100, height: 60 },
      ports: [{ id: 'input', side: 'left', offset: 0.25 }],
    },
  ],
  edges: [
    {
      id: 'edge',
      source: { nodeID: 'source', portID: 'output' },
      target: { nodeID: 'target', portID: 'input' },
    },
  ],
})

describe('FdGraphSnapshotIndex', () => {
  it('keeps number and string identities distinct', () => {
    expect(graphElementKey(1)).not.toBe(graphElementKey('1'))
    expect(graphElementIDFromKey('n:12')).toBe(12)
    expect(graphElementIDFromKey('s:12')).toBe('12')
  })

  it('resolves port geometry', () => {
    const node = snapshot().nodes[1]
    expect(node && graphPortPoint(node, 'input')).toEqual({ x: 900, y: 235 })
  })

  it('queries nodes and elongated edges without scanning the entire graph', () => {
    const index = new FdGraphSnapshotIndex(snapshot(), {
      cellSize: 100,
      maximumCellsPerElement: 4,
    })
    expect(index.nodesIn({ x: -10, y: 0, width: 130, height: 100 }).map(({ id }) => id)).toEqual([
      'source',
    ])
    expect(index.edgesIn({ x: 480, y: 100, width: 40, height: 100 }).map(({ id }) => id)).toEqual([
      'edge',
    ])
  })

  it('derives content bounds from nodes and edges', () => {
    expect(new FdGraphSnapshotIndex(snapshot()).contentBounds).toEqual({
      x: 0,
      y: 20,
      width: 1_000,
      height: 260,
    })
  })

  it('rejects invalid references and duplicate identities', () => {
    const invalid: FdAnyGraphSnapshot = {
      id: 'invalid',
      nodes: [
        { id: 'node', frame: { x: 0, y: 0, width: 100, height: 100 } },
        { id: 'node', frame: { x: 0, y: 0, width: 100, height: 100 } },
      ],
      edges: [
        {
          id: 'edge',
          source: { nodeID: 'node' },
          target: { nodeID: 'missing' },
        },
      ],
    }
    expect(() => new FdGraphSnapshotIndex(invalid)).toThrow(FdGraphSnapshotValidationError)
    try {
      new FdGraphSnapshotIndex(invalid)
    } catch (error) {
      expect((error as FdGraphSnapshotValidationError).issues.map(({ kind }) => kind)).toEqual([
        'duplicateNodeID',
        'missingEndpointNode',
      ])
    }
  })

  it('indexes one hundred thousand nodes with bounded visible queries', () => {
    const large: FdAnyGraphSnapshot = {
      id: 'large',
      nodes: Array.from({ length: 100_000 }, (_, index) => ({
        id: index,
        frame: {
          x: (index % 1_000) * 40,
          y: Math.floor(index / 1_000) * 40,
          width: 24,
          height: 24,
        },
      })),
      edges: [],
    }
    const index = new FdGraphSnapshotIndex(large)
    expect(index.nodesIn({ x: 0, y: 0, width: 400, height: 400 })).toHaveLength(121)
  })

  it('does not revisit every snapshot node during a visible query', () => {
    let identifierReads = 0
    const nodes = Array.from({ length: 1_000 }, (_, index) => ({
      get id() {
        identifierReads += 1
        return index
      },
      frame: { x: index * 100, y: 0, width: 40, height: 40 },
    }))
    const index = new FdGraphSnapshotIndex({ id: 'bounded-query', nodes, edges: [] })
    identifierReads = 0

    expect(index.nodesIn({ x: 0, y: 0, width: 50, height: 50 })).toHaveLength(1)
    expect(identifierReads).toBe(0)
  })
})
