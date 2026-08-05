import { afterEach, describe, expect, it } from 'vitest'
import type { FdFlowGrid } from './fd-flow-grid.js'
import './fd-flow-grid.js'

async function mount(html: string): Promise<FdFlowGrid> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const element = host.firstElementChild as FdFlowGrid
  await element.updateComplete
  return element
}

const gridOf = (element: FdFlowGrid) => element.shadowRoot?.querySelector('.grid') as HTMLElement

const rectAt = (element: FdFlowGrid, index: number) =>
  (element.children[index] as HTMLElement).getBoundingClientRect()

const items = (count: number, width = 100) =>
  Array.from(
    { length: count },
    (_, index) => `<span style="display:block;width:${width}px;height:20px">${index}</span>`,
  ).join('')

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-flow-grid', () => {
  it('spaces both axes by 7 and pads 18/13', async () => {
    const element = await mount('<fd-flow-grid></fd-flow-grid>')
    const style = getComputedStyle(gridOf(element))

    expect(style.columnGap).toBe('7px')
    expect(style.rowGap).toBe('7px')
    expect(style.paddingLeft).toBe('18px')
    expect(style.paddingRight).toBe('18px')
    expect(style.paddingTop).toBe('13px')
    expect(style.paddingBottom).toBe('13px')
  })

  it('honours a custom spacing on both axes', async () => {
    const element = await mount('<fd-flow-grid spacing="12"></fd-flow-grid>')
    const style = getComputedStyle(gridOf(element))

    expect(style.columnGap).toBe('12px')
    expect(style.rowGap).toBe('12px')
  })

  it('wraps once the next item no longer fits', async () => {
    const element = await mount(`<fd-flow-grid>${items(3)}</fd-flow-grid>`)
    element.style.width = '286px'
    await element.updateComplete

    // 18 + 100 + 7 + 100 + 18 = 243 fits two; a third needs 350.
    expect(rectAt(element, 1).top).toBe(rectAt(element, 0).top)
    expect(rectAt(element, 2).top).toBeGreaterThan(rectAt(element, 0).top)
    expect(rectAt(element, 2).left).toBe(rectAt(element, 0).left)
  })

  it('stacks wrapped rows exactly one spacing apart', async () => {
    const element = await mount(`<fd-flow-grid>${items(3)}</fd-flow-grid>`)
    element.style.width = '286px'
    await element.updateComplete

    expect(Math.round(rectAt(element, 2).top - rectAt(element, 0).bottom)).toBe(7)
  })

  it('leads the row rather than centring or stretching it', async () => {
    const element = await mount(`<fd-flow-grid>${items(1)}</fd-flow-grid>`)
    element.style.width = '400px'
    await element.updateComplete

    const grid = gridOf(element).getBoundingClientRect()
    const item = (element.firstElementChild as HTMLElement).getBoundingClientRect()

    expect(Math.round(item.left - grid.left)).toBe(18)
    expect(Math.round(item.width)).toBe(100)
    expect(getComputedStyle(gridOf(element)).alignItems).toBe('flex-start')
  })
})
