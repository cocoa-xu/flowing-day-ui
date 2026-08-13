import { describe, expect, it } from 'vitest'
import type { FdCanvasRect, FdCanvasSize } from '../geometry.js'
import {
  FdCompoundContainerGeometry,
  type FdCompoundContainerGeometryResolver,
  FdCompoundLayout,
  FdCompoundLayoutIssue,
  FdPaddedCompoundContainerConfiguration,
  FdPaddedCompoundContainerGeometry,
} from './compound.js'
import { FdCubicEdgeRouter, FdLayeredDAGLayout } from './edge-routing.js'
import { FdLayeredLayoutConfiguration, FdLayoutInsets } from './layered.js'
import {
  FdGraphLayoutInput,
  FdGraphLayoutPort,
  type FdGraphLayoutPortKey,
  FdGraphLayoutTopology,
  FdLayoutComponentIdentity,
  FdLayoutInputID,
  FdLayoutPipelineIdentity,
  FdLayoutRevision,
} from './model.js'
import { FdGraphLayoutPipelineError, type FdGraphLayoutStrategy } from './pipeline.js'

type Strategy = FdGraphLayoutStrategy<string, string, string>

const makeLevelLayout = () =>
  new FdLayeredDAGLayout<string, string, string>(
    new FdLayeredLayoutConfiguration(24, 48, 64, new FdLayoutInsets(0, 0), { width: 0, height: 0 }),
  )

const makeStrategy = () =>
  new FdCompoundLayout<string, string, string>(
    makeLevelLayout(),
    new FdPaddedCompoundContainerGeometry(
      new FdPaddedCompoundContainerConfiguration(new FdLayoutInsets(20, 16), 28),
    ),
    new FdCubicEdgeRouter(),
  )

const makeInput = (
  topology: FdGraphLayoutTopology<string, string, string>,
  strategy: Strategy,
  options: {
    readonly sizes?: Readonly<Record<string, FdCanvasSize>>
    readonly placementState?: readonly {
      readonly nodeID: string
      readonly offset: FdCanvasSize
    }[]
  } = {},
) => {
  const sizeForNode = (nodeID: string) => options.sizes?.[nodeID] ?? { width: 100, height: 60 }
  return new FdGraphLayoutInput({
    id: new FdLayoutInputID(
      topology.snapshotID,
      strategy.identity,
      new FdLayoutComponentIdentity('sizes'),
      new FdLayoutComponentIdentity('anchors'),
      new FdLayoutRevision(),
    ),
    topology,
    nodeSizes: topology.nodeIDs.map((nodeID) => ({ nodeID, size: sizeForNode(nodeID) })),
    portAnchors: topology.ports.map((port) => {
      const size = sizeForNode(port.nodeID)
      const external = port.id === 'external'
      return {
        key: port.key,
        position: { x: external ? size.width : 0, y: size.height / 2 },
        normal: { dx: external ? 1 : -1, dy: 0 },
      }
    }),
    placementState: options.placementState ?? [],
  })
}

const boundaryFixture = () => {
  const externalPort = { nodeID: 'container', portID: 'external' }
  const internalPort = { nodeID: 'child-source', portID: 'internal' }
  const topology = new FdGraphLayoutTopology<string, string, string>({
    snapshotID: 'boundary',
    nodeIDs: ['source', 'container', 'child-source', 'child-target'],
    ports: [new FdGraphLayoutPort(externalPort), new FdGraphLayoutPort(internalPort)],
    edges: [
      {
        id: 'boundary',
        endpoints: {
          kind: 'directed',
          source: { kind: 'node', nodeID: 'source' },
          target: { kind: 'port', key: internalPort },
        },
      },
      {
        id: 'internal',
        endpoints: {
          kind: 'directed',
          source: { kind: 'port', key: internalPort },
          target: { kind: 'node', nodeID: 'child-target' },
        },
      },
    ],
    containments: [
      { containerNodeID: 'container', memberNodeIDs: ['child-source', 'child-target'] },
    ],
  })
  const strategy = makeStrategy()
  return { strategy, input: makeInput(topology, strategy), externalPort, internalPort }
}

