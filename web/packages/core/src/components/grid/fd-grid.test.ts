import { afterEach, describe, expect, it } from 'vitest'
import type { FdGrid } from './fd-grid.js'
import './fd-grid.js'

async function mount(html: string): Promise<FdGrid> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const element = host.firstElementChild as FdGrid
  await element.updateComplete
  return element
}

const gridOf = (element: FdGrid) => element.shadowRoot?.querySelector('.grid') as HTMLElement

const columnsOf = (element: FdGrid) =>
  getComputedStyle(gridOf(element)).gridTemplateColumns.split(/\s+/).filter(Boolean)

const items = (count: number) =>
  Array.from({ length: count }, (_, index) => `<span>${index}</span>`).join('')

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-grid', () => {
  it('spaces by 7 and pads 18/13', async () => {
    const element = await mount('<fd-grid></fd-grid>')
    const style = getComputedStyle(gridOf(element))

    expect(style.columnGap).toBe('7px')
    expect(style.rowGap).toBe('7px')
    expect(style.paddingLeft).toBe('18px')
    expect(style.paddingTop).toBe('13px')
  })

  /** 3 × 96 + 2 × 7 = 302 fits in 364; a fourth column would need 405. */
  it('fits as many 96px columns as the width allows', async () => {
    const element = await mount(`<fd-grid>${items(6)}</fd-grid>`)
    element.style.width = '400px'
    await element.updateComplete

    expect(columnsOf(element)).toHaveLength(3)
  })

  it('adds a column as the grid widens', async () => {
    const element = await mount(`<fd-grid>${items(6)}</fd-grid>`)
    element.style.width = '540px'
    await element.updateComplete

    expect(columnsOf(element)).toHaveLength(4)
  })

  it('shares the row equally between the columns it fits', async () => {
    const element = await mount(`<fd-grid>${items(6)}</fd-grid>`)
    element.style.width = '400px'
    await element.updateComplete

    const widths = columnsOf(element).map(Number.parseFloat)
    const first = widths[0] as number
    expect(widths.every((width) => Math.abs(width - first) < 0.5)).toBe(true)
    expect(widths.reduce((sum, width) => sum + width, 0) + 2 * 7).toBeCloseTo(364, 0)
  })

  it('honours a custom minimum width', async () => {
    const element = await mount(`<fd-grid minimum-width="160">${items(6)}</fd-grid>`)
    element.style.width = '400px'
    await element.updateComplete

    expect(columnsOf(element)).toHaveLength(2)
  })

  it('falls back to a single fitting column when narrower than the minimum', async () => {
    const element = await mount(`<fd-grid>${items(3)}</fd-grid>`)
    element.style.width = '90px'
    await element.updateComplete

    const columns = columnsOf(element)
    expect(columns).toHaveLength(1)
    expect(Number.parseFloat(columns[0] as string)).toBeLessThanOrEqual(90 - 36)
  })
})
