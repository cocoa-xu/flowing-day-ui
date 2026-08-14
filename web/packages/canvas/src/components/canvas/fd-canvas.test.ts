import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultCanvasConfiguration } from '../../configuration.js'
import type { FdCanvas } from './fd-canvas.js'
import './fd-canvas.js'

async function mount(): Promise<FdCanvas> {
  const element = document.createElement('fd-canvas')
  element.style.width = '600px'
  element.style.height = '400px'
  element.contentRect = { x: 0, y: 0, width: 200, height: 100 }
  document.body.append(element)
  await element.updateComplete
  await new Promise(requestAnimationFrame)
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-canvas viewport', () => {
  it('uses the Swift zoom range and duration units', () => {
    expect(defaultCanvasConfiguration.zoomRange).toEqual([0.25, 4])
    expect(defaultCanvasConfiguration.viewportAnimationDuration).toBe(0.25)
  })

  it('centers content at the configured initial zoom', async () => {
    const element = await mount()
    expect(element.viewport.transform.zoom).toBe(1)
    expect(element.viewport.transform.offset.x).toBeCloseTo(200)
    expect(element.viewport.transform.offset.y).toBeCloseTo(150)
  })

  it('keeps the viewport center fixed while changing zoom', async () => {
    const element = await mount()
    const viewportCenter = { x: 300, y: 200 }
    const worldCenter = element.viewport.transform.removePoint(viewportCenter)

    element.setZoom(2)

    expect(element.viewport.transform.zoom).toBe(2)
    expect(element.viewport.transform.applyPoint(worldCenter).x).toBeCloseTo(viewportCenter.x)
    expect(element.viewport.transform.applyPoint(worldCenter).y).toBeCloseTo(viewportCenter.y)
  })

  it('clamps zoom to the configured range', async () => {
    const element = await mount()
    element.configuration = { zoomRange: [0.5, 2] }
    await element.updateComplete

    element.setZoom(4)

    expect(element.viewport.transform.zoom).toBe(2)
  })

  it('fits content within a padded viewport', async () => {
    const element = await mount()
    element.fitRect({ x: 0, y: 0, width: 1000, height: 800 }, 40, undefined, {
      animated: false,
    })
    const displayed = element.viewport.transform.applyRect({
      x: 0,
      y: 0,
      width: 1000,
      height: 800,
    })

    expect(displayed.x).toBeGreaterThanOrEqual(40)
    expect(displayed.y).toBeGreaterThanOrEqual(40)
    expect(displayed.x + displayed.width).toBeLessThanOrEqual(560)
    expect(displayed.y + displayed.height).toBeLessThanOrEqual(360)
  })

  it('preserves the world center when the host is resized', async () => {
    const element = await mount()
    const oldWorldCenter = element.viewport.transform.removePoint({ x: 300, y: 200 })
    element.style.width = '800px'
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)

    const newWorldCenter = element.viewport.transform.removePoint({ x: 400, y: 200 })
    expect(newWorldCenter.x).toBeCloseTo(oldWorldCenter.x)
    expect(newWorldCenter.y).toBeCloseTo(oldWorldCenter.y)
  })

  it('applies the content change policy when content identity changes', async () => {
    const element = await mount()
    element.contentChangeBehavior = { kind: 'center' }
    element.anchor({ x: 500, y: 500 }, { x: 300, y: 200 }, 2)
    element.contentID = 'next'
    await element.updateComplete

    expect(element.viewport.transform.zoom).toBe(1)
    expect(element.viewport.transform.offset.x).toBeCloseTo(200)
    expect(element.viewport.transform.offset.y).toBeCloseTo(150)
  })
})

