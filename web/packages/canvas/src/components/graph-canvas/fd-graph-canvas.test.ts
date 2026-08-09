import { afterEach, describe, expect, it } from 'vitest'
import type { FdGraphAccessibilityActionDetail } from '../../accessibility/events.js'
import type { FdCanvasPoint } from '../../geometry.js'
import type {
  FdGraphFocusChangeDetail,
  FdGraphNodeFramesChangeDetail,
  FdGraphSelectionChangeDetail,
} from '../../graph/events.js'
import type { FdAnyGraphSnapshot } from '../../graph/model.js'
import type {
  FdGraphCanvasHistoryConflictDetail,
  FdGraphCanvasHistoryStateDetail,
} from '../../history/events.js'
import type {
  FdGraphRenderFrame,
  FdGraphRenderingBackend,
  FdGraphRenderingBackendPreference,
  FdGraphRenderingSurface,
} from '../../rendering/backend.js'
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
  backend?: FdGraphRenderingBackend | FdGraphRenderingBackendPreference,
): Promise<FdGraphCanvas> {
  const element = document.createElement('fd-graph-canvas')
  element.style.width = '800px'
  element.style.height = '600px'
  element.snapshot = snapshot
  if (backend) element.renderingBackend = backend
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
  it('renders indexed nodes, ports, edges, and labels with the automatic backend', async () => {
    const element = await mount()
    const root = element.shadowRoot

    expect(element.resolvedRenderingBackend?.kind).toBe('webgl2')
    expect(root?.querySelectorAll('.graph-gpu-layer')).toHaveLength(1)
    expect(root?.querySelectorAll('.graph-node')).toHaveLength(2)
    expect(root?.querySelectorAll('.graph-port')).toHaveLength(2)
    expect(root?.querySelectorAll('.graph-edge')).toHaveLength(0)
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

  it('keeps model hit testing available when dense nodes use GPU level of detail', async () => {
    const element = await mount(
      graphSnapshot(),
      new FdGraphWebGL2RenderingBackend({ maximumDOMNodeCount: 0 }),
    )
    const canvas = preparePointerInput(element)
    const point = clientPoint(element, { x: 100, y: 120 })

    expect(element.shadowRoot?.querySelectorAll('.graph-node')).toHaveLength(0)
    dispatchPointer(canvas, 'pointerdown', point)
    dispatchPointer(canvas, 'pointerup', point)

    expect(element.selectedNodeIDs.has('source')).toBe(true)
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

  it('drags a multi-node selection and commits one local snapshot on pointer release', async () => {
    const element = await mount()
    const canvas = preparePointerInput(element)
    element.selectedNodeIDs = new Set(['source', 'target'])
    element.interactionConfiguration = {
      frameUpdates: 'local',
      snapping: { enabled: false },
    }
    await element.updateComplete
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
  })

  it('emits intent updates without mutating a consumer-owned snapshot', async () => {
    const snapshot = graphSnapshot()
    const element = await mount(snapshot)
    const canvas = preparePointerInput(element)
    element.interactionConfiguration = { snapping: { enabled: false } }
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
    const snapshot = graphSnapshot()
    const element = await mount({
      ...snapshot,
      nodes: snapshot.nodes.map((node) =>
        node.id === 'source' ? { ...node, capabilities: { draggable: false } } : node,
      ),
    })
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
    first.interactionConfiguration = { frameUpdates: 'local' }
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
    second.interactionConfiguration = { frameUpdates: 'local' }
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

  it('resizes selected nodes from all exposed edge and corner handles', async () => {
    const element = await mount()
    const canvas = preparePointerInput(element)
    element.selectedNodeIDs = new Set(['source'])
    element.interactionConfiguration = {
      frameUpdates: 'local',
      snapping: { enabled: false },
    }
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
    expect(focusChanges.at(-1)).toEqual({ focusedNodeID: 'target', source: 'keyboard' })
    expect(
      element.shadowRoot
        ?.querySelector('[data-fd-graph-node="s:target"]')
        ?.hasAttribute('data-focused'),
    ).toBe(true)
  })

  it('nudges a selected node by standard and configurable large steps', async () => {
    const element = await mount()
    const canvas = element.shadowRoot?.querySelector('fd-canvas') as HTMLElement
    element.interactionConfiguration = { frameUpdates: 'local' }
    element.keyboardConfiguration = { nudgeStep: 2, largeNudgeStep: 18 }
    element.focusedNodeID = 'source'
    element.selectedNodeIDs = new Set(['source'])
    await element.updateComplete

    dispatchKey(canvas, 'ArrowRight')
    expect(element.snapshot.nodes[0]?.frame.x).toBe(42)
    dispatchKey(canvas, 'ArrowDown', { shiftKey: true })
    expect(element.snapshot.nodes[0]?.frame.y).toBe(98)
  })

  it('allows the consumer to replace every default key binding', async () => {
    const element = await mount()
    const canvas = element.shadowRoot?.querySelector('fd-canvas') as HTMLElement
    element.keyboardConfiguration = {
      selectionBehavior: 'preserve',
      resolveCommand: (event) =>
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
    const snapshot = graphSnapshot()
    const element = await mount({
      ...snapshot,
      nodes: snapshot.nodes.map((node) =>
        node.id === 'target'
          ? { ...node, capabilities: { ...node.capabilities, keyboardNavigable: false } }
          : node,
      ),
    })
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
    expect(surface?.getAttribute('aria-activedescendant')).toContain('node%3As%3Asource')
    dispatchKey(surface ?? element, 'ArrowDown')
    expect(surface?.getAttribute('aria-activedescendant')).toContain('node%3As%3Atarget')
    dispatchKey(surface ?? element, 'ArrowDown')
    await nextFrame()
    expect(
      element.shadowRoot
        ?.querySelector('[data-fd-graph-edge="s:connection"]')
        ?.hasAttribute('data-focused'),
    ).toBe(true)
  })

  it('keeps consumer semantics and capabilities independent from mechanics', async () => {
    const element = document.createElement('fd-graph-canvas')
    element.style.width = '800px'
    element.style.height = '600px'
    element.snapshot = graphSnapshot()
    element.accessibilityConfiguration = {
      canvasLabel: 'Workflow surface',
      maximumExposedElementCount: 2,
      capabilities: { movement: false },
      nodeRepresentation: (node) => ({
        kind: 'element',
        description: { label: `Step ${String(node.id)}`, hint: 'Consumer-provided hint' },
      }),
      portRepresentation: () => ({ kind: 'hidden' }),
      edgeRepresentation: () => ({ kind: 'hidden' }),
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
    element.interactionConfiguration = { frameUpdates: 'local' }
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

  it('lets consumers replace accessibility commands and opt out completely', async () => {
    const element = await mount()
    const surface = element.shadowRoot?.querySelector<HTMLElement>('.accessibility-surface')
    element.accessibilityConfiguration = {
      resolveCommand: (event) => (event.key === 'j' ? { kind: 'focusNext' } : undefined),
    }
    await element.updateComplete
    surface?.focus()
    const first = surface?.getAttribute('aria-activedescendant')

    dispatchKey(surface ?? element, 'ArrowDown')
    expect(surface?.getAttribute('aria-activedescendant')).toBe(first)
    dispatchKey(surface ?? element, 'j')
    expect(surface?.getAttribute('aria-activedescendant')).not.toBe(first)

    element.accessibilityConfiguration = { enabled: false }
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
    element.interactionConfiguration = { frameUpdates: 'local' }
    element.focusedNodeID = 'source'
    element.selectedNodeIDs = new Set(['source'])
    element.addEventListener('fd-graph-history-state-change', (event) => states.push(event.detail))
    await element.updateComplete

    dispatchKey(canvas, 'ArrowRight')
    expect(element.snapshot.nodes[0]?.frame.x).toBe(41)
    expect(element.canUndo).toBe(true)
    expect(element.undoActionName).toBe('Move Nodes')

    expect(await element.undo()).toBe(true)
    expect(element.snapshot.nodes[0]?.frame.x).toBe(40)
    expect(element.canRedo).toBe(true)
    expect(await element.redo()).toBe(true)
    expect(element.snapshot.nodes[0]?.frame.x).toBe(41)
    expect(states.some(({ isApplying }) => isApplying)).toBe(true)
  })

  it('uses rebindable platform shortcuts without claiming unavailable history', async () => {
    const element = await mount()
    const canvas = element.shadowRoot?.querySelector('fd-canvas') as HTMLElement
    element.interactionConfiguration = { frameUpdates: 'local' }
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

    dispatchKey(canvas, 'z', { metaKey: true, shiftKey: true })
    await nextFrame()
    expect(element.snapshot.nodes[0]?.frame.x).toBe(41)
  })

  it('reports stale state instead of overwriting a newer snapshot', async () => {
    const element = await mount()
    const canvas = element.shadowRoot?.querySelector('fd-canvas') as HTMLElement
    const conflicts: FdGraphCanvasHistoryConflictDetail[] = []
    element.interactionConfiguration = { frameUpdates: 'local' }
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
