import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdColorPicker } from './fd-color-picker.js'
import './fd-color-picker.js'

async function mount(attributes = ''): Promise<FdColorPicker> {
  const host = document.createElement('div')
  host.innerHTML = `<fd-color-picker label="Accent" ${attributes}></fd-color-picker>`
  document.body.append(host)
  const element = host.firstElementChild as FdColorPicker
  await element.updateComplete
  return element
}

const inputOf = (element: FdColorPicker) =>
  element.shadowRoot?.querySelector('input') as HTMLInputElement

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-color-picker', () => {
  it('uses the compact platform colour well', async () => {
    const element = await mount('value="#e991b2"')
    const input = inputOf(element)

    expect(input.type).toBe('color')
    expect(input.value).toBe('#e991b2')
    expect(input.getBoundingClientRect().width).toBeCloseTo(38, 1)
    expect(input.getBoundingClientRect().height).toBeCloseTo(22, 1)
    expect(element.shadowRoot?.querySelector('.label')?.textContent).toBe('Accent')
  })

  it('can hide its visible label for a labelled wrapper', async () => {
    const element = await mount('hide-label')

    expect(element.shadowRoot?.querySelector('.label')).toBeNull()
    expect(inputOf(element).getAttribute('aria-label')).toBe('Accent')
  })

  it('reports a new colour', async () => {
    const element = await mount()
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)
    const input = inputOf(element)
    input.value = '#4e9b83'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    expect(element.value).toBe('#4e9b83')
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({ value: '#4e9b83' })
  })

  it('participates in forms and honours disabled', async () => {
    const form = document.createElement('form')
    form.innerHTML = '<fd-color-picker name="accent" value="#e991b2" disabled></fd-color-picker>'
    document.body.append(form)
    const element = form.firstElementChild as FdColorPicker
    await element.updateComplete

    expect(new FormData(form).has('accent')).toBe(false)
    expect(inputOf(element).disabled).toBe(true)
  })
})