describe('fd-canvas input and events', () => {
  it('uses control-wheel magnification anchored under the pointer', async () => {
    const element = await mount()
    const viewport = element.shadowRoot?.querySelector('.viewport') as HTMLElement
    const anchor = { x: 240, y: 160 }
    const worldAnchor = element.viewport.transform.removePoint(anchor)
    const onChange = vi.fn()
    element.addEventListener('fd-viewport-change', onChange)
    const event = new WheelEvent('wheel', {
      clientX: anchor.x,
      clientY: anchor.y,
      deltaY: -12,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })

    viewport.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(element.viewport.transform.zoom).toBeGreaterThan(1)
    expect(element.viewport.transform.applyPoint(worldAnchor).x).toBeCloseTo(anchor.x)
    expect(element.viewport.transform.applyPoint(worldAnchor).y).toBeCloseTo(anchor.y)
    expect(onChange.mock.calls.at(-1)?.[0].detail.phase).toBe('continuous')
  })

  it('maps wheel deltas to native scroll-direction panning', async () => {
    const element = await mount()
    const viewport = element.shadowRoot?.querySelector('.viewport') as HTMLElement
    const initialOffset = element.viewport.transform.offset

    viewport.dispatchEvent(
      new WheelEvent('wheel', {
        clientX: 300,
        clientY: 200,
        deltaX: 30,
        deltaY: 20,
        bubbles: true,
        cancelable: true,
      }),
    )

    expect(element.viewport.transform.offset.x).toBeCloseTo(initialOffset.x - 30)
    expect(element.viewport.transform.offset.y).toBeCloseTo(initialOffset.y - 20)
  })

  it('supports one-finger touch panning', async () => {
    const element = await mount()
    const viewport = element.shadowRoot?.querySelector('.viewport') as HTMLElement
    vi.spyOn(viewport, 'setPointerCapture').mockImplementation(() => {})
    const bounds = viewport.getBoundingClientRect()
    const initialOffset = element.viewport.transform.offset

    viewport.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        pointerType: 'touch',
        button: 0,
        clientX: bounds.left + 300,
        clientY: bounds.top + 200,
        bubbles: true,
      }),
    )
    viewport.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        pointerType: 'touch',
        clientX: bounds.left + 330,
        clientY: bounds.top + 220,
        bubbles: true,
      }),
    )
    viewport.dispatchEvent(
      new PointerEvent('pointerup', {
        pointerId: 1,
        pointerType: 'touch',
        clientX: bounds.left + 330,
        clientY: bounds.top + 220,
        bubbles: true,
      }),
    )

    expect(element.viewport.transform.offset.x).toBeCloseTo(initialOffset.x + 30)
    expect(element.viewport.transform.offset.y).toBeCloseTo(initialOffset.y + 20)
  })

  it('supports anchored two-finger touch panning and magnification', async () => {
    const element = await mount()
    const viewport = element.shadowRoot?.querySelector('.viewport') as HTMLElement
    vi.spyOn(viewport, 'setPointerCapture').mockImplementation(() => {})
    const bounds = viewport.getBoundingClientRect()
    const anchor = { x: 300, y: 200 }
    const worldAnchor = element.viewport.transform.removePoint(anchor)
    const onChange = vi.fn()
    element.addEventListener('fd-viewport-change', onChange)
    const dispatchTouch = (type: string, pointerId: number, x: number, y: number) => {
      viewport.dispatchEvent(
        new PointerEvent(type, {
          pointerId,
          pointerType: 'touch',
          button: 0,
          clientX: bounds.left + x,
          clientY: bounds.top + y,
          bubbles: true,
        }),
      )
    }

    dispatchTouch('pointerdown', 1, 200, 200)
    dispatchTouch('pointerdown', 2, 400, 200)
    dispatchTouch('pointermove', 1, 190, 220)
    dispatchTouch('pointermove', 2, 430, 220)

    expect(element.viewport.transform.zoom).toBeCloseTo(1.2)
    expect(element.viewport.transform.applyPoint(worldAnchor)).toEqual({ x: 310, y: 220 })
    expect(onChange.mock.calls.at(-1)?.[0].detail.phase).toBe('continuous')

    dispatchTouch('pointerup', 2, 430, 220)

    expect(onChange.mock.calls.at(-1)?.[0].detail.phase).toBe('ended')
  })

  it('can leave ordinary wheel events to a page scroller', async () => {
    const element = await mount()
    element.allowsPageScroll = true
    const viewport = element.shadowRoot?.querySelector('.viewport') as HTMLElement
    const initialTransform = element.viewport.transform
    const event = new WheelEvent('wheel', {
      clientX: 300,
      clientY: 200,
      deltaY: 40,
      bubbles: true,
      cancelable: true,
    })

    viewport.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(element.viewport.transform).toEqual(initialTransform)
  })

  it('accepts a consumer-defined viewport tab order', async () => {
    const element = await mount()
    element.viewportTabIndex = -1
    await element.updateComplete
    const viewport = element.shadowRoot?.querySelector('.viewport') as HTMLElement
    expect(viewport.tabIndex).toBe(-1)
  })

  it('reports bounded render coverage independently of world extent', async () => {
    const element = await mount()
    const onCoverage = vi.fn()
    element.addEventListener('fd-render-world-rect-change', onCoverage)

    element.setZoom(1.5)

    const detail = onCoverage.mock.calls.at(-1)?.[0].detail
    expect(detail.rect.width).toBeLessThan(1000)
    expect(detail.rect.height).toBeLessThan(1000)
  })

  it('handles each request identity once', async () => {
    const element = await mount()
    element.request = {
      id: 'focus-node',
      animated: false,
      action: { kind: 'focus', rect: { x: 80, y: 40, width: 40, height: 20 }, zoom: 2 },
    }
    await element.updateComplete
    const focused = element.viewport.transform

    element.request = {
      id: 'focus-node',
      animated: false,
      action: { kind: 'focus', rect: { x: 400, y: 400, width: 40, height: 20 }, zoom: 1 },
    }
    await element.updateComplete

    expect(element.viewport.transform).toEqual(focused)
  })

  it('handles the same request identity for new content', async () => {
    const element = await mount()
    element.contentID = 'first'
    element.request = {
      id: 'focus-node',
      animated: false,
      action: { kind: 'focus', rect: { x: 80, y: 40, width: 40, height: 20 }, zoom: 2 },
    }
    await element.updateComplete

    element.contentID = 'second'
    element.request = {
      id: 'focus-node',
      animated: false,
      action: { kind: 'focus', rect: { x: 400, y: 400, width: 40, height: 20 }, zoom: 1 },
    }
    await element.updateComplete

    expect(element.viewport.transform.zoom).toBe(1)
    expect(element.viewport.transform.applyPoint({ x: 420, y: 410 })).toEqual({ x: 300, y: 200 })
  })

  it('lets consumers override smart magnification', async () => {
    const element = await mount()
    const viewport = element.shadowRoot?.querySelector('.viewport') as HTMLElement
    const onSmartMagnify = vi.fn((event: Event) => event.preventDefault())
    element.addEventListener('fd-smart-magnify', onSmartMagnify)

    viewport.dispatchEvent(
      new MouseEvent('dblclick', {
        clientX: 300,
        clientY: 200,
        bubbles: true,
        cancelable: true,
      }),
    )

    expect(onSmartMagnify).toHaveBeenCalledOnce()
    expect(element.viewport.transform.zoom).toBe(1)
  })
})
