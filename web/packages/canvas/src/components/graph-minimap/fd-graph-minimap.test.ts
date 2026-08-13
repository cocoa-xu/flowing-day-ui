import { afterEach, describe, expect, it } from 'vitest'
import { FdCanvasTransform, FdCanvasViewport } from '../../geometry.js'
import type { FdAnyGraphMiniMapSnapshot } from '../../minimap/model.js'
import type {
  FdGraphMiniMapRenderFrame,
  FdGraphMiniMapRenderingBackend,
} from '../../minimap/renderer.js'
import type { FdGraphMiniMap } from './fd-graph-minimap.js'
import './fd-graph-minimap.js'

const snapshot: FdAnyGraphMiniMapSnapshot = {
  id: 'graph',
  contentBounds: { x: 0, y: 0, width: 1_000, height: 800 },
  nodes: [
    { id: 'one', frame: { x: 0, y: 0, width: 80, height: 60 } },
    { id: 'two', frame: { x: 920, y: 740, width: 80, height: 60 } },
  ],
  edges: [{ id: 'edge', start: { x: 40, y: 30 }, end: { x: 960, y: 770 } }],
}

const viewport = (offsetX = 0): FdCanvasViewport =>
  new FdCanvasViewport(
    new FdCanvasTransform(1, { x: offsetX, y: 0 }),
    { width: 400, height: 300 },
    { x: 0, y: 0, width: 400, height: 300 },
  )

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

class RecordingBackend implements FdGraphMiniMapRenderingBackend {
  readonly frames: FdGraphMiniMapRenderFrame[] = []
  mounts = 0
  unmounts = 0

  mount(): void {
    this.mounts += 1
  }

  render(frame: FdGraphMiniMapRenderFrame): void {
    this.frames.push(frame)
  }

  unmount(): void {
    this.unmounts += 1
  }
}

