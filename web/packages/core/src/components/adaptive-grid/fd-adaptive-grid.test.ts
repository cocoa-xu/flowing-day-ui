import { afterEach, describe, expect, it } from 'vitest'
import type { FdAdaptiveGrid } from './fd-adaptive-grid.js'
import './fd-adaptive-grid.js'

async function mount(markup: string): Promise<FdAdaptiveGrid> {
  const host = document.createElement('div')
  host.innerHTML = markup
  document.body.append(host)
  const element = host.firstElementChild as FdAdaptiveGrid
  await element.updateComplete
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-adaptive-grid', () => {
  it('matches Swift minimum width and spacing defaults without Preferences insets', async () => {
    const element = await mount('<fd-adaptive-grid><span>One</span></fd-adaptive-grid>')
    const grid = element.shadowRoot?.querySelector('.grid') as HTMLElement
    const style = getComputedStyle(grid)

    expect(style.columnGap).toBe('7px')
    expect(style.padding).toBe('0px')
    expect(element.minimumWidth).toBe(96)
  })
})
