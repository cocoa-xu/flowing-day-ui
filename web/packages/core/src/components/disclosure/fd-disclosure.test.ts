import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdDisclosure } from './fd-disclosure.js'
import './fd-disclosure.js'

async function mount(attributes = ''): Promise<FdDisclosure> {
  const host = document.createElement('div')
  host.innerHTML = `<fd-disclosure label="Advanced" ${attributes}><p>Details</p></fd-disclosure>`
  document.body.append(host)
  const element = host.firstElementChild as FdDisclosure
  await element.updateComplete
  return element
}

const headerOf = (element: FdDisclosure) =>
  element.shadowRoot?.querySelector('.header') as HTMLButtonElement

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-disclosure', () => {
  it('toggles its content and reports the expanded state', async () => {
    const element = await mount()
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)

    headerOf(element).click()
    await element.updateComplete

    expect(element.expanded).toBe(true)
    expect(headerOf(element).getAttribute('aria-expanded')).toBe('true')
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({ checked: true })
  })

  it('animates an intrinsic-height reveal without exposing overflow', async () => {
    const element = await mount('expanded')
    const reveal = element.shadowRoot?.querySelector('.reveal') as HTMLElement
    const content = element.shadowRoot?.querySelector('.content') as HTMLElement

    expect(getComputedStyle(content).overflow).toBe('hidden')
    expect(reveal.getBoundingClientRect().height).toBeGreaterThan(0)
  })

  it('honours a minimum header height', async () => {
    const element = await mount('minimum-header-height="52"')
    expect(headerOf(element).getBoundingClientRect().height).toBeGreaterThanOrEqual(52)
  })

  it('uses Swift content insets and accepts custom values', async () => {
    const element = await mount()
    const header = headerOf(element)

    expect(getComputedStyle(header).padding).toBe('8px 10px')

    element.contentInsets = { top: 4, leading: 6, bottom: 8, trailing: 10 }
    await element.updateComplete
    const style = getComputedStyle(header)
    expect([style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]).toEqual([
      '4px',
      '10px',
      '8px',
      '6px',
    ])
  })

  it('uses the Swift veil focus treatment without an outline', async () => {
    const element = await mount()
    const header = headerOf(element)
    header.focus()

    expect(getComputedStyle(header).outlineStyle).toBe('none')
    expect(getComputedStyle(header).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  it('does not open while disabled', async () => {
    const element = await mount('disabled')
    headerOf(element).click()
    expect(element.expanded).toBe(false)
  })
})
