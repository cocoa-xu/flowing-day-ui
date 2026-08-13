import { afterEach, describe, expect, it } from 'vitest'
import type { FdCard } from './fd-card.js'
import './fd-card.js'

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-card', () => {
  it('supports the Swift alignment, spacing, and content inset inputs', async () => {
    const element = document.createElement('fd-card') as FdCard
    element.alignment = 'center'
    element.spacing = 9
    element.contentInsets = { top: 4, leading: 6, bottom: 8, trailing: 10 }
    document.body.append(element)
    await element.updateComplete
    const style = getComputedStyle(element)

    expect(style.alignItems).toBe('center')
    expect(style.gap).toBe('9px')
    expect([style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]).toEqual([
      '4px',
      '10px',
      '8px',
      '6px',
    ])
  })
})
