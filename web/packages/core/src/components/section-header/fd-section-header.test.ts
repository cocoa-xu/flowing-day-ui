import { afterEach, describe, expect, it } from 'vitest'
import type { FdSectionHeader } from './fd-section-header.js'
import './fd-section-header.js'

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-section-header', () => {
  it('matches the standalone Swift section header', async () => {
    const element = document.createElement('fd-section-header') as FdSectionHeader
    element.label = 'Startup'
    document.body.append(element)
    await element.updateComplete
    const style = getComputedStyle(element)

    expect(element.shadowRoot?.textContent?.trim()).toBe('Startup')
    expect(style.textTransform).toBe('uppercase')
    expect(style.letterSpacing).toBe('0.7px')
    expect(style.fontSize).toBe('10.5px')
    expect(style.fontWeight).toBe('600')
  })
})