describe('Swift-aligned compound layout', () => {
  it('lays out expanded children inside their resolved container', () => {
    const fixture = boundaryFixture()
    const result = fixture.strategy.layout(fixture.input)
    const container = required(result.frame('container'))
    const childSource = required(result.frame('child-source'))
    const childTarget = required(result.frame('child-target'))

    expect(container.width).toBeGreaterThan(100)
    expect(container.height).toBeGreaterThan(60)
    expect(contains(container, childSource)).toBe(true)
    expect(contains(container, childTarget)).toBe(true)
    expect(result.inputID).toBe(fixture.input.id)
  })

  it('routes boundary edges against final world port anchors', () => {
    const fixture = boundaryFixture()
    const result = fixture.strategy.layout(fixture.input)
    const container = required(result.frame('container'))
    const externalAnchor = required(
      result.resolvedPortAnchors.find(({ key }) => samePortKey(key, fixture.externalPort)),
    )
    const internalAnchor = required(
      result.resolvedPortAnchors.find(({ key }) => samePortKey(key, fixture.internalPort)),
    )
    const route = required(result.route('boundary'))

    expect(externalAnchor.position.x).toBeCloseTo(container.x + container.width)
    expect(routeEnd(route)).toEqual(internalAnchor.position)
  })

  it('resolves nested containers bottom up', () => {
    const strategy = makeStrategy()
    const topology = new FdGraphLayoutTopology<string, string, string>({
      nodeIDs: ['outer', 'middle', 'wide', 'tall'],
      ports: [],
      edges: [],
      containments: [
        { containerNodeID: 'outer', memberNodeIDs: ['middle'] },
        { containerNodeID: 'middle', memberNodeIDs: ['wide', 'tall'] },
      ],
    })
    const result = strategy.layout(
      makeInput(topology, strategy, {
        sizes: {
          outer: { width: 80, height: 50 },
          middle: { width: 90, height: 60 },
          wide: { width: 220, height: 40 },
          tall: { width: 70, height: 140 },
        },
      }),
    )
    const outer = required(result.frame('outer'))
    const middle = required(result.frame('middle'))

    expect(contains(outer, middle)).toBe(true)
    expect(contains(middle, required(result.frame('wide')))).toBe(true)
    expect(contains(middle, required(result.frame('tall')))).toBe(true)
    expect(middle.width).toBeGreaterThan(220)
    expect(outer.width).toBeGreaterThan(middle.width)
  })

  it('gives independent instances independent world frames', () => {
    const strategy = makeStrategy()
    const topology = new FdGraphLayoutTopology<string, string, string>({
      nodeIDs: ['first-container', 'second-container', 'first-child', 'second-child'],
      ports: [],
      edges: [],
      containments: [
        { containerNodeID: 'first-container', memberNodeIDs: ['first-child'] },
        { containerNodeID: 'second-container', memberNodeIDs: ['second-child'] },
      ],
    })
    const result = strategy.layout(makeInput(topology, strategy))
    const firstContainer = required(result.frame('first-container'))
    const secondContainer = required(result.frame('second-container'))
    const firstChild = required(result.frame('first-child'))
    const secondChild = required(result.frame('second-child'))

    expect(intersects(firstContainer, secondContainer)).toBe(false)
    expect(contains(firstContainer, firstChild)).toBe(true)
    expect(contains(secondContainer, secondChild)).toBe(true)
    expect(firstChild).not.toEqual(secondChild)
  })

  it('keeps manual offsets scoped to the moved node', () => {
    const strategy = makeStrategy()
    const topology = new FdGraphLayoutTopology<string, string, string>({
      nodeIDs: ['container', 'first', 'second'],
      ports: [],
      edges: [],
      containments: [{ containerNodeID: 'container', memberNodeIDs: ['first', 'second'] }],
    })
    const baseline = strategy.layout(makeInput(topology, strategy))
    const moved = strategy.layout(
      makeInput(topology, strategy, {
        placementState: [{ nodeID: 'second', offset: { width: 35, height: 18 } }],
      }),
    )
    const baselineSecond = required(baseline.frame('second'))
    const movedSecond = required(moved.frame('second'))

    expect(moved.frame('first')).toEqual(baseline.frame('first'))
    expect(movedSecond.x).toBeCloseTo(baselineSecond.x + 35)
    expect(movedSecond.y).toBeCloseTo(baselineSecond.y + 18)
  })

  it('accepts a replaceable container geometry stage', () => {
    const geometry: FdCompoundContainerGeometryResolver<string, string> = {
      identity: new FdLayoutComponentIdentity(),
      geometry: (context) =>
        new FdCompoundContainerGeometry(
          { width: 400, height: 300 },
          { x: 50, y: 70 },
          context.portAnchors,
        ),
    }
    const strategy = new FdCompoundLayout<string, string, string>(
      makeLevelLayout(),
      geometry,
      new FdCubicEdgeRouter(),
    )
    const topology = new FdGraphLayoutTopology<string, string, string>({
      nodeIDs: ['container', 'child'],
      ports: [],
      edges: [],
      containments: [{ containerNodeID: 'container', memberNodeIDs: ['child'] }],
    })
    const result = strategy.layout(makeInput(topology, strategy))

    expect(result.frame('container')).toMatchObject({ width: 400, height: 300 })
    expect(result.frame('child')).toMatchObject({ x: 50, y: 70 })
  })

  it('returns structured failures for invalid custom geometry', () => {
    const topology = new FdGraphLayoutTopology<string, string, string>({
      nodeIDs: ['container', 'child'],
      ports: [],
      edges: [],
      containments: [{ containerNodeID: 'container', memberNodeIDs: ['child'] }],
    })
    const geometry: FdCompoundContainerGeometryResolver<string, string> = {
      identity: new FdLayoutComponentIdentity(),
      geometry: (context) =>
        new FdCompoundContainerGeometry(
          { width: 20, height: 20 },
          { x: 10, y: 10 },
          context.portAnchors,
        ),
    }
    const strategy = new FdCompoundLayout<string, string, string>(
      makeLevelLayout(),
      geometry,
      new FdCubicEdgeRouter(),
    )

    expect(() => strategy.layout(makeInput(topology, strategy))).toThrowError(
      expect.objectContaining({
        constructor: FdCompoundLayoutIssue,
        kind: 'contentExceedsContainer',
        details: { nodeID: 'container' },
      }),
    )
  })

  it('rejects invalid custom port anchors', () => {
    const key = { nodeID: 'container', portID: 'external' }
    const topology = new FdGraphLayoutTopology<string, string, string>({
      nodeIDs: ['container', 'child'],
      ports: [new FdGraphLayoutPort(key)],
      edges: [],
      containments: [{ containerNodeID: 'container', memberNodeIDs: ['child'] }],
    })
    const geometry: FdCompoundContainerGeometryResolver<string, string> = {
      identity: new FdLayoutComponentIdentity(),
      geometry: (context) =>
        new FdCompoundContainerGeometry(
          { width: 400, height: 300 },
          { x: 50, y: 70 },
          context.portAnchors.map((anchor) => ({
            ...anchor,
            position: { x: Number.NaN, y: 0 },
          })),
        ),
    }
    const strategy = new FdCompoundLayout<string, string, string>(
      makeLevelLayout(),
      geometry,
      new FdCubicEdgeRouter(),
    )

    expect(() => strategy.layout(makeInput(topology, strategy))).toThrowError(
      expect.objectContaining({ kind: 'invalidPortAnchor', details: { key } }),
    )
  })

  it('uses no recursive call stack for deep containment', () => {
    const nodeCount = 2_000
    const nodeIDs = Array.from({ length: nodeCount }, (_, index) => String(index))
    const strategy = new FdCompoundLayout<string, string, string>(
      new FdLayeredDAGLayout(
        new FdLayeredLayoutConfiguration(0, 0, 0, new FdLayoutInsets(0, 0), {
          width: 0,
          height: 0,
        }),
      ),
      new FdPaddedCompoundContainerGeometry(
        new FdPaddedCompoundContainerConfiguration(new FdLayoutInsets(0, 0), 0),
      ),
      new FdCubicEdgeRouter(),
    )
    const topology = new FdGraphLayoutTopology<string, string, string>({
      nodeIDs,
      ports: [],
      edges: [],
      containments: nodeIDs.slice(0, -1).map((nodeID, index) => ({
        containerNodeID: nodeID,
        memberNodeIDs: [String(index + 1)],
      })),
    })
    const result = strategy.layout(
      makeInput(topology, strategy, {
        sizes: Object.fromEntries(nodeIDs.map((nodeID) => [nodeID, { width: 10, height: 10 }])),
      }),
    )

    expect(result.nodeFrames).toHaveLength(nodeCount)
    expect(
      contains(required(result.frame('0')), required(result.frame(String(nodeCount - 1)))),
    ).toBe(true)
  })

  it('rejects input for another pipeline', () => {
    const strategy = makeStrategy()
    const topology = new FdGraphLayoutTopology<string, string, string>({
      nodeIDs: ['node'],
      ports: [],
      edges: [],
    })
    const input = new FdGraphLayoutInput({
      id: new FdLayoutInputID(
        topology.snapshotID,
        new FdLayoutPipelineIdentity(new FdLayoutComponentIdentity()),
        new FdLayoutComponentIdentity(),
        new FdLayoutComponentIdentity(),
        new FdLayoutRevision(),
      ),
      topology,
      nodeSizes: [{ nodeID: 'node', size: { width: 100, height: 60 } }],
      portAnchors: [],
    })

    expect(() => strategy.layout(input)).toThrowError(FdGraphLayoutPipelineError)
  })
})

const routeEnd = (route: {
  readonly start: { readonly x: number; readonly y: number }
  readonly segments: readonly { readonly end: { readonly x: number; readonly y: number } }[]
}) => route.segments.at(-1)?.end ?? route.start

const samePortKey = (
  first: FdGraphLayoutPortKey<string, string>,
  second: FdGraphLayoutPortKey<string, string>,
) => first.nodeID === second.nodeID && first.portID === second.portID

const contains = (outer: FdCanvasRect, inner: FdCanvasRect) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.width >= inner.x + inner.width &&
  outer.y + outer.height >= inner.y + inner.height

const intersects = (first: FdCanvasRect, second: FdCanvasRect) =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y

const required = <Value>(value: Value | undefined): Value => {
  if (value === undefined) throw new Error('test invariant failed')
  return value
}
