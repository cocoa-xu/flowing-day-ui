import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdPopover } from './fd-popover.js'
import './fd-popover.js'

async function mount(markup: string): Promise<FdPopover> {
  const host = document.createElement('div')
  host.innerHTML = markup
  document.body.append(host)
  const element = host.querySelector('fd-popover') as FdPopover
  await element.updateComplete
  return element
}

const surface = (element: FdPopover) => element.shadowRoot?.querySelector('.surface') as HTMLElement

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-popover lifecycle', () => {
  it('opens from its trigger in the browser top layer', async () => {
    const element = await mount(`
      <fd-popover accessibility-label="Preview options">
        <button slot="trigger">Options</button>
        <p>Changes apply immediately.</p>
      </fd-popover>
    `)
    const trigger = element.querySelector('button') as HTMLButtonElement

    trigger.click()
    await vi.waitFor(() => expect(element.open).toBe(true))
    await element.updateComplete

    expect(element.open).toBe(true)
    expect(surface(element).matches(':popover-open')).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
  })

  it('tracks native light-dismiss state', async () => {
    const element = await mount(`
      <fd-popover accessibility-label="Preview options"><button slot="trigger">Options</button></fd-popover>
    `)
    const onClose = vi.fn()
    element.addEventListener('fd-close', onClose)
    element.show()
    await element.updateComplete

    surface(element).hidePopover()
    await vi.waitFor(() => expect(element.open).toBe(false))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('dismisses on scroll only while open', async () => {
    const element = await mount(`
      <fd-popover accessibility-label="Preview options"><button slot="trigger">Options</button></fd-popover>
    `)
    element.show()
    await element.updateComplete

    window.dispatchEvent(new Event('scroll'))
    await element.updateComplete

    expect(element.open).toBe(false)
  })

  it('restores trigger accessibility attributes when disconnected', async () => {
    const element = await mount(`
      <fd-popover accessibility-label="Preview options">
        <button slot="trigger" aria-haspopup="menu" aria-expanded="mixed">Options</button>
      </fd-popover>
    `)
    const trigger = element.querySelector('button') as HTMLButtonElement

    element.remove()

    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('mixed')
  })

  it('updates only the accessible label it owns', async () => {
    const element = await mount(`
      <fd-popover accessibility-label="Preview options"><button slot="trigger">Options</button></fd-popover>
    `)
    const trigger = element.querySelector('button') as HTMLButtonElement

    element.accessibilityLabel = 'Layout options'
    await element.updateComplete
    expect(trigger.getAttribute('aria-label')).toBe('Layout options')

    element.accessibilityLabel = ''
    await element.updateComplete
    expect(trigger.hasAttribute('aria-label')).toBe(false)

    const preserved = await mount(`
      <fd-popover accessibility-label="Preview options">
        <button slot="trigger" aria-label="Application label">Options</button>
      </fd-popover>
    `)
    const preservedTrigger = preserved.querySelector('button') as HTMLButtonElement
    preserved.accessibilityLabel = 'Layout options'
    await preserved.updateComplete

    expect(preservedTrigger.getAttribute('aria-label')).toBe('Application label')
  })
})

describe('fd-popover presentation', () => {
  it('honors bounded content widths without a layout observer', async () => {
    const element = await mount(`
      <fd-popover accessibility-label="Details" minimum-width="240" maximum-width="360">
        <button slot="trigger">Details</button>
        <p>Content</p>
      </fd-popover>
    `)
    element.show()
    await element.updateComplete

    const width = surface(element).getBoundingClientRect().width
    expect(width).toBeGreaterThanOrEqual(240)
    expect(width).toBeLessThanOrEqual(360)
  })

  it('accepts arbitrary interactive content', async () => {
    const element = await mount(`
      <fd-popover accessibility-label="Details">
        <button slot="trigger">Details</button>
        <label><input type="checkbox" /> Live preview</label>
      </fd-popover>
    `)

    expect(element.querySelector('input')).not.toBeNull()
    expect(surface(element).getAttribute('role')).toBe('dialog')
  })

  it('uses Swift content insets and arrow edge defaults', async () => {
    const element = await mount(`
      <fd-popover accessibility-label="Details">
        <button slot="trigger">Details</button>
      </fd-popover>
    `)

    expect(element.arrowEdge).toBe('top')
    expect(getComputedStyle(surface(element)).padding).toBe('13px')
  })
})
