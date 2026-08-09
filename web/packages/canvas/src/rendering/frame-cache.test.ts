import { describe, expect, it } from 'vitest'
import type { FdAnyGraphNode, FdAnyGraphSnapshot } from '../graph/model.js'
import { FdGraphRenderGeometryCache } from './frame-cache.js'

const snapshot: FdAnyGraphSnapshot = {
  id: 'cache',
  nodes: [
    { id: 1, frame: { x: 0, y: 0, width: 40, height: 40 } },
    { id: 2, frame: { x: 100, y: 0, width: 40, height: 40 } },
  ],
  edges: [{ id: 3, source: { nodeID: 1 }, target: { nodeID: 2 } }],
}

describe('graph render geometry cache', () => {
  it('reuses immutable geometry while only the viewport changes', () => {
    const cache = new FdGraphRenderGeometryCache()
    let endpointCalls = 0
    const input = {
      snapshotRevision: 1,
      presentationRevision: 1,
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      selectedNodeIDs: new Set([1]),
      focusedNodeID: 1,
      nodeFrame: (node: (typeof snapshot.nodes)[number]) => node.frame,
      edgeEndpoint: (_edge: (typeof snapshot.edges)[number], endpoint: 'source' | 'target') => {
        endpointCalls += 1
        return endpoint === 'source' ? { x: 40, y: 20 } : { x: 100, y: 20 }
      },
    }
    const first = cache.resolve(input)
    const second = cache.resolve(input)

    expect(second).toBe(first)
    expect(second.nodes).toBe(first.nodes)
    expect(second.edges).toBe(first.edges)
    expect(endpointCalls).toBe(2)
  })

  it('rebuilds geometry when presentation state changes', () => {
    const cache = new FdGraphRenderGeometryCache()
    const base = {
      snapshotRevision: 1,
      presentationRevision: 1,
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      selectedNodeIDs: new Set<number>(),
      nodeFrame: (node: (typeof snapshot.nodes)[number]) => node.frame,
      edgeEndpoint: (_edge: (typeof snapshot.edges)[number], endpoint: 'source' | 'target') =>
        endpoint === 'source' ? { x: 40, y: 20 } : { x: 100, y: 20 },
    }
    const first = cache.resolve(base)
    const second = cache.resolve({ ...base, presentationRevision: 2, focusedEdgeID: 3 })

    expect(second).not.toBe(first)
    expect(second.edges[0]?.focused).toBe(true)
  })

  it('prepares a hundred-thousand elements once per revision', () => {
    const cache = new FdGraphRenderGeometryCache()
    const nodes = Array.from({ length: 100_000 }, (_, id) => ({
      id,
      frame: { x: id * 2, y: 0, width: 1, height: 1 },
    }))
    let frameCalls = 0
    const input = {
      snapshotRevision: 1,
      presentationRevision: 1,
      nodes,
      edges: [],
      selectedNodeIDs: new Set<number>(),
      nodeFrame: (node: FdAnyGraphNode) => {
        frameCalls += 1
        return node.frame
      },
      edgeEndpoint: () => ({ x: 0, y: 0 }),
    }

    expect(cache.resolve(input).nodes).toHaveLength(100_000)
    expect(cache.resolve(input).nodes).toHaveLength(100_000)
    expect(frameCalls).toBe(100_000)
  })
})
