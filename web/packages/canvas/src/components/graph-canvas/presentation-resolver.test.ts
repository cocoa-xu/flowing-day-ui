import { afterEach, describe, expect, it, vi } from 'vitest'
import { FdGraphCanvasContent, FdGraphCanvasLayoutAdapter } from '../../graph/content.js'
import {
  FdGraphElementAddress,
  FdGraphInstanceHandle,
  FdGraphInstancePath,
  FdGraphPresentation,
  FdGraphPresentationLocalElementID,
} from '../../graph/presentation.js'
import {
  FdGraphCanvasSessionCommand,
  FdGraphCanvasSessionID,
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
import { graphCanvasEngineSnapshot } from './engine-adapter.js'
import { FdGraphCanvas } from './fd-graph-canvas-element.js'
import type { FdGraphCanvasEngine } from './fd-graph-canvas.js'
import { FdGraphCanvasPresentationResolver } from './presentation-resolver.js'

afterEach(() => document.body.replaceChildren())

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
  it('feeds source-aligned content and session state into the private engine', async () => {
    const content = makeContent()
    const element = document.createElement('fd-graph-canvas') as FdGraphCanvas<string>
    element.content = content
    element.session = new FdGraphCanvasSessionState({
      selection: new Set(['source', 'source-output']),
      focusedElementID: 'source-output',
      tool: 'pan',
    })
    document.body.append(element)
    await element.updateComplete
    const engine = element.shadowRoot?.querySelector('fd-graph-canvas-engine') as
      | FdGraphCanvasEngine
      | undefined

    expect(engine?.snapshot.nodes.map(({ id }) => id)).toEqual(['source', 'target'])
    expect(engine?.selectedElements).toEqual([
      { kind: 'node', nodeID: 'source' },
      { kind: 'port', nodeID: 'source', portID: 'source-output' },
    ])
    expect(engine?.focusedElement).toEqual({
      kind: 'port',
      nodeID: 'source',
      portID: 'source-output',
    })
    expect(engine?.tool).toBe('pan')
  })

  it('maps private engine selection and focus changes back to canonical session IDs', async () => {
    const element = document.createElement('fd-graph-canvas') as FdGraphCanvas<string>
    element.content = makeContent()
    document.body.append(element)
    await element.updateComplete
    const engine = element.shadowRoot?.querySelector('fd-graph-canvas-engine')

    engine?.dispatchEvent(
      new CustomEvent('fd-graph-selection-change', {
        detail: {
          selectedElements: [
            { kind: 'port', nodeID: 'target', portID: 'target-input' },
            { kind: 'edge', edgeID: 'edge' },
          ],
          selectedNodeIDs: new Set(),
          phase: 'ended',
          source: 'pointer',
        },
        bubbles: true,
        composed: true,
      }),
    )
    engine?.dispatchEvent(
      new CustomEvent('fd-graph-focus-change', {
        detail: {
          focusedElement: { kind: 'edge', edgeID: 'edge' },
          source: 'pointer',
        },
        bubbles: true,
        composed: true,
      }),
    )

    expect(element.session.selection).toEqual(new Set(['target-input', 'edge']))
    expect(element.session.focusedElementID).toBe('edge')
  })

  it('routes viewport and smart-magnify behavior through the source-aligned callbacks', async () => {
    const element = document.createElement('fd-graph-canvas') as FdGraphCanvas<string>
    element.content = makeContent()
    const onViewportChange = vi.fn()
    const onSmartMagnify = vi.fn(() => ({
      kind: 'focus' as const,
      rect: { x: 0, y: 0, width: 100, height: 80 },
      zoom: 1.5,
    }))
    element.onViewportChange = onViewportChange
    element.onSmartMagnify = onSmartMagnify
    document.body.append(element)
    await element.updateComplete
    const engine = element.shadowRoot?.querySelector(
      'fd-graph-canvas-engine',
    ) as FdGraphCanvasEngine
    const focusRect = vi.spyOn(engine, 'focusRect').mockImplementation(() => {})
    const viewport = engine.viewport
    const smartMagnify = new CustomEvent('fd-smart-magnify', {
      detail: {
        location: { x: 40, y: 40 },
        worldLocation: { x: 40, y: 40 },
        viewport,
        initialZoom: 1,
        zoomTolerance: 0.01,
        canRestoreViewport: false,
        isZoomedIn: false,
      },
      cancelable: true,
    })

    engine.dispatchEvent(smartMagnify)
    engine.dispatchEvent(
      new CustomEvent('fd-viewport-change', {
        detail: { viewport, phase: 'continuous' },
      }),
    )

    expect(smartMagnify.defaultPrevented).toBe(true)
    expect(onSmartMagnify).toHaveBeenCalledWith(
      expect.objectContaining({ nearestNodeID: 'source' }),
    )
    expect(focusRect).toHaveBeenCalledWith({ x: 0, y: 0, width: 100, height: 80 }, 1.5)
    expect(element.session.viewport).toBe(viewport)
    expect(onViewportChange).toHaveBeenCalledWith(viewport, 'continuous')
  })

  it('handles source-aligned session commands once and only for the target session', async () => {
    const content = makeContent()
    const sessionID = new FdGraphCanvasSessionID('target-session')
    const element = document.createElement('fd-graph-canvas') as FdGraphCanvas<string>
    element.content = content
    element.sessionID = sessionID
    const onIntent = vi.fn()
    element.onIntent = onIntent
    document.body.append(element)
    await element.updateComplete
    const engine = element.shadowRoot?.querySelector(
      'fd-graph-canvas-engine',
    ) as FdGraphCanvasEngine
    const focusRect = vi.spyOn(engine, 'focusRect').mockImplementation(() => {})
    const fitRect = vi.spyOn(engine, 'fitRect').mockImplementation(() => {})

    element.command = new FdGraphCanvasSessionCommand(
      sessionID,
      { kind: 'jumpToElement', elementID: 'target', selection: 'replace', zoom: 1.4 },
      false,
      'jump',
    )
    await element.updateComplete

    expect(element.session.focusedElementID).toBe('target')
    expect(element.session.selection).toEqual(new Set(['target']))
    expect(focusRect).toHaveBeenCalledWith(
      { x: 240, y: 0, width: 100, height: 80 },
      1.4,
      { animated: false },
    )

    element.command = new FdGraphCanvasSessionCommand(
      sessionID,
      { kind: 'select', command: { kind: 'replace', elementIDs: new Set(['source', 'missing']) } },
      true,
      'select',
    )
    await element.updateComplete
    expect(element.session.selection).toEqual(new Set(['source']))

    element.command = new FdGraphCanvasSessionCommand(
      sessionID,
      { kind: 'fit', scope: { kind: 'selection' }, padding: 32, maximumZoom: 2 },
      true,
      'fit',
    )
    await element.updateComplete
    expect(fitRect).toHaveBeenCalledWith(
      { x: 0, y: 0, width: 100, height: 80 },
      32,
      2,
      { animated: true },
    )

    element.command = new FdGraphCanvasSessionCommand(
      sessionID,
      { kind: 'inspect', elementID: 'edge' },
      true,
      'inspect',
    )
    await element.updateComplete
    expect(onIntent).toHaveBeenLastCalledWith({
      kind: 'elementAction',
      intent: expect.objectContaining({
        action: 'inspect',
        elementID: 'edge',
        basePresentationSnapshotID: 'presentation',
      }),
    })

    element.command = new FdGraphCanvasSessionCommand(
      new FdGraphCanvasSessionID('other-session'),
      { kind: 'focus', elementID: 'source' },
      true,
      'wrong-target',
    )
    await element.updateComplete
    expect(focusRect).toHaveBeenCalledTimes(1)
  })

  it('emits source-aligned arrangement intents without changing engine-owned frames', async () => {
    const content = makeContent()
    const sessionID = new FdGraphCanvasSessionID('arrangement-session')
    const element = document.createElement('fd-graph-canvas') as FdGraphCanvas<string>
    element.content = content
    element.sessionID = sessionID
    element.session = new FdGraphCanvasSessionState({ selection: new Set(['source', 'target']) })
    const onIntent = vi.fn()
    element.onIntent = onIntent
    document.body.append(element)
    await element.updateComplete

    element.command = new FdGraphCanvasSessionCommand(
      sessionID,
      { kind: 'arrange', action: { kind: 'align', alignment: 'leading' } },
      true,
      'arrange',
    )
    await element.updateComplete

    expect(onIntent).toHaveBeenCalledWith({
      kind: 'nodeArrangementRequested',
      intent: expect.objectContaining({
        action: { kind: 'align', alignment: 'leading' },
        translations: new Map([
          ['target', { width: -240, height: 0 }],
        ]),
        basePresentationSnapshotID: 'presentation',
        baseLayoutInputID: content.id,
      }),
    })
  })

  it('reconciles session identities and stale transient state when content changes', async () => {
    const content = makeContent()
    const element = document.createElement('fd-graph-canvas') as FdGraphCanvas<string>
    element.session = new FdGraphCanvasSessionState({
      selection: new Set(['source', 'missing']),
      focusedElementID: 'missing',
      hoveredElementID: 'missing',
      transientNodeDrag: new FdGraphCanvasTransientNodeDrag({
        nodeID: 'source',
        basePresentationSnapshotID: 'stale',
        baseLayoutInputID: content.id,
      }),
    })
    element.content = content
    document.body.append(element)
    await element.updateComplete

    expect(element.session.selection).toEqual(new Set(['source']))
    expect(element.session.focusedElementID).toBeUndefined()
    expect(element.session.hoveredElementID).toBeUndefined()
    expect(element.session.transientNodeDrag).toBeUndefined()
  })

  it('preserves canonical identities at the private rendering-engine boundary', () => {
    const content = makeContent()
    const snapshot = graphCanvasEngineSnapshot(content)

    expect(snapshot.nodes).toEqual([
      expect.objectContaining({
        id: 'source',
        frame: { x: 0, y: 0, width: 100, height: 80 },
        ports: [expect.objectContaining({ id: 'source-output', side: 'right', offset: 0.5 })],
      }),
      expect.objectContaining({
        id: 'target',
        frame: { x: 240, y: 0, width: 100, height: 80 },
        ports: [expect.objectContaining({ id: 'target-input', side: 'left', offset: 0.5 })],
      }),
    ])
    expect(snapshot.edges).toEqual([
      expect.objectContaining({
        id: 'edge',
        source: { nodeID: 'source', portID: 'source-output' },
        target: { nodeID: 'target', portID: 'target-input' },
        data: expect.objectContaining({ localID: edgeLocalID, isDirected: true }),
      }),
    ])
  })

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
