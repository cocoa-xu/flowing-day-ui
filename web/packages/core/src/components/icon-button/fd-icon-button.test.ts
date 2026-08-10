import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdIconButton } from './fd-icon-button.js'
import './fd-icon-button.js'

async function mount(markup: string): Promise<FdIconButton> {
  const host = document.createElement('div')
  host.innerHTML = markup
  document.body.append(host)
  const element = host.firstElementChild as FdIconButton
  await element.updateComplete
  return element
}

const buttonOf = (element: FdIconButton) =>
  element.shadowRoot?.querySelector('button') as HTMLButtonElement

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-icon-button', () => {
  it('matches the Swift control size and corner radius', async () => {
    const element = await mount('<fd-icon-button label="Refresh" symbol="arrow"></fd-icon-button>')
    const button = buttonOf(element)

    expect(button.getBoundingClientRect().width).toBeCloseTo(30, 1)
    expect(button.getBoundingClientRect().height).toBeCloseTo(30, 1)
    expect(getComputedStyle(button).borderRadius).toBe('8px')
  })

  it('reports an ordinary activation without selection semantics', async () => {
    const element = await mount('<fd-icon-button label="Refresh" symbol="arrow"></fd-icon-button>')
    const activate = vi.fn()
    const change = vi.fn()
    element.addEventListener('fd-activate', activate)
    element.addEventListener('fd-change', change)

    buttonOf(element).click()

    expect(activate).toHaveBeenCalledOnce()
    expect(change).not.toHaveBeenCalled()
    expect(buttonOf(element).hasAttribute('aria-pressed')).toBe(false)
  })

  it('toggles selection and reports both state and activation', async () => {
    const element = await mount('<fd-icon-button label="Pin" symbol="pin" toggle></fd-icon-button>')
    const changes: boolean[] = []
    const activate = vi.fn()
    element.addEventListener('fd-change', (event) => changes.push(event.detail.checked ?? false))
    element.addEventListener('fd-activate', activate)

    buttonOf(element).click()
    await element.updateComplete
    expect(element.selected).toBe(true)
    expect(buttonOf(element).getAttribute('aria-pressed')).toBe('true')

    buttonOf(element).click()
    expect(changes).toEqual([true, false])
    expect(activate).toHaveBeenCalledTimes(2)
  })

  it('does not activate while disabled', async () => {
    const element = await mount(
      '<fd-icon-button label="Delete" symbol="trash" disabled></fd-icon-button>',
    )
    const activate = vi.fn()
    element.addEventListener('fd-activate', activate)

    buttonOf(element).click()
    expect(activate).not.toHaveBeenCalled()
    expect(buttonOf(element).disabled).toBe(true)
  })

  it('keeps its keyboard focus treatment inside the button bounds', async () => {
    const element = await mount('<fd-icon-button label="Refresh" symbol="arrow"></fd-icon-button>')
    const button = buttonOf(element)
    button.focus()

    expect(getComputedStyle(button).outlineStyle).toBe('none')
  })
})
