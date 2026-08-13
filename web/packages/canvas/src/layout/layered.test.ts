import { describe, expect, it } from 'vitest'
import {
  FdLayer,
  FdLayerAssignment,
  FdLayerAssignmentIssue,
  FdLayeredComponent,
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
    nodeSizes: nodeIDs.map((nodeID) => ({ nodeID, size: { width: 10, height: 10 } })),
    portAnchors: [],
  })
}

const dagView = (input: FdGraphLayoutInput<string>) => {
  const result = input.validateDAG()
  if (result.kind !== 'valid') throw result.issue
  return result.view
}

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
})
