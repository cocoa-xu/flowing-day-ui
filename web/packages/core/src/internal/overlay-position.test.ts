import { describe, expect, it } from 'vitest'
import { positionOverlay } from './overlay-position.js'

const rect = (x: number, y: number, width: number, height: number): DOMRectReadOnly =>
  new DOMRect(x, y, width, height)

describe('overlay positioning', () => {
  it('uses the preferred edge when it fits', () => {
    expect(
      positionOverlay(
        rect(100, 100, 40, 30),
        rect(0, 0, 80, 50),
        { width: 400, height: 300 },
        'top',
        8,
        10,
        false,
      ),
    ).toEqual({ left: 80, top: 42 })
  })

  it('flips away from a constrained edge', () => {
    expect(
      positionOverlay(
        rect(100, 12, 40, 30),
        rect(0, 0, 80, 50),
        { width: 400, height: 300 },
        'top',
        8,
        10,
        false,
      ),
    ).toEqual({ left: 80, top: 50 })
  })

  it('resolves leading and trailing from writing direction', () => {
    const anchor = rect(100, 100, 40, 30)
    const overlay = rect(0, 0, 50, 40)
    const viewport = { width: 400, height: 300 }

    expect(positionOverlay(anchor, overlay, viewport, 'leading', 8, 10, false).left).toBe(42)
    expect(positionOverlay(anchor, overlay, viewport, 'leading', 8, 10, true).left).toBe(148)
  })

  it('clamps oversized positions to the viewport margin', () => {
    expect(
      positionOverlay(
        rect(2, 2, 10, 10),
        rect(0, 0, 390, 290),
        { width: 400, height: 300 },
        'top',
        8,
        10,
        false,
      ),
    ).toEqual({ left: 10, top: 10 })
  })
})
