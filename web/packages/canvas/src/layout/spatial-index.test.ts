import { describe, expect, it } from 'vitest'
import {
  FdGraphLayoutInput,
  FdGraphLayoutTopology,
  FdLayoutComponentIdentity,
  FdLayoutInputID,
  FdLayoutPipelineIdentity,
  FdLayoutRevision,
} from './model.js'
import { FdGraphEdgeRoute, FdGraphLayoutResult, FdGraphNodePlacement } from './pipeline.js'
import {
  FdGraphRenderIndex,
  FdGraphRenderIndexConfiguration,
  FdGraphRenderIndexIssue,
} from './render-index.js'
import {
  FdSpatialIndex,
  FdSpatialIndexConfiguration,
  FdSpatialIndexIssue,
} from './spatial-index.js'

describe('spatial index', () => {
  const entries = [
    { id: 'first', frame: { x: 0, y: 0, width: 100, height: 60 } },
    { id: 'second', frame: { x: 2_000, y: 2_000, width: 100, height: 60 } },
  ]

  it('supports local frame updates and stable ordered queries', () => {
    const index = new FdSpatialIndex(entries)
    index.updateFrame({ x: 600, y: 400, width: 100, height: 60 }, 'first')

    expect(index.itemIDs({ x: -20, y: -20, width: 160, height: 100 })).toEqual([])
    expect(index.itemIDs({ x: 580, y: 380, width: 160, height: 100 })).toEqual(['first'])
    expect(index.frame('first')).toEqual({ x: 600, y: 400, width: 100, height: 60 })
  })

  it('falls back to scanning when query budgets are exhausted', () => {
    const index = new FdSpatialIndex(
      entries,
      new FdSpatialIndexConfiguration({ maximumCellsPerQuery: 1 }),
    )

    expect(index.itemIDs({ x: -100, y: -100, width: 2_500, height: 2_500 })).toEqual([
      'first',
      'second',
    ])
  })

  it('falls back during nearest search and preserves source order for ties', () => {
    const index = new FdSpatialIndex(
      [
        { id: 'first', frame: { x: 0, y: 0, width: 100, height: 60 } },
        { id: 'second', frame: { x: 2_000, y: 0, width: 100, height: 60 } },
      ],
      new FdSpatialIndexConfiguration({ maximumNearestCellsVisited: 1 }),
    )

    expect(index.nearestItemID({ x: 1_050, y: 30 })).toBe('first')
    expect(index.nearestItemID({ x: 1_050, y: 30 }, new Set(['first']))).toBe('second')
  })

  it('culls a large grid without changing unordered membership', () => {
    const index = new FdSpatialIndex(
      Array.from({ length: 10_000 }, (_, item) => ({
        id: item,
        frame: {
          x: (item % 100) * 140,
          y: Math.floor(item / 100) * 100,
          width: 100,
          height: 60,
        },
      })),
    )
    const viewport = { x: 6_900, y: 4_900, width: 500, height: 400 }
    const ordered = index.itemIDs(viewport)

    expect(ordered.length).toBeLessThan(40)
    expect(ordered).toContain(5_050)
    expect(new Set(index.itemIDsUnordered(viewport))).toEqual(new Set(ordered))
  })

  it('rejects invalid identities, frames, and item cell budgets', () => {
    expect(() => new FdSpatialIndex([entries[0]!, entries[0]!])).toThrow(FdSpatialIndexIssue)
    expect(
      () =>
        new FdSpatialIndex([
          { id: 'invalid', frame: { x: 0, y: 0, width: Number.NaN, height: 10 } },
        ]),
    ).toThrow(FdSpatialIndexIssue)
    expect(
      () =>
        new FdSpatialIndex(
          [{ id: 'large', frame: { x: 0, y: 0, width: 1_000, height: 1_000 } }],
          new FdSpatialIndexConfiguration({ bucketSize: 10, maximumCellsPerItem: 4 }),
        ),
    ).toThrow(FdSpatialIndexIssue)
  })
})

describe('graph render index', () => {
  const makeFixture = (edgeEnd = { x: 1_000, y: 30 }) => {
    const topology = new FdGraphLayoutTopology({
      snapshotID: 'render',
      nodeIDs: ['first', 'second'],
      ports: [],
      edges: [
        {
          id: 'edge',
          endpoints: {
            kind: 'directed' as const,
            source: { kind: 'node' as const, nodeID: 'first' },
            target: { kind: 'node' as const, nodeID: 'second' },
          },
        },
      ],
    })
    const input = new FdGraphLayoutInput({
      id: new FdLayoutInputID(
        'render',
        new FdLayoutPipelineIdentity(new FdLayoutComponentIdentity('pipeline')),
        new FdLayoutComponentIdentity('node-size'),
        new FdLayoutComponentIdentity('port-anchor'),
        new FdLayoutRevision(),
      ),
      topology,
      nodeSizes: [
        { nodeID: 'first', size: { width: 100, height: 60 } },
        { nodeID: 'second', size: { width: 100, height: 60 } },
      ],
      portAnchors: [],
    })
    const placement = new FdGraphNodePlacement(
      input,
      [
        { nodeID: 'first', frame: { x: 0, y: 0, width: 100, height: 60 } },
        { nodeID: 'second', frame: { x: 1_000, y: 0, width: 100, height: 60 } },
      ],
      {
        x: 0,
        y: 0,
        width: Math.max(1_100, edgeEnd.x),
        height: Math.max(60, edgeEnd.y),
      },
    )
    const result = new FdGraphLayoutResult(input, placement, [
      {
        edgeID: 'edge',
        route: new FdGraphEdgeRoute({ x: 100, y: 30 }, [{ kind: 'line', end: edgeEnd }]),
      },
    ])
    return { input, result }
  }

  it('materializes only visible nodes and routes', () => {
    const { input, result } = makeFixture()
    const index = new FdGraphRenderIndex(input, result)
    const viewport = { x: 450, y: 0, width: 100, height: 60 }

    expect(index.slice(viewport)).toMatchObject({
      inputID: input.id,
      nodeIDs: [],
      edgeIDs: ['edge'],
      nodeFrames: [],
    })
    expect(index.slice(viewport).edgeRoutes.map(({ edgeID }) => edgeID)).toEqual(['edge'])
    expect(index.unorderedNodeIDs({ x: -10, y: -10, width: 120, height: 80 })).toEqual(['first'])
    expect(index.nodeIDs({ x: -10, y: -10, width: 1_120, height: 80 })).toEqual(['first', 'second'])
  })

  it('supports long edges independently of spatial grid budgets', () => {
    const { input, result } = makeFixture({ x: 100_000_000, y: 100_000_000 })
    const index = new FdGraphRenderIndex(input, result)

    expect(index.slice({ x: 49_999_900, y: 49_999_900, width: 200, height: 200 }).edgeIDs).toEqual([
      'edge',
    ])
  })

  it('honors edge culling margin and validates input identity', () => {
    const { input, result } = makeFixture()
    const index = new FdGraphRenderIndex(
      input,
      result,
      new FdGraphRenderIndexConfiguration({ edgeCullingMargin: 0 }),
    )
    expect(index.slice({ x: 450, y: 29, width: 100, height: 2 }).edgeIDs).toEqual(['edge'])

    const other = makeFixture()
    expect(() => new FdGraphRenderIndex(input, other.result)).toThrow(FdGraphRenderIndexIssue)
  })
})
