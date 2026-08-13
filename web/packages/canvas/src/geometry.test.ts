import { describe, expect, it } from 'vitest'
import {
  canvasRectsIntersect,
  FdCanvasGridLevels,
  FdCanvasRenderSurface,
  FdCanvasTransform,
  unionCanvasRects,
} from './geometry.js'

describe('FdCanvasTransform', () => {
  it('round trips world geometry', () => {
    const transform = new FdCanvasTransform(2.4, { x: -8000, y: 370 })
    const point = { x: 12_345, y: 678 }
    const rect = { x: 11_900, y: 520, width: 1200, height: 840 }

    expect(transform.removePoint(transform.applyPoint(point)).x).toBeCloseTo(point.x)
    expect(transform.removePoint(transform.applyPoint(point)).y).toBeCloseTo(point.y)
    expect(transform.removeRect(transform.applyRect(rect))).toEqual(rect)
  })

  it('anchors a world point at a viewport point', () => {
    const transform = FdCanvasTransform.anchoring({ x: 640, y: 280 }, { x: 710, y: 360 }, 1.35)
    expect(transform.applyPoint({ x: 640, y: 280 }).x).toBeCloseTo(710)
    expect(transform.applyPoint({ x: 640, y: 280 }).y).toBeCloseTo(360)
  })

  it('fits a world rect inside padded viewport bounds', () => {
    const world = { x: 400, y: 120, width: 440, height: 420 }
    const viewport = { x: 280, y: 20, width: 880, height: 700 }
    const transform = FdCanvasTransform.fitting(world, viewport, 50, [0.4, 1.6])
    const displayed = transform.applyRect(world)

    expect(displayed.x).toBeGreaterThanOrEqual(viewport.x + 50)
    expect(displayed.x + displayed.width).toBeLessThanOrEqual(viewport.x + viewport.width - 50)
    expect(displayed.y).toBeGreaterThanOrEqual(viewport.y + 50)
    expect(displayed.y + displayed.height).toBeLessThanOrEqual(viewport.y + viewport.height - 50)
  })
})

it('builds a bounded render surface around coverage', () => {
  const coverage = { x: 8_000_000, y: 4000, width: 1840, height: 1400 }
  const transform = new FdCanvasTransform(0.5, { x: -3_999_200, y: -1900 })
  const surface = new FdCanvasRenderSurface(coverage, transform)

  expect(surface.displayedSize).toEqual({ width: 920, height: 700 })
  expect(surface.viewportOffset).toEqual({ x: 800, y: 100 })
  expect(surface.localTransform.applyPoint(coverage)).toEqual({ x: 0, y: 0 })
})

it('keeps adaptive grid levels within visual spacing bounds', () => {
  const levels = new FdCanvasGridLevels(12, 3, 12, 2)
  expect(levels.fine).toEqual({ spacing: 18, opacity: 0.5 })
  expect(levels.coarse).toEqual({ spacing: 36, opacity: 0.5 })
})

it('keeps adaptive grid transitions continuous across scale boundaries', () => {
  const before = new FdCanvasGridLevels(24, 0.999, 12, 2)
  const after = new FdCanvasGridLevels(24, 1.001, 12, 2)

  expect(before.fine.spacing).toBeCloseTo(23.976)
  expect(before.fine.opacity).toBeCloseTo(0.998)
  expect(after.coarse.spacing).toBeCloseTo(24.024)
  expect(after.coarse.opacity).toBeCloseTo(0.998)
})

describe('canvas rectangle utilities', () => {
  it('detects intersecting and disjoint rectangles', () => {
    expect(
      canvasRectsIntersect(
        { x: 0, y: 0, width: 40, height: 40 },
        { x: 30, y: 30, width: 40, height: 40 },
      ),
    ).toBe(true)
    expect(
      canvasRectsIntersect(
        { x: 0, y: 0, width: 40, height: 40 },
        { x: 41, y: 0, width: 40, height: 40 },
      ),
    ).toBe(false)
  })

  it('unions rectangles without losing negative origins', () => {
    expect(
      unionCanvasRects(
        { x: -20, y: 10, width: 30, height: 20 },
        { x: 5, y: -10, width: 20, height: 60 },
      ),
    ).toEqual({ x: -20, y: -10, width: 45, height: 60 })
  })
})
