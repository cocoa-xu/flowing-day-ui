import { afterEach, describe, expect, it, vi } from 'vitest'
import { FdTooltip } from './fd-tooltip.js'

async function mount(markup: string): Promise<FdTooltip> {
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '-10000px'
  host.innerHTML = markup
  document.body.append(host)
  const element = host.querySelector('fd-tooltip') as FdTooltip
  await element.updateComplete
  return element
}

const surface = (element: FdTooltip) => element.shadowRoot?.querySelector('.surface') as HTMLElement

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-tooltip timing', () => {
  it('uses the same deliberate delay as SwiftUI', () => {
    expect(FdTooltip.defaultDelay).toBe(0.65)
  })

  it('opens after hover delay and closes on pointer exit', async () => {
    const element = await mount(`
      <fd-tooltip accessibility-text="More information" message="Shows more information" delay="0">
        <button slot="trigger">Help</button>
      </fd-tooltip>
    `)

    element.dispatchEvent(new PointerEvent('pointerenter'))
    await wait(1)
    await element.updateComplete
    expect(surface(element).matches(':popover-open')).toBe(true)

    element.dispatchEvent(new PointerEvent('pointerleave'))
    await element.updateComplete
    expect(element.open).toBe(false)
  })

  it('cancels a pending presentation when the pointer leaves', async () => {
    const element = await mount(`
      <fd-tooltip accessibility-text="More information" message="Shows more information" delay="0.02">
        <button slot="trigger">Help</button>
      </fd-tooltip>
    `)

    vi.useFakeTimers()
    try {
      element.dispatchEvent(new PointerEvent('pointerenter'))
      element.dispatchEvent(new PointerEvent('pointerleave'))
      await vi.advanceTimersByTimeAsync(20)

      expect(element.open).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses focus as the keyboard equivalent of hover', async () => {
    const element = await mount(`
      <fd-tooltip accessibility-text="More information" message="Shows more information" delay="0">
        <button slot="trigger">Help</button>
      </fd-tooltip>
    `)
    const trigger = element.querySelector('button') as HTMLButtonElement

    trigger.focus()
    await wait(1)
    await element.updateComplete
    expect(element.open).toBe(true)

    trigger.blur()
    await element.updateComplete
    expect(element.open).toBe(false)
  })
})

describe('fd-tooltip semantics', () => {
  it('shows its text when formatting whitespace occupies the default slot', async () => {
    const element = await mount(`
      <fd-tooltip accessibility-text="More information" message="Shows more information">
        <button slot="trigger">Help</button>
      </fd-tooltip>
    `)

    const content = surface(element).querySelector('fd-tooltip-content')
    expect(content?.shadowRoot?.querySelector('.message')?.textContent?.trim()).toBe(
      'Shows more information',
    )
  })

  it('describes the trigger without replacing its accessible name', async () => {
    const element = await mount(`
      <fd-tooltip accessibility-text="More information" message="Shows more information">
        <button slot="trigger" aria-label="Help">?</button>
      </fd-tooltip>
    `)
    const trigger = element.querySelector('button') as HTMLButtonElement

    expect(trigger.getAttribute('aria-label')).toBe('Help')
    expect(surface(element).getAttribute('role')).toBe('tooltip')
    expect(surface(element).getAttribute('aria-label')).toBe('More information')
    expect(trigger.getAttribute('aria-describedby')).toBe(surface(element).id)
  })

  it('restores an application description when disconnected', async () => {
    const element = await mount(`
      <fd-tooltip accessibility-text="Temporary description" message="Temporary description">
        <button slot="trigger" aria-describedby="application-description">Help</button>
      </fd-tooltip>
    `)
    const trigger = element.querySelector('button') as HTMLButtonElement

    element.remove()

    expect(trigger.getAttribute('aria-describedby')).toBe('application-description')
  })

  it('preserves application descriptions while connected', async () => {
    const element = await mount(`
      <fd-tooltip accessibility-text="Original tooltip" message="Original tooltip">
        <button slot="trigger" aria-describedby="application-description">Help</button>
      </fd-tooltip>
    `)
    const trigger = element.querySelector('button') as HTMLButtonElement

    expect(trigger.getAttribute('aria-describedby')?.split(' ')).toEqual([
      'application-description',
      surface(element).id,
    ])
  })

  it('dismisses on Escape', async () => {
    const element = await mount(`
      <fd-tooltip accessibility-text="More information" message="Shows more information" delay="0">
        <button slot="trigger">Help</button>
      </fd-tooltip>
    `)

    element.dispatchEvent(new PointerEvent('pointerenter'))
    await wait(1)
    await element.updateComplete
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await element.updateComplete

    expect(element.open).toBe(false)
  })

  it('keeps rich content noninteractive', async () => {
    const element = await mount(`
      <fd-tooltip title="Confirmation" message="Use this only for important actions" symbol="info" accessibility-text="Important action details">
        <button slot="trigger">Help</button>
        <strong>Custom explanation</strong>
      </fd-tooltip>
    `)

    const content = surface(element).querySelector('fd-tooltip-content')
    expect(content?.shadowRoot?.querySelector('.title')?.textContent).toBe('Confirmation')
    expect(element.textContent).toContain('Custom explanation')
    expect(getComputedStyle(surface(element)).pointerEvents).toBe('none')
  })
})
