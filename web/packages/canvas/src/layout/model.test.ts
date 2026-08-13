import { describe, expect, it } from 'vitest'
import {
  FdGraphLayoutInput,
  FdGraphLayoutInputIssue,
  FdGraphLayoutPort,
  FdGraphLayoutTopology,
  FdGraphLayoutTopologyIssue,
  FdLayoutComponentIdentity,
  FdLayoutInputID,
  FdLayoutPipelineIdentity,
  FdLayoutPipelineStageRole,
  FdLayoutRevision,
  sameLayoutInputID,
} from './model.js'

const inputID = (snapshotID: string): FdLayoutInputID =>
  new FdLayoutInputID(
    snapshotID,
    new FdLayoutPipelineIdentity(new FdLayoutComponentIdentity('pipeline')),
    new FdLayoutComponentIdentity('node-size'),
    new FdLayoutComponentIdentity('port-anchor'),
    new FdLayoutRevision(),
  )

describe('graph layout model', () => {
  it('preserves Swift layout identity structure', () => {
    const component = new FdLayoutComponentIdentity('layout', 3)
    const pipeline = new FdLayoutPipelineIdentity(component, FdLayoutPipelineStageRole.placement)

    expect(pipeline.stages).toEqual([
      {
        kind: 'component',
        role: FdLayoutPipelineStageRole.placement,
        identity: component,
      },
    ])
    expect(() => new FdLayoutComponentIdentity('layout', -1)).toThrow(RangeError)
    expect(() => new FdLayoutPipelineStageRole('')).toThrow(RangeError)
  })

  it('compares layout input identity by value across object boundaries', () => {
    const makeID = () =>
      new FdLayoutInputID(
        'snapshot',
        new FdLayoutPipelineIdentity(new FdLayoutComponentIdentity('pipeline', 2)),
        new FdLayoutComponentIdentity('node-size', 3),
        new FdLayoutComponentIdentity('port-anchor', 4),
        new FdLayoutRevision('layout-state'),
      )

    expect(sameLayoutInputID(makeID(), makeID())).toBe(true)
    expect(
      sameLayoutInputID(
        makeID(),
        new FdLayoutInputID(
          'snapshot',
          new FdLayoutPipelineIdentity(new FdLayoutComponentIdentity('pipeline', 2)),
          new FdLayoutComponentIdentity('node-size', 3),
          new FdLayoutComponentIdentity('port-anchor', 4),
          new FdLayoutRevision('different-state'),
        ),
      ),
    ).toBe(false)
  })

  it('indexes directed, undirected, port, and containment relationships', () => {
    const topology = new FdGraphLayoutTopology({
      snapshotID: 'snapshot',
      nodeIDs: ['root', 'child', 'peer'],
      ports: [new FdGraphLayoutPort('output', 'root')],
      edges: [
        {
          id: 'directed',
          endpoints: {
            kind: 'directed',
            source: { kind: 'port', key: { nodeID: 'root', portID: 'output' } },
            target: { kind: 'node', nodeID: 'child' },
          },
        },
        {
          id: 'undirected',
          endpoints: {
            kind: 'undirected',
            first: { kind: 'node', nodeID: 'child' },
            second: { kind: 'node', nodeID: 'peer' },
          },
        },
      ],
      containments: [{ containerNodeID: 'root', memberNodeIDs: ['child'] }],
    })

    expect(topology.directedSuccessorNodeIDs('root')).toEqual(['child'])
    expect(topology.directedPredecessorNodeIDs('child')).toEqual(['root'])
    expect(topology.adjacentNodeIDs('child')).toEqual(['root', 'peer'])
    expect(topology.memberNodeIDs('root')).toEqual(['child'])
    expect(topology.containerNodeID('child')).toBe('root')
    expect(topology.rootNodeIDs).toEqual(['root', 'peer'])
    expect(topology.weaklyConnectedComponents()).toEqual([['root', 'child', 'peer']])
  })

  it('rejects invalid topology using Swift issue names', () => {
    expect(
      () =>
        new FdGraphLayoutTopology({
          nodeIDs: ['node'],
          ports: [],
          edges: [],
          containments: [{ containerNodeID: 'node', memberNodeIDs: ['node'] }],
        }),
    ).toThrowError(expect.objectContaining({ kind: 'selfContainment' }))

    try {
      new FdGraphLayoutTopology({
        nodeIDs: ['one', 'two'],
        ports: [],
        edges: [],
        containments: [
          { containerNodeID: 'one', memberNodeIDs: ['two'] },
          { containerNodeID: 'two', memberNodeIDs: ['one'] },
        ],
      })
      throw new Error('expected containment cycle')
    } catch (error) {
      expect(error).toBeInstanceOf(FdGraphLayoutTopologyIssue)
      expect((error as FdGraphLayoutTopologyIssue).kind).toBe('containmentCycle')
      expect((error as FdGraphLayoutTopologyIssue).details.nodeIDs).toEqual(['one', 'two', 'one'])
    }
  })

  it('normalizes layout input into topology order', () => {
    const topology = new FdGraphLayoutTopology({
      snapshotID: 'input',
      nodeIDs: ['one', 'two'],
      ports: [new FdGraphLayoutPort('input', 'two')],
      edges: [],
    })
    const input = new FdGraphLayoutInput({
      id: inputID('input'),
      topology,
      nodeSizes: [
        { nodeID: 'two', size: { width: 20, height: 30 } },
        { nodeID: 'one', size: { width: 10, height: 15 } },
      ],
      portAnchors: [
        {
          key: { nodeID: 'two', portID: 'input' },
          position: { x: 0, y: 15 },
          normal: { dx: -1, dy: 0 },
        },
      ],
      placementState: [{ nodeID: 'two', offset: { width: 5, height: -3 } }],
    })

    expect(input.nodeSizes.map(({ nodeID }) => nodeID)).toEqual(['one', 'two'])
    expect(input.size('two')).toEqual({ width: 20, height: 30 })
    expect(input.anchor({ nodeID: 'two', portID: 'input' })?.normal).toEqual({ dx: -1, dy: 0 })
    expect(input.placementOffset('one')).toEqual({ width: 0, height: 0 })
    expect(input.placementOffset('two')).toEqual({ width: 5, height: -3 })
  })

  it('rejects incomplete and mismatched layout input', () => {
    const topology = new FdGraphLayoutTopology({
      snapshotID: 'expected',
      nodeIDs: ['node'],
      ports: [],
      edges: [],
    })

    expect(
      () =>
        new FdGraphLayoutInput({
          id: inputID('other'),
          topology,
          nodeSizes: [{ nodeID: 'node', size: { width: 10, height: 10 } }],
          portAnchors: [],
        }),
    ).toThrowError(expect.objectContaining({ kind: 'presentationSnapshotIdentityMismatch' }))

    try {
      new FdGraphLayoutInput({
        id: inputID('expected'),
        topology,
        nodeSizes: [],
        portAnchors: [],
      })
      throw new Error('expected missing node size')
    } catch (error) {
      expect(error).toBeInstanceOf(FdGraphLayoutInputIssue)
      expect((error as FdGraphLayoutInputIssue).kind).toBe('missingNodeSize')
    }
  })

  it('validates DAGs with stable topology order and snapshot identity', () => {
    const topology = new FdGraphLayoutTopology({
      snapshotID: 'dag',
      nodeIDs: ['a', 'b', 'c', 'd'],
      ports: [],
      edges: [
        {
          id: 'ac',
          endpoints: {
            kind: 'directed',
            source: { kind: 'node', nodeID: 'a' },
            target: { kind: 'node', nodeID: 'c' },
          },
        },
        {
          id: 'bc',
          endpoints: {
            kind: 'directed',
            source: { kind: 'node', nodeID: 'b' },
            target: { kind: 'node', nodeID: 'c' },
          },
        },
        {
          id: 'cd',
          endpoints: {
            kind: 'directed',
            source: { kind: 'node', nodeID: 'c' },
            target: { kind: 'node', nodeID: 'd' },
          },
        },
      ],
    })
    const input = new FdGraphLayoutInput({
      id: inputID('dag'),
      topology,
      nodeSizes: topology.nodeIDs.map((nodeID) => ({
        nodeID,
        size: { width: 10, height: 10 },
      })),
      portAnchors: [],
    })

    const result = input.validateDAG()

    expect(result.kind).toBe('valid')
    if (result.kind !== 'valid') throw new Error('expected valid DAG')
    expect(result.view.topologicalNodeIDs).toEqual(['a', 'b', 'c', 'd'])
    expect(result.view.snapshotID).toBe('dag')
    expect(result.view.input).toBe(input)
  })

  it('reports undirected edges before attempting DAG ordering', () => {
    const topology = new FdGraphLayoutTopology({
      snapshotID: 'undirected',
      nodeIDs: ['a', 'b', 'c'],
      ports: [],
      edges: [
        {
          id: 'first',
          endpoints: {
            kind: 'undirected',
            first: { kind: 'node', nodeID: 'a' },
            second: { kind: 'node', nodeID: 'b' },
          },
        },
        {
          id: 'second',
          endpoints: {
            kind: 'undirected',
            first: { kind: 'node', nodeID: 'b' },
            second: { kind: 'node', nodeID: 'c' },
          },
        },
      ],
    })
    const input = new FdGraphLayoutInput({
      id: inputID('undirected'),
      topology,
      nodeSizes: topology.nodeIDs.map((nodeID) => ({
        nodeID,
        size: { width: 10, height: 10 },
      })),
      portAnchors: [],
    })

    const result = input.validateDAG()

    expect(result.kind).toBe('invalid')
    if (result.kind !== 'invalid') throw new Error('expected invalid DAG')
    expect(result.issue).toMatchObject({ kind: 'undirectedEdges', edgeIDs: ['first', 'second'] })
  })

  it('reports the exact directed cycle edge path', () => {
    const topology = new FdGraphLayoutTopology({
      snapshotID: 'cycle',
      nodeIDs: ['a', 'b', 'c'],
      ports: [],
      edges: [
        {
          id: 'ab',
          endpoints: {
            kind: 'directed',
            source: { kind: 'node', nodeID: 'a' },
            target: { kind: 'node', nodeID: 'b' },
          },
        },
        {
          id: 'bc',
          endpoints: {
            kind: 'directed',
            source: { kind: 'node', nodeID: 'b' },
            target: { kind: 'node', nodeID: 'c' },
          },
        },
        {
          id: 'ca',
          endpoints: {
            kind: 'directed',
            source: { kind: 'node', nodeID: 'c' },
            target: { kind: 'node', nodeID: 'a' },
          },
        },
        {
          id: 'ac',
          endpoints: {
            kind: 'directed',
            source: { kind: 'node', nodeID: 'a' },
            target: { kind: 'node', nodeID: 'c' },
          },
        },
      ],
    })
    const input = new FdGraphLayoutInput({
      id: inputID('cycle'),
      topology,
      nodeSizes: topology.nodeIDs.map((nodeID) => ({
        nodeID,
        size: { width: 10, height: 10 },
      })),
      portAnchors: [],
    })

    const result = input.validateDAG()

    expect(result.kind).toBe('invalid')
    if (result.kind !== 'invalid') throw new Error('expected invalid DAG')
    expect(result.issue).toMatchObject({ kind: 'cycle', edgePath: ['ab', 'bc', 'ca'] })
  })
})
