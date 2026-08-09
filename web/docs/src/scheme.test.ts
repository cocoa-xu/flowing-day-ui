import { describe, expect, it } from 'vitest'
import { resolveScheme } from './scheme.js'

describe('resolveScheme', () => {
  it('preserves an explicit appearance', () => {
    expect(resolveScheme('light', true)).toBe('light')
    expect(resolveScheme('dark', false)).toBe('dark')
  })

  it('resolves system appearance from the media query', () => {
    expect(resolveScheme('system', false)).toBe('light')
    expect(resolveScheme('system', true)).toBe('dark')
  })
})
