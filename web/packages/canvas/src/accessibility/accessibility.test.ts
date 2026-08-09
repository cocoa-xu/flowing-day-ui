import { describe, expect, it } from 'vitest'
import type { FdAnyGraphSnapshot } from '../graph/model.js'
import { resolveGraphCanvasAccessibilityConfiguration } from './configuration.js'
import {
  createGraphAccessibilitySnapshot,
  FdGraphAccessibilitySnapshot,
  graphNodeAccessibilityKey,
} from './snapshot.js'

const graph: FdAnyGraphSnapshot = {
  id: 'accessibility',
  nodes: [
    {
      id: 'source',
      frame: { x: 0, y: 0, width: 100, height: 60 },
      label: 'Source',
      ports: [{ id: 'output', side: 'right', label: 'Output' }],
    },
    { id: 'target', frame: { x: 200, y: 0, width: 100, height: 60 }, label: 'Target' },
  ],
  edges: [
    {
      id: 'edge',
      source: { nodeID: 'source', portID: 'output' },
      target: { nodeID: 'target' },
      label: 'Connection',
    },
  ],
}

describe('graph accessibility configuration', () => {
  it('supports independent capabilities and consumer-owned semantics', () => {
    const configuration = resolveGraphCanvasAccessibilityConfiguration({
      capabilities: { movement: false },
      nodeRepresentation: (node) => ({
        kind: 'element',
        description: { label: `Workflow ${String(node.id)}`, hint: 'Consumer hint' },
      }),
    })
    const snapshot = createGraphAccessibilitySnapshot(graph, configuration)

    expect(configuration.capabilities.movement).toBe(false)
    expect(configuration.capabilities.selection).toBe(true)
    expect(snapshot.item(graphNodeAccessibilityKey('source'))?.description).toEqual({
      label: 'Workflow source',
      hint: 'Consumer hint',
    })
  })

  it('allows ports and edges to be exposed or hidden independently', () => {
    const standard = createGraphAccessibilitySnapshot(
      graph,
      resolveGraphCanvasAccessibilityConfiguration(),
    )
    const nodesOnly = createGraphAccessibilitySnapshot(
      graph,
      resolveGraphCanvasAccessibilityConfiguration({
        portRepresentation: () => ({ kind: 'hidden' }),
        edgeRepresentation: () => ({ kind: 'hidden' }),
      }),
    )

    expect(standard.items.map(({ kind }) => kind)).toEqual(['node', 'port', 'node', 'edge'])
    expect(nodesOnly.items.map(({ kind }) => kind)).toEqual(['node', 'node'])
  })
})

describe('graph accessibility snapshot', () => {
  it('preserves stable focus and relationships', () => {
    const snapshot = createGraphAccessibilitySnapshot(
      graph,
      resolveGraphCanvasAccessibilityConfiguration(),
    )
    const source = graphNodeAccessibilityKey('source')
    const target = graphNodeAccessibilityKey('target')

    expect(snapshot.reconciledFocus(target)).toBe(target)
    expect(snapshot.reconciledFocus('missing')).toBe(source)
    expect(snapshot.relatedElementKeys(source)).toContain(target)
    expect(snapshot.elementKeyAfter(source)).toBeDefined()
  })

  it('materializes only a bounded window around the focused item', () => {
    const items = Array.from({ length: 100_000 }, (_, index) => ({
      key: `node:${index}`,
      kind: 'node' as const,
      reference: { kind: 'node' as const, nodeID: index },
      frame: { x: index * 20, y: 0, width: 18, height: 18 },
      description: { label: `Node ${index}` },
      relatedElementKeys: [],
    }))
    const snapshot = new FdGraphAccessibilitySnapshot(items)
    const exposed = snapshot.exposedItems('node:50000', 64)

    expect(exposed).toHaveLength(64)
    expect(exposed[32]?.key).toBe('node:50000')
  })
})
