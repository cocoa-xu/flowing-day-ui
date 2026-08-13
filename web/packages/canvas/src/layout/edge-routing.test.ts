import { describe, expect, it } from 'vitest'
import {
  FdCubicEdgeRouter,
  FdCubicEdgeRouterConfiguration,
  FdLayeredDAGLayout,
} from './edge-routing.js'
import { FdLayeredLayoutConfiguration, FdLayoutInsets } from './layered.js'
import {
  FdGraphLayoutInput,
  FdGraphLayoutPort,
  FdGraphLayoutTopology,
  FdLayoutComponentIdentity,
  FdLayoutInputID,
  FdLayoutPipelineIdentity,
  FdLayoutRevision,
} from './model.js'
import { FdGraphNodePlacement } from './pipeline.js'

const identity = new FdLayoutPipelineIdentity(new FdLayoutComponentIdentity('test'))

const makeInput = (
  pipelineIdentity: FdLayoutPipelineIdentity,
  options: {
    readonly nodeIDs: readonly string[]
    readonly ports?: readonly FdGraphLayoutPort<string, string>[]
    readonly edges: readonly {
      readonly id: string
      readonly endpoints:
        | {
            readonly kind: 'directed'
            readonly source:
              | { readonly kind: 'node'; readonly nodeID: string }
              | {
                  readonly kind: 'port'
                  readonly key: { readonly nodeID: string; readonly portID: string }
                }
            readonly target:
              | { readonly kind: 'node'; readonly nodeID: string }
              | {
                  readonly kind: 'port'
                  readonly key: { readonly nodeID: string; readonly portID: string }
                }
          }
        | {
            readonly kind: 'undirected'
            readonly first: { readonly kind: 'node'; readonly nodeID: string }
            readonly second: { readonly kind: 'node'; readonly nodeID: string }
          }
    }[]
    readonly anchors?: readonly {
      readonly key: { readonly nodeID: string; readonly portID: string }
      readonly position: { readonly x: number; readonly y: number }
      readonly normal: { readonly dx: number; readonly dy: number }
    }[]
    readonly sizes?: Readonly<Record<string, { readonly width: number; readonly height: number }>>
  },
): FdGraphLayoutInput<string, string, string> => {
  const topology = new FdGraphLayoutTopology({
    snapshotID: 'routing',
    nodeIDs: options.nodeIDs,
    ports: options.ports ?? [],
    edges: options.edges,
  })
  return new FdGraphLayoutInput({
    id: new FdLayoutInputID(
      'routing',
      pipelineIdentity,
      new FdLayoutComponentIdentity('sizes'),
      new FdLayoutComponentIdentity('anchors'),
      new FdLayoutRevision(),
    ),
    topology,
    nodeSizes: options.nodeIDs.map((nodeID) => ({
      nodeID,
      size: options.sizes?.[nodeID] ?? { width: 100, height: 60 },
    })),
    portAnchors: options.anchors ?? [],
  })
}

const twoNodePlacement = (input: FdGraphLayoutInput<string, string, string>) =>
  new FdGraphNodePlacement(
    input,
    [
      { nodeID: 'source', frame: { x: 0, y: 0, width: 100, height: 60 } },
      { nodeID: 'target', frame: { x: 300, y: 0, width: 100, height: 60 } },
    ],
    { x: 0, y: 0, width: 400, height: 60 },
  )

