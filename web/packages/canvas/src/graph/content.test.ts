import { describe, expect, it } from 'vitest'
import {
  FdGraphLayoutInput,
  FdLayoutComponentIdentity,
  FdLayoutInputID,
  FdLayoutPipelineIdentity,
  FdLayoutRevision,
} from '../layout/model.js'
import { FdGraphEdgeRoute, FdGraphLayoutResult, FdGraphNodePlacement } from '../layout/pipeline.js'
import {
  FdGraphCanvasContent,
  FdGraphCanvasContentIssue,
  FdGraphCanvasLayoutAdapter,
} from './content.js'
import {
  FdGraphElementAddress,
  FdGraphInstanceAddress,
  FdGraphInstanceHandle,
  FdGraphInstanceNodeAddress,
  FdGraphInstancePath,
  FdGraphPresentation,
  FdGraphPresentationLocalElementID,
} from './presentation.js'

const root = new FdGraphInstanceHandle(0)
const sourceNodeLocalID = FdGraphPresentationLocalElementID.source({
  instanceHandle: root,
  elementID: { kind: 'node', nodeID: 'source-node' },
})
const sourcePortLocalID = FdGraphPresentationLocalElementID.source({
  instanceHandle: root,
  elementID: {
    kind: 'port',
    key: { nodeID: 'source-node', portID: 'output' },
  },
})
const targetNodeLocalID = FdGraphPresentationLocalElementID.source({
  instanceHandle: root,
  elementID: { kind: 'node', nodeID: 'target-node' },
})
const targetPortLocalID = FdGraphPresentationLocalElementID.source({
  instanceHandle: root,
  elementID: {
    kind: 'port',
    key: { nodeID: 'target-node', portID: 'input' },
  },
})
const edgeLocalID = FdGraphPresentationLocalElementID.source({
  instanceHandle: root,
  elementID: { kind: 'edge', edgeID: 'edge' },
})

const elementAddress = (
  elementID:
    | { readonly kind: 'node'; readonly nodeID: string }
    | {
        readonly kind: 'port'
        readonly key: { readonly nodeID: string; readonly portID: string }
      }
    | { readonly kind: 'edge'; readonly edgeID: string },
) =>
  new FdGraphElementAddress({
    instancePath: FdGraphInstancePath.root,
    graphID: 'graph',
    elementID,
  })

const presentation = () =>
  new FdGraphPresentation({
    snapshotID: 'presentation-1',
    documentSnapshotID: 'document-1',
    entryPointID: 'main',
    focusPath: FdGraphInstancePath.root,
    instances: [],
    nodes: [
      {
        id: 'source',
        localID: sourceNodeLocalID,
        address: elementAddress({ kind: 'node', nodeID: 'source-node' }),
        value: { title: 'Source' },
      },
      {
        id: 'target',
        localID: targetNodeLocalID,
        address: elementAddress({ kind: 'node', nodeID: 'target-node' }),
        value: { title: 'Target' },
      },
    ],
    ports: [
      {
        id: 'source-output',
        localID: sourcePortLocalID,
        address: elementAddress({
          kind: 'port',
          key: { nodeID: 'source-node', portID: 'output' },
        }),
        value: undefined,
      },
      {
        id: 'target-input',
        localID: targetPortLocalID,
        address: elementAddress({
          kind: 'port',
          key: { nodeID: 'target-node', portID: 'input' },
        }),
        value: undefined,
      },
    ],
    edges: [
      {
        id: 'edge',
        localID: edgeLocalID,
        address: elementAddress({ kind: 'edge', edgeID: 'edge' }),
        endpoints: {
          kind: 'directed',
          source: { kind: 'port', id: 'source-output' },
          target: { kind: 'port', id: 'target-input' },
        },
        value: undefined,
      },
    ],
    contextEdges: [],
  })

