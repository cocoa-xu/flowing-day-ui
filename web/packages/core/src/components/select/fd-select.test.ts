import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdSelect } from './fd-select.js'
import './fd-select.js'

async function mount(markup: string): Promise<FdSelect> {
  const host = document.createElement('div')
  host.innerHTML = markup
  document.body.append(host)
  const element = host.querySelector('fd-select') as FdSelect
  await element.updateComplete
  // One more frame for the slotchange that resolves fd-option children.
  await element.updateComplete
  return element
}

const OPTIONS = `
  <fd-option value="hide">Hide Afloat</fd-option>
  <fd-option value="quit">Quit Afloat</fd-option>
  <fd-option value="ask">Ask every time</fd-option>
`

const button = (element: FdSelect) =>
  element.shadowRoot?.querySelector('.button') as HTMLButtonElement
const menu = (element: FdSelect) => element.shadowRoot?.querySelector('.menu') as HTMLElement
const optionRows = (element: FdSelect) =>
  [...(element.shadowRoot?.querySelectorAll('.option') ?? [])] as HTMLElement[]

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-select chrome', () => {
  /** An inline SVG rides its line box's baseline and sits low in a 9px chevron slot. */
  it('centres the chevron glyph in the control', async () => {
    const element = await mount(`<fd-select value="quit">${OPTIONS}</fd-select>`)
    const glyph = element.shadowRoot?.querySelector('.chevron svg') as SVGElement

    const middle = (rect: DOMRect) => rect.y + rect.height / 2
    expect(getComputedStyle(glyph).display).toBe('block')
    expect(middle(glyph.getBoundingClientRect())).toBeCloseTo(
      middle(button(element).getBoundingClientRect()),
      1,
    )
  })
})

describe('fd-select options', () => {
  it('resolves options from fd-option children', async () => {
    const element = await mount(`<fd-select value="quit">${OPTIONS}</fd-select>`)

    expect(element.resolvedOptions).toEqual([
      { value: 'hide', label: 'Hide Afloat' },
      { value: 'quit', label: 'Quit Afloat' },
      { value: 'ask', label: 'Ask every time' },
    ])
    expect(element.selectedIndex).toBe(1)
  })

  it('prefers the options property over slotted children', async () => {
    const element = await mount(`<fd-select>${OPTIONS}</fd-select>`)
    element.options = [{ value: 'a', label: 'Alpha' }]
    await element.updateComplete

    expect(element.resolvedOptions).toEqual([{ value: 'a', label: 'Alpha' }])
  })

  it('uses an option accent without changing undecorated options', async () => {
    const element = await mount(`
      <fd-select value="petal">
        <fd-option value="petal" accent="#D67084">Petal</fd-option>
        <fd-option value="all">All Colors…</fd-option>
      </fd-select>
    `)

    expect(element.resolvedOptions).toEqual([
      { value: 'petal', label: 'Petal', accent: '#D67084' },
      { value: 'all', label: 'All Colors…' },
    ])

    button(element).click()
    await element.updateComplete
    const rows = optionRows(element)
    expect(rows[0]?.hasAttribute('data-accent')).toBe(true)
    expect(rows[0]?.style.getPropertyValue('--_option-accent')).toBe('#D67084')
    expect(rows[0]?.querySelector('.swatch')).not.toBeNull()
    expect(rows[1]?.hasAttribute('data-accent')).toBe(false)
    expect(rows[1]?.querySelector('.swatch')).toBeNull()
  })

  it('shows the label of the selected option', async () => {
    const element = await mount(`<fd-select value="ask">${OPTIONS}</fd-select>`)
    expect(element.shadowRoot?.querySelector('.value')?.textContent).toBe('Ask every time')
  })

  it('falls back to an em dash when nothing matches, as PreferencesPopupButton.draw does', async () => {
    const element = await mount(`<fd-select value="nope">${OPTIONS}</fd-select>`)
    expect(element.shadowRoot?.querySelector('.value')?.textContent).toBe('—')
  })
})

