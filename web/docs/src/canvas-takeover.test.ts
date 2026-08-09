import { describe, expect, it } from 'vitest'
import { canvasObserverThresholds, shouldActivateCanvas } from './canvas-takeover.js'

describe('shouldActivateCanvas', () => {
  it('activates once the canvas nearly fills the viewport', () => {
    expect(shouldActivateCanvas(true, 900, 1_000)).toBe(true)
    expect(shouldActivateCanvas(true, 899, 1_000)).toBe(false)
  })

  it('does not depend on the canvas being the same height as the viewport', () => {
    const canvasHeight = 2_000
    const intersectionHeight = 900
    expect(intersectionHeight / canvasHeight).toBe(0.45)
    expect(shouldActivateCanvas(true, intersectionHeight, 1_000)).toBe(true)
  })

  it('rejects missing viewport coverage', () => {
    expect(shouldActivateCanvas(false, 1_000, 1_000)).toBe(false)
    expect(shouldActivateCanvas(true, 1_000, 0)).toBe(false)
  })

  it('observes enough thresholds for a smooth viewport takeover', () => {
    expect(canvasObserverThresholds).toHaveLength(101)
    expect(canvasObserverThresholds[0]).toBe(0)
    expect(canvasObserverThresholds.at(-1)).toBe(1)
  })
})
