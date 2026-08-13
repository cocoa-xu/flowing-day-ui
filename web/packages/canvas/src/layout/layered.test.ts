import { describe, expect, it } from 'vitest'
import type { FdAnyGraphSnapshot } from '../graph/model.js'
import { FdLayeredGraphLayoutCycleError, layoutLayeredGraph } from './layered.js'

const snapshot: FdAnyGraphSnapshot = {
  id: 'layout',
  nodes: [
    { id: 'root', frame: { x: 0, y: 0, width: 100, height: 50 } },
    { id: 'wide', frame: { x: 0, y: 0, width: 180, height: 70 } },
    { id: 'narrow', frame: { x: 0, y: 0, width: 80, height: 40 } },
  ],
  edges: [
    { id: 'wide-edge', source: { nodeID: 'root' }, target: { nodeID: 'wide' } },
    { id: 'narrow-edge', source: { nodeID: 'root' }, target: { nodeID: 'narrow' } },
  ],
}

const configuration = {
  horizontalNodeSpacing: 30,
  verticalNodeSpacing: 50,
  componentSpacing: 70,
  canvasInsets: { top: 20, right: 20, bottom: 20, left: 20 },
  minimumCanvasSize: { width: 0, height: 0 },
} as const

describe('layered graph layout', () => {
  it('places descendants below their parents by default', () => {
    const result = layoutLayeredGraph(snapshot, configuration)
    const root = result.nodeFrames.get('root')!
    const wide = result.nodeFrames.get('wide')!
    const narrow = result.nodeFrames.get('narrow')!

    expect(root.y + root.height).toBeLessThan(wide.y)
    expect(root.y + root.height).toBeLessThan(narrow.y)
    expect(wide).toMatchObject({ width: 180, height: 70 })
  })

  it('places descendants to the right when configured', () => {
    const result = layoutLayeredGraph(snapshot, {
      ...configuration,
      direction: 'leftToRight',
    })
    const root = result.nodeFrames.get('root')!
    const wide = result.nodeFrames.get('wide')!
    const narrow = result.nodeFrames.get('narrow')!

    expect(root.x + root.width).toBeLessThan(wide.x)
    expect(root.x + root.width).toBeLessThan(narrow.x)
    expect(narrow).toMatchObject({ width: 80, height: 40 })
  })

  it('rejects cyclic input with a specific error', () => {
    expect(() =>
      layoutLayeredGraph(
        {
          ...snapshot,
          edges: [
            ...snapshot.edges,
            { id: 'return', source: { nodeID: 'wide' }, target: { nodeID: 'root' } },
          ],
        },
        configuration,
      ),
    ).toThrow(FdLayeredGraphLayoutCycleError)
  })

  it('is stack safe for a ten-thousand-node path', () => {
    const nodeCount = 10_000
    const nodes = Array.from({ length: nodeCount }, (_, index) => ({
      id: index,
      frame: { x: 0, y: 0, width: 1, height: 1 },
    }))
    const edges = Array.from({ length: nodeCount - 1 }, (_, index) => ({
      id: index,
      source: { nodeID: index },
      target: { nodeID: index + 1 },
    }))

    const result = layoutLayeredGraph(
      { id: 'large-path', nodes, edges },
      { ...configuration, direction: 'leftToRight' },
    )

    expect(result.nodeFrames.size).toBe(nodeCount)
    expect(result.nodeFrames.get(nodeCount - 1)!.x).toBeGreaterThan(result.nodeFrames.get(0)!.x)
  })
})