describe('fd-select metrics', () => {
  it('uses the 30px control height', async () => {
    const element = await mount(`<fd-select value="hide">${OPTIONS}</fd-select>`)
    expect(button(element).getBoundingClientRect().height).toBe(30)
  })

  /** intrinsicContentSize measures every label so the control does not resize on selection. */
  it('sizes to the widest label plus 40, not the selected one', async () => {
    const element = await mount(`<fd-select value="hide">${OPTIONS}</fd-select>`)
    const wide = button(element).getBoundingClientRect().width

    element.value = 'ask'
    await element.updateComplete
    expect(button(element).getBoundingClientRect().width).toBe(wide)
  })

  it('never goes below the requested minimum width', async () => {
    const element = await mount(
      `<fd-select minimum-width="240" value="hide">${OPTIONS}</fd-select>`,
    )
    expect(button(element).getBoundingClientRect().width).toBe(240)
  })

  /**
   * A popup on an inactive `fd-page` first renders inside `display: none`, where text
   * measures zero. Sizing it from that measurement collapsed the control to 40px and
   * clipped the value for good, since nothing measured it again.
   */
  it('sizes itself once an unrendered subtree is laid out', async () => {
    const host = document.createElement('div')
    host.style.display = 'none'
    host.innerHTML = `<fd-select value="hide">${OPTIONS}</fd-select>`
    document.body.append(host)

    const element = host.querySelector('fd-select') as FdSelect
    await element.updateComplete
    await element.updateComplete
    expect(element.style.getPropertyValue('--_button-width')).toBe('')

    host.style.display = 'block'
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    await element.updateComplete

    expect(button(element).getBoundingClientRect().width).toBeGreaterThan(60)
    expect(element.shadowRoot?.querySelector('.value')?.textContent).toBe('Hide Afloat')
  })
})

describe('fd-select menu', () => {
  it('opens on click and closes again', async () => {
    const element = await mount(`<fd-select value="hide">${OPTIONS}</fd-select>`)

    button(element).click()
    await element.updateComplete
    expect(element.open).toBe(true)
    expect(menu(element).matches(':popover-open')).toBe(true)

    element.dismiss()
    await element.updateComplete
    expect(element.open).toBe(false)
  })

  it('opens on ArrowDown, mirroring keyCode 125 on the closed control', async () => {
    const element = await mount(`<fd-select value="hide">${OPTIONS}</fd-select>`)

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await element.updateComplete

    expect(element.open).toBe(true)
  })

  it('renders one row per option and badges the selected one', async () => {
    const element = await mount(`<fd-select value="quit">${OPTIONS}</fd-select>`)
    button(element).click()
    await element.updateComplete

    const rows = optionRows(element)
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false'])
    expect(rows[1]?.querySelector('.badge')).not.toBeNull()
    expect(rows[0]?.querySelector('.badge')).toBeNull()
  })

  it('uses the 36px row pitch from PreferencesPopupMenuView', async () => {
    const element = await mount(`<fd-select value="hide">${OPTIONS}</fd-select>`)
    button(element).click()
    await element.updateComplete

    const rows = optionRows(element).map((row) => row.getBoundingClientRect())
    expect(rows[0]?.height).toBe(32)
    expect((rows[1]?.top ?? 0) - (rows[0]?.top ?? 0)).toBe(36)
  })

  it('sizes the menu to the option count plus the 8px inset on each edge', async () => {
    const element = await mount(`<fd-select value="hide">${OPTIONS}</fd-select>`)
    button(element).click()
    await element.updateComplete

    expect(menu(element).getBoundingClientRect().height).toBe(3 * 36 + 16)
  })

  it('places the menu trailing-aligned below the anchor with a 6px gap', async () => {
    const element = await mount(
      `<fd-select style="position:fixed;top:100px;left:200px" value="hide">${OPTIONS}</fd-select>`,
    )
    button(element).click()
    await element.updateComplete

    const anchor = element.getBoundingClientRect()
    const rect = menu(element).getBoundingClientRect()

    expect(Math.round(rect.top - anchor.bottom)).toBe(6)
    expect(Math.round(rect.right)).toBe(Math.round(anchor.right))
  })

  it('flips above the anchor when there is no room below', async () => {
    const element = await mount(
      `<fd-select style="position:fixed;left:200px;bottom:4px" value="hide">${OPTIONS}</fd-select>`,
    )
    button(element).click()
    await element.updateComplete

    const anchor = element.getBoundingClientRect()
    expect(menu(element).getBoundingClientRect().bottom).toBeLessThanOrEqual(anchor.top - 5)
  })
})

