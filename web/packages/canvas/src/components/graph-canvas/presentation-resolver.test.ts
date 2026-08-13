import { afterEach, describe, expect, it, vi } from 'vitest'
import { FdGraphCanvasContent, FdGraphCanvasLayoutAdapter } from '../../graph/content.js'
import {
  FdGraphElementAddress,
  FdGraphInstanceHandle,
  FdGraphInstancePath,
  FdGraphPresentation,
  FdGraphPresentationLocalElementID,
} from '../../graph/presentation.js'
import { FdGraphCanvasSnapState } from '../../interactions/arrangement.js'
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
import {
  FdGraphCanvasWebGL2VisualAdapter,
  type FdGraphRenderingBackend,
} from '../../rendering/backend.js'
import {
  graphCanvasEngineEdgeGeometryResolver,
  graphCanvasEngineSnapshot,
} from './engine-adapter.js'
import type { FdGraphCanvasEngine } from './fd-graph-canvas.js'
import type { FdGraphCanvas } from './fd-graph-canvas-element.js'
import './fd-graph-canvas-element.js'
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
    expect(engine?.configuration.renderingBackend).toBe('dom')
  })

  it('provides the Swift-aligned backend context to a WebGL2 visual adapter', async () => {
    const content = makeContent()
    const sessionID = new FdGraphCanvasSessionID('backend-session')
    const session = new FdGraphCanvasSessionState<string>()
    const backend: FdGraphRenderingBackend = {
      kind: 'test',
      mount: () => {},
      render: () => {},
      unmount: () => {},
    }
    let receivedContent: FdGraphCanvasContent<string> | undefined
    let receivedSessionID: FdGraphCanvasSessionID | undefined
    let receivedSession: FdGraphCanvasSessionState<string> | undefined
    const element = document.createElement('fd-graph-canvas') as FdGraphCanvas<string>
    element.content = content
    element.sessionID = sessionID
    element.session = session
    element.webGL2VisualAdapter = new FdGraphCanvasWebGL2VisualAdapter({
      isAvailable: () => true,
      content: (context) => {
        receivedContent = context.content
        receivedSessionID = context.sessionID
        receivedSession = context.session
        return backend
      },
    })
    document.body.append(element)
    await element.updateComplete
    const engine = element.shadowRoot?.querySelector('fd-graph-canvas-engine') as
      | FdGraphCanvasEngine
      | undefined

    expect(engine?.renderingAdapter).toBe(backend)
    expect(receivedContent).toBe(content)
    expect(receivedSessionID).toBe(sessionID)
    expect(receivedSession).toBe(session)
  })

  it('provides presentation values and Swift-aligned contexts to render builders', async () => {
    const element = document.createElement('fd-graph-canvas') as FdGraphCanvas<string>
    element.style.cssText = 'width:800px;height:600px'
    element.content = makeContent()
    element.configuration = { renderingBackend: 'dom' }
    const renderedNodes: string[] = []
    const renderedPorts: string[] = []
    const renderedEdges: string[] = []
    const renderedLayers: string[] = []
    let selectSource: (() => void) | undefined
    let inspectSource: (() => void) | undefined
    const intents: unknown[] = []
    element.onIntent = (intent) => intents.push(intent)
    element.background = (context) => {
      renderedLayers.push(`background:${context.zoom}`)
      return 'Background'
    }
    element.decorations = (context) => {
      renderedLayers.push(`decorations:${context.content.presentation.nodes.length}`)
      return 'Decorations'
    }
    element.overlays = (context) => {
      renderedLayers.push(`overlays:${context.sessionID.rawValue}`)
      return 'Overlays'
    }
    element.node = (node, context) => {
      renderedNodes.push(`${node.id}:${context.localID}:${context.renderScale}`)
      if (node.id === 'source') {
        selectSource = () => context.actions.select()
        inspectSource = () => context.actions.send('inspect')
      }
      return `Node ${node.id}`
    }
    element.port = (port, context) => {
      renderedPorts.push(`${port.id}:${context.localID}:${context.nodeLocalID}`)
      return `Port ${port.id}`
    }
    element.edge = (edge, context) => {
      renderedEdges.push(`${edge.id}:${context.localID}:${context.worldRoute.segments.length}`)
      return `Edge ${edge.id}`
    }
    document.body.append(element)
    await element.updateComplete
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    expect(renderedNodes).toHaveLength(2)
    expect(renderedPorts).toHaveLength(2)
    expect(renderedEdges).toEqual([`edge:${edgeLocalID}:1`])
    const engine = element.shadowRoot?.querySelector('fd-graph-canvas-engine')
    expect(engine?.shadowRoot?.querySelector('.graph-node')?.textContent).toContain('Node source')
    expect(engine?.shadowRoot?.querySelector('.graph-edge-content')?.textContent).toBe('Edge edge')
    expect(engine?.shadowRoot?.querySelector('.builder-background')?.textContent).toBe('Background')
    expect(engine?.shadowRoot?.querySelector('.consumer-decorations')?.textContent).toBe(
      'Decorations',
    )
    expect(engine?.shadowRoot?.querySelector('.builder-overlay')?.textContent).toBe('Overlays')
    expect(renderedLayers).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^background:/),
        'decorations:2',
        expect.stringMatching(/^overlays:/),
      ]),
    )
    selectSource?.()
    inspectSource?.()
    expect(element.session.selection).toEqual(new Set(['source']))
    expect(intents).toEqual([
      expect.objectContaining({
        kind: 'elementAction',
        intent: expect.objectContaining({ action: 'inspect', elementID: 'source' }),
      }),
    ])
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
    expect(focusRect).toHaveBeenCalledWith({ x: 240, y: 0, width: 100, height: 80 }, 1.4, {
      animated: false,
    })

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
    expect(fitRect).toHaveBeenCalledWith({ x: 0, y: 0, width: 100, height: 80 }, 32, 2, {
      animated: true,
    })

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
        translations: new Map([['target', { width: -240, height: 0 }]]),
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

  it('projects private drag interaction state into the session and emits a canonical intent', async () => {
    const content = makeContent()
    const element = document.createElement('fd-graph-canvas') as FdGraphCanvas<string>
    element.content = content
    const onIntent = vi.fn()
    element.onIntent = onIntent
    document.body.append(element)
    await element.updateComplete
    const engine = element.shadowRoot?.querySelector(
      'fd-graph-canvas-engine',
    ) as FdGraphCanvasEngine
    const before = { x: 0, y: 0, width: 100, height: 80 }
    const after = { x: 24, y: 0, width: 100, height: 80 }
    vi.spyOn(engine, 'activeNodeInteraction', 'get').mockReturnValue({
      kind: 'move',
      anchorNodeID: 'source',
      baseFrames: new Map([['source', before]]),
      baseBounds: before,
      latestFrames: new Map([['source', after]]),
      guides: [],
      snapState: new FdGraphCanvasSnapState(),
      constrainedAxis: 'horizontal',
    })
    const detail = {
      transactionID: 'drag',
      snapshotID: 'presentation',
      kind: 'drag' as const,
      changes: [{ nodeID: 'source', before, after }],
    }

    engine.dispatchEvent(
      new CustomEvent('fd-graph-node-frames-change', {
        detail: { ...detail, phase: 'continuous' },
        bubbles: true,
        composed: true,
      }),
    )
    expect(element.session.transientNodeDrag).toEqual(
      expect.objectContaining({
        nodeID: 'source',
        nodeIDs: new Set(['source']),
        translation: { width: 24, height: 0 },
        constrainedAxis: 'horizontal',
        baseLayoutInputID: content.id,
      }),
    )

    engine.dispatchEvent(
      new CustomEvent('fd-graph-node-frames-change', {
        detail: { ...detail, phase: 'ended' },
        bubbles: true,
        composed: true,
      }),
    )
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'nodeDragCompleted',
      intent: expect.objectContaining({
        nodeID: 'source',
        nodeIDs: new Set(['source']),
        translation: { width: 24, height: 0 },
        basePresentationSnapshotID: 'presentation',
        baseLayoutInputID: content.id,
      }),
    })
    expect(element.session.transientNodeDrag).toBeUndefined()
  })

  it('projects private resize interaction state into the session and emits a canonical intent', async () => {
    const content = makeContent()
    const element = document.createElement('fd-graph-canvas') as FdGraphCanvas<string>
    element.content = content
    const onIntent = vi.fn()
    element.onIntent = onIntent
    document.body.append(element)
    await element.updateComplete
    const engine = element.shadowRoot?.querySelector(
      'fd-graph-canvas-engine',
    ) as FdGraphCanvasEngine
    const before = { x: 0, y: 0, width: 100, height: 80 }
    const after = { x: 0, y: 0, width: 140, height: 100 }
    vi.spyOn(engine, 'activeNodeInteraction', 'get').mockReturnValue({
      kind: 'resize',
      anchorNodeID: 'source',
      baseFrames: new Map([['source', before]]),
      baseBounds: before,
      latestFrames: new Map([['source', after]]),
      minimumBoundsSize: { width: 44, height: 32 },
      edges: new Set(['trailing', 'bottom']),
      guides: [],
      snapState: new FdGraphCanvasSnapState(),
      aspectRatioDrivingAxis: 'horizontal',
    })
    const detail = {
      transactionID: 'resize',
      snapshotID: 'presentation',
      kind: 'resize' as const,
      changes: [{ nodeID: 'source', before, after }],
    }

    engine.dispatchEvent(
      new CustomEvent('fd-graph-node-frames-change', {
        detail: { ...detail, phase: 'continuous' },
        bubbles: true,
        composed: true,
      }),
    )
    expect(element.session.transientNodeResize).toEqual(
      expect.objectContaining({
        anchorNodeID: 'source',
        nodeOrder: ['source'],
        bounds: after,
        edges: new Set(['trailing', 'bottom']),
        aspectRatioDrivingAxis: 'horizontal',
        baseLayoutInputID: content.id,
      }),
    )

    engine.dispatchEvent(
      new CustomEvent('fd-graph-node-frames-change', {
        detail: { ...detail, phase: 'ended' },
        bubbles: true,
        composed: true,
      }),
    )
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'nodeResizeCompleted',
      intent: expect.objectContaining({
        anchorNodeID: 'source',
        changes: [
          expect.objectContaining({
            nodeID: 'source',
            originTranslation: { width: 0, height: 0 },
            sizeDelta: { width: 40, height: 20 },
          }),
        ],
        edges: new Set(['trailing', 'bottom']),
        baseLayoutInputID: content.id,
      }),
    })
    expect(element.session.transientNodeResize).toBeUndefined()
  })

  it('projects connection state and emits canonical completion and cancellation intents', async () => {
    const content = makeContent()
    const element = document.createElement('fd-graph-canvas') as FdGraphCanvas<string>
    element.content = content
    const onIntent = vi.fn()
    element.onIntent = onIntent
    document.body.append(element)
    await element.updateComplete
    const engine = element.shadowRoot?.querySelector('fd-graph-canvas-engine')
    const origin = {
      kind: 'new' as const,
      source: { nodeID: 'source', portID: 'source-output' },
    }

    engine?.dispatchEvent(
      new CustomEvent('fd-graph-connection-preview-change', {
        detail: {
          connection: {
            origin,
            basePresentationSnapshotID: 'presentation',
            baseLayoutInputID: 'presentation',
            stationaryPoint: { x: 100, y: 40 },
            originalMovingPoint: { x: 100, y: 40 },
            movingPoint: { x: 240, y: 40 },
            candidate: {
              endpoint: { nodeID: 'target', portID: 'target-input' },
              point: { x: 240, y: 40 },
            },
            validation: { kind: 'valid' },
          },
        },
        bubbles: true,
        composed: true,
      }),
    )
    expect(element.session.transientConnection).toEqual(
      expect.objectContaining({
        origin: { kind: 'new', sourcePortID: 'source-output' },
        candidatePortID: 'target-input',
        validation: { kind: 'valid' },
        baseLayoutInputID: content.id,
      }),
    )

    engine?.dispatchEvent(
      new CustomEvent('fd-graph-connection-complete', {
        detail: {
          basePresentationSnapshotID: 'presentation',
          baseLayoutInputID: 'presentation',
          operation: {
            kind: 'create',
            source: { nodeID: 'source', portID: 'source-output' },
            target: { nodeID: 'target', portID: 'target-input' },
          },
        },
        bubbles: true,
        composed: true,
      }),
    )
    expect(onIntent).toHaveBeenLastCalledWith({
      kind: 'connectionCompleted',
      intent: expect.objectContaining({
        operation: {
          kind: 'create',
          sourcePortID: 'source-output',
          targetPortID: 'target-input',
        },
        baseLayoutInputID: content.id,
      }),
    })
    expect(element.session.transientConnection).toBeUndefined()

    engine?.dispatchEvent(
      new CustomEvent('fd-graph-connection-preview-change', {
        detail: {
          connection: {
            origin,
            basePresentationSnapshotID: 'presentation',
            baseLayoutInputID: 'presentation',
            stationaryPoint: { x: 100, y: 40 },
            originalMovingPoint: { x: 100, y: 40 },
            movingPoint: { x: 160, y: 40 },
          },
        },
        bubbles: true,
        composed: true,
      }),
    )

    engine?.dispatchEvent(
      new CustomEvent('fd-graph-connection-cancel', {
        detail: {
          basePresentationSnapshotID: 'presentation',
          baseLayoutInputID: 'presentation',
          origin,
          reason: { kind: 'noTarget' },
        },
        bubbles: true,
        composed: true,
      }),
    )
    expect(onIntent).toHaveBeenLastCalledWith({
      kind: 'connectionCancelled',
      intent: expect.objectContaining({
        origin: { kind: 'new', sourcePortID: 'source-output' },
        reason: { kind: 'noTarget' },
        baseLayoutInputID: content.id,
      }),
    })
    expect(element.session.transientConnection).toBeUndefined()
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
    const edge = snapshot.edges[0]
    if (!edge) throw new Error('missing edge')
    expect(
      graphCanvasEngineEdgeGeometryResolver({
        edge,
        source: { x: 100, y: 40 },
        target: { x: 240, y: 40 },
      }).route,
    ).toEqual(new FdGraphEdgeRoute({ x: 100, y: 40 }, [{ kind: 'line', end: { x: 240, y: 40 } }]))
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
    if (!sourceAnchor) throw new Error('missing source anchor')
    expect(resolver.anchor(sourceAnchor, sourceNodeLocalID).position).toEqual({ x: 400, y: 60 })
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
    if (!sourceAnchor) throw new Error('missing source anchor')
    expect(resolver.anchor(sourceAnchor, sourceNodeLocalID).position).toEqual({ x: 200, y: 80 })

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
