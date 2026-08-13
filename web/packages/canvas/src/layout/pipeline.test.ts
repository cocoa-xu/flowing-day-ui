import { describe, expect, it } from 'vitest'
import {
  FdGraphLayoutInput,
  FdGraphLayoutPort,
  FdGraphLayoutTopology,
  FdLayoutComponentIdentity,
  FdLayoutInputID,
  FdLayoutPipelineIdentity,
  FdLayoutRevision,
} from './model.js'
import {
  FdGraphEdgeRoute,
  FdGraphLayoutPipeline,
  FdGraphLayoutPipelineError,
  FdGraphNodePlacement,
  FdGraphNodePlacementIssue,
} from './pipeline.js'

const placementIdentity = new FdLayoutPipelineIdentity(new FdLayoutComponentIdentity('placement'))
const routingIdentity = new FdLayoutComponentIdentity('routing')

const placementStrategy = {
  identity: placementIdentity,
  place: (input: FdGraphLayoutInput<string, string, string>) =>
    new FdGraphNodePlacement(
      input,
      [
        { nodeID: 'source', frame: { x: 10, y: 20, width: 100, height: 60 } },
        { nodeID: 'target', frame: { x: 250, y: 20, width: 120, height: 60 } },
      ],
      { x: 0, y: 0, width: 400, height: 100 },
    ),
}

const edgeRouter = {
  identity: routingIdentity,
  routes: () => [
    {
      edgeID: 'edge',
      route: new FdGraphEdgeRoute({ x: 110, y: 50 }, [
        { kind: 'line' as const, end: { x: 250, y: 50 } },
      ]),
    },
  ],
}

const makeInput = (pipelineIdentity: FdLayoutPipelineIdentity) => {
  const topology = new FdGraphLayoutTopology({
    snapshotID: 'pipeline',
    nodeIDs: ['source', 'target'],
    ports: [new FdGraphLayoutPort('output', 'source')],
    edges: [
      {
        id: 'edge',
        endpoints: {
          kind: 'directed' as const,
          source: { kind: 'port' as const, key: { nodeID: 'source', portID: 'output' } },
          target: { kind: 'node' as const, nodeID: 'target' },
        },
      },
    ],
  })
  return new FdGraphLayoutInput({
    id: new FdLayoutInputID(
      'pipeline',
      pipelineIdentity,
      new FdLayoutComponentIdentity('node-size'),
      new FdLayoutComponentIdentity('port-anchor'),
      new FdLayoutRevision(),
    ),
    topology,
    nodeSizes: [
      { nodeID: 'source', size: { width: 100, height: 60 } },
      { nodeID: 'target', size: { width: 120, height: 60 } },
    ],
    portAnchors: [
      {
        key: { nodeID: 'source', portID: 'output' },
        position: { x: 100, y: 30 },
        normal: { dx: 1, dy: 0 },
      },
    ],
  })
}

describe('graph layout pipeline', () => {
  it('produces topology-ordered frames, routes, and resolved anchors', () => {
    const pipeline = new FdGraphLayoutPipeline(placementStrategy, edgeRouter)
    const result = pipeline.layout(makeInput(pipeline.identity))

    expect(result.nodeFrames.map(({ nodeID }) => nodeID)).toEqual(['source', 'target'])
    expect(result.edgeRoutes.map(({ edgeID }) => edgeID)).toEqual(['edge'])
    expect(result.resolvedPortAnchors).toEqual([
      {
        key: { nodeID: 'source', portID: 'output' },
        position: { x: 110, y: 50 },
        normal: { dx: 1, dy: 0 },
      },
    ])
    expect(result.frame('target')).toEqual({ x: 250, y: 20, width: 120, height: 60 })
    expect(result.route('edge')?.conservativeBounds).toEqual({
      x: 110,
      y: 50,
      width: 140,
      height: 0,
    })
  })

  it('rejects a placement whose frame size differs from layout input', () => {
    const pipeline = new FdGraphLayoutPipeline(placementStrategy, edgeRouter)
    const input = makeInput(pipeline.identity)

    expect(
      () =>
        new FdGraphNodePlacement(
          input,
          [
            { nodeID: 'source', frame: { x: 0, y: 0, width: 99, height: 60 } },
            { nodeID: 'target', frame: { x: 200, y: 0, width: 120, height: 60 } },
          ],
          { x: 0, y: 0, width: 400, height: 100 },
        ),
    ).toThrowError(expect.objectContaining({ kind: 'nodeFrameSizeMismatch' }))
  })

  it('rejects input created for a different pipeline identity', () => {
    const pipeline = new FdGraphLayoutPipeline(placementStrategy, edgeRouter)
    const input = makeInput(
      new FdLayoutPipelineIdentity(new FdLayoutComponentIdentity('other-placement')),
    )

    expect(() => pipeline.layout(input)).toThrow(FdGraphLayoutPipelineError)
  })

  it('reports placement validation with the Swift issue type', () => {
    const pipeline = new FdGraphLayoutPipeline(placementStrategy, edgeRouter)
    const input = makeInput(pipeline.identity)

    try {
      new FdGraphNodePlacement(input, [], { x: 0, y: 0, width: 1, height: 1 })
      throw new Error('expected missing node frame')
    } catch (error) {
      expect(error).toBeInstanceOf(FdGraphNodePlacementIssue)
      expect((error as FdGraphNodePlacementIssue).kind).toBe('missingNodeFrame')
    }
  })
})
