import { describe, expect, it } from 'vitest'
import {
  FdCenteredLayerCoordinates,
  FdLayer,
  FdLayerAssignment,
  FdLayerAssignmentIssue,
  FdLayeredComponent,
  FdLayeredDAGPlacement,
  FdLayeredLayoutConfiguration,
  FdLayoutInsets,
  FdLayerOrdering,
  FdLayerOrderingIssue,
  FdLongestPathLayerAssignment,
  FdStableLayerOrdering,
} from './layered.js'
import {
  FdGraphLayoutInput,
  FdGraphLayoutTopology,
  FdLayoutComponentIdentity,
  FdLayoutInputID,
  FdLayoutPipelineIdentity,
  FdLayoutRevision,
} from './model.js'

const makeInput = (
  nodeIDs: readonly string[],
  edges: readonly { readonly id: string; readonly source: string; readonly target: string }[],
  options: {
    readonly sizes?: Readonly<Record<string, { readonly width: number; readonly height: number }>>
    readonly offsets?: Readonly<Record<string, { readonly width: number; readonly height: number }>>
  } = {},
): FdGraphLayoutInput<string> => {
  const snapshotID = 'layered'
  const topology = new FdGraphLayoutTopology({
    snapshotID,
    nodeIDs,
    ports: [],
    edges: edges.map(({ id, source, target }) => ({
      id,
      endpoints: {
        kind: 'directed',
        source: { kind: 'node', nodeID: source },
        target: { kind: 'node', nodeID: target },
      },
    })),
  })
  return new FdGraphLayoutInput({
    id: new FdLayoutInputID(
      snapshotID,
      new FdLayoutPipelineIdentity(new FdLayoutComponentIdentity('pipeline')),
      new FdLayoutComponentIdentity('sizes'),
      new FdLayoutComponentIdentity('anchors'),
      new FdLayoutRevision(),
    ),
    topology,
    nodeSizes: nodeIDs.map((nodeID) => ({
      nodeID,
      size: options.sizes?.[nodeID] ?? { width: 10, height: 10 },
    })),
    portAnchors: [],
    placementState: nodeIDs.flatMap((nodeID) => {
      const offset = options.offsets?.[nodeID]
      return offset ? [{ nodeID, offset }] : []
    }),
  })
}

const dagView = (input: FdGraphLayoutInput<string>) => {
  const result = input.validateDAG()
  if (result.kind !== 'valid') throw result.issue
  return result.view
}

const configuration = (direction: 'topToBottom' | 'leftToRight' = 'topToBottom') =>
  new FdLayeredLayoutConfiguration(
    30,
    50,
    70,
    new FdLayoutInsets(20, 20),
    { width: 0, height: 0 },
    direction,
  )

const placement = (direction: 'topToBottom' | 'leftToRight' = 'topToBottom') =>
  new FdLayeredDAGPlacement(
    new FdLongestPathLayerAssignment(),
    new FdStableLayerOrdering(),
    new FdCenteredLayerCoordinates(configuration(direction)),
  )

