import { afterEach, describe, expect, it } from 'vitest'
import type { FdWrappingGrid } from './fd-wrapping-grid.js'
import './fd-wrapping-grid.js'

async function mount(markup: string): Promise<FdWrappingGrid> {
  const host = document.createElement('div')
  host.innerHTML = markup
  document.body.append(host)
  const element = host.firstElementChild as FdWrappingGrid
  await element.updateComplete
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-wrapping-grid', () => {
  it('matches Swift spacing without Preferences insets', async () => {
    const element = await mount('<fd-wrapping-grid><span>One</span></fd-wrapping-grid>')
    const grid = element.shadowRoot?.querySelector('.grid') as HTMLElement
    const style = getComputedStyle(grid)

    expect(style.gap).toBe('7px')
    expect(style.padding).toBe('0px')
    expect(style.alignItems).toBe('flex-start')
  })
})
