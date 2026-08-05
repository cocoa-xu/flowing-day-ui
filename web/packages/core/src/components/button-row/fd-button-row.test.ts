import { afterEach, describe, expect, it } from 'vitest'
import type { FdRow } from '../row/fd-row.js'
import type { FdButtonRow } from './fd-button-row.js'
import './fd-button-row.js'

async function mount(html: string): Promise<FdButtonRow> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const element = host.firstElementChild as FdButtonRow
  await element.updateComplete
  return element
}

const buttonOf = (element: FdButtonRow) =>
  element.shadowRoot?.querySelector('.soft-button') as HTMLButtonElement

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-button-row', () => {
  it('renders the row text and the button label', async () => {
    const element = await mount(
      '<fd-button-row label="Cache" caption="Frees disk space." button-label="Clear"></fd-button-row>',
    )
    const row = element.shadowRoot?.querySelector('fd-row') as FdRow

    expect(row.label).toBe('Cache')
    expect(row.caption).toBe('Frees disk space.')
    expect(buttonOf(element).textContent?.trim()).toBe('Clear')
  })

  it('uses the 12/5 padding and control radius of SettingsSoftButtonStyle', async () => {
    const element = await mount(
      '<fd-button-row label="Cache" button-label="Clear"></fd-button-row>',
    )
    const style = getComputedStyle(buttonOf(element))

    expect(style.paddingLeft).toBe('12px')
    expect(style.paddingRight).toBe('12px')
    expect(style.paddingTop).toBe('5px')
    expect(style.paddingBottom).toBe('5px')
    expect(style.borderRadius).toBe('9px')
  })

  it('fills with the solid accent and a white label when prominent', async () => {
    const element = await mount(
      '<fd-button-row label="Cache" button-label="Clear" prominent></fd-button-row>',
    )
    const style = getComputedStyle(buttonOf(element))

    expect(style.color).toBe('rgb(255, 255, 255)')
    expect(style.boxShadow).toBe('none')
    expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  it('draws the hairline inside the shape when not prominent', async () => {
    const element = await mount(
      '<fd-button-row label="Cache" button-label="Clear"></fd-button-row>',
    )
    expect(getComputedStyle(buttonOf(element)).boxShadow).toContain('inset')
  })

  it('fires fd-activate when the button is pressed', async () => {
    const element = await mount(
      '<fd-button-row label="Cache" button-label="Clear"></fd-button-row>',
    )
    let fired = 0
    element.addEventListener('fd-activate', () => {
      fired += 1
    })

    buttonOf(element).click()
    expect(fired).toBe(1)
  })

  it('does not fire fd-activate for a click on the row text', async () => {
    const element = await mount(
      '<fd-button-row label="Cache" button-label="Clear"></fd-button-row>',
    )
    const row = element.shadowRoot?.querySelector('fd-row') as FdRow
    await row.updateComplete
    const label = (row.shadowRoot as ShadowRoot).querySelector('.label') as HTMLElement
    let fired = 0
    element.addEventListener('fd-activate', () => {
      fired += 1
    })

    label.click()
    expect(fired).toBe(0)
  })

  it('crosses the shadow boundary so an ancestor can listen', async () => {
    const element = await mount(
      '<fd-button-row label="Cache" button-label="Clear"></fd-button-row>',
    )
    let fired = 0
    document.body.addEventListener('fd-activate', () => {
      fired += 1
    })

    buttonOf(element).click()
    expect(fired).toBe(1)
  })

  it('stays silent while disabled', async () => {
    const element = await mount(
      '<fd-button-row label="Cache" button-label="Clear" disabled></fd-button-row>',
    )
    let fired = 0
    element.addEventListener('fd-activate', () => {
      fired += 1
    })

    buttonOf(element).click()
    expect(fired).toBe(0)
    expect(buttonOf(element).disabled).toBe(true)
  })
})