describe('layered DAG strategies', () => {
  it('assigns longest-path ranks in topological order', () => {
    const input = makeInput(
      ['a', 'b', 'c', 'd'],
      [
        { id: 'ac', source: 'a', target: 'c' },
        { id: 'bc', source: 'b', target: 'c' },
        { id: 'cd', source: 'c', target: 'd' },
      ],
    )

    const assignment = new FdLongestPathLayerAssignment().assignLayers(dagView(input))

    expect([...assignment.ranks]).toEqual([
      ['a', 0],
      ['b', 0],
      ['c', 1],
      ['d', 2],
    ])
  })

  it('validates complete nonnegative layer assignments', () => {
    const input = makeInput(['a', 'b'], [])

    expect(() => new FdLayerAssignment(input, [{ nodeID: 'a', rank: 0 }])).toThrowError(
      expect.objectContaining({ kind: 'missingNode', nodeID: 'b' }),
    )
    expect(
      () =>
        new FdLayerAssignment(input, [
          { nodeID: 'a', rank: 0 },
          { nodeID: 'a', rank: 1 },
          { nodeID: 'b', rank: 0 },
        ]),
    ).toThrow(FdLayerAssignmentIssue)
    expect(
      () =>
        new FdLayerAssignment(input, [
          { nodeID: 'a', rank: -1 },
          { nodeID: 'b', rank: 0 },
        ]),
    ).toThrowError(expect.objectContaining({ kind: 'negativeRank', nodeID: 'a' }))
    expect(
      () =>
        new FdLayerAssignment(input, [
          { nodeID: 'a', rank: 0 },
          { nodeID: 'b', rank: 0 },
          { nodeID: 'unknown', rank: 0 },
        ]),
    ).toThrowError(expect.objectContaining({ kind: 'unknownNode', nodeID: 'unknown' }))
  })

  it('orders weak components and siblings stably', () => {
    const input = makeInput(
      ['first-root', 'second-root', 'late-child', 'early-child', 'isolated'],
      [
        { id: 'late', source: 'second-root', target: 'late-child' },
        { id: 'early', source: 'first-root', target: 'early-child' },
      ],
    )
    const view = dagView(input)
    const assignment = new FdLongestPathLayerAssignment().assignLayers(view)

    const ordering = new FdStableLayerOrdering().orderLayers(view, assignment)

    expect(
      ordering.components.map((component) =>
        component.layers.map((layer) => ({ rank: layer.rank, nodeIDs: layer.nodeIDs })),
      ),
    ).toEqual([
      [
        { rank: 0, nodeIDs: ['first-root'] },
        { rank: 1, nodeIDs: ['early-child'] },
      ],
      [
        { rank: 0, nodeIDs: ['second-root'] },
        { rank: 1, nodeIDs: ['late-child'] },
      ],
      [{ rank: 0, nodeIDs: ['isolated'] }],
    ])
  })

  it('normalizes layers and rejects malformed ordering', () => {
    const input = makeInput(['a', 'b'], [{ id: 'ab', source: 'a', target: 'b' }])
    const assignment = new FdLayerAssignment(input, [
      { nodeID: 'a', rank: 0 },
      { nodeID: 'b', rank: 1 },
    ])
    const ordering = new FdLayerOrdering(input, assignment, [
      new FdLayeredComponent([new FdLayer(1, ['b']), new FdLayer(0, ['a'])]),
    ])

    expect(ordering.components[0]?.layers.map(({ rank }) => rank)).toEqual([0, 1])
    expect(
      () =>
        new FdLayerOrdering(input, assignment, [
          new FdLayeredComponent([new FdLayer(0, ['a', 'b'])]),
        ]),
    ).toThrowError(expect.objectContaining({ kind: 'rankMismatch', nodeID: 'b' }))
    expect(() => new FdLayerOrdering(input, assignment, [new FdLayeredComponent([])])).toThrow(
      FdLayerOrderingIssue,
    )
  })

  it('validates layout insets and configuration', () => {
    expect(new FdLayoutInsets(12, 8)).toEqual({
      top: 8,
      leading: 12,
      bottom: 8,
      trailing: 12,
    })
    expect(new FdLayoutInsets(1, 2, 3, 4)).toEqual({
      top: 1,
      leading: 2,
      bottom: 3,
      trailing: 4,
    })
    expect(() => new FdLayoutInsets(-1, 0)).toThrow(RangeError)
    expect(
      () =>
        new FdLayeredLayoutConfiguration(Number.NaN, 0, 0, new FdLayoutInsets(0, 0), {
          width: 0,
          height: 0,
        }),
    ).toThrow(RangeError)
  })

  it('places descendants below their parents using centered coordinates', () => {
    const input = makeInput(
      ['root', 'wide', 'narrow'],
      [
        { id: 'wide-edge', source: 'root', target: 'wide' },
        { id: 'narrow-edge', source: 'root', target: 'narrow' },
      ],
      {
        sizes: {
          root: { width: 100, height: 50 },
          wide: { width: 180, height: 70 },
          narrow: { width: 80, height: 40 },
        },
      },
    )

    const result = placement().place(input)
    const root = result.frame('root')!
    const wide = result.frame('wide')!
    const narrow = result.frame('narrow')!

    expect(root.y + root.height).toBeLessThan(wide.y)
    expect(root.y + root.height).toBeLessThan(narrow.y)
    expect(wide).toMatchObject({ width: 180, height: 70 })
    expect(result.contentBounds.width).toBeGreaterThanOrEqual(300)
  })

  it('places descendants to the right and applies persisted offsets', () => {
    const sizes = {
      root: { width: 100, height: 50 },
      child: { width: 80, height: 40 },
    }
    const input = makeInput(['root', 'child'], [{ id: 'edge', source: 'root', target: 'child' }], {
      sizes,
      offsets: { child: { width: 7, height: -3 } },
    })
    const baselineInput = makeInput(
      ['root', 'child'],
      [{ id: 'edge', source: 'root', target: 'child' }],
      { sizes },
    )

    const result = placement('leftToRight').place(input)
    const baseline = placement('leftToRight').place(baselineInput)

    expect(result.frame('root')!.x + result.frame('root')!.width).toBeLessThan(
      result.frame('child')!.x,
    )
    expect(result.frame('child')!.x - baseline.frame('child')!.x).toBe(7)
    expect(result.frame('child')!.y - baseline.frame('child')!.y).toBe(-3)
  })

  it('uses the configured minimum canvas for empty input', () => {
    const input = makeInput([], [])
    const strategy = new FdLayeredDAGPlacement(
      new FdLongestPathLayerAssignment(),
      new FdStableLayerOrdering(),
      new FdCenteredLayerCoordinates(
        new FdLayeredLayoutConfiguration(0, 0, 0, new FdLayoutInsets(0, 0), {
          width: 640,
          height: 480,
        }),
      ),
    )

    expect(strategy.place(input).contentBounds).toEqual({ x: 0, y: 0, width: 640, height: 480 })
  })

  it('composes Swift pipeline identity roles and rejects cyclic input', () => {
    const assignment = new FdLongestPathLayerAssignment(new FdLayoutComponentIdentity('assignment'))
    const ordering = new FdStableLayerOrdering(new FdLayoutComponentIdentity('ordering'))
    const coordinates = new FdCenteredLayerCoordinates(
      configuration(),
      new FdLayoutComponentIdentity('coordinates'),
    )
    const strategy = new FdLayeredDAGPlacement(assignment, ordering, coordinates)

    expect(
      strategy.identity.stages.map((stage) => ({
        role: stage.role.rawValue,
        id: stage.kind === 'component' ? stage.identity.id : undefined,
      })),
    ).toEqual([
      { role: 'layer-assignment', id: 'assignment' },
      { role: 'layer-ordering', id: 'ordering' },
      { role: 'coordinate-assignment', id: 'coordinates' },
    ])
    expect(() =>
      strategy.place(
        makeInput(
          ['a', 'b'],
          [
            { id: 'ab', source: 'a', target: 'b' },
            { id: 'ba', source: 'b', target: 'a' },
          ],
        ),
      ),
    ).toThrowError(expect.objectContaining({ kind: 'cycle', edgePath: ['ab', 'ba'] }))
  })

  it('remains stack safe for a ten-thousand-node path', () => {
    const nodeCount = 10_000
    const nodeIDs = Array.from({ length: nodeCount }, (_, index) => String(index))
    const edges = Array.from({ length: nodeCount - 1 }, (_, index) => ({
      id: String(index),
      source: String(index),
      target: String(index + 1),
    }))

    const result = placement('leftToRight').place(makeInput(nodeIDs, edges))

    expect(result.nodeFrames).toHaveLength(nodeCount)
    expect(result.frame(String(nodeCount - 1))!.x).toBeGreaterThan(result.frame('0')!.x)
  })
})