describe('fd-select keyboard', () => {
  async function opened(): Promise<FdSelect> {
    const element = await mount(`<fd-select value="hide">${OPTIONS}</fd-select>`)
    button(element).click()
    await element.updateComplete
    return element
  }

  const press = async (element: FdSelect, key: string) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    await element.updateComplete
  }

  const highlighted = (element: FdSelect) =>
    optionRows(element).findIndex((row) => row.hasAttribute('data-highlighted'))

  it('starts the highlight on the selected option', async () => {
    const element = await mount(`<fd-select value="ask">${OPTIONS}</fd-select>`)
    button(element).click()
    await element.updateComplete

    expect(highlighted(element)).toBe(2)
  })

  it('wraps the highlight in both directions', async () => {
    const element = await opened()
    expect(highlighted(element)).toBe(0)

    await press(element, 'ArrowUp')
    expect(highlighted(element)).toBe(2)

    await press(element, 'ArrowDown')
    expect(highlighted(element)).toBe(0)
  })

  it('selects the highlighted option on Enter and closes', async () => {
    const element = await opened()
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)

    await press(element, 'ArrowDown')
    await press(element, 'Enter')

    expect(element.value).toBe('quit')
    expect(element.open).toBe(false)
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({ value: 'quit' })
  })
})

describe('fd-select selection', () => {
  it('reports a click on an option and closes the menu', async () => {
    const element = await mount(`<fd-select value="hide">${OPTIONS}</fd-select>`)
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)

    button(element).click()
    await element.updateComplete
    optionRows(element)[2]?.click()
    await element.updateComplete

    expect(element.value).toBe('ask')
    expect(element.open).toBe(false)
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('participates in a form', async () => {
    const form = document.createElement('form')
    form.innerHTML = `<fd-select name="closing" value="quit">${OPTIONS}</fd-select>`
    document.body.append(form)
    const element = form.querySelector('fd-select') as FdSelect
    await element.updateComplete

    expect(new FormData(form).get('closing')).toBe('quit')

    element.value = 'ask'
    await element.updateComplete
    expect(new FormData(form).get('closing')).toBe('ask')
  })

  it('exposes combobox semantics', async () => {
    const element = await mount(
      `<fd-select label="Closing behavior" value="hide">${OPTIONS}</fd-select>`,
    )
    const control = button(element)

    expect(control.getAttribute('role')).toBe('combobox')
    expect(control.getAttribute('aria-label')).toBe('Closing behavior')
    expect(control.getAttribute('aria-haspopup')).toBe('listbox')
    expect(control.getAttribute('aria-expanded')).toBe('false')

    control.click()
    await element.updateComplete
    expect(control.getAttribute('aria-expanded')).toBe('true')
    expect(menu(element).getAttribute('role')).toBe('listbox')
  })

  it('does not submit while disabled', async () => {
    const form = document.createElement('form')
    form.innerHTML = `<fd-select name="closing" value="quit" disabled>${OPTIONS}</fd-select>`
    document.body.append(form)
    const element = form.querySelector('fd-select') as FdSelect
    await element.updateComplete

    expect(new FormData(form).has('closing')).toBe(false)
  })
})