const layout = (source = presentation(), identitySuffix = '') => {
  const topology = FdGraphCanvasLayoutAdapter.topology(source)
  const component = new FdLayoutComponentIdentity(`test-layout${identitySuffix}`)
  const input = new FdGraphLayoutInput({
    id: new FdLayoutInputID(
      source.snapshotID,
      new FdLayoutPipelineIdentity(component),
      component,
      component,
      new FdLayoutRevision(`state-1${identitySuffix}`),
    ),
    topology,
    nodeSizes: [
      { nodeID: sourceNodeLocalID, size: { width: 100, height: 80 } },
      { nodeID: targetNodeLocalID, size: { width: 100, height: 80 } },
    ],
    portAnchors: [
      {
        key: { nodeID: sourceNodeLocalID, portID: sourcePortLocalID },
        position: { x: 100, y: 40 },
        normal: { dx: 1, dy: 0 },
      },
      {
        key: { nodeID: targetNodeLocalID, portID: targetPortLocalID },
        position: { x: 0, y: 40 },
        normal: { dx: -1, dy: 0 },
      },
    ],
  })
  const placement = new FdGraphNodePlacement(
    input,
    [
      { nodeID: sourceNodeLocalID, frame: { x: 0, y: 0, width: 100, height: 80 } },
      { nodeID: targetNodeLocalID, frame: { x: 240, y: 0, width: 100, height: 80 } },
    ],
    { x: 0, y: 0, width: 340, height: 80 },
  )
  const result = new FdGraphLayoutResult(input, placement, [
    {
      edgeID: edgeLocalID,
      route: new FdGraphEdgeRoute({ x: 100, y: 40 }, [{ kind: 'line', end: { x: 240, y: 40 } }]),
    },
  ])
  return { input, result }
}

describe('graph canvas presentation identity', () => {
  it('round-trips Swift-aligned source and context local identities', () => {
    expect(FdGraphPresentationLocalElementID.decode(sourcePortLocalID)).toEqual({
      kind: 'source',
      instanceHandle: new FdGraphInstanceHandle(0),
      elementID: {
        kind: 'port',
        key: { nodeID: 'source-node', portID: 'output' },
      },
      occurrenceID: undefined,
    })

    const context = FdGraphPresentationLocalElementID.subgraphContext({
      instanceHandle: new FdGraphInstanceHandle(3),
      linkID: 'details',
    })
    expect(FdGraphPresentationLocalElementID.decode(context)).toEqual({
      kind: 'subgraphContext',
      instanceHandle: new FdGraphInstanceHandle(3),
      linkID: 'details',
    })

    const occurrence = FdGraphPresentationLocalElementID.source({
      instanceHandle: root,
      elementID: { kind: 'node', nodeID: 'source-node' },
      occurrenceID: 0,
    })
    expect(FdGraphPresentationLocalElementID.decode(occurrence)).toMatchObject({
      kind: 'source',
      occurrenceID: 0,
    })
  })
})

