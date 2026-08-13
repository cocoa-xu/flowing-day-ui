import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdRadioGroup } from './fd-radio-group.js'
import './fd-radio-group.js'

async function mount(): Promise<FdRadioGroup> {
  const group = document.createElement('fd-radio-group')
  group.label = 'Mode'
  group.value = 'quiet'
  group.options = [
    { value: 'quiet', label: 'Quiet' },
    { value: 'focused', label: 'Focused', symbol: 'focus' },
    { value: 'shared', label: 'Shared', isEnabled: false },
  ]
  document.body.append(group)
  await group.updateComplete
  return group
}

afterEach(() => document.body.replaceChildren())

describe('fd-radio-group', () => {
  it('renders the current selection and disabled options', async () => {
    const group = await mount()
    const radios = group.shadowRoot?.querySelectorAll('fd-radio') ?? []

    expect(radios).toHaveLength(3)
    expect(radios[0]?.selected).toBe(true)
    expect(radios[2]?.disabled).toBe(true)
  })

  it('changes selection through an option activation', async () => {
    const group = await mount()
    const listener = vi.fn()
    group.addEventListener('fd-change', listener)
    group.shadowRoot?.querySelectorAll('fd-radio')[1]?.shadowRoot?.querySelector('button')?.click()
    await group.updateComplete

    expect(group.value).toBe('focused')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('navigates enabled options along the configured axis', async () => {
    const group = await mount()
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await group.updateComplete
    expect(group.value).toBe('focused')

    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await group.updateComplete
    expect(group.value).toBe('quiet')
  })

  it('uses writing direction for horizontal arrow navigation', async () => {
    const group = await mount()
    group.axis = 'horizontal'
    group.dir = 'rtl'
    await group.updateComplete

    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    await group.updateComplete

    expect(group.value).toBe('focused')
  })
})
