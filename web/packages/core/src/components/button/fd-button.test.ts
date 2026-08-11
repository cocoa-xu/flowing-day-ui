import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdButton } from './fd-button.js'
import './fd-button.js'

async function mount(attributes = ''): Promise<FdButton> {
  const host = document.createElement('div')
  host.innerHTML = `<fd-button label="Continue" ${attributes}></fd-button>`
  document.body.append(host)
  const element = host.firstElementChild as FdButton
  await element.updateComplete
  return element
}

const buttonOf = (element: FdButton) =>
  element.shadowRoot?.querySelector('button') as HTMLButtonElement

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-button', () => {
  it('shows its label when formatting whitespace occupies the default slot', async () => {
    const host = document.createElement('div')
    host.innerHTML = '<fd-button label="Continue"> \n </fd-button>'
    document.body.append(host)
    const element = host.firstElementChild as FdButton
    await element.updateComplete

    expect(buttonOf(element).textContent?.trim()).toBe('Continue')
  })

  it('uses meaningful custom content instead of its label', async () => {
    const host = document.createElement('div')
    host.innerHTML = '<fd-button label="Continue"><strong>Resume</strong></fd-button>'
    document.body.append(host)
    const element = host.firstElementChild as FdButton
    await element.updateComplete

    const control = buttonOf(element)
    const slot = control.querySelector('slot') as HTMLSlotElement

    expect(slot.assignedElements()[0]?.textContent).toBe('Resume')
    expect(control.textContent).not.toContain('Continue')
  })

  it('uses the soft button geometry', async () => {
    const element = await mount()
    const style = getComputedStyle(buttonOf(element))

    expect(style.paddingLeft).toBe('12px')
    expect(style.paddingTop).toBe('5px')
    expect(style.borderRadius).toBe('9px')
  })

  it('reports activation', async () => {
    const element = await mount()
    const onActivate = vi.fn()
    element.addEventListener('fd-activate', onActivate)

    buttonOf(element).click()
    expect(onActivate).toHaveBeenCalledOnce()
  })

  it('offers the prominent treatment', async () => {
    const element = await mount('prominent')
    expect(buttonOf(element).hasAttribute('data-prominent')).toBe(true)
    expect(getComputedStyle(buttonOf(element)).boxShadow).toBe('none')
  })

  it('stays inert while disabled', async () => {
    const element = await mount('disabled')
    const onActivate = vi.fn()
    element.addEventListener('fd-activate', onActivate)
    buttonOf(element).click()
    expect(onActivate).not.toHaveBeenCalled()
  })
})
