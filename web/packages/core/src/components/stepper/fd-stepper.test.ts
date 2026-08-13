import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdStepper } from './fd-stepper.js'
import './fd-stepper.js'

async function mount(): Promise<FdStepper> {
  const stepper = document.createElement('fd-stepper')
  stepper.label = 'Copies'
  stepper.value = 4
  stepper.minimum = 1
  stepper.maximum = 5
  stepper.step = 2
  document.body.append(stepper)
  await stepper.updateComplete
  return stepper
}

afterEach(() => document.body.replaceChildren())

describe('fd-stepper', () => {
  it('formats its value and exposes adjustable semantics', async () => {
    const stepper = await mount()
    stepper.formatValue = (value) => `${value} copies`
    await stepper.updateComplete

    expect(stepper.shadowRoot?.querySelector('.value')?.textContent).toBe('4 copies')
    expect(stepper.shadowRoot?.querySelector<HTMLButtonElement>('.increment')?.ariaLabel).toBe(
      'Increase Copies',
    )
    expect(stepper.shadowRoot?.querySelector('.value')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('clamps increments and decrements to its bounds', async () => {
    const stepper = await mount()

    stepper.shadowRoot?.querySelector<HTMLButtonElement>('.increment')?.click()
    await stepper.updateComplete
    expect(stepper.value).toBe(5)

    stepper.value = 2
    await stepper.updateComplete
    stepper.shadowRoot?.querySelector<HTMLButtonElement>('.decrement')?.click()
    await stepper.updateComplete
    expect(stepper.value).toBe(1)
  })

  it('uses arrow keys and reports changes', async () => {
    const stepper = await mount()
    const listener = vi.fn()
    stepper.addEventListener('fd-change', listener)

    stepper.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await stepper.updateComplete

    expect(stepper.value).toBe(5)
    expect(listener).toHaveBeenCalledOnce()
  })

  it('does not change while disabled', async () => {
    const stepper = await mount()
    stepper.disabled = true
    await stepper.updateComplete

    stepper.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(stepper.value).toBe(4)
  })
})
