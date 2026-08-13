import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultGraphAccessibilityCommandResolver } from '../../accessibility/configuration.js'
import type { FdGraphAccessibilityActionDetail } from '../../accessibility/events.js'
import type { FdCanvasPoint } from '../../geometry.js'
import type {
  FdGraphConnectionCancelDetail,
  FdGraphConnectionCompleteDetail,
  FdGraphConnectionPreviewChangeDetail,
  FdGraphFocusChangeDetail,
  FdGraphNodeFramesChangeDetail,
  FdGraphSelectionChangeDetail,
} from '../../graph/events.js'
import type { FdAnyGraphSnapshot } from '../../graph/model.js'
import {
  graphEdgeReference,
  graphElementReferenceKey,
  graphNodeReference,
  graphPortReference,
} from '../../graph/model.js'
import type {
  FdGraphCanvasHistoryConflictDetail,
  FdGraphCanvasHistoryStateDetail,
} from '../../history/events.js'
import { snapGraphTranslationRequest } from '../../interactions/arrangement.js'
import { graphConnectionOriginForEdge } from '../../interactions/connection.js'
import type {
  FdGraphCanvasRenderingBackendPreference,
  FdGraphRenderFrame,
  FdGraphRenderingBackend,
  FdGraphRenderingSurface,
} from '../../rendering/backend.js'
import { graphCanvasRenderingBackendCapabilities } from '../../rendering/backend.js'
import { FdGraphDOMRenderingBackend } from '../../rendering/dom-backend.js'
import { FdGraphWebGL2RenderingBackend } from '../../rendering/webgl2-backend.js'
import type { FdGraphCanvas } from './fd-graph-canvas.js'
import './fd-graph-canvas.js'

const graphSnapshot = (): FdAnyGraphSnapshot => ({
  id: 'graph-1',
  nodes: [
    {
      id: 'source',
      frame: { x: 40, y: 80, width: 180, height: 88 },
      label: 'Source',
      subtitle: 'Input node',
      ports: [{ id: 'output', side: 'right' }],
    },
    {
      id: 'target',
      frame: { x: 420, y: 220, width: 180, height: 88 },
      label: 'Target',
      ports: [{ id: 'input', side: 'left' }],
    },
  ],
  edges: [
    {
      id: 'connection',
      source: { nodeID: 'source', portID: 'output' },
      target: { nodeID: 'target', portID: 'input' },
      label: 'Data',
    },
  ],
})

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

async function mount(
  snapshot: FdAnyGraphSnapshot = graphSnapshot(),
  backend?: FdGraphRenderingBackend | FdGraphCanvasRenderingBackendPreference,
): Promise<FdGraphCanvas> {
  const element = document.createElement('fd-graph-canvas')
  element.style.width = '800px'
  element.style.height = '600px'
  element.snapshot = snapshot
  if (typeof backend === 'string') element.configuration = { renderingBackend: backend }
  else if (backend) element.renderingAdapter = backend
  document.body.append(element)
  await element.updateComplete
  await nextFrame()
  await nextFrame()
  return element
}

function preparePointerInput(element: FdGraphCanvas): HTMLElement {
  const canvas = element.shadowRoot?.querySelector('fd-canvas') as HTMLElement
  canvas.setPointerCapture = () => undefined
  return canvas
}

function clientPoint(element: FdGraphCanvas, worldPoint: FdCanvasPoint): FdCanvasPoint {
  const point = element.viewport.transform.applyPoint(worldPoint)
  const bounds = element.getBoundingClientRect()
  return { x: bounds.left + point.x, y: bounds.top + point.y }
}

function applyFrameIntents(element: FdGraphCanvas): void {
  element.addEventListener('fd-graph-node-frames-change', ({ detail }) => {
    if (detail.phase !== 'ended') return
    const frames = new Map(detail.changes.map(({ nodeID, after }) => [nodeID, after]))
    element.snapshot = {
      ...element.snapshot,
      nodes: element.snapshot.nodes.map((node) => ({
        ...node,
        frame: frames.get(node.id) ?? node.frame,
      })),
    }
  })
}

function dispatchPointer(
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  point: FdCanvasPoint,
  modifiers: Pick<PointerEventInit, 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey'> = {},
): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: point.x,
      clientY: point.y,
      bubbles: true,
      composed: true,
      cancelable: true,
      ...modifiers,
    }),
  )
}

function dispatchKey(target: EventTarget, value: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: value,
      bubbles: true,
      composed: true,
      cancelable: true,
      ...init,
    }),
  )
}

afterEach(() => {
  document.body.replaceChildren()
})

class RecordingBackend implements FdGraphRenderingBackend {
  readonly kind = 'recording'
  readonly frames: FdGraphRenderFrame[] = []
  mounts = 0
  unmounts = 0

  mount(_surface: FdGraphRenderingSurface): void {
    this.mounts += 1
  }

  render(frame: FdGraphRenderFrame): void {
    this.frames.push(frame)
  }

  unmount(): void {
    this.unmounts += 1
  }
}