describe('graph canvas content', () => {
  it('builds layout topology directly from the presentation', () => {
    const topology = FdGraphCanvasLayoutAdapter.topology(presentation())

    expect(topology.nodeIDs).toEqual([sourceNodeLocalID, targetNodeLocalID])
    expect(topology.ports.map(({ key }) => key)).toEqual([
      { nodeID: sourceNodeLocalID, portID: sourcePortLocalID },
      { nodeID: targetNodeLocalID, portID: targetPortLocalID },
    ])
    expect(topology.edges).toEqual([
      {
        id: edgeLocalID,
        endpoints: {
          kind: 'directed',
          source: {
            kind: 'port',
            key: { nodeID: sourceNodeLocalID, portID: sourcePortLocalID },
          },
          target: {
            kind: 'port',
            key: { nodeID: targetNodeLocalID, portID: targetPortLocalID },
          },
        },
      },
    ])
  })

  it('projects expanded subgraph contexts into layout containment', () => {
    const childHandle = new FdGraphInstanceHandle(1)
    const containerLocalID = FdGraphPresentationLocalElementID.source({
      instanceHandle: root,
      elementID: { kind: 'node', nodeID: 'container' },
    })
    const childLocalID = FdGraphPresentationLocalElementID.source({
      instanceHandle: childHandle,
      elementID: { kind: 'node', nodeID: 'child' },
    })
    const instance = new FdGraphInstanceAddress(FdGraphInstancePath.root, 'child-graph')
    const source = new FdGraphPresentation({
      snapshotID: 'nested-presentation',
      documentSnapshotID: 'document-1',
      entryPointID: 'main',
      focusPath: FdGraphInstancePath.root,
      instances: [],
      nodes: [
        {
          id: 'container',
          localID: containerLocalID,
          address: elementAddress({ kind: 'node', nodeID: 'container' }),
          value: undefined,
        },
        {
          id: 'child',
          localID: childLocalID,
          address: elementAddress({ kind: 'node', nodeID: 'child' }),
          value: undefined,
        },
      ],
      ports: [],
      edges: [],
      contextEdges: [
        {
          id: 'context',
          localID: FdGraphPresentationLocalElementID.subgraphContext({
            instanceHandle: root,
            linkID: 'details',
          }),
          linkID: 'details',
          sourceInstanceHandle: root,
          site: new FdGraphInstanceNodeAddress(
            new FdGraphInstanceAddress(FdGraphInstancePath.root, 'graph'),
            'container',
          ),
          targetGraphID: 'child-graph',
          targetInstanceHandle: childHandle,
          state: { kind: 'expanded', instanceAddress: instance },
        },
      ],
    })

    expect(FdGraphCanvasLayoutAdapter.topology(source).containments).toEqual([
      { containerNodeID: containerLocalID, memberNodeIDs: [childLocalID] },
    ])
  })

  it('provides identity, geometry, adjacency, and render-index queries', () => {
    const source = presentation()
    const { input, result } = layout(source)
    const content = new FdGraphCanvasContent({
      presentation: source,
      layoutInput: input,
      layoutResult: result,
    })

    expect(content.id).toBe(input.id)
    expect(content.elementIDs).toEqual(
      new Set(['source', 'target', 'source-output', 'target-input', 'edge']),
    )
    expect(content.contains('target')).toBe(true)
    expect(content.localID('source')).toBe(sourceNodeLocalID)
    expect(content.elementID(targetPortLocalID)).toBe('target-input')
    expect(content.node(sourceNodeLocalID)?.value).toEqual({ title: 'Source' })
    expect(content.port(targetPortLocalID)?.id).toBe('target-input')
    expect(content.edge(edgeLocalID)?.id).toBe('edge')
    expect(content.frame(targetNodeLocalID)).toEqual({ x: 240, y: 0, width: 100, height: 80 })
    expect(content.nodePresentationOrder(targetNodeLocalID)).toBe(1)
    expect(content.route(edgeLocalID)?.segments).toHaveLength(1)
    expect(content.anchor(sourcePortLocalID)).toEqual({
      position: { x: 100, y: 40 },
      normal: { dx: 1, dy: 0 },
    })
    expect(content.nodeLocalID(targetPortLocalID)).toBe(targetNodeLocalID)
    expect(content.portLocalIDs(sourceNodeLocalID)).toEqual([sourcePortLocalID])
    expect(content.incidentEdgeLocalIDs(sourceNodeLocalID)).toEqual([edgeLocalID])
    expect(content.endpointNodeLocalIDs(edgeLocalID)).toEqual({
      first: sourceNodeLocalID,
      second: targetNodeLocalID,
    })
    expect(content.edgeAnchors(edgeLocalID)).toEqual({
      first: { position: { x: 100, y: 40 }, normal: { dx: 1, dy: 0 } },
      second: { position: { x: 240, y: 40 }, normal: { dx: -1, dy: 0 } },
      isDirected: true,
    })
    expect(content.bounds(new Set(['source', 'edge']))).toEqual({
      x: 0,
      y: 0,
      width: 240,
      height: 80,
    })
    expect(content.renderElementIDs({ x: -10, y: -10, width: 150, height: 100 }).nodeIDs).toEqual([
      sourceNodeLocalID,
    ])
    expect(content.nearestNodeLocalID({ x: 310, y: 40 })).toBe(targetNodeLocalID)
  })

  it('rejects presentation, layout identity, and topology mismatches', () => {
    const source = presentation()
    const { input, result } = layout(source)
    const otherPresentation = new FdGraphPresentation({
      ...source,
      snapshotID: 'presentation-2',
    })

    expect(
      () =>
        new FdGraphCanvasContent({
          presentation: otherPresentation,
          layoutInput: input,
          layoutResult: result,
        }),
    ).toThrow(expect.objectContaining({ kind: 'presentationSnapshotIdentityMismatch' }))

    const otherLayout = layout(source, '-other')
    expect(
      () =>
        new FdGraphCanvasContent({
          presentation: source,
          layoutInput: input,
          layoutResult: otherLayout.result,
        }),
    ).toThrow(expect.objectContaining({ kind: 'layoutInputIdentityMismatch' }))

    const reversedPresentation = new FdGraphPresentation({
      ...source,
      nodes: [...source.nodes].reverse(),
    })
    expect(
      () =>
        new FdGraphCanvasContent({
          presentation: reversedPresentation,
          layoutInput: input,
          layoutResult: result,
        }),
    ).toThrow(expect.objectContaining({ kind: 'layoutTopologyMismatch' }))
  })

  it('rejects duplicate identities, invalid ownership, and invalid endpoints', () => {
    const source = presentation()
    expect(() =>
      FdGraphCanvasLayoutAdapter.topology(
        new FdGraphPresentation({
          ...source,
          nodes: [
            source.nodes[0] as (typeof source.nodes)[number],
            source.nodes[0] as (typeof source.nodes)[number],
          ],
        }),
      ),
    ).toThrow(expect.objectContaining({ kind: 'duplicateLocalIdentity' }))

    expect(() =>
      FdGraphCanvasLayoutAdapter.topology(
        new FdGraphPresentation({
          ...source,
          nodes: [
            source.nodes[0] as (typeof source.nodes)[number],
            {
              ...(source.nodes[1] as (typeof source.nodes)[number]),
              id: 'source',
            },
          ],
        }),
      ),
    ).toThrow(expect.objectContaining({ kind: 'duplicateCanonicalIdentity' }))

    const invalidPortLocalID = FdGraphPresentationLocalElementID.source({
      instanceHandle: root,
      elementID: { kind: 'port', key: { nodeID: 'missing', portID: 'input' } },
    })
    expect(() =>
      FdGraphCanvasLayoutAdapter.topology(
        new FdGraphPresentation({
          ...source,
          ports: [
            {
              ...(source.ports[0] as (typeof source.ports)[number]),
              localID: invalidPortLocalID,
            },
          ],
          edges: [],
        }),
      ),
    ).toThrow(expect.objectContaining({ kind: 'invalidPortOwnership' }))

    expect(() =>
      FdGraphCanvasLayoutAdapter.topology(
        new FdGraphPresentation({
          ...source,
          edges: [
            {
              ...(source.edges[0] as (typeof source.edges)[number]),
              endpoints: {
                kind: 'directed',
                source: { kind: 'node', id: 'missing' },
                target: { kind: 'node', id: 'target' },
              },
            },
          ],
        }),
      ),
    ).toThrow(expect.objectContaining({ kind: 'invalidPresentationEndpoint' }))
  })

  it('translates render-index failures into the canvas content issue', () => {
    const source = presentation()
    const { input, result } = layout(source)
    const malformedResult = {
      inputID: result.inputID,
      nodeFrames: [
        {
          nodeID: sourceNodeLocalID,
          frame: { x: Number.NaN, y: 0, width: 100, height: 80 },
        },
      ],
      edgeRoutes: result.edgeRoutes,
      resolvedPortAnchors: result.resolvedPortAnchors,
      contentBounds: result.contentBounds,
      frame: result.frame.bind(result),
      route: result.route.bind(result),
    } as unknown as typeof result

    expect(
      () =>
        new FdGraphCanvasContent({
          presentation: source,
          layoutInput: input,
          layoutResult: malformedResult,
        }),
    ).toThrow(expect.objectContaining({ kind: 'renderIndexConstructionFailed' }))
  })

  it('uses the dedicated content issue type', () => {
    expect(new FdGraphCanvasContentIssue('layoutTopologyMismatch')).toMatchObject({
      name: 'FdGraphCanvasContentIssue',
      message: 'layoutTopologyMismatch',
      kind: 'layoutTopologyMismatch',
    })
  })
})
