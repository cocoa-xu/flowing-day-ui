import { afterEach, describe, expect, it } from 'vitest'
import type { FdEmptyState } from '../empty-state/fd-empty-state.js'
import type { FdEmptyRow } from './fd-empty-row.js'
import './fd-empty-row.js'

async function mount(html: string): Promise<FdEmptyRow> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const element = host.firstElementChild as FdEmptyRow
  await element.updateComplete
  return element
}

const boxOf = (element: FdEmptyRow) => element.shadowRoot?.querySelector('.empty') as HTMLElement

const stateOf = (element: FdEmptyRow) =>
  (boxOf(element) as FdEmptyState).shadowRoot?.querySelector('.state') as HTMLElement

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-empty-row', () => {
  it('pads by 14px vertically rather than the 10 a populated row takes', async () => {
    const element = await mount('<fd-empty-row message="No devices found."></fd-empty-row>')
    const style = getComputedStyle(boxOf(element))

    expect(style.paddingTop).toBe('14px')
    expect(style.paddingBottom).toBe('14px')
    expect(style.paddingLeft).toBe('18px')
    expect(style.paddingRight).toBe('18px')
  })

  it('draws the message faint, in the value text role', async () => {
    const element = await mount('<fd-empty-row message="No devices found."></fd-empty-row>')
    const style = getComputedStyle(boxOf(element))

    expect(style.fontSize).toBe('12.5px')
    expect(style.color).toBe('rgb(145, 145, 138)')
  })

  it('aligns a symbol on the first text baseline, 10px away', async () => {
    const element = await mount(
      '<fd-empty-row message="Nothing here" symbol="tray"></fd-empty-row>',
    )
    const style = getComputedStyle(stateOf(element))

    expect(style.alignItems).toBe('baseline')
    expect(style.columnGap).toBe('10px')
    expect((boxOf(element) as FdEmptyState).shadowRoot?.querySelector('fd-icon')).not.toBeNull()
  })

  it('omits the symbol entirely when none is given', async () => {
    const element = await mount('<fd-empty-row message="Nothing here"></fd-empty-row>')
    expect((boxOf(element) as FdEmptyState).shadowRoot?.querySelector('fd-icon')).toBeNull()
  })

  it('leads the row rather than centring it', async () => {
    const element = await mount('<fd-empty-row message="No devices found."></fd-empty-row>')
    const box = boxOf(element).getBoundingClientRect()
    const host = element.getBoundingClientRect()

    expect(Math.round(box.width)).toBe(Math.round(host.width))
    expect(getComputedStyle(stateOf(element)).justifyContent).toBe('flex-start')
  })

  it('falls back to its text content', async () => {
    const element = await mount('<fd-empty-row>Nothing to see.</fd-empty-row>')
    expect(element.textContent?.trim()).toBe('Nothing to see.')
    expect((boxOf(element) as FdEmptyState).message).toBe('Nothing to see.')
  })
})
