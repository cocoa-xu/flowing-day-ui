import { describe, expect, it, vi } from 'vitest'
import { FdCanvasTransform, FdCanvasViewport } from './geometry.js'
import { FdCanvasProxy, FdCanvasRenderContext } from './rendering-context.js'

const transform = new FdCanvasTransform(2, { x: 40, y: 20 })
const viewport = new FdCanvasViewport(
  transform,
  { width: 800, height: 600 },
  { x: 0, y: 0, width: 800, height: 600 },
)
const renderContext = new FdCanvasRenderContext(viewport, {
  x: 20,
  y: 10,
  width: 400,
  height: 300,
})

describe('canvas render context', () => {
  it('uses the viewport transform for world, viewport, and surface geometry', () => {
    expect(renderContext.zoom).toBe(2)
    expect(renderContext.viewportPoint({ x: 20, y: 10 })).toEqual({ x: 80, y: 40 })
    expect(renderContext.worldPoint({ x: 80, y: 40 })).toEqual({ x: 20, y: 10 })
    expect(renderContext.renderSurface()).toMatchObject({
      displayedSize: { width: 800, height: 600 },
      viewportOffset: { x: 80, y: 40 },
    })
  })

  it('forwards proxy operations with Swift-aligned defaults', () => {
    const setZoom = vi.fn()
    const anchor = vi.fn()
    const focus = vi.fn()
    const fit = vi.fn()
    const proxy = new FdCanvasProxy({ context: renderContext, setZoom, anchor, focus, fit })

    proxy.setZoom(1.5)
    proxy.anchor({ worldPoint: { x: 20, y: 10 }, viewportPoint: { x: 80, y: 40 } })
    proxy.focus({ x: 0, y: 0, width: 100, height: 80 })
    proxy.fit({ x: 0, y: 0, width: 300, height: 200 }, 48, 2, true)

    expect(setZoom).toHaveBeenCalledWith(1.5, 'ended', false)
    expect(anchor).toHaveBeenCalledWith({ x: 20, y: 10 }, { x: 80, y: 40 }, 2, 'ended', false)
    expect(focus).toHaveBeenCalledWith({ x: 0, y: 0, width: 100, height: 80 }, undefined, false)
    expect(fit).toHaveBeenCalledWith({ x: 0, y: 0, width: 300, height: 200 }, 48, 2, true)
  })
})
