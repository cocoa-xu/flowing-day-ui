import { describe, expect, it } from 'vitest'
import {
  FdGraphLayoutPort,
  FdGraphLayoutTopology,
  FdGraphLayoutTopologyIssue,
  FdLayoutComponentIdentity,
  FdLayoutPipelineIdentity,
  FdLayoutPipelineStageRole,
} from './model.js'

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
})
