import { describe, expect, it } from 'vitest'
import type { FdAnyGraphSnapshot } from '../graph/model.js'
import { FdGraphSnapshotIndex } from '../graph/snapshot-index.js'
import {
  beginGraphConnection,
  graphConnectionOriginForEdge,
  nearestGraphConnectionTarget,
  resolveGraphConnection,
  resolveGraphConnectionEditingConfiguration,
  updateGraphConnection,
} from './connection.js'

const snapshot: FdAnyGraphSnapshot = {
  id: 'connections',
  nodes: [
    {
      id: 'source',
      frame: { x: 0, y: 0, width: 100, height: 60 },
      ports: [{ id: 'out', side: 'right' }],
    },
    {
      id: 'target',
      frame: { x: 240, y: 0, width: 100, height: 60 },
      ports: [
        { id: 'in', side: 'left' },
        { id: 'other', side: 'bottom' },
      ],
    },
  ],
  edges: [
    {
      id: 'edge',
      source: { nodeID: 'source', portID: 'out' },
      target: { nodeID: 'target', portID: 'in' },
    },
  ],
}

describe('graph connection editing', () => {
  it('matches the Swift connection editing defaults', () => {
    const configuration = resolveGraphConnectionEditingConfiguration()

    expect(configuration.enabled).toBe(false)
    expect(configuration.allowsReconnection).toBe(true)
    expect(configuration.targetHitRadius).toBe(18)
    expect(configuration.sourceHitPadding).toBe(6)
    expect(configuration.minimumDragDistance).toBe(2)
    expect(configuration.rendersDefaultPreview).toBe(true)
  })

  it('creates a validated connection between node-scoped ports', () => {
    const index = new FdGraphSnapshotIndex(snapshot)
    const configuration = resolveGraphConnectionEditingConfiguration({ enabled: true })
    const started = beginGraphConnection(
      { kind: 'new', source: { nodeID: 'source', portID: 'out' } },
      snapshot.id,
      index,
      configuration,
    )
    if (!started) throw new Error('connection did not start')
    const updated = updateGraphConnection(
      started,
      { x: 241, y: 30 },
      snapshot.id,
      index,
      18,
      configuration,
    )

    expect(updated.candidate?.endpoint).toEqual({ nodeID: 'target', portID: 'in' })
    expect(resolveGraphConnection(updated, snapshot.id)).toEqual({
      kind: 'completed',
      operation: {
        kind: 'create',
        source: { nodeID: 'source', portID: 'out' },
        target: { nodeID: 'target', portID: 'in' },
      },
    })
  })

  it('preserves validation feedback in a cancelled resolution', () => {
    const index = new FdGraphSnapshotIndex(snapshot)
    const configuration = resolveGraphConnectionEditingConfiguration({
      enabled: true,
      validate: () => ({ kind: 'invalid', feedback: { message: 'Type mismatch' } }),
    })
    const started = beginGraphConnection(
      { kind: 'new', source: { nodeID: 'source', portID: 'out' } },
      snapshot.id,
      index,
      configuration,
    )
    if (!started) throw new Error('connection did not start')
    const updated = updateGraphConnection(
      started,
      { x: 240, y: 30 },
      snapshot.id,
      index,
      18,
      configuration,
    )

    expect(resolveGraphConnection(updated, snapshot.id)).toEqual({
      kind: 'cancelled',
      reason: { kind: 'invalidTarget', feedback: { message: 'Type mismatch' } },
    })
  })

  it('supports endpoint reconnection and rejects stale completion', () => {
    const index = new FdGraphSnapshotIndex(snapshot)
    const edge = snapshot.edges[0]
    if (!edge) throw new Error('edge fixture is missing')
    const origin = graphConnectionOriginForEdge(edge, 'target')
    if (!origin) throw new Error('reconnection origin is missing')
    const configuration = resolveGraphConnectionEditingConfiguration({ enabled: true })
    const started = beginGraphConnection(origin, snapshot.id, index, configuration)
    if (!started) throw new Error('connection did not start')
    const updated = updateGraphConnection(
      started,
      { x: 290, y: 60 },
      snapshot.id,
      index,
      18,
      configuration,
    )

    expect(resolveGraphConnection(updated, snapshot.id)).toEqual({
      kind: 'completed',
      operation: {
        kind: 'reconnect',
        edgeID: 'edge',
        endpoint: 'target',
        target: { nodeID: 'target', portID: 'other' },
      },
    })
    expect(resolveGraphConnection(updated, 'new-snapshot')).toEqual({
      kind: 'cancelled',
      reason: { kind: 'staleSnapshot' },
    })
  })

  it('finds the closest target through the spatial index at scale', () => {
    const nodes = Array.from({ length: 100_000 }, (_, id) => ({
      id,
      frame: { x: (id % 1_000) * 80, y: Math.floor(id / 1_000) * 80, width: 40, height: 40 },
      ports: [{ id: 'port', side: 'right' as const }],
    }))
    const index = new FdGraphSnapshotIndex({ id: 'large', nodes, edges: [] })

    expect(nearestGraphConnectionTarget(index, { x: 79_960, y: 7_940 }, 24)?.endpoint).toEqual({
      nodeID: 99_999,
      portID: 'port',
    })
  })
})
