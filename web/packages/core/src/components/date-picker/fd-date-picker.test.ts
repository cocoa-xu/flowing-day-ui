import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdDatePicker } from './fd-date-picker.js'
import './fd-date-picker.js'

async function mount(): Promise<FdDatePicker> {
  const element = document.createElement('fd-date-picker')
  element.label = 'Departure'
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => document.body.replaceChildren())

describe('fd-date-picker', () => {
  it.each([
    ['date', 'date'],
    ['time', 'time'],
    ['dateAndTime', 'datetime-local'],
  ] as const)('maps %s to the matching native field', async (components, type) => {
    const element = await mount()
    element.components = components
    await element.updateComplete

    expect(element.shadowRoot?.querySelector('input')?.type).toBe(type)
  })

  it('reflects bounds and emits value changes', async () => {
    const element = await mount()
    element.components = 'date'
    element.minimum = '2026-01-01'
    element.maximum = '2026-12-31'
    const listener = vi.fn()
    element.addEventListener('fd-change', listener)
    await element.updateComplete
    const input = element.shadowRoot?.querySelector('input')
    if (!input) throw new Error('missing date input')

    input.value = '2026-08-13'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }))

    expect(element.value).toBe('2026-08-13')
    expect(input.min).toBe('2026-01-01')
    expect(input.max).toBe('2026-12-31')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('participates in form submission and reset', async () => {
    const form = document.createElement('form')
    const element = document.createElement('fd-date-picker')
    element.name = 'departure'
    element.value = '2026-08-13'
    form.append(element)
    document.body.append(form)
    await element.updateComplete

    expect(new FormData(form).get('departure')).toBe('2026-08-13')
    element.value = '2026-08-14'
    form.reset()
    await element.updateComplete
    expect(element.value).toBe('2026-08-13')
  })
})
