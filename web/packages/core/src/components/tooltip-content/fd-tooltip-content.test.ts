import { afterEach, describe, expect, it } from 'vitest'
import type { FdTooltipContent } from './fd-tooltip-content.js'
import './fd-tooltip-content.js'

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-tooltip-content', () => {
  it('matches the Swift title, symbol, message, and geometry', async () => {
    const element = document.createElement('fd-tooltip-content') as FdTooltipContent
    element.title = 'Details'
    element.symbol = 'info'
    element.message = 'Additional context'
    document.body.append(element)
    await element.updateComplete
    const style = getComputedStyle(element)

    expect(element.shadowRoot?.querySelector('.title')?.textContent).toBe('Details')
    expect(element.shadowRoot?.querySelector('.message')?.textContent?.trim()).toBe(
      'Additional context',
    )
    expect(element.shadowRoot?.querySelector('fd-icon')).not.toBeNull()
    expect(style.maxWidth).toBe('260px')
    expect(style.padding).toBe('8px 10px')
  })
})
