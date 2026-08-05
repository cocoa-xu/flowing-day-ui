import { afterEach, describe, expect, it } from 'vitest'
import type { FdRow } from './fd-row.js'
import './fd-row.js'

async function mount(html: string): Promise<FdRow> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const element = host.firstElementChild as FdRow
  await element.updateComplete
  return element
}

const rowOf = (element: FdRow) => element.shadowRoot?.querySelector('.row') as HTMLElement

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-row', () => {
  it('renders the label and omits the caption when unset', async () => {
    const element = await mount('<fd-row label="Launch at login"></fd-row>')
    const shadow = element.shadowRoot as ShadowRoot

    expect(shadow.querySelector('.label')?.textContent).toBe('Launch at login')
    expect(shadow.querySelector('.caption')).toBeNull()
  })

  it('renders the caption when set', async () => {
    const element = await mount('<fd-row label="Network" caption="Choose content."></fd-row>')
    expect(element.shadowRoot?.querySelector('.caption')?.textContent).toBe('Choose content.')
  })

  it('omits the symbol gutter entirely when no symbol is given', async () => {
    const element = await mount('<fd-row label="Plain"></fd-row>')
    expect(element.shadowRoot?.querySelector('fd-icon')).toBeNull()
  })

  it('renders a symbol gutter at the SwiftUI width', async () => {
    const element = await mount('<fd-row symbol="gearshape" label="General"></fd-row>')
    const symbol = element.shadowRoot?.querySelector('.symbol') as HTMLElement

    expect(symbol).not.toBeNull()
    expect(getComputedStyle(symbol).width).toBe('20px')
    expect(getComputedStyle(symbol).fontSize).toBe('13px')
  })

  it('uses 10px vertical padding without a caption', async () => {
    const row = rowOf(await mount('<fd-row label="Plain"></fd-row>'))
    const style = getComputedStyle(row)

    expect(style.paddingTop).toBe('10px')
    expect(style.paddingBottom).toBe('10px')
  })

  it('grows to 11px vertical padding once a caption is present', async () => {
    const row = rowOf(await mount('<fd-row label="Plain" caption="More"></fd-row>'))
    const style = getComputedStyle(row)

    expect(style.paddingTop).toBe('11px')
    expect(style.paddingBottom).toBe('11px')
  })

  it('insets horizontally by the row inset metric and honours an override', async () => {
    const element = await mount('<fd-row label="Plain"></fd-row>')
    expect(getComputedStyle(rowOf(element)).paddingLeft).toBe('18px')

    element.style.setProperty('--fd-metric-row-inset', '24px')
    expect(getComputedStyle(rowOf(element)).paddingLeft).toBe('24px')
  })

  it('reserves the 42px minimum row height', async () => {
    const element = await mount('<fd-row label="Plain"></fd-row>')
    expect(getComputedStyle(rowOf(element)).minHeight).toBe('42px')
    expect(element.getBoundingClientRect().height).toBeGreaterThanOrEqual(42)
  })

  it('keeps the trailing control at the trailing edge', async () => {
    const element = await mount(
      '<fd-row label="Plain"><span slot="trailing" style="width:40px">x</span></fd-row>',
    )
    const trailing = element.querySelector('[slot="trailing"]') as HTMLElement
    const row = element.getBoundingClientRect()

    expect(Math.round(row.right - trailing.getBoundingClientRect().right)).toBe(18)
  })
})