async function mount(backend?: FdGraphMiniMapRenderingBackend): Promise<FdGraphMiniMap> {
  const element = document.createElement('fd-graph-minimap')
  element.snapshot = snapshot
  element.viewport = viewport()
  element.configuration = { visibility: 'always' }
  if (backend) element.renderingBackend = backend
  document.body.append(element)
  await element.updateComplete
  await nextFrame()
  await nextFrame()
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-graph-minimap rendering', () => {
  it('renders an adaptive plan through a replaceable backend', async () => {
    const backend = new RecordingBackend()
    const element = await mount(backend)
    const frame = backend.frames.at(-1)

    expect(backend.mounts).toBe(1)
    expect(frame?.snapshot).toBe(snapshot)
    expect(frame?.viewport).toBe(element.viewport)
    expect(frame?.viewportFrame).toEqual(
      frame?.transform.applyRect(element.viewport.visibleWorldRect),
    )
    expect(frame?.plan.snapshotID).toBe(snapshot.id)
    expect(frame?.plan.nodeBatches).toHaveLength(1)
    expect(frame?.plan.edgeSegments).toHaveLength(1)
    expect(frame?.style.nodeStyles).toHaveLength(1)
    expect(element.getAttribute('placement')).toBe('bottomTrailing')
    expect(element.getAttribute('data-visible')).toBe('true')
  })

  it('keeps view styling and overlay placement separate from core configuration', async () => {
    const backend = new RecordingBackend()
    const element = await mount(backend)
    element.miniMapStyle = {
      background: '#fffaf7',
      nodeStyles: [{ fill: '#f3a9b8' }, { fill: '#83b9a2' }],
    }
    element.placement = 'topLeading'
    element.overlayInsets = { top: 4, right: 6, bottom: 8, left: 10 }
    element.nodeStyleIndex = ({ id }) => (id === 'two' ? 1 : 0)
    await element.updateComplete
    await nextFrame()
    await nextFrame()

    const frame = backend.frames.at(-1)
    expect(frame?.style.background).toBe('#fffaf7')
    expect(frame?.plan.nodeBatches.map(({ styleIndex }) => styleIndex)).toEqual([0, 1])
    expect(element.getAttribute('placement')).toBe('topLeading')
    expect(element.style.getPropertyValue('--fd-graph-minimap-inset-top')).toBe('4px')
    expect(element.style.getPropertyValue('--fd-graph-minimap-inset-left')).toBe('10px')
  })

  it('exposes the Swift-aligned rendering context for slotted decorations', async () => {
    const element = await mount()
    element.viewport = viewport(-120)
    await element.updateComplete

    expect(element.renderingContext).toMatchObject({
      snapshot,
      viewport: element.viewport,
      configuration: { interaction: 'panAndZoom' },
    })
  })

  it('remounts its renderer after the same element is reconnected', async () => {
    const backend = new RecordingBackend()
    const element = await mount(backend)

    element.remove()
    expect(backend.unmounts).toBe(1)
    document.body.append(element)
    await nextFrame()
    await nextFrame()

    expect(backend.mounts).toBe(2)
    expect(backend.frames.length).toBeGreaterThan(1)
  })

  it('updates the viewport indicator without rebuilding a stable overview plan', async () => {
    const backend = new RecordingBackend()
    const element = await mount(backend)
    const originalRenderCount = backend.frames.length
    const indicator = element.shadowRoot?.querySelector<HTMLElement>('.viewport-indicator')
    const originalTransform = indicator?.style.transform

    element.viewport = viewport(-120)
    await element.updateComplete

    expect(indicator?.style.transform).not.toBe(originalTransform)
    expect(backend.frames).toHaveLength(originalRenderCount)
  })

  it('pins local navigator geometry for the duration of direct manipulation', async () => {
    const backend = new RecordingBackend()
    const element = await mount(backend)
    element.configuration = {
      visibility: 'always',
      scope: { kind: 'localNavigator', surroundingScale: 3 },
    }
    await element.updateComplete
    await nextFrame()
    await nextFrame()
    const originalBounds = backend.frames.at(-1)?.plan.transform.worldBounds
    const bounds = element.getBoundingClientRect()
    element.setPointerCapture = () => undefined

    element.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        button: 0,
        clientX: bounds.left + 100,
        clientY: bounds.top + 70,
        bubbles: true,
        cancelable: true,
      }),
    )
    element.viewport = new FdCanvasViewport(
      FdCanvasTransform.identity,
      { width: 400, height: 300 },
      { x: 4_000, y: 3_000, width: 400, height: 300 },
    )
    await element.updateComplete
    await nextFrame()

    expect(backend.frames.at(-1)?.plan.transform.worldBounds).toEqual(originalBounds)

    element.dispatchEvent(
      new PointerEvent('pointerup', {
        pointerId: 1,
        button: 0,
        clientX: bounds.left + 100,
        clientY: bounds.top + 70,
        bubbles: true,
        cancelable: true,
      }),
    )
    await nextFrame()
    await nextFrame()

    expect(backend.frames.at(-1)?.plan.transform.worldBounds).not.toEqual(originalBounds)
  })

  it('supports automatic visibility when navigation is not useful', async () => {
    const element = await mount()
    element.configuration = { visibility: 'whenNavigationIsUseful' }
    element.snapshot = {
      id: 'small',
      contentBounds: { x: 20, y: 20, width: 40, height: 40 },
      nodes: [{ id: 0, frame: { x: 20, y: 20, width: 40, height: 40 } }],
      edges: [],
    }
    await element.updateComplete

    expect(element.getAttribute('data-visible')).toBe('false')
  })

  it('emits pointer and trackpad navigation intents', async () => {
    const element = await mount()
    element.setPointerCapture = () => undefined
    const events: unknown[] = []
    element.addEventListener('fd-graph-minimap-navigation', (event) => events.push(event.detail))
    const bounds = element.getBoundingClientRect()

    element.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        button: 0,
        clientX: bounds.left + 180,
        clientY: bounds.top + 100,
        bubbles: true,
        cancelable: true,
      }),
    )
    element.dispatchEvent(
      new PointerEvent('pointerup', {
        pointerId: 1,
        button: 0,
        clientX: bounds.left + 180,
        clientY: bounds.top + 100,
        bubbles: true,
        cancelable: true,
      }),
    )
    element.dispatchEvent(
      new WheelEvent('wheel', {
        clientX: bounds.left + 100,
        clientY: bounds.top + 70,
        deltaY: -12,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'center', phase: 'continuous' }),
        expect.objectContaining({ kind: 'center', phase: 'ended' }),
        expect.objectContaining({ kind: 'zoom', phase: 'continuous' }),
      ]),
    )
  })
})