describe('cubic edge router', () => {
  it('provides the Swift standard configuration and validates custom values', () => {
    expect(FdCubicEdgeRouterConfiguration.standard).toEqual({
      minimumControlDistance: 28,
      maximumControlDistance: 54,
      controlDistanceRatio: 0.45,
      parallelEdgeSpacing: 12,
      selfLoopRadius: 34,
    })
    expect(() => new FdCubicEdgeRouterConfiguration(10, 5, 1, 1, 1)).toThrow(RangeError)
  })

  it('routes node endpoints from their frame boundaries', () => {
    const input = makeInput(identity, {
      nodeIDs: ['source', 'target'],
      edges: [
        {
          id: 'edge',
          endpoints: {
            kind: 'directed',
            source: { kind: 'node', nodeID: 'source' },
            target: { kind: 'node', nodeID: 'target' },
          },
        },
      ],
    })

    const [route] = new FdCubicEdgeRouter().routes(input, twoNodePlacement(input))

    expect(route?.route).toEqual({
      start: { x: 100, y: 30 },
      segments: [
        {
          kind: 'cubic',
          control1: { x: 154, y: 30 },
          control2: { x: 246, y: 30 },
          end: { x: 300, y: 30 },
        },
      ],
    })
  })

  it('uses exact port anchors and separates parallel edges symmetrically', () => {
    const ports = [
      new FdGraphLayoutPort('output', 'source'),
      new FdGraphLayoutPort('input', 'target'),
    ]
    const endpoints = {
      kind: 'directed' as const,
      source: { kind: 'port' as const, key: { nodeID: 'source', portID: 'output' } },
      target: { kind: 'port' as const, key: { nodeID: 'target', portID: 'input' } },
    }
    const input = makeInput(identity, {
      nodeIDs: ['source', 'target'],
      ports,
      edges: [
        { id: 'first', endpoints },
        { id: 'second', endpoints },
      ],
      anchors: [
        {
          key: { nodeID: 'source', portID: 'output' },
          position: { x: 100, y: 30 },
          normal: { dx: 1, dy: 0 },
        },
        {
          key: { nodeID: 'target', portID: 'input' },
          position: { x: 0, y: 30 },
          normal: { dx: -1, dy: 0 },
        },
      ],
    })

    const routes = new FdCubicEdgeRouter().routes(input, twoNodePlacement(input))

    expect(routes.map(({ route }) => route.start)).toEqual([
      { x: 100, y: 30 },
      { x: 100, y: 30 },
    ])
    expect(routes.map(({ route }) => route.segments[0])).toEqual([
      expect.objectContaining({ control1: { x: 154, y: 24 }, control2: { x: 246, y: 24 } }),
      expect.objectContaining({ control1: { x: 154, y: 36 }, control2: { x: 246, y: 36 } }),
    ])
  })

  it('routes self loops as two cubic segments outside the node frame', () => {
    const input = makeInput(identity, {
      nodeIDs: ['node'],
      edges: [
        {
          id: 'loop',
          endpoints: {
            kind: 'directed',
            source: { kind: 'node', nodeID: 'node' },
            target: { kind: 'node', nodeID: 'node' },
          },
        },
      ],
    })
    const placement = new FdGraphNodePlacement(
      input,
      [{ nodeID: 'node', frame: { x: 50, y: 50, width: 100, height: 60 } }],
      { x: 0, y: 0, width: 200, height: 150 },
    )

    const [route] = new FdCubicEdgeRouter().routes(input, placement)

    expect(route?.route.segments).toHaveLength(2)
    expect(route?.route.conservativeBounds.y).toBeLessThan(50)
    expect(route?.route.conservativeBounds.x).toBeLessThan(50)
    expect(route?.route.conservativeBounds.width).toBeGreaterThan(100)
  })
})

describe('layered DAG layout', () => {
  it('composes the Swift default placement and edge router', () => {
    const layout = new FdLayeredDAGLayout(
      new FdLayeredLayoutConfiguration(30, 50, 70, new FdLayoutInsets(20, 20), {
        width: 0,
        height: 0,
      }),
    )
    const input = makeInput(layout.identity, {
      nodeIDs: ['source', 'target'],
      edges: [
        {
          id: 'edge',
          endpoints: {
            kind: 'directed',
            source: { kind: 'node', nodeID: 'source' },
            target: { kind: 'node', nodeID: 'target' },
          },
        },
      ],
    })

    const result = layout.layout(input)
    const sourceFrame = result.frame('source')
    const targetFrame = result.frame('target')
    if (!sourceFrame || !targetFrame) throw new Error('expected layered layout frames')

    expect(sourceFrame.y + sourceFrame.height).toBeLessThan(targetFrame.y)
    expect(result.route('edge')?.segments).toHaveLength(1)
    expect(result.route('edge')?.segments[0]?.kind).toBe('cubic')
  })
})