describe('fd-graph-canvas rendering boundary', () => {
  it('preserves the viewport when content changes by default', () => {
    const element = document.createElement('fd-graph-canvas')

    expect(element.contentChangeBehavior).toEqual({ kind: 'preserveViewport' })
  })

  it('uses WebGL2 when available and otherwise falls back to complete DOM rendering', async () => {
    const element = await mount()
    const root = element.shadowRoot
    const usesWebGL2 = graphCanvasRenderingBackendCapabilities().webgl2

    expect(element.resolvedRenderingBackend?.kind).toBe(usesWebGL2 ? 'webgl2' : 'dom')
    expect(root?.querySelectorAll('.graph-gpu-layer')).toHaveLength(usesWebGL2 ? 1 : 0)
    expect(root?.querySelectorAll('.graph-node')).toHaveLength(2)
    expect(root?.querySelectorAll('.graph-port')).toHaveLength(2)
    if (!usesWebGL2) expect(root?.querySelectorAll('.graph-edge')).toHaveLength(1)
    expect(root?.querySelector('.graph-edge-label')?.textContent).toBe('Data')
  })

  it('keeps keyed node elements while applying a new immutable snapshot', async () => {
    const element = await mount()
    const original = element.shadowRoot?.querySelector<HTMLElement>(
      '[data-fd-graph-node="s:source"]',
    )
    const current = graphSnapshot()
    element.snapshot = {
      ...current,
      id: 'graph-2',
      nodes: current.nodes.map((node) =>
        node.id === 'source'
          ? { ...node, frame: { ...node.frame, x: 120 }, label: 'Moved source' }
          : node,
      ),
    }
    await element.updateComplete
    await nextFrame()
    await nextFrame()

    const updated = element.shadowRoot?.querySelector<HTMLElement>(
      '[data-fd-graph-node="s:source"]',
    )
    expect(updated).toBe(original)
    expect(updated?.style.transform).toContain('120px')
    expect(updated?.textContent).toContain('Moved source')
  })

  it('removes selected and focused elements that disappear from a snapshot', async () => {
    const element = await mount(graphSnapshot(), 'dom')
    element.selectedElements = [
      graphPortReference('source', 'output'),
      graphEdgeReference('connection'),
    ]
    element.focusedElement = graphEdgeReference('connection')
    await element.updateComplete

    element.snapshot = {
      id: 'graph-without-connections',
      nodes: graphSnapshot().nodes.map((node) => ({ ...node, ports: [] })),
      edges: [],
    }
    await element.updateComplete

    expect(element.selectedElements).toEqual([])
    expect(element.focusedElement).toBeUndefined()
  })

  it('accepts a consumer-supplied rendering backend', async () => {
    const backend = new RecordingBackend()
    const element = await mount(graphSnapshot(), backend)

    expect(element.resolvedRenderingBackend).toBe(backend)
    expect(backend.mounts).toBe(1)
    expect(backend.frames.at(-1)?.nodes).toHaveLength(2)
    expect(backend.frames.at(-1)?.edges).toHaveLength(1)

    element.remove()
    expect(backend.unmounts).toBe(1)
  })

  it('supports standard DOM node content without coupling the graph model to Lit', async () => {
    const backend = new FdGraphDOMRenderingBackend({
      createNodeContent: ({ node }) => {
        const content = document.createElement('span')
        content.textContent = `Custom ${node.label}`
        return content
      },
    })
    const element = await mount(graphSnapshot(), backend)

    expect(element.shadowRoot?.querySelector('.graph-node')?.textContent).toContain('Custom Source')
  })

  it('supports custom edge labels and endpoint decorations across the DOM boundary', async () => {
    const current = graphSnapshot()
    const snapshot: FdAnyGraphSnapshot = {
      ...current,
      edges: current.edges.map((edge) => ({
        ...edge,
        style: { targetDecoration: { kind: 'arrow', length: 7, width: 6, gap: 3 } },
      })),
    }
    const backend = new FdGraphDOMRenderingBackend({
      createEdgeLabelContent: ({ edge }) => {
        const content = document.createElement('span')
        content.textContent = `Custom ${edge.label}`
        return content
      },
    })
    const element = await mount(snapshot, backend)
    const label = element.shadowRoot?.querySelector<HTMLElement>('.graph-edge-label')

    expect(label?.textContent).toBe('Custom Data')
    expect(label?.style.transform).toContain('translate3d')
    expect(element.shadowRoot?.querySelector('.graph-edge-arrow')).not.toBeNull()
  })

  it('updates edge label visibility when zoom crosses the configured threshold', async () => {
    const element = await mount(
      graphSnapshot(),
      new FdGraphDOMRenderingBackend({ minimumEdgeLabelZoom: 1.1 }),
    )

    expect(element.shadowRoot?.querySelector('.graph-edge-label')).toBeNull()
    element.jumpToElement('target', { zoom: 1.4, animated: false })
    await nextFrame()
    await nextFrame()

    expect(element.shadowRoot?.querySelector('.graph-edge-label')?.textContent).toBe('Data')
  })

  it('keeps model hit testing available when dense nodes use GPU level of detail', async () => {
    const element = await mount(
      graphSnapshot(),
      new FdGraphWebGL2RenderingBackend({ maximumDOMNodeCount: 0 }),
    )
    const canvas = preparePointerInput(element)
    const gpuCanvas = element.shadowRoot?.querySelector<HTMLCanvasElement>('.graph-gpu-layer')
    const usesWebGL2 = Boolean(gpuCanvas?.getContext('webgl2'))
    const point = clientPoint(element, { x: 100, y: 120 })

    expect(element.shadowRoot?.querySelectorAll('.graph-node')).toHaveLength(usesWebGL2 ? 0 : 2)
    dispatchPointer(canvas, 'pointerdown', point)
    dispatchPointer(canvas, 'pointerup', point)

    expect(element.selectedNodeIDs.has('source')).toBe(true)
  })

  it('passes rendering configuration to the automatic GPU backend', async () => {
    const element = document.createElement('fd-graph-canvas')
    element.style.width = '800px'
    element.style.height = '600px'
    element.snapshot = graphSnapshot()
    element.renderingConfiguration = { maximumDOMNodeCount: 0 }
    document.body.append(element)
    await element.updateComplete
    await nextFrame()
    await nextFrame()

    const backend = element.resolvedRenderingBackend
    const usesWebGL2 =
      backend instanceof FdGraphWebGL2RenderingBackend && backend.activeKind === 'webgl2'
    expect(element.shadowRoot?.querySelectorAll('.graph-node')).toHaveLength(usesWebGL2 ? 0 : 2)
  })

  it('converts wide-gamut CSS colors before uploading them to WebGL', async () => {
    const snapshot: FdAnyGraphSnapshot = {
      id: 'wide-gamut-color',
      nodes: [
        {
          id: 'node',
          frame: { x: 40, y: 80, width: 180, height: 88 },
          style: { fill: 'color(display-p3 0 1 0)', stroke: 'transparent' },
        },
      ],
      edges: [],
    }
    const element = await mount(
      snapshot,
      new FdGraphWebGL2RenderingBackend({ maximumDOMNodeCount: 0 }),
    )
    const canvas = element.shadowRoot?.querySelector<HTMLCanvasElement>('.graph-gpu-layer')
    const context = canvas?.getContext('webgl2')
    if (!canvas || !context) return

    const nodeData = new Float32Array(12)
    context.getBufferSubData(context.ARRAY_BUFFER, 0, nodeData)

    expect(nodeData[4]).toBeLessThan(0.125)
    expect(nodeData[5]).toBeGreaterThan(0.875)
    expect(nodeData[6]).toBeLessThan(0.125)
    expect(nodeData[7]).toBe(1)
  })

  it('creates a fresh WebGL surface when the canvas is reattached', async () => {
    const element = await mount()
    const originalCanvas = element.shadowRoot?.querySelector('.graph-gpu-layer')
    if (!originalCanvas) return

    element.remove()
    document.body.append(element)
    await element.updateComplete
    await nextFrame()
    await nextFrame()

    const replacement = element.shadowRoot?.querySelector<HTMLCanvasElement>('.graph-gpu-layer')
    expect(replacement).not.toBe(originalCanvas)
    const backend = element.resolvedRenderingBackend
    if (backend instanceof FdGraphWebGL2RenderingBackend && backend.activeKind === 'webgl2') {
      expect(replacement?.getContext('webgl2')).not.toBeNull()
    }
    expect(element.shadowRoot?.querySelectorAll('.graph-node')).toHaveLength(2)
  })

  it('falls back to complete DOM rendering after WebGL context loss', async () => {
    const element = await mount()
    const canvas = element.shadowRoot?.querySelector<HTMLCanvasElement>('.graph-gpu-layer')

    canvas?.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))

    expect(element.shadowRoot?.querySelectorAll('.graph-edge')).toHaveLength(1)
    expect(element.shadowRoot?.querySelectorAll('.graph-node')).toHaveLength(2)
  })

  it('only sends a bounded visible slice of a hundred-thousand-node graph to the backend', async () => {
    const backend = new RecordingBackend()
    const snapshot: FdAnyGraphSnapshot = {
      id: 'large',
      nodes: Array.from({ length: 100_000 }, (_, index) => ({
        id: index,
        frame: {
          x: (index % 1_000) * 40,
          y: Math.floor(index / 1_000) * 40,
          width: 24,
          height: 24,
        },
      })),
      edges: [],
    }
    const element = await mount(snapshot, backend)

    const visibleCount = backend.frames.at(-1)?.nodes.length ?? 0
    expect(visibleCount).toBeGreaterThan(0)
    expect(visibleCount).toBeLessThan(20_000)
    expect(element.shadowRoot?.querySelectorAll('.accessibility-item')).toHaveLength(64)
    expect(
      element.shadowRoot?.querySelector('.accessibility-surface')?.getAttribute('aria-rowcount'),
    ).toBe('100000')
  })
})

