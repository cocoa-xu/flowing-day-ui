import { describe, expect, it } from 'vitest'
import {
  FdForceComponentPackingConfiguration,
  FdForceDirectedLayout,
  FdForceDirectedLayoutConfiguration,
  FdForceSimulationConfiguration,
} from './force-directed.js'
import { FdLayoutInsets } from './layered.js'
import {
  FdGraphLayoutInput,
  FdGraphLayoutTopology,
  FdLayoutComponentIdentity,
  FdLayoutInputID,
  FdLayoutRevision,
} from './model.js'
import type { FdGraphLayoutStrategy } from './pipeline.js'

type Edge = {
  readonly id: string
  readonly kind: 'directed' | 'undirected'
  readonly first: string
  readonly second: string
}

const configuration = new FdForceDirectedLayoutConfiguration(
  new FdForceSimulationConfiguration(
    80,
    120,
    250_000,
    0.02,
    0.001,
    0.5,
    12,
    0.25,
    0.85,
    24,
    0.01,
    0.7,
    24,
  ),
  new FdForceComponentPackingConfiguration(72, 24, 1.5, new FdLayoutInsets(24, 20), {
    width: 320,
    height: 240,
  }),
)

const makeInput = (
  nodeIDs: readonly string[],
  edges: readonly Edge[],
  strategy: FdGraphLayoutStrategy<string, string, string>,
  options: {
    readonly sizes?: Readonly<Record<string, { readonly width: number; readonly height: number }>>
    readonly offsets?: Readonly<Record<string, { readonly width: number; readonly height: number }>>
  } = {},
): FdGraphLayoutInput<string, string, string> => {
  const snapshotID = 'force-directed'
  const topology = new FdGraphLayoutTopology<string, string, string>({
    snapshotID,
    nodeIDs,
    ports: [],
    edges: edges.map(({ id, kind, first, second }) => ({
      id,
      endpoints:
        kind === 'directed'
          ? {
              kind,
              source: { kind: 'node', nodeID: first },
              target: { kind: 'node', nodeID: second },
            }
          : {
              kind,
              first: { kind: 'node', nodeID: first },
              second: { kind: 'node', nodeID: second },
            },
    })),
  })
  return new FdGraphLayoutInput({
    id: new FdLayoutInputID(
      snapshotID,
      strategy.identity,
      new FdLayoutComponentIdentity('sizes'),
      new FdLayoutComponentIdentity('anchors'),
      new FdLayoutRevision(),
    ),
    topology,
    nodeSizes: nodeIDs.map((nodeID) => ({
      nodeID,
      size: options.sizes?.[nodeID] ?? { width: 100, height: 60 },
    })),
    portAnchors: [],
    placementState: nodeIDs.flatMap((nodeID) => {
      const offset = options.offsets?.[nodeID]
      return offset === undefined ? [] : [{ nodeID, offset }]
    }),
  })
}

const directed = (id: string, first: string, second: string): Edge => ({
  id,
  kind: 'directed',
  first,
  second,
})

const undirected = (id: string, first: string, second: string): Edge => ({
  id,
  kind: 'undirected',
  first,
  second,
})

