import { afterEach, describe, expect, it } from 'vitest'
import type { FdIconSelectionButton } from './fd-icon-selection-button.js'
import './fd-icon-selection-button.js'

async function mount(html: string): Promise<FdIconSelectionButton> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const element = host.firstElementChild as FdIconSelectionButton
  await element.updateComplete
  return element
}

const partOf = (element: FdIconSelectionButton, selector: string) =>
  element.shadowRoot?.querySelector(selector) as HTMLElement

const buttonOf = (element: FdIconSelectionButton) => partOf(element, '.button') as HTMLButtonElement

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-icon-selection-button', () => {
  it('keeps the SettingsIconSelectionButtonMetrics geometry', async () => {
    const element = await mount(
      '<fd-icon-selection-button label="Grid"></fd-icon-selection-button>',
    )
    const style = getComputedStyle(buttonOf(element))

    expect(style.height).toBe('31px')
    expect(style.paddingLeft).toBe('10px')
    expect(style.paddingRight).toBe('10px')
    expect(style.columnGap).toBe('9px')
    expect(style.borderRadius).toBe('9px')
  })

  it('reserves 14px for the leading glyph and 15px for the indicator', async () => {
    const element = await mount(
      '<fd-icon-selection-button label="Grid"></fd-icon-selection-button>',
    )

    expect(getComputedStyle(partOf(element, '.leading')).width).toBe('14px')
    expect(getComputedStyle(partOf(element, '.indicator')).width).toBe('15px')
    expect(getComputedStyle(partOf(element, '.indicator')).height).toBe('15px')
  })

  it('draws the title at 11px medium', async () => {
    const element = await mount(
      '<fd-icon-selection-button label="Grid"></fd-icon-selection-button>',
    )
    const style = getComputedStyle(partOf(element, '.title'))

    expect(style.fontSize).toBe('11px')
    expect(style.fontWeight).toBe('500')
  })

  it('stays unfilled and faint while unselected', async () => {
    const element = await mount(
      '<fd-icon-selection-button label="Grid"></fd-icon-selection-button>',
    )
    const style = getComputedStyle(buttonOf(element))

    expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(style.color).toBe('rgb(145, 145, 138)')
    expect(getComputedStyle(partOf(element, '.indicator') as HTMLElement).backgroundColor).toBe(
      'rgba(0, 0, 0, 0)',
    )
  })

  it('washes, inks and fills the disc once selected', async () => {
    const element = await mount(
      '<fd-icon-selection-button label="Grid" tint="#B4674D" selected></fd-icon-selection-button>',
    )
    const style = getComputedStyle(buttonOf(element))

    expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(style.color).toBe('rgb(29, 29, 27)')
    expect(getComputedStyle(partOf(element, '.indicator')).backgroundColor).toBe(
      'rgb(180, 103, 77)',
    )
  })

  it('shows the checkmark only when selected', async () => {
    const element = await mount(
      '<fd-icon-selection-button label="Grid"></fd-icon-selection-button>',
    )
    const mark = partOf(element, '.indicator svg')

    expect(getComputedStyle(mark).opacity).toBe('0')

    element.selected = true
    await element.updateComplete
    expect(getComputedStyle(partOf(element, '.indicator svg')).opacity).toBe('1')
  })

  /** foregroundStyle(tint.opacity(isSelected ? 1 : 0.3)) */
  it('dims the leading glyph while unselected', async () => {
    const element = await mount(
      '<fd-icon-selection-button label="Grid" tint="#B4674D"></fd-icon-selection-button>',
    )
    const dimmed = getComputedStyle(partOf(element, '.leading')).color

    element.selected = true
    await element.updateComplete
    expect(getComputedStyle(partOf(element, '.leading')).color).toBe('rgb(180, 103, 77)')
    expect(dimmed).not.toBe('rgb(180, 103, 77)')
  })

  it('takes its tint per instance rather than from the accent', async () => {
    const element = await mount(
      '<fd-icon-selection-button label="Grid" tint="#4F9B95" selected></fd-icon-selection-button>',
    )
    expect(getComputedStyle(partOf(element, '.indicator')).backgroundColor).toBe(
      'rgb(79, 155, 149)',
    )
  })

  it('toggles and reports the new state', async () => {
    const element = await mount(
      '<fd-icon-selection-button label="Grid"></fd-icon-selection-button>',
    )
    const states: boolean[] = []
    element.addEventListener('fd-change', (event) => {
      states.push(event.detail.checked as boolean)
    })

    buttonOf(element).click()
    await element.updateComplete
    expect(element.selected).toBe(true)

    buttonOf(element).click()
    await element.updateComplete
    expect(states).toEqual([true, false])
  })

  /** help ?? (isSelected ? "Hide \(title)" : "Show \(title)") */
  it('phrases its own tooltip, and yields to an explicit one', async () => {
    const element = await mount(
      '<fd-icon-selection-button label="Grid"></fd-icon-selection-button>',
    )
    expect(buttonOf(element).title).toBe('Show Grid')

    element.selected = true
    await element.updateComplete
    expect(buttonOf(element).title).toBe('Hide Grid')

    element.help = 'Toggle the grid overlay'
    await element.updateComplete
    expect(buttonOf(element).title).toBe('Toggle the grid overlay')
  })

  it('never raises the tooltip from the host', async () => {
    const element = await mount(
      '<fd-icon-selection-button label="Grid"></fd-icon-selection-button>',
    )
    expect(element.hasAttribute('title')).toBe(false)
  })

  it('exposes its state to assistive technology', async () => {
    const element = await mount(
      '<fd-icon-selection-button label="Grid"></fd-icon-selection-button>',
    )
    expect(buttonOf(element).getAttribute('aria-pressed')).toBe('false')

    element.selected = true
    await element.updateComplete
    expect(buttonOf(element).getAttribute('aria-pressed')).toBe('true')
  })

  it('stays put while disabled', async () => {
    const element = await mount(
      '<fd-icon-selection-button label="Grid" disabled></fd-icon-selection-button>',
    )
    buttonOf(element).click()
    await element.updateComplete

    expect(element.selected).toBe(false)
  })

  it('takes a leading glyph from the slot over the symbol', async () => {
    const element = await mount(
      '<fd-icon-selection-button label="Grid" symbol="circle"><span slot="leading">*</span></fd-icon-selection-button>',
    )
    expect(element.querySelector('[slot="leading"]')).not.toBeNull()
    expect(element.shadowRoot?.querySelector('slot[name="leading"]')).not.toBeNull()
  })
})
