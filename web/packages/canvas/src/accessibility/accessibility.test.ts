import { describe, expect, it } from 'vitest'
import type { FdAnyGraphSnapshot } from '../graph/model.js'
import { FdGraphSnapshotIndex } from '../graph/snapshot-index.js'
import {
  defaultGraphAccessibilityCommandResolver,
  resolveGraphCanvasAccessibilityConfiguration,
} from './configuration.js'
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
    const configuration = resolveGraphCanvasAccessibilityConfiguration(
      { capabilities: { movement: false } },
      {
        nodeAccessibilityRepresentation: (node) => ({
          kind: 'element',
          description: { label: `Workflow ${String(node.id)}`, hint: 'Consumer hint' },
        }),
      },
    )
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
      resolveGraphCanvasAccessibilityConfiguration(
        {},
        {
          portAccessibilityRepresentation: () => ({ kind: 'hidden' }),
          edgeAccessibilityRepresentation: () => ({ kind: 'hidden' }),
        },
      ),
    )

    expect(standard.items.map(({ kind }) => kind)).toEqual(['node', 'port', 'node', 'edge'])
    expect(nodesOnly.items.map(({ kind }) => kind)).toEqual(['node', 'node'])
  })

  it('provides a default connected-element command and validates custom actions', () => {
    expect(
      defaultGraphAccessibilityCommandResolver(
        new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true }),
      ),
    ).toEqual({ kind: 'focusNextRelated' })
    expect(() =>
      createGraphAccessibilitySnapshot(
        graph,
        resolveGraphCanvasAccessibilityConfiguration(
          {},
          {
            nodeAccessibilityRepresentation: () => ({
              kind: 'element',
              description: {
                label: 'Node',
                actions: [
                  { id: 'inspect', label: 'Inspect' },
                  { id: 'inspect', label: 'Inspect again' },
                ],
              },
            }),
          },
        ),
      ),
    ).toThrow('duplicate accessibility action ID inspect')
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

  it('updates affected node, port, and edge geometry incrementally', () => {
    const index = new FdGraphSnapshotIndex(graph)
    const snapshot = createGraphAccessibilitySnapshot(
      graph,
      resolveGraphCanvasAccessibilityConfiguration(),
    )
    index.applyNodeFrames('accessibility-2', [
      { nodeID: 'source', frame: { x: 40, y: 30, width: 100, height: 60 } },
    ])

    snapshot.updateGeometry(index, new Set(['source']))

    expect(snapshot.item(graphNodeAccessibilityKey('source'))?.frame).toEqual({
      x: 40,
      y: 30,
      width: 100,
      height: 60,
    })
    expect(snapshot.items.find(({ kind }) => kind === 'port')?.frame).toEqual({
      x: 129,
      y: 49,
      width: 22,
      height: 22,
    })
    expect(snapshot.items.find(({ kind }) => kind === 'edge')?.frame).toEqual({
      x: 140,
      y: 30,
      width: 110,
      height: 30,
    })
  })
})