describe('Swift-aligned force-directed layout', () => {
  it('accepts directed, undirected, and mixed edges deterministically', () => {
    const strategy = new FdForceDirectedLayout<string, string, string>(configuration)
    const input = makeInput(
      ['a', 'b', 'c', 'd'],
      [
        directed('ab', 'a', 'b'),
        undirected('bc', 'b', 'c'),
        directed('ca', 'c', 'a'),
        undirected('cd', 'c', 'd'),
      ],
      strategy,
    )

    const first = strategy.layout(input)
    const second = strategy.layout(input)

    expect(first.nodeFrames).toEqual(second.nodeFrames)
    expect(first.edgeRoutes).toEqual(second.edgeRoutes)
    expect(first.contentBounds).toEqual(second.contentBounds)
    expect(first.nodeFrames).toHaveLength(4)
    expect(first.edgeRoutes).toHaveLength(4)
  })

  it('does not let edge orientation, duplicates, or self edges distort placement', () => {
    const strategy = new FdForceDirectedLayout<string, string, string>(configuration)
    const directedInput = makeInput(
      ['a', 'b', 'c'],
      [directed('ab', 'a', 'b'), directed('bc', 'b', 'c')],
      strategy,
    )
    const undirectedInput = makeInput(
      ['a', 'b', 'c'],
      [undirected('ab', 'a', 'b'), undirected('bc', 'b', 'c')],
      strategy,
    )
    expect(strategy.layout(directedInput).nodeFrames).toEqual(
      strategy.layout(undirectedInput).nodeFrames,
    )

    const simple = makeInput(['a', 'b'], [directed('ab', 'a', 'b')], strategy)
    const repeated = makeInput(
      ['a', 'b'],
      [directed('ab', 'a', 'b'), directed('ba', 'b', 'a'), directed('loop', 'a', 'a')],
      strategy,
    )
    expect(strategy.layout(simple).nodeFrames).toEqual(strategy.layout(repeated).nodeFrames)
  })

  it('packs disconnected components without overlap and applies placement state', () => {
    const strategy = new FdForceDirectedLayout<string, string, string>(configuration)
    const input = makeInput(
      ['a', 'b', 'c', 'd'],
      [undirected('ab', 'a', 'b'), undirected('cd', 'c', 'd')],
      strategy,
    )
    const result = strategy.layout(input)
    const first = bounds(result.nodeFrames.filter(({ nodeID }) => nodeID === 'a' || nodeID === 'b'))
    const second = bounds(
      result.nodeFrames.filter(({ nodeID }) => nodeID === 'c' || nodeID === 'd'),
    )
    expect(intersects(first, second)).toBe(false)

    const moved = strategy.layout(
      makeInput(['a', 'b'], [undirected('ab', 'a', 'b')], strategy, {
        sizes: { a: { width: 60, height: 40 }, b: { width: 180, height: 120 } },
        offsets: { a: { width: 31, height: 17 } },
      }),
    )
    const baseline = strategy.layout(
      makeInput(['a', 'b'], [undirected('ab', 'a', 'b')], strategy, {
        sizes: { a: { width: 60, height: 40 }, b: { width: 180, height: 120 } },
      }),
    )
    expect(moved.frame('a')?.x).toBeCloseTo((baseline.frame('a')?.x ?? 0) + 31)
    expect(moved.frame('a')?.y).toBeCloseTo((baseline.frame('a')?.y ?? 0) + 17)
    expect(moved.frame('b')).toEqual(baseline.frame('b'))
  })

  it('uses the minimum canvas size for an empty graph', () => {
    const strategy = new FdForceDirectedLayout<string, string, string>(configuration)
    expect(strategy.layout(makeInput([], [], strategy)).contentBounds).toEqual({
      x: 0,
      y: 0,
      width: 320,
      height: 240,
    })
  })

  it('handles ten thousand nodes with Barnes-Hut repulsion', () => {
    const largeConfiguration = new FdForceDirectedLayoutConfiguration(
      new FdForceSimulationConfiguration(
        4,
        80,
        100_000,
        0.02,
        0.001,
        0.25,
        8,
        0.2,
        0.8,
        20,
        0,
        0.8,
        24,
      ),
      configuration.packing,
    )
    const strategy = new FdForceDirectedLayout<string, string, string>(largeConfiguration)
    const nodeIDs = Array.from({ length: 10_000 }, (_, index) => `${index}`)
    const edges = Array.from({ length: 9_999 }, (_, index) =>
      undirected(`edge-${index + 1}`, `${index}`, `${index + 1}`),
    )
    const result = strategy.layout(makeInput(nodeIDs, edges, strategy))
    expect(result.nodeFrames).toHaveLength(10_000)
    expect(result.edgeRoutes).toHaveLength(9_999)
  }, 30_000)
})

const bounds = (
  frames: readonly { readonly frame: { x: number; y: number; width: number; height: number } }[],
) => {
  const first = frames[0]?.frame
  if (first === undefined) throw new Error('Expected at least one frame')
  return frames.slice(1).reduce((result, { frame }) => {
    const x = Math.min(result.x, frame.x)
    const y = Math.min(result.y, frame.y)
    const maxX = Math.max(result.x + result.width, frame.x + frame.width)
    const maxY = Math.max(result.y + result.height, frame.y + frame.height)
    return { x, y, width: maxX - x, height: maxY - y }
  }, first)
}

const intersects = (
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
): boolean =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y