describe('fd-graph-canvas pointer editing', () => {
  it('keeps node selection visible without resize bounds when resizing is disabled', async () => {
    const element = await mount()
    element.selectedNodeIDs = new Set(['source'])
    await element.updateComplete
    await nextFrame()

    expect(element.shadowRoot?.querySelector<HTMLElement>('.selection-bounds')?.hidden).toBe(true)
    expect(
      element.shadowRoot
        ?.querySelector('[data-fd-graph-node="s:source"]')
        ?.hasAttribute('data-selected'),
    ).toBe(true)
  })

  it('shows live marquee selection before the pointer is released', async () => {
    const element = await mount()
    const canvas = preparePointerInput(element)
    const changes: FdGraphSelectionChangeDetail[] = []
    element.addEventListener('fd-graph-selection-change', (event) => changes.push(event.detail))
    const start = clientPoint(element, { x: 20, y: 60 })
    const end = clientPoint(element, { x: 250, y: 190 })

    dispatchPointer(canvas, 'pointerdown', start)
    dispatchPointer(canvas, 'pointermove', end)
    await nextFrame()

    expect(changes.at(-1)?.phase).toBe('continuous')
    expect(changes.at(-1)?.selectedNodeIDs).toEqual(new Set(['source']))
    expect(element.shadowRoot?.querySelector<HTMLElement>('.selection-marquee')?.hidden).toBe(false)
    expect(
      element.shadowRoot
        ?.querySelector('[data-fd-graph-node="s:source"]')
        ?.hasAttribute('data-selected'),
    ).toBe(true)

    dispatchPointer(canvas, 'pointerup', end)
    expect(changes.at(-1)?.phase).toBe('ended')
    expect(element.shadowRoot?.querySelector<HTMLElement>('.selection-marquee')?.hidden).toBe(true)
  })

  it('drags a multi-node selection and lets the consumer commit the resulting intent', async () => {
    const element = await mount()
    const canvas = preparePointerInput(element)
    element.selectedNodeIDs = new Set(['source', 'target'])
    element.configuration = { nodeDraggingMode: 'multiple' }
    applyFrameIntents(element)
    await element.updateComplete
    const initialIndex = element.graphIndex
    const initialTransform = element.viewport.transform
    const events: FdGraphNodeFramesChangeDetail[] = []
    element.addEventListener('fd-graph-node-frames-change', (event) => events.push(event.detail))
    const source = element.shadowRoot?.querySelector(
      '[data-fd-graph-node="s:source"]',
    ) as HTMLElement
    const start = clientPoint(element, { x: 100, y: 120 })
    const end = clientPoint(element, { x: 130, y: 140 })

    dispatchPointer(source, 'pointerdown', start)
    dispatchPointer(canvas, 'pointermove', end)
    dispatchPointer(canvas, 'pointerup', end)

    expect(events.some(({ phase }) => phase === 'continuous')).toBe(true)
    expect(events.at(-1)?.phase).toBe('ended')
    expect(events.at(-1)?.changes).toHaveLength(2)
    expect(element.snapshot.nodes[0]?.frame.x).toBe(70)
    expect(element.snapshot.nodes[0]?.frame.y).toBe(100)
    expect(element.snapshot.nodes[1]?.frame.x).toBe(450)
    expect(element.snapshot.nodes[1]?.frame.y).toBe(240)
    await element.updateComplete
    await nextFrame()
    expect(element.graphIndex).not.toBe(initialIndex)
    expect(element.viewport.transform).toEqual(initialTransform)
  })

  it('lets a consumer admit only part of a multi-node drag', async () => {
    const element = await mount()
    const canvas = preparePointerInput(element)
    element.selectedNodeIDs = new Set(['source', 'target'])
    element.configuration = { nodeDraggingMode: 'multiple' }
    applyFrameIntents(element)
    element.interactionPolicy = {
      admitNodeDrag: ({
        anchorNodeID,
        selectedNodeIDs,
        candidateNodeIDs,
        basePresentationSnapshotID,
      }) => {
        expect(anchorNodeID).toBe('source')
        expect(selectedNodeIDs).toEqual(['source', 'target'])
        expect(candidateNodeIDs).toEqual(['source', 'target'])
        expect(basePresentationSnapshotID).toBe('graph-1')
        return { kind: 'allowOnly', nodeIDs: new Set(['source']) }
      },
    }
    await element.updateComplete
    const source = element.shadowRoot?.querySelector(
      '[data-fd-graph-node="s:source"]',
    ) as HTMLElement
    const start = clientPoint(element, { x: 100, y: 120 })
    const end = clientPoint(element, { x: 130, y: 140 })

    dispatchPointer(source, 'pointerdown', start)
    dispatchPointer(canvas, 'pointermove', end)
    dispatchPointer(canvas, 'pointerup', end)

    expect(element.snapshot.nodes[0]?.frame.x).toBe(70)
    expect(element.snapshot.nodes[1]?.frame.x).toBe(420)
  })

  it('emits intent updates without mutating a consumer-owned snapshot', async () => {
    const snapshot = graphSnapshot()
    const element = await mount(snapshot)
    const canvas = preparePointerInput(element)
    await element.updateComplete
    const events: FdGraphNodeFramesChangeDetail[] = []
    element.addEventListener('fd-graph-node-frames-change', (event) => events.push(event.detail))
    const source = element.shadowRoot?.querySelector(
      '[data-fd-graph-node="s:source"]',
    ) as HTMLElement
    const start = clientPoint(element, { x: 100, y: 120 })
    const end = clientPoint(element, { x: 140, y: 150 })

    dispatchPointer(source, 'pointerdown', start)
    dispatchPointer(canvas, 'pointermove', end)
    dispatchPointer(canvas, 'pointerup', end)

    expect(events.at(-1)?.changes[0]?.after.x).toBe(80)
    expect(events.at(-1)?.changes[0]?.after.y).toBe(110)
    expect(element.snapshot).toBe(snapshot)
    expect(element.snapshot.nodes[0]?.frame).toEqual({ x: 40, y: 80, width: 180, height: 88 })
  })

  it('honors node capabilities and consumer drag policy', async () => {
    const element = await mount()
    element.interactionPolicy = {
      nodeCapabilities: {
        overrides: new Map([['source', { draggable: false }]]),
      },
    }
    await element.updateComplete
    const canvas = preparePointerInput(element)
    const events: FdGraphNodeFramesChangeDetail[] = []
    element.addEventListener('fd-graph-node-frames-change', (event) => events.push(event.detail))
    const source = element.shadowRoot?.querySelector(
      '[data-fd-graph-node="s:source"]',
    ) as HTMLElement
    const start = clientPoint(element, { x: 100, y: 120 })
    const end = clientPoint(element, { x: 160, y: 150 })

    dispatchPointer(source, 'pointerdown', start)
    dispatchPointer(canvas, 'pointermove', end)
    dispatchPointer(canvas, 'pointerup', end)

    expect(events).toHaveLength(0)
    expect(element.snapshot.nodes[0]?.frame.x).toBe(40)
  })

  it('snaps during ordinary dragging and bypasses snapping while Command is held', async () => {
    const first = await mount()
    const firstCanvas = preparePointerInput(first)
    first.configuration = { snapping: { isEnabled: true } }
    applyFrameIntents(first)
    await first.updateComplete
    const firstSource = first.shadowRoot?.querySelector(
      '[data-fd-graph-node="s:source"]',
    ) as HTMLElement
    const firstStart = clientPoint(first, { x: 100, y: 120 })
    const firstEnd = clientPoint(first, { x: 296, y: 120 })

    dispatchPointer(firstSource, 'pointerdown', firstStart)
    dispatchPointer(firstCanvas, 'pointermove', firstEnd)
    dispatchPointer(firstCanvas, 'pointerup', firstEnd)
    expect(first.snapshot.nodes[0]?.frame.x).toBeCloseTo(240)

    const second = await mount()
    const secondCanvas = preparePointerInput(second)
    second.configuration = { snapping: { isEnabled: true } }
    applyFrameIntents(second)
    await second.updateComplete
    const secondSource = second.shadowRoot?.querySelector(
      '[data-fd-graph-node="s:source"]',
    ) as HTMLElement
    const secondStart = clientPoint(second, { x: 100, y: 120 })
    const secondEnd = clientPoint(second, { x: 296, y: 120 })

    dispatchPointer(secondSource, 'pointerdown', secondStart, { metaKey: true })
    dispatchPointer(secondCanvas, 'pointermove', secondEnd, { metaKey: true })
    dispatchPointer(secondCanvas, 'pointerup', secondEnd, { metaKey: true })
    expect(second.snapshot.nodes[0]?.frame.x).toBeCloseTo(236)
  })

  it('lets consumers extend translation snapping without replacing the standard solver', async () => {
    const element = await mount()
    const canvas = preparePointerInput(element)
    element.configuration = {
      snapping: {
        isEnabled: true,
        targets: new Set(['grid', 'equalSpacing', 'equalSize']),
      },
    }
    applyFrameIntents(element)
    element.interactionPolicy = {
      snappingStrategy: {
        translation: (request) => {
          const standard = snapGraphTranslationRequest(request)
          return {
            ...standard,
            translation: {
              width: standard.translation.width + 10,
              height: standard.translation.height,
            },
          }
        },
      },
    }
    await element.updateComplete
    const source = element.shadowRoot?.querySelector(
      '[data-fd-graph-node="s:source"]',
    ) as HTMLElement
    const start = clientPoint(element, { x: 100, y: 120 })
    const end = clientPoint(element, { x: 140, y: 150 })

    dispatchPointer(source, 'pointerdown', start)
    dispatchPointer(canvas, 'pointermove', end)
    dispatchPointer(canvas, 'pointerup', end)

    expect(element.snapshot.nodes[0]?.frame.x).toBe(90)
    expect(element.snapshot.nodes[0]?.frame.y).toBe(110)
  })

  it('uses custom resize frames even when the strategy does not emit guides', async () => {
    const element = await mount()
    const canvas = preparePointerInput(element)
    element.selectedNodeIDs = new Set(['source'])
    element.configuration = {
      nodeResizing: { isEnabled: true },
      snapping: { isEnabled: true },
    }
    applyFrameIntents(element)
    element.interactionPolicy = {
      snappingStrategy: {
        resize: () => {
          const bounds = { x: 40, y: 80, width: 240, height: 128 }
          return {
            bounds,
            frames: new Map([['source', bounds]]),
            guides: [],
            state: {},
          }
        },
      },
    }
    await element.updateComplete
    const handle = element.shadowRoot?.querySelector<HTMLElement>(
      '[data-fd-resize-handle="bottomRight"]',
    )
    if (!handle) throw new Error('missing resize handle')
    const start = clientPoint(element, { x: 220, y: 168 })
    const end = clientPoint(element, { x: 260, y: 198 })

    dispatchPointer(handle, 'pointerdown', start)
    dispatchPointer(canvas, 'pointermove', end)
    dispatchPointer(canvas, 'pointerup', end)

    expect(element.snapshot.nodes[0]?.frame).toEqual({ x: 40, y: 80, width: 240, height: 128 })
  })

  it('does not invoke custom snapping while Command is held or snapping is disabled', async () => {
    const strategy = vi.fn(snapGraphTranslationRequest)
    const first = await mount()
    const firstCanvas = preparePointerInput(first)
    first.interactionPolicy = { snappingStrategy: { translation: strategy } }
    await first.updateComplete
    const firstSource = first.shadowRoot?.querySelector(
      '[data-fd-graph-node="s:source"]',
    ) as HTMLElement
    const start = clientPoint(first, { x: 100, y: 120 })
    const end = clientPoint(first, { x: 140, y: 150 })

    dispatchPointer(firstSource, 'pointerdown', start, { metaKey: true })
    dispatchPointer(firstCanvas, 'pointermove', end, { metaKey: true })
    dispatchPointer(firstCanvas, 'pointerup', end, { metaKey: true })

    const second = await mount()
    const secondCanvas = preparePointerInput(second)
    second.interactionPolicy = { snappingStrategy: { translation: strategy } }
    await second.updateComplete
    const secondSource = second.shadowRoot?.querySelector(
      '[data-fd-graph-node="s:source"]',
    ) as HTMLElement
    const secondStart = clientPoint(second, { x: 100, y: 120 })
    const secondEnd = clientPoint(second, { x: 140, y: 150 })
    dispatchPointer(secondSource, 'pointerdown', secondStart)
    dispatchPointer(secondCanvas, 'pointermove', secondEnd)
    dispatchPointer(secondCanvas, 'pointerup', secondEnd)

    expect(strategy).not.toHaveBeenCalled()
  })

  it('resizes selected nodes from all exposed edge and corner handles', async () => {
    const element = await mount()
    const canvas = preparePointerInput(element)
    element.selectedNodeIDs = new Set(['source'])
    element.configuration = { nodeResizing: { isEnabled: true } }
    applyFrameIntents(element)
    await element.updateComplete
    const handles = element.shadowRoot?.querySelectorAll<HTMLElement>('.resize-handle')
    expect(handles).toHaveLength(8)
    expect(handles && [...handles].every(({ hidden }) => !hidden)).toBe(true)
    const handle = element.shadowRoot?.querySelector<HTMLElement>(
      '[data-fd-resize-handle="bottomRight"]',
    )
    expect(handle).toBeTruthy()
    const start = clientPoint(element, { x: 220, y: 168 })
    const end = clientPoint(element, { x: 260, y: 198 })

    if (!handle) throw new Error('missing resize handle')
    dispatchPointer(handle, 'pointerdown', start)
    dispatchPointer(canvas, 'pointermove', end)
    dispatchPointer(canvas, 'pointerup', end)

    expect(element.snapshot.nodes[0]?.frame.width).toBeCloseTo(220)
    expect(element.snapshot.nodes[0]?.frame.height).toBeCloseTo(118)
  })

  it('enforces consumer-provided maximum node sizes during resize', async () => {
    const element = await mount()
    const canvas = preparePointerInput(element)
    element.selectedNodeIDs = new Set(['source'])
    element.configuration = { nodeResizing: { isEnabled: true } }
    applyFrameIntents(element)
    element.interactionPolicy = {
      nodeSizeConstraints: {
        overrides: new Map([['source', { maximumSize: { width: 200, height: 100 } }]]),
      },
    }
    await element.updateComplete
    const handle = element.shadowRoot?.querySelector<HTMLElement>(
      '[data-fd-resize-handle="bottomRight"]',
    )
    if (!handle) throw new Error('missing resize handle')
    const start = clientPoint(element, { x: 220, y: 168 })
    const end = clientPoint(element, { x: 420, y: 368 })

    dispatchPointer(handle, 'pointerdown', start)
    dispatchPointer(canvas, 'pointermove', end)
    dispatchPointer(canvas, 'pointerup', end)

    expect(element.snapshot.nodes[0]?.frame.x).toBe(40)
    expect(element.snapshot.nodes[0]?.frame.y).toBe(80)
    expect(element.snapshot.nodes[0]?.frame.width).toBeCloseTo(200)
    expect(element.snapshot.nodes[0]?.frame.height).toBeCloseTo(100)
  })

  it('lets a consumer admit only part of a group resize', async () => {
    const element = await mount()
    const canvas = preparePointerInput(element)
    element.selectedNodeIDs = new Set(['source', 'target'])
    element.configuration = { nodeResizing: { isEnabled: true } }
    applyFrameIntents(element)
    element.interactionPolicy = {
      admitNodeResize: ({ anchorNodeID, candidateNodeIDs, baseFrames, edges }) => {
        expect(anchorNodeID).toBe('source')
        expect(candidateNodeIDs).toEqual(['source', 'target'])
        expect([...baseFrames.keys()]).toEqual(['source', 'target'])
        expect(edges).toEqual(new Set(['bottom', 'trailing']))
        return { kind: 'allowOnly', nodeIDs: new Set(['source']) }
      },
    }
    await element.updateComplete
    const handle = element.shadowRoot?.querySelector<HTMLElement>(
      '[data-fd-resize-handle="bottomRight"]',
    )
    if (!handle) throw new Error('missing resize handle')
    const start = clientPoint(element, { x: 600, y: 308 })
    const end = clientPoint(element, { x: 620, y: 328 })

    dispatchPointer(handle, 'pointerdown', start)
    dispatchPointer(canvas, 'pointermove', end)
    dispatchPointer(canvas, 'pointerup', end)

    expect(element.snapshot.nodes[0]?.frame.width).toBeCloseTo(200)
    expect(element.snapshot.nodes[0]?.frame.height).toBeCloseTo(108)
    expect(element.snapshot.nodes[1]?.frame).toEqual({ x: 420, y: 220, width: 180, height: 88 })
  })

  it('reuses guide elements while presenting resize measurements', async () => {
    const element = await mount()
    const canvas = preparePointerInput(element)
    element.selectedNodeIDs = new Set(['source'])
    element.configuration = {
      nodeResizing: { isEnabled: true },
      snapping: { isEnabled: true, targets: new Set() },
    }
    await element.updateComplete
    const handle = element.shadowRoot?.querySelector<HTMLElement>(
      '[data-fd-resize-handle="bottomRight"]',
    )
    if (!handle) throw new Error('missing resize handle')
    const start = clientPoint(element, { x: 220, y: 168 })
    const first = clientPoint(element, { x: 260, y: 198 })
    const second = clientPoint(element, { x: 280, y: 208 })

    dispatchPointer(handle, 'pointerdown', start)
    dispatchPointer(canvas, 'pointermove', first)
    const guide = element.shadowRoot?.querySelector<HTMLElement>('.graph-guide')
    expect(guide?.querySelector('.guide-label')?.textContent).toBe('220')
    expect(guide?.getAttribute('part')).toContain('guide-resize')

    dispatchPointer(canvas, 'pointermove', second)
    expect(element.shadowRoot?.querySelector('.graph-guide')).toBe(guide)
    dispatchPointer(canvas, 'pointerup', second)
    expect(guide?.hidden).toBe(true)
  })

  it('supports a consumer-supplied incremental guide renderer', async () => {
    const element = await mount()
    const canvas = preparePointerInput(element)
    const createElement = vi.fn(() => document.createElement('output'))
    const updateElement = vi.fn((guide: HTMLElement) => {
      guide.textContent = 'Custom guide'
    })
    element.guideRenderer = { createElement, updateElement }
    element.selectedNodeIDs = new Set(['source'])
    element.configuration = {
      nodeResizing: { isEnabled: true },
      snapping: { isEnabled: true, targets: new Set() },
    }
    await element.updateComplete
    const handle = element.shadowRoot?.querySelector<HTMLElement>('[data-fd-resize-handle="right"]')
    if (!handle) throw new Error('missing resize handle')
    const start = clientPoint(element, { x: 220, y: 124 })
    const first = clientPoint(element, { x: 250, y: 124 })
    const second = clientPoint(element, { x: 260, y: 124 })

    dispatchPointer(handle, 'pointerdown', start)
    dispatchPointer(canvas, 'pointermove', first)
    dispatchPointer(canvas, 'pointermove', second)

    expect(createElement).toHaveBeenCalledTimes(1)
    expect(updateElement).toHaveBeenCalledTimes(2)
    expect(element.shadowRoot?.querySelector('output')?.textContent).toBe('Custom guide')
    dispatchPointer(canvas, 'pointerup', second)
  })

  it('keeps wheel pan and pinch input active while the selection tool is enabled', async () => {
    const element = await mount()
    const viewport = element.shadowRoot
      ?.querySelector('fd-canvas')
      ?.shadowRoot?.querySelector('.viewport') as HTMLElement
    const initial = element.viewport.transform

    viewport.dispatchEvent(
      new WheelEvent('wheel', {
        clientX: 400,
        clientY: 300,
        deltaX: 16,
        deltaY: 12,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(element.viewport.transform.offset.x).toBeCloseTo(initial.offset.x - 16)
    expect(element.viewport.transform.offset.y).toBeCloseTo(initial.offset.y - 12)

    viewport.dispatchEvent(
      new WheelEvent('wheel', {
        clientX: 400,
        clientY: 300,
        deltaY: -12,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(element.viewport.transform.zoom).toBeGreaterThan(initial.zoom)
  })

  it('selects and focuses ports and edges with typed identities', async () => {
    const element = await mount(graphSnapshot(), 'dom')
    const changes: FdGraphSelectionChangeDetail[] = []
    element.addEventListener('fd-graph-selection-change', (event) => changes.push(event.detail))
    const port = element.shadowRoot?.querySelector<HTMLElement>(
      '[data-fd-graph-node="s:source"][data-fd-graph-port="s:output"]',
    )
    const edge = element.shadowRoot?.querySelector<SVGPathElement>(
      '[data-fd-graph-edge="s:connection"]',
    )
    if (!port || !edge) throw new Error('missing selectable graph elements')

    port.dispatchEvent(new MouseEvent('click', { button: 0, bubbles: true, composed: true }))
    await nextFrame()

    expect(element.selectedElements).toEqual([graphPortReference('source', 'output')])
    expect(element.focusedElement).toEqual(graphPortReference('source', 'output'))
    expect(port.hasAttribute('data-selected')).toBe(true)
    expect(port.hasAttribute('data-focused')).toBe(true)

    edge.dispatchEvent(
      new MouseEvent('click', { button: 0, shiftKey: true, bubbles: true, composed: true }),
    )
    await nextFrame()

    expect(element.selectedElements).toEqual([
      graphPortReference('source', 'output'),
      graphEdgeReference('connection'),
    ])
    expect(element.focusedElement).toEqual(graphEdgeReference('connection'))
    expect(edge.hasAttribute('data-selected')).toBe(true)
    expect(edge.hasAttribute('data-focused')).toBe(true)
    expect(changes.at(-1)?.selectedElements).toEqual(element.selectedElements)
  })
})

describe('fd-graph-canvas connection editing', () => {
  it('treats a port click as selection without mistaking the captured click for an edge', async () => {
    const element = await mount(graphSnapshot(), 'dom')
    const canvas = preparePointerInput(element)
    element.configuration = {
      ...element.configuration,
      connectionEditing: { isEnabled: true },
    }
    await element.updateComplete
    await nextFrame()
    const sourcePort = element.shadowRoot?.querySelector<HTMLElement>(
      '[data-fd-graph-node="s:source"][data-fd-graph-port="s:output"]',
    )
    if (!sourcePort) throw new Error('missing source port')
    const point = clientPoint(element, { x: 220, y: 124 })

    dispatchPointer(sourcePort, 'pointerdown', point)
    dispatchPointer(canvas, 'pointerup', point)
    canvas.dispatchEvent(
      new MouseEvent('click', {
        clientX: point.x,
        clientY: point.y,
        button: 0,
        bubbles: true,
        composed: true,
      }),
    )

    expect(element.selectedElements).toEqual([graphPortReference('source', 'output')])
  })

  it('previews and completes a new connection without mutating the snapshot', async () => {
    const snapshot = graphSnapshot()
    const element = await mount(snapshot)
    const canvas = preparePointerInput(element)
    element.configuration = { connectionEditing: { isEnabled: true } }
    await element.updateComplete
    const previews: FdGraphConnectionPreviewChangeDetail[] = []
    const completions: FdGraphConnectionCompleteDetail[] = []
    element.addEventListener('fd-graph-connection-preview-change', (event) => {
      previews.push(event.detail)
    })
    element.addEventListener('fd-graph-connection-complete', (event) => {
      completions.push(event.detail)
    })
    const sourcePort = element.shadowRoot?.querySelector<HTMLElement>(
      '[data-fd-graph-node="s:source"][data-fd-graph-port="s:output"]',
    )
    if (!sourcePort) throw new Error('missing source port')
    const start = clientPoint(element, { x: 220, y: 124 })
    const end = clientPoint(element, { x: 420, y: 264 })

    dispatchPointer(sourcePort, 'pointerdown', start)
    dispatchPointer(canvas, 'pointermove', end)

    const preview = element.shadowRoot?.querySelector('.connection-preview')
    expect(previews.at(-1)?.connection?.candidate?.endpoint).toEqual({
      nodeID: 'target',
      portID: 'input',
    })
    expect(preview?.hasAttribute('hidden')).toBe(false)
    expect(preview?.getAttribute('data-validation')).toBe('valid')

    dispatchPointer(canvas, 'pointerup', end)

    expect(completions).toHaveLength(1)
    expect(completions[0]?.operation).toEqual({
      kind: 'create',
      source: { nodeID: 'source', portID: 'output' },
      target: { nodeID: 'target', portID: 'input' },
    })
    expect(element.snapshot).toBe(snapshot)
    expect(preview?.hasAttribute('hidden')).toBe(true)
  })

  it('exposes validation feedback and reports an invalid target', async () => {
    const element = await mount()
    const canvas = preparePointerInput(element)
    element.configuration = { connectionEditing: { isEnabled: true } }
    element.interactionPolicy = {
      connectionPolicy: {
        validate: () => ({
          kind: 'invalid',
          feedback: { message: 'This input already has a connection.' },
        }),
      },
    }
    await element.updateComplete
    const cancellations: FdGraphConnectionCancelDetail[] = []
    element.addEventListener('fd-graph-connection-cancel', (event) => {
      cancellations.push(event.detail)
    })
    const sourcePort = element.shadowRoot?.querySelector<HTMLElement>(
      '[data-fd-graph-port="s:output"]',
    )
    if (!sourcePort) throw new Error('missing source port')
    const start = clientPoint(element, { x: 220, y: 124 })
    const end = clientPoint(element, { x: 420, y: 264 })

    dispatchPointer(sourcePort, 'pointerdown', start)
    dispatchPointer(canvas, 'pointermove', end)

    expect(
      element.shadowRoot?.querySelector('.connection-preview')?.getAttribute('data-validation'),
    ).toBe('invalid')
    expect(element.shadowRoot?.querySelector('.connection-feedback')?.textContent).toBe(
      'This input already has a connection.',
    )

    dispatchPointer(canvas, 'pointerup', end)
    expect(cancellations[0]?.reason).toEqual({
      kind: 'invalidTarget',
      feedback: { message: 'This input already has a connection.' },
    })
  })

  it('supports custom previews and cancels stale sessions on snapshot replacement', async () => {
    const element = await mount()
    element.configuration = {
      connectionEditing: { isEnabled: true, rendersDefaultPreview: false },
    }
    await element.updateComplete
    const previews: FdGraphConnectionPreviewChangeDetail[] = []
    const cancellations: FdGraphConnectionCancelDetail[] = []
    element.addEventListener('fd-graph-connection-preview-change', (event) => {
      previews.push(event.detail)
    })
    element.addEventListener('fd-graph-connection-cancel', (event) => {
      cancellations.push(event.detail)
    })

    expect(
      element.beginConnection({
        kind: 'new',
        source: { nodeID: 'source', portID: 'output' },
      }),
    ).toBe(true)
    expect(element.updateConnection({ x: 420, y: 264 })).toBe(true)
    expect(previews.at(-1)?.connection?.candidate?.endpoint.nodeID).toBe('target')
    expect(element.shadowRoot?.querySelector('.connection-preview')?.hasAttribute('hidden')).toBe(
      true,
    )

    element.snapshot = { ...graphSnapshot(), id: 'graph-2' }
    await element.updateComplete
    expect(cancellations[0]?.snapshotID).toBe('graph-1')
    expect(cancellations[0]?.reason).toEqual({ kind: 'staleSnapshot' })
  })

  it('supports programmatic endpoint reconnection and Escape cancellation', async () => {
    const element = await mount()
    element.configuration = { connectionEditing: { isEnabled: true } }
    await element.updateComplete
    const edge = element.snapshot.edges[0]
    if (!edge) throw new Error('missing edge fixture')
    const origin = graphConnectionOriginForEdge(edge, 'target')
    if (!origin) throw new Error('missing reconnect origin')
    const completions: FdGraphConnectionCompleteDetail[] = []
    const cancellations: FdGraphConnectionCancelDetail[] = []
    element.addEventListener('fd-graph-connection-complete', (event) => {
      completions.push(event.detail)
    })
    element.addEventListener('fd-graph-connection-cancel', (event) => {
      cancellations.push(event.detail)
    })

    expect(element.beginConnection(origin)).toBe(true)
    expect(element.updateConnection({ x: 220, y: 124 })).toBe(true)
    expect(element.completeConnection()).toBe(true)
    expect(completions[0]?.operation).toEqual({
      kind: 'reconnect',
      edgeID: 'connection',
      endpoint: 'target',
      target: { nodeID: 'source', portID: 'output' },
    })

    expect(element.beginConnection(origin)).toBe(true)
    dispatchKey(element.shadowRoot?.querySelector('fd-canvas') ?? element, 'Escape')
    expect(cancellations.at(-1)?.reason).toEqual({ kind: 'cancelled' })
  })
})

describe('fd-graph-canvas keyboard editing', () => {
  it('keeps one canvas tab stop and navigates nodes spatially', async () => {
    const element = await mount()
    const canvas = element.shadowRoot?.querySelector('fd-canvas') as HTMLElement
    const viewport = canvas.shadowRoot?.querySelector('.viewport') as HTMLElement
    const focusChanges: FdGraphFocusChangeDetail[] = []
    element.addEventListener('fd-graph-focus-change', (event) => focusChanges.push(event.detail))

    viewport.focus()
    expect(element.focusedNodeID).toBe('source')
    dispatchKey(canvas, 'ArrowRight')
    await nextFrame()

    expect(element.focusedNodeID).toBe('target')
    expect(element.selectedNodeIDs).toEqual(new Set(['target']))
    expect(focusChanges.at(-1)).toEqual({
      focusedElement: graphNodeReference('target'),
      focusedNodeID: 'target',
      source: 'keyboard',
    })
    expect(
      element.shadowRoot
        ?.querySelector('[data-fd-graph-node="s:target"]')
        ?.hasAttribute('data-focused'),
    ).toBe(true)
  })

  it('nudges a selected node by standard and configurable large steps', async () => {
    const element = await mount()
    const canvas = element.shadowRoot?.querySelector('fd-canvas') as HTMLElement
    element.configuration = { keyboardNudging: { step: 2, largeStep: 18 } }
    applyFrameIntents(element)
    element.focusedNodeID = 'source'
    element.selectedNodeIDs = new Set(['source'])
    await element.updateComplete

    dispatchKey(canvas, 'ArrowRight')
    expect(element.snapshot.nodes[0]?.frame.x).toBe(42)
    dispatchKey(canvas, 'ArrowDown', { shiftKey: true })
    expect(element.snapshot.nodes[0]?.frame.y).toBe(98)
  })

  it('applies drag admission to keyboard movement', async () => {
    const element = await mount()
    const canvas = element.shadowRoot?.querySelector('fd-canvas') as HTMLElement
    applyFrameIntents(element)
    element.interactionPolicy = {
      admitNodeDrag: () => ({ kind: 'allowOnly', nodeIDs: new Set(['source']) }),
    }
    element.focusedNodeID = 'source'
    element.selectedNodeIDs = new Set(['source', 'target'])
    await element.updateComplete

    dispatchKey(canvas, 'ArrowRight')

    expect(element.snapshot.nodes[0]?.frame.x).toBe(41)
    expect(element.snapshot.nodes[1]?.frame.x).toBe(420)
  })

  it('allows the consumer to replace every default key binding', async () => {
    const element = await mount()
    const canvas = element.shadowRoot?.querySelector('fd-canvas') as HTMLElement
    element.configuration = {
      keyboardNavigation: { selectionBehavior: 'preserve' },
    }
    element.platformAdapter = {
      resolveKeyboardCommand: (event) =>
        event.key === 'j' ? { kind: 'navigate', direction: 'right' } : undefined,
    }
    element.focusedNodeID = 'source'
    await element.updateComplete

    dispatchKey(canvas, 'ArrowRight')
    expect(element.focusedNodeID).toBe('source')
    dispatchKey(canvas, 'j')
    expect(element.focusedNodeID).toBe('target')
  })

  it('respects keyboard navigation and dragging capabilities independently', async () => {
    const element = await mount()
    element.interactionPolicy = {
      nodeCapabilities: {
        overrides: new Map([['target', { keyboardNavigable: false }]]),
      },
    }
    const canvas = element.shadowRoot?.querySelector('fd-canvas') as HTMLElement
    element.focusedNodeID = 'source'
    await element.updateComplete

    dispatchKey(canvas, 'ArrowRight')
    expect(element.focusedNodeID).toBe('source')
  })

  it('reconciles focus when a snapshot removes the focused node', async () => {
    const element = await mount()
    const source = graphSnapshot().nodes[0]
    if (!source) throw new Error('missing source fixture')
    element.focusedNodeID = 'target'
    await element.updateComplete
    element.snapshot = {
      id: 'without-target',
      nodes: [source],
      edges: [],
    }
    await element.updateComplete

    expect(element.focusedNodeID).toBe(undefined)
  })
})

describe('fd-graph-canvas navigation', () => {
  it('jumps to a node with explicit focus, selection, zoom, and animation behavior', async () => {
    const element = await mount()
    const selectionChanges: FdGraphSelectionChangeDetail[] = []
    const focusChanges: FdGraphFocusChangeDetail[] = []
    element.addEventListener('fd-graph-selection-change', (event) => {
      selectionChanges.push(event.detail)
    })
    element.addEventListener('fd-graph-focus-change', (event) => {
      focusChanges.push(event.detail)
    })

    expect(
      element.jumpToElement('target', { selection: 'replace', zoom: 1.4, animated: false }),
    ).toBe(true)

    expect(element.selectedNodeIDs).toEqual(new Set(['target']))
    expect(element.focusedNodeID).toBe('target')
    expect(element.viewport.transform.zoom).toBeCloseTo(1.4)
    expect(selectionChanges.at(-1)?.source).toBe('programmatic')
    expect(focusChanges.at(-1)).toEqual({
      focusedElement: graphNodeReference('target'),
      focusedNodeID: 'target',
      source: 'programmatic',
    })
  })

  it('supports preserved and additive selection and ignores missing nodes', async () => {
    const element = await mount()
    element.selectedNodeIDs = new Set(['source'])
    await element.updateComplete

    expect(element.jumpToElement('target', { selection: 'preserve', animated: false })).toBe(true)
    expect(element.selectedNodeIDs).toEqual(new Set(['source']))
    expect(element.jumpToElement('target', { selection: 'add', animated: false })).toBe(true)
    expect(element.selectedNodeIDs).toEqual(new Set(['source', 'target']))
    expect(element.jumpToElement('missing')).toBe(false)
  })
})

describe('fd-graph-canvas arrangement', () => {
  it('arranges selected nodes through the standard event and history boundary', async () => {
    const element = await mount()
    element.selectedNodeIDs = new Set(['source', 'target'])
    applyFrameIntents(element)
    await element.updateComplete
    const events: FdGraphNodeFramesChangeDetail[] = []
    element.addEventListener('fd-graph-node-frames-change', (event) => events.push(event.detail))

    expect(element.arrangeSelectedNodes({ kind: 'align', alignment: 'top' })).toBe(true)

    expect(element.snapshot.nodes[1]?.frame.y).toBe(80)
    expect(events.at(-1)?.kind).toBe('arrangement')
    expect(element.undoActionName).toBe('Arrange Nodes')
    await element.updateComplete
    expect(await element.undo()).toBe(true)
    expect(element.snapshot.nodes[1]?.frame.y).toBe(220)
  })

  it('excludes nodes that opt out of arrangement actions', async () => {
    const element = await mount()
    element.interactionPolicy = {
      nodeCapabilities: {
        overrides: new Map([['target', { arrangementParticipant: false }]]),
      },
    }
    element.selectedNodeIDs = new Set(['source', 'target'])
    await element.updateComplete

    expect(element.arrangeSelectedNodes({ kind: 'align', alignment: 'top' })).toBe(false)
  })
})

describe('fd-graph-canvas accessibility', () => {
  it('uses one composite tab stop with a bounded active-descendant window', async () => {
    const element = await mount(graphSnapshot(), 'dom')
    const canvas = element.shadowRoot?.querySelector('fd-canvas')
    const viewport = canvas?.shadowRoot?.querySelector('.viewport')
    const surface = element.shadowRoot?.querySelector<HTMLElement>('.accessibility-surface')

    expect(viewport?.getAttribute('tabindex')).toBe('-1')
    expect(surface?.tabIndex).toBe(0)
    expect(surface?.getAttribute('role')).toBe('grid')
    expect(surface?.getAttribute('aria-rowcount')).toBe('3')
    expect(element.shadowRoot?.querySelectorAll('.accessibility-item')).toHaveLength(3)

    surface?.focus()
    expect(surface?.getAttribute('aria-activedescendant')).toContain(
      encodeURIComponent(graphElementReferenceKey(graphNodeReference('source'))),
    )
    dispatchKey(surface ?? element, 'ArrowDown')
    expect(surface?.getAttribute('aria-activedescendant')).toContain(
      encodeURIComponent(graphElementReferenceKey(graphNodeReference('target'))),
    )
    dispatchKey(surface ?? element, 'ArrowDown')
    await nextFrame()
    expect(
      element.shadowRoot
        ?.querySelector('[data-fd-graph-edge="s:connection"]')
        ?.hasAttribute('data-focused'),
    ).toBe(true)
    dispatchKey(surface ?? element, ' ')
    await nextFrame()
    expect(element.selectedElements).toEqual([graphEdgeReference('connection')])
    expect(
      element.shadowRoot
        ?.querySelector('[data-fd-graph-edge="s:connection"]')
        ?.hasAttribute('data-selected'),
    ).toBe(true)
    const activeID = surface?.getAttribute('aria-activedescendant')
    expect(
      activeID ? element.shadowRoot?.getElementById(activeID)?.getAttribute('aria-selected') : null,
    ).toBe('true')
  })

  it('keeps consumer semantics and capabilities independent from mechanics', async () => {
    const element = document.createElement('fd-graph-canvas')
    element.style.width = '800px'
    element.style.height = '600px'
    element.snapshot = graphSnapshot()
    element.configuration = {
      accessibility: {
        maximumExposedElementCount: 2,
        capabilities: { movement: false },
      },
    }
    element.platformAdapter = {
      accessibilityCanvasLabel: 'Workflow surface',
      nodeAccessibilityRepresentation: (node) => ({
        kind: 'element',
        description: { label: `Step ${String(node.id)}`, hint: 'Consumer-provided hint' },
      }),
      portAccessibilityRepresentation: () => ({ kind: 'hidden' }),
      edgeAccessibilityRepresentation: () => ({ kind: 'hidden' }),
    }
    document.body.append(element)
    await element.updateComplete
    await nextFrame()
    const surface = element.shadowRoot?.querySelector('.accessibility-surface')

    expect(surface?.getAttribute('aria-label')).toBe('Workflow surface')
    expect(surface?.getAttribute('aria-readonly')).toBe('true')
    expect(element.shadowRoot?.querySelectorAll('.accessibility-item')).toHaveLength(2)
    expect(
      element.shadowRoot?.querySelector('.accessibility-item')?.getAttribute('aria-label'),
    ).toBe('Step source')
    expect(
      element.shadowRoot?.querySelector('.accessibility-item')?.getAttribute('aria-description'),
    ).toBe('Consumer-provided hint')
  })

  it('supports selection, activation, and keyboard movement without a pointer', async () => {
    const element = await mount()
    const surface = element.shadowRoot?.querySelector<HTMLElement>('.accessibility-surface')
    const actions: FdGraphAccessibilityActionDetail[] = []
    applyFrameIntents(element)
    element.addEventListener('fd-graph-accessibility-action', (event) => actions.push(event.detail))
    await element.updateComplete

    surface?.focus()
    dispatchKey(surface ?? element, ' ')
    expect(element.selectedNodeIDs).toEqual(new Set(['source']))
    dispatchKey(surface ?? element, 'ArrowRight', { ctrlKey: true })
    expect(element.snapshot.nodes[0]?.frame.x).toBe(41)
    dispatchKey(surface ?? element, 'Enter')

    expect(actions.map(({ action }) => action.kind)).toEqual([
      'focus',
      'select',
      'move',
      'activate',
    ])
  })

  it('navigates connected elements and dispatches consumer-defined accessibility actions', async () => {
    const element = document.createElement('fd-graph-canvas')
    element.style.width = '800px'
    element.style.height = '600px'
    element.snapshot = graphSnapshot()
    element.configuration = { renderingBackend: 'dom' }
    element.platformAdapter = {
      resolveAccessibilityCommand: (event) =>
        event.key === 'i'
          ? { kind: 'perform', actionID: 'inspect' }
          : defaultGraphAccessibilityCommandResolver(event),
      nodeAccessibilityRepresentation: (node) => ({
        kind: 'element',
        description: {
          label: String(node.label),
          identifier: `node-${String(node.id)}`,
          actions: [{ id: 'inspect', label: 'Inspect node' }],
        },
      }),
    }
    const actions: FdGraphAccessibilityActionDetail[] = []
    element.addEventListener('fd-graph-accessibility-action', (event) => actions.push(event.detail))
    document.body.append(element)
    await element.updateComplete
    await nextFrame()
    const surface = element.shadowRoot?.querySelector<HTMLElement>('.accessibility-surface')

    surface?.focus()
    dispatchKey(surface ?? element, 'ArrowRight', { altKey: true })
    expect(surface?.getAttribute('aria-activedescendant')).toContain(
      encodeURIComponent(graphElementReferenceKey(graphNodeReference('target'))),
    )

    dispatchKey(surface ?? element, 'i')

    expect(actions.at(-1)).toEqual({
      element: { kind: 'node', nodeID: 'target' },
      action: { kind: 'perform', actionID: 'inspect' },
    })
    const targetRow = element.shadowRoot?.querySelector<HTMLElement>(
      '[data-fd-graph-accessibility-identifier="node-target"]',
    )
    expect(targetRow?.getAttribute('aria-description')).toBe('Inspect node')
  })

  it('lets consumers replace accessibility commands and opt out completely', async () => {
    const element = await mount()
    const surface = element.shadowRoot?.querySelector<HTMLElement>('.accessibility-surface')
    element.platformAdapter = {
      resolveAccessibilityCommand: (event) =>
        event.key === 'j' ? { kind: 'focusNext' } : undefined,
    }
    await element.updateComplete
    surface?.focus()
    const first = surface?.getAttribute('aria-activedescendant')

    dispatchKey(surface ?? element, 'ArrowDown')
    expect(surface?.getAttribute('aria-activedescendant')).toBe(first)
    dispatchKey(surface ?? element, 'j')
    expect(surface?.getAttribute('aria-activedescendant')).not.toBe(first)

    element.configuration = {
      accessibility: {
        capabilities: {
          focusNavigation: false,
          selection: false,
          movement: false,
          connections: false,
          elementActions: false,
        },
      },
    }
    await element.updateComplete
    expect(surface?.tabIndex).toBe(-1)
    expect(
      element.shadowRoot
        ?.querySelector('fd-canvas')
        ?.shadowRoot?.querySelector('.viewport')
        ?.getAttribute('tabindex'),
    ).toBe('0')
    expect(element.shadowRoot?.querySelectorAll('.accessibility-item')).toHaveLength(0)
  })
})

describe('fd-graph-canvas history', () => {
  it('registers one local transaction and supports public undo and redo', async () => {
    const element = await mount()
    const canvas = element.shadowRoot?.querySelector('fd-canvas') as HTMLElement
    const states: FdGraphCanvasHistoryStateDetail[] = []
    applyFrameIntents(element)
    element.focusedNodeID = 'source'
    element.selectedNodeIDs = new Set(['source'])
    element.addEventListener('fd-graph-history-state-change', (event) => states.push(event.detail))
    await element.updateComplete

    dispatchKey(canvas, 'ArrowRight')
    expect(element.snapshot.nodes[0]?.frame.x).toBe(41)
    expect(element.canUndo).toBe(true)
    expect(element.undoActionName).toBe('Move Nodes')

    await element.updateComplete
    expect(await element.undo()).toBe(true)
    expect(element.snapshot.nodes[0]?.frame.x).toBe(40)
    expect(element.canRedo).toBe(true)
    await element.updateComplete
    expect(await element.redo()).toBe(true)
    expect(element.snapshot.nodes[0]?.frame.x).toBe(41)
    expect(states.some(({ isApplying }) => isApplying)).toBe(true)
  })

  it('uses rebindable platform shortcuts without claiming unavailable history', async () => {
    const element = await mount()
    const canvas = element.shadowRoot?.querySelector('fd-canvas') as HTMLElement
    applyFrameIntents(element)
    element.focusedNodeID = 'source'
    element.selectedNodeIDs = new Set(['source'])
    await element.updateComplete
    const unavailable = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    canvas.dispatchEvent(unavailable)
    expect(unavailable.defaultPrevented).toBe(false)

    dispatchKey(canvas, 'ArrowRight')
    await element.updateComplete
    const undo = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    canvas.dispatchEvent(undo)
    await nextFrame()
    expect(undo.defaultPrevented).toBe(true)
    expect(element.snapshot.nodes[0]?.frame.x).toBe(40)

    await element.updateComplete
    dispatchKey(canvas, 'z', { metaKey: true, shiftKey: true })
    await nextFrame()
    expect(element.snapshot.nodes[0]?.frame.x).toBe(41)
  })

  it('reports stale state instead of overwriting a newer snapshot', async () => {
    const element = await mount()
    const canvas = element.shadowRoot?.querySelector('fd-canvas') as HTMLElement
    const conflicts: FdGraphCanvasHistoryConflictDetail[] = []
    applyFrameIntents(element)
    element.focusedNodeID = 'source'
    element.selectedNodeIDs = new Set(['source'])
    element.addEventListener('fd-graph-history-conflict', (event) => conflicts.push(event.detail))
    await element.updateComplete
    dispatchKey(canvas, 'ArrowRight')
    const current = element.snapshot
    element.snapshot = {
      ...current,
      id: 'remote-update',
      nodes: current.nodes.map((node) =>
        node.id === 'source' ? { ...node, frame: { ...node.frame, x: 500 } } : node,
      ),
    }
    await element.updateComplete

    expect(await element.undo()).toBe(false)
    expect(element.snapshot.nodes[0]?.frame.x).toBe(500)
    expect(conflicts[0]?.failure).toEqual({ kind: 'staleNodeFrame', nodeID: 'source' })
    expect(element.canRedo).toBe(false)
  })

  it('lets a collaboration policy own compensation and supports capability opt-out', async () => {
    const applied: string[] = []
    const element = await mount()
    const canvas = element.shadowRoot?.querySelector('fd-canvas') as HTMLElement
    element.historyConfiguration = {
      mode: 'collaborative',
      apply: (_changes, direction) => {
        applied.push(direction)
        return { kind: 'applied' }
      },
    }
    element.focusedNodeID = 'source'
    element.selectedNodeIDs = new Set(['source'])
    await element.updateComplete
    dispatchKey(canvas, 'ArrowRight')

    expect(await element.undo()).toBe(true)
    expect(await element.redo()).toBe(true)
    expect(applied).toEqual(['undo', 'redo'])

    element.historyConfiguration = { capabilities: { localUndoRedo: false } }
    await element.updateComplete
    dispatchKey(canvas, 'ArrowRight')
    expect(element.canUndo).toBe(false)
  })
})

describe('fd-graph-canvas minimap integration', () => {
  it('shares the indexed snapshot and drives the canvas viewport', async () => {
    const element = await mount()
    element.miniMapConfiguration = { visibility: 'always' }
    await element.updateComplete
    await nextFrame()
    await nextFrame()
    const miniMap = element.shadowRoot?.querySelector('fd-graph-minimap')
    expect(miniMap?.snapshot).toBe(element.snapshot)
    expect(miniMap?.snapshotIndex).toBe(element.graphIndex)
    const initialOffset = element.viewport.transform.offset

    miniMap?.dispatchEvent(
      new CustomEvent('fd-graph-minimap-navigation', {
        detail: {
          kind: 'center',
          worldPoint: { x: 500, y: 400 },
          phase: 'ended',
        },
        bubbles: true,
        composed: true,
      }),
    )

    expect(element.viewport.transform.offset).not.toEqual(initialOffset)
    expect(
      element.viewport.visibleWorldRect.x + element.viewport.visibleWorldRect.width / 2,
    ).toBeCloseTo(500)
  })
})
