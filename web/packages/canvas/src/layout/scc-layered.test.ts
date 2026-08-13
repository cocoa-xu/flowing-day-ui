import { describe, expect, it } from 'vitest'
import { FdLayoutInsets } from './layered.js'
import {
  FdGraphLayoutInput,
  FdGraphLayoutTopology,
  FdLayoutComponentIdentity,
  FdLayoutInputID,
  FdLayoutRevision,
} from './model.js'
import type { FdGraphLayoutStrategy } from './pipeline.js'
import { FdSCCLayeredLayout, FdSCCLayeredLayoutConfiguration } from './scc-layered.js'

type Edge = {
  readonly id: string
  readonly kind: 'directed' | 'undirected'
  readonly first: string
  readonly second: string
}

const configuration = new FdSCCLayeredLayoutConfiguration(
  56,
  72,
  96,
  36,
  20,
  new FdLayoutInsets(24, 20),
  { width: 320, height: 240 },
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
  const snapshotID = 'scc-layered'
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

describe('Swift-aligned SCC layered layout', () => {
  it('places cycle members together and descendants in the next layer', () => {
    const strategy = new FdSCCLayeredLayout<string, string, string>(configuration)
    const result = strategy.layout(
      makeInput(
        ['a', 'b', 'c', 'descendant'],
        [
          directed('ab', 'a', 'b'),
          directed('bc', 'b', 'c'),
          directed('ca', 'c', 'a'),
          directed('cd', 'c', 'descendant'),
        ],
        strategy,
        {
          sizes: {
            a: { width: 100, height: 50 },
            b: { width: 140, height: 60 },
            c: { width: 80, height: 70 },
            descendant: { width: 120, height: 50 },
          },
        },
      ),
    )
    const cycle = ['a', 'b', 'c'].map((nodeID) => required(result.frame(nodeID)))
    const first = required(cycle[0])
    const second = required(cycle[1])
    const third = required(cycle[2])
    const descendant = required(result.frame('descendant'))
    expect(intersects(first, second)).toBe(false)
    expect(intersects(first, third)).toBe(false)
    expect(intersects(second, third)).toBe(false)
    expect(Math.max(...cycle.map((frame) => frame.y + frame.height))).toBeLessThan(descendant.y)
  })

  it('accepts mixed topology and remains deterministic', () => {
    const strategy = new FdSCCLayeredLayout<string, string, string>(configuration)
    const input = makeInput(
      ['peer-a', 'peer-b', 'target'],
      [undirected('peers', 'peer-a', 'peer-b'), directed('target', 'peer-b', 'target')],
      strategy,
    )
    const first = strategy.layout(input)
    const second = strategy.layout(input)
    expect(first.nodeFrames).toEqual(second.nodeFrames)
    expect(first.edgeRoutes).toEqual(second.edgeRoutes)
    const peerA = required(first.frame('peer-a'))
    const peerB = required(first.frame('peer-b'))
    const target = required(first.frame('target'))
    expect(intersects(peerA, peerB)).toBe(false)
    expect(Math.max(peerA.y + peerA.height, peerB.y + peerB.height)).toBeLessThan(target.y)
  })

  it('packs weak components and applies only the addressed placement offset', () => {
    const strategy = new FdSCCLayeredLayout<string, string, string>(configuration)
    const input = makeInput(
      ['a', 'b', 'c', 'd'],
      [directed('ab', 'a', 'b'), directed('cd', 'c', 'd')],
      strategy,
    )
    const result = strategy.layout(input)
    const first = union(required(result.frame('a')), required(result.frame('b')))
    const second = union(required(result.frame('c')), required(result.frame('d')))
    expect(intersects(first, second)).toBe(false)
    expect(first.x + first.width).toBeLessThan(second.x)

    const baseline = strategy.layout(
      makeInput(['a', 'b'], [directed('ab', 'a', 'b'), directed('ba', 'b', 'a')], strategy),
    )
    const moved = strategy.layout(
      makeInput(['a', 'b'], [directed('ab', 'a', 'b'), directed('ba', 'b', 'a')], strategy, {
        offsets: { b: { width: 37, height: -19 } },
      }),
    )
    expect(moved.frame('a')).toEqual(baseline.frame('a'))
    expect(moved.frame('b')?.x).toBeCloseTo((baseline.frame('b')?.x ?? 0) + 37)
    expect(moved.frame('b')?.y).toBeCloseTo((baseline.frame('b')?.y ?? 0) - 19)
  })

  it('uses the minimum canvas size for an empty graph', () => {
    const strategy = new FdSCCLayeredLayout<string, string, string>(configuration)
    expect(strategy.layout(makeInput([], [], strategy)).contentBounds).toEqual({
      x: 0,
      y: 0,
      width: 320,
      height: 240,
    })
  })

  it('is stack-safe for a ten-thousand-node cycle', () => {
    const count = 10_000
    const strategy = new FdSCCLayeredLayout<string, string, string>(configuration)
    const nodeIDs = Array.from({ length: count }, (_, index) => `${index}`)
    const edges = Array.from({ length: count }, (_, index) =>
      directed(`edge-${index}`, `${index}`, `${(index + 1) % count}`),
    )
    const result = strategy.layout(makeInput(nodeIDs, edges, strategy))
    expect(result.nodeFrames).toHaveLength(count)
    expect(result.edgeRoutes).toHaveLength(count)
  }, 30_000)
})

type Rect = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const required = <Value>(value: Value | undefined): Value => {
  if (value === undefined) throw new Error('Expected a value')
  return value
}

const intersects = (first: Rect, second: Rect): boolean =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y

const union = (first: Rect, second: Rect): Rect => {
  const x = Math.min(first.x, second.x)
  const y = Math.min(first.y, second.y)
  const maximumX = Math.max(first.x + first.width, second.x + second.width)
  const maximumY = Math.max(first.y + first.height, second.y + second.height)
  return { x, y, width: maximumX - x, height: maximumY - y }
}
