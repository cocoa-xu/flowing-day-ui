import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdCheckbox } from './fd-checkbox.js'
import './fd-checkbox.js'

async function mount(markup: string): Promise<FdCheckbox> {
  const host = document.createElement('div')
  host.innerHTML = markup
  document.body.append(host)
  const element = host.firstElementChild as FdCheckbox
  await element.updateComplete
  return element
}

const buttonOf = (element: FdCheckbox) =>
  element.shadowRoot?.querySelector('.button') as HTMLButtonElement

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-checkbox', () => {
  it('toggles and reports its checked state', async () => {
    const element = await mount('<fd-checkbox label="Canvas"></fd-checkbox>')
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)

    buttonOf(element).click()
    await element.updateComplete

    expect(element.checked).toBe(true)
    expect(buttonOf(element).getAttribute('role')).toBe('checkbox')
    expect(buttonOf(element).getAttribute('aria-checked')).toBe('true')
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({ checked: true })
  })

  it('supports each SwiftUI truncation mode', async () => {
    const element = await mount(
      '<fd-checkbox label="A very long checkbox label" truncation="middle" tail-length="6"></fd-checkbox>',
    )
    const label = element.shadowRoot?.querySelector('.label') as HTMLElement

    expect(label.querySelector('.truncate-head')?.textContent).toBe('A very long checkbox')
    expect(label.querySelector('.truncate-tail')?.textContent).toBe(' label')
  })

  it('supports trailing indicators and fit-content geometry', async () => {
    const element = await mount(
      '<fd-checkbox label="Compact" indicator-placement="trailing" width-policy="fit-content" maximum-width="120"></fd-checkbox>',
    )
    const button = buttonOf(element)

    expect(button.lastElementChild?.getAttribute('part')).toBe('indicator')
    expect(element.getBoundingClientRect().width).toBeLessThanOrEqual(120)
    expect(element.getBoundingClientRect().width).toBeLessThan(document.body.clientWidth)
  })

  it('uses the icon treatment when a symbol is supplied', async () => {
    const element = await mount(
      '<fd-checkbox label="Display" symbol="display" checked></fd-checkbox>',
    )

    expect(element.shadowRoot?.querySelector('fd-icon')?.getAttribute('part')).toBe('icon')
    expect(element.shadowRoot?.querySelector('.icon-indicator')).not.toBeNull()
    expect(buttonOf(element).getBoundingClientRect().height).toBeCloseTo(31, 1)
  })

  it('participates in form submission and reset', async () => {
    const form = document.createElement('form')
    form.innerHTML = '<fd-checkbox name="feature" value="canvas" checked></fd-checkbox>'
    document.body.append(form)
    const element = form.firstElementChild as FdCheckbox
    await element.updateComplete

    expect(new FormData(form).get('feature')).toBe('canvas')
    buttonOf(element).click()
    await element.updateComplete
    expect(new FormData(form).has('feature')).toBe(false)

    form.reset()
    await element.updateComplete
    expect(element.checked).toBe(true)
  })

  it('does not toggle while disabled', async () => {
    const element = await mount('<fd-checkbox label="Locked" disabled></fd-checkbox>')
    buttonOf(element).click()
    expect(element.checked).toBe(false)
  })
})
