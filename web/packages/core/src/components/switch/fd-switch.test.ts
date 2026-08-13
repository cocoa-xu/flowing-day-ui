import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import type { FdSwitch } from './fd-switch.js'
import './fd-switch.js'

async function mount(html: string): Promise<HTMLElement> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const element = host.firstElementChild as HTMLElement & { updateComplete?: Promise<unknown> }
  await element.updateComplete
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-switch', () => {
  it('exposes the switch role and reflects checked state to assistive technology', async () => {
    const element = (await mount('<fd-switch></fd-switch>')) as FdSwitch

    expect(element.getAttribute('role')).toBe('switch')
    expect(element.getAttribute('aria-checked')).toBe('false')

    element.checked = true
    await element.updateComplete

    expect(element.getAttribute('aria-checked')).toBe('true')
    expect(element.hasAttribute('checked')).toBe(true)
  })

  it('is discoverable in the accessibility tree', async () => {
    await mount('<fd-switch checked></fd-switch>')

    expect(page.getByRole('switch').elements()).toHaveLength(1)
    expect(page.getByRole('switch', { checked: true }).elements()).toHaveLength(1)
  })

  it('leaves an author-supplied role alone', async () => {
    const element = (await mount('<fd-switch role="checkbox"></fd-switch>')) as FdSwitch
    expect(element.getAttribute('role')).toBe('checkbox')
  })

  it('marks itself disabled for assistive technology', async () => {
    const element = (await mount('<fd-switch disabled></fd-switch>')) as FdSwitch
    expect(element.getAttribute('aria-disabled')).toBe('true')
  })

  it('renders and exposes the Swift title', async () => {
    const element = (await mount('<fd-switch label="Share Updates"></fd-switch>')) as FdSwitch

    expect(element.shadowRoot?.querySelector('.label')?.textContent).toBe('Share Updates')
    expect(element.getAttribute('aria-label')).toBe('Share Updates')
  })

  it('is keyboard reachable by default', async () => {
    const element = (await mount('<fd-switch></fd-switch>')) as FdSwitch
    expect(element.tabIndex).toBe(0)
  })

  it('toggles on click and reports the new value', async () => {
    const element = (await mount('<fd-switch></fd-switch>')) as FdSwitch
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)

    element.click()
    await element.updateComplete

    expect(element.checked).toBe(true)
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({ checked: true })
  })

  it('toggles on Space and Enter', async () => {
    const element = (await mount('<fd-switch></fd-switch>')) as FdSwitch

    element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await element.updateComplete
    expect(element.checked).toBe(true)

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await element.updateComplete
    expect(element.checked).toBe(false)
  })

  it('ignores unrelated keys', async () => {
    const element = (await mount('<fd-switch></fd-switch>')) as FdSwitch
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    await element.updateComplete
    expect(element.checked).toBe(false)
  })

  it('does not toggle while disabled, and leaves the tab order', async () => {
    const element = (await mount('<fd-switch disabled></fd-switch>')) as FdSwitch
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)

    element.click()
    await element.updateComplete

    expect(element.checked).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
    expect(element.tabIndex).toBe(-1)
  })

  it('emits a composed event so it crosses shadow boundaries', async () => {
    const element = (await mount('<fd-switch></fd-switch>')) as FdSwitch
    const onChange = vi.fn()
    document.body.addEventListener('fd-change', onChange)

    element.click()
    await element.updateComplete

    expect(onChange).toHaveBeenCalledOnce()
    document.body.removeEventListener('fd-change', onChange)
  })

  it('participates in a form and submits only while checked', async () => {
    const form = document.createElement('form')
    form.innerHTML = '<fd-switch name="launchAtLogin" value="yes"></fd-switch>'
    document.body.append(form)
    const element = form.firstElementChild as FdSwitch
    await element.updateComplete

    expect(element.form).toBe(form)
    expect(new FormData(form).get('launchAtLogin')).toBeNull()

    element.checked = true
    await element.updateComplete
    expect(new FormData(form).get('launchAtLogin')).toBe('yes')

    element.disabled = true
    await element.updateComplete
    expect(new FormData(form).get('launchAtLogin')).toBeNull()
  })

  it('restores its initial state on form reset', async () => {
    const form = document.createElement('form')
    form.innerHTML = '<fd-switch name="sync" checked></fd-switch>'
    document.body.append(form)
    const element = form.firstElementChild as FdSwitch
    await element.updateComplete

    element.checked = false
    await element.updateComplete
    form.reset()
    await element.updateComplete

    expect(element.checked).toBe(true)
  })

  it('picks up an accent override declared outside its shadow root', async () => {
    document.documentElement.style.setProperty('--fd-accent-fill', 'rgb(196, 69, 61)')
    try {
      const element = (await mount('<fd-switch checked></fd-switch>')) as FdSwitch
      const track = element.shadowRoot?.querySelector('.track') as HTMLElement
      expect(getComputedStyle(track).backgroundColor).toBe('rgb(196, 69, 61)')
    } finally {
      document.documentElement.style.removeProperty('--fd-accent-fill')
    }
  })
})
