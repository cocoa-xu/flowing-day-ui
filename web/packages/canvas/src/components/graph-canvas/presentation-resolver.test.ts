import { describe, expect, it } from 'vitest'
import { FdGraphCanvasContent, FdGraphCanvasLayoutAdapter } from '../../graph/content.js'
import {
  FdGraphElementAddress,
  FdGraphInstanceHandle,
  FdGraphInstancePath,
  FdGraphPresentation,
  FdGraphPresentationLocalElementID,
} from '../../graph/presentation.js'
import {
  FdGraphCanvasSessionState,
  FdGraphCanvasTransientNodeDrag,
  FdGraphCanvasTransientNodeResize,
} from '../../interactions/session.js'
import {
  FdGraphLayoutInput,
  FdLayoutComponentIdentity,
  FdLayoutInputID,
  FdLayoutPipelineIdentity,
  FdLayoutRevision,
} from '../../layout/model.js'
import {
  FdGraphEdgeRoute,
  FdGraphLayoutResult,
  FdGraphNodePlacement,
} from '../../layout/pipeline.js'
import { FdGraphCanvasPresentationResolver } from './presentation-resolver.js'

const root = new FdGraphInstanceHandle(0)
const sourceNodeLocalID = FdGraphPresentationLocalElementID.source({
  instanceHandle: root,
  elementID: { kind: 'node', nodeID: 'source-node' },
})
const sourcePortLocalID = FdGraphPresentationLocalElementID.source({
  instanceHandle: root,
  elementID: { kind: 'port', key: { nodeID: 'source-node', portID: 'output' } },
})
const targetNodeLocalID = FdGraphPresentationLocalElementID.source({
  instanceHandle: root,
  elementID: { kind: 'node', nodeID: 'target-node' },
})
const targetPortLocalID = FdGraphPresentationLocalElementID.source({
  instanceHandle: root,
  elementID: { kind: 'port', key: { nodeID: 'target-node', portID: 'input' } },
})
const edgeLocalID = FdGraphPresentationLocalElementID.source({
  instanceHandle: root,
  elementID: { kind: 'edge', edgeID: 'edge' },
})

