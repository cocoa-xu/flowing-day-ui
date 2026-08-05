import { describe, expect, it } from 'vitest'
import { FdSliderMath } from './slider-math.js'

describe('FdSliderMath.fraction', () => {
  it('maps a value onto its position in the range', () => {
    expect(FdSliderMath.fraction(0.5, 0, 1)).toBe(0.5)
    expect(FdSliderMath.fraction(75, 50, 100)).toBe(0.5)
    expect(FdSliderMath.fraction(-10, -20, 20)).toBe(0.25)
  })

  it('pins the ends', () => {
    expect(FdSliderMath.fraction(0, 0, 1)).toBe(0)
    expect(FdSliderMath.fraction(1, 0, 1)).toBe(1)
  })

  it('clamps a value from outside the range', () => {
    expect(FdSliderMath.fraction(-5, 0, 1)).toBe(0)
    expect(FdSliderMath.fraction(9, 0, 1)).toBe(1)
  })

  /** guard span > 0 else { return 0 } */
  it('returns 0 for a degenerate range rather than dividing by zero', () => {
    expect(FdSliderMath.fraction(5, 5, 5)).toBe(0)
    expect(FdSliderMath.fraction(5, 10, 0)).toBe(0)
  })
})

describe('FdSliderMath.value', () => {
  it('maps a fraction back onto the range', () => {
    expect(FdSliderMath.value(0.5, 0, 1)).toBe(0.5)
    expect(FdSliderMath.value(0.5, 50, 100)).toBe(75)
    expect(FdSliderMath.value(0.25, -20, 20)).toBe(-10)
  })

  it('clamps the fraction before applying it', () => {
    expect(FdSliderMath.value(-2, 0, 10)).toBe(0)
    expect(FdSliderMath.value(3, 0, 10)).toBe(10)
  })

  it('round-trips with fraction', () => {
    for (const value of [0, 12.5, 40, 99.9, 100]) {
      expect(FdSliderMath.value(FdSliderMath.fraction(value, 0, 100), 0, 100)).toBeCloseTo(
        value,
        10,
      )
    }
  })
})