const address = (
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

const makeContent = () => {
  const presentation = new FdGraphPresentation({
    snapshotID: 'presentation',
    documentSnapshotID: 'document',
    entryPointID: 'main',
    focusPath: FdGraphInstancePath.root,
    instances: [],
    nodes: [
      {
        id: 'source',
        localID: sourceNodeLocalID,
        address: address({ kind: 'node', nodeID: 'source-node' }),
        value: undefined,
      },
      {
        id: 'target',
        localID: targetNodeLocalID,
        address: address({ kind: 'node', nodeID: 'target-node' }),
        value: undefined,
      },
    ],
    ports: [
      {
        id: 'source-output',
        localID: sourcePortLocalID,
        address: address({
          kind: 'port',
          key: { nodeID: 'source-node', portID: 'output' },
        }),
        value: undefined,
      },
      {
        id: 'target-input',
        localID: targetPortLocalID,
        address: address({
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
        address: address({ kind: 'edge', edgeID: 'edge' }),
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
  const component = new FdLayoutComponentIdentity('presentation-resolver')
  const input = new FdGraphLayoutInput({
    id: new FdLayoutInputID(
      presentation.snapshotID,
      new FdLayoutPipelineIdentity(component),
      component,
      component,
      new FdLayoutRevision('state'),
    ),
    topology: FdGraphCanvasLayoutAdapter.topology(presentation),
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
        position: { x: 240, y: 40 },
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
  return new FdGraphCanvasContent({ presentation, layoutInput: input, layoutResult: result })
}

describe('graph canvas presentation resolver', () => {
  it('applies matching transient drag geometry to nodes, ports, and edges', () => {
    const content = makeContent()
    const session = new FdGraphCanvasSessionState({
      transientNodeDrag: new FdGraphCanvasTransientNodeDrag({
        nodeID: 'source',
        basePresentationSnapshotID: content.presentation.snapshotID,
        baseLayoutInputID: content.id,
        translation: { width: 300, height: 20 },
      }),
    })
    const resolver = new FdGraphCanvasPresentationResolver(content, session)

    expect(resolver.nodeFrame(sourceNodeLocalID)).toEqual({
      x: 300,
      y: 20,
      width: 100,
      height: 80,
    })
    const sourceAnchor = content.anchor(sourcePortLocalID)
    expect(sourceAnchor).toBeDefined()
    expect(resolver.anchor(sourceAnchor!, sourceNodeLocalID).position).toEqual({ x: 400, y: 60 })
    expect(resolver.edgeRoute(edgeLocalID)).toMatchObject({
      start: { x: 400, y: 60 },
      segments: [{ end: { x: 240, y: 40 } }],
    })
  })

  it('keeps transient nodes visible after moving from outside the viewport', () => {
    const content = makeContent()
    const session = new FdGraphCanvasSessionState({
      transientNodeDrag: new FdGraphCanvasTransientNodeDrag({
        nodeID: 'source',
        basePresentationSnapshotID: content.presentation.snapshotID,
        baseLayoutInputID: content.id,
        translation: { width: 300, height: 0 },
      }),
    })

    const visible = new FdGraphCanvasPresentationResolver(content, session).visibleElementIDs({
      x: 280,
      y: -20,
      width: 140,
      height: 120,
    })

    expect(visible.nodeIDs).toContain(sourceNodeLocalID)
    expect(visible.edgeIDs).toContain(edgeLocalID)
    expect(visible.portIDs).toContain(sourcePortLocalID)
  })

  it('applies resize geometry only when no drag is present', () => {
    const content = makeContent()
    const resize = new FdGraphCanvasTransientNodeResize({
      anchorNodeID: 'source',
      basePresentationSnapshotID: content.presentation.snapshotID,
      baseLayoutInputID: content.id,
      nodeOrder: ['source'],
      baseFrames: new Map([['source', { x: 0, y: 0, width: 100, height: 80 }]]),
      edges: new Set(['trailing', 'bottom']),
      bounds: { x: 0, y: 0, width: 200, height: 160 },
    })
    const resolver = new FdGraphCanvasPresentationResolver(
      content,
      new FdGraphCanvasSessionState({ transientNodeResize: resize }),
    )

    expect(resolver.nodeFrame(sourceNodeLocalID)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 160,
    })
    const sourceAnchor = content.anchor(sourcePortLocalID)
    expect(sourceAnchor).toBeDefined()
    expect(resolver.anchor(sourceAnchor!, sourceNodeLocalID).position).toEqual({ x: 200, y: 80 })

    const dragWins = new FdGraphCanvasPresentationResolver(
      content,
      new FdGraphCanvasSessionState({
        transientNodeResize: resize,
        transientNodeDrag: new FdGraphCanvasTransientNodeDrag({
          nodeID: 'source',
          basePresentationSnapshotID: content.presentation.snapshotID,
          baseLayoutInputID: content.id,
        }),
      }),
    )
    expect(dragWins.activeNodeResize).toBeUndefined()
  })

  it('ignores transient state pinned to a different layout input', () => {
    const content = makeContent()
    const component = new FdLayoutComponentIdentity('stale')
    const staleInputID = new FdLayoutInputID(
      content.presentation.snapshotID,
      new FdLayoutPipelineIdentity(component),
      component,
      component,
      new FdLayoutRevision('stale'),
    )
    const resolver = new FdGraphCanvasPresentationResolver(
      content,
      new FdGraphCanvasSessionState({
        transientNodeDrag: new FdGraphCanvasTransientNodeDrag({
          nodeID: 'source',
          basePresentationSnapshotID: content.presentation.snapshotID,
          baseLayoutInputID: staleInputID,
          translation: { width: 300, height: 20 },
        }),
      }),
    )

    expect(resolver.activeNodeDrag).toBeUndefined()
    expect(resolver.nodeFrame(sourceNodeLocalID)).toEqual({ x: 0, y: 0, width: 100, height: 80 })
    expect(resolver.edgeRoute(edgeLocalID)).toBe(content.route(edgeLocalID))
  })
})
