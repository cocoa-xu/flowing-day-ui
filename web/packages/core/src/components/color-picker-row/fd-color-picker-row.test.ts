import { afterEach, describe, expect, it } from 'vitest'
import type { FdColorPicker } from '../color-picker/fd-color-picker.js'
import type { FdColorPickerRow } from './fd-color-picker-row.js'
import './fd-color-picker-row.js'

async function mount(html: string): Promise<FdColorPickerRow> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const element = host.firstElementChild as FdColorPickerRow
  await element.updateComplete
  return element
}

const pickerOf = (element: FdColorPickerRow) =>
  element.shadowRoot?.querySelector('fd-color-picker') as FdColorPicker

const swatchOf = (element: FdColorPickerRow) =>
  pickerOf(element).shadowRoot?.querySelector('.swatch') as HTMLInputElement

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-color-picker-row', () => {
  it('hands the choice to the platform picker', async () => {
    const element = await mount('<fd-color-picker-row label="Tint"></fd-color-picker-row>')
    expect(swatchOf(element).type).toBe('color')
  })

  it('shows the current colour', async () => {
    const element = await mount(
      '<fd-color-picker-row label="Tint" value="#6d9ea5"></fd-color-picker-row>',
    )
    expect(swatchOf(element).value).toBe('#6d9ea5')
  })

  it('draws the well at the small control size', async () => {
    const element = await mount('<fd-color-picker-row label="Tint"></fd-color-picker-row>')
    const style = getComputedStyle(swatchOf(element))

    expect(style.width).toBe('38px')
    expect(style.height).toBe('22px')
  })

  it('labels the well, since it carries no visible text', async () => {
    const element = await mount('<fd-color-picker-row label="Tint"></fd-color-picker-row>')
    expect(swatchOf(element).getAttribute('aria-label')).toBe('Tint')
  })

  it('asks for opacity only when told to', async () => {
    const opaque = await mount('<fd-color-picker-row label="Tint"></fd-color-picker-row>')
    expect(swatchOf(opaque).hasAttribute('alpha')).toBe(false)

    const translucent = await mount(
      '<fd-color-picker-row label="Tint" supports-opacity></fd-color-picker-row>',
    )
    expect(swatchOf(translucent).hasAttribute('alpha')).toBe(true)
  })

  it('reports a new colour', async () => {
    const element = await mount(
      '<fd-color-picker-row label="Tint" value="#000000"></fd-color-picker-row>',
    )
    const values: string[] = []
    element.addEventListener('fd-change', (event) => {
      values.push(event.detail.value as string)
    })

    const swatch = swatchOf(element)
    swatch.value = '#b4674d'
    swatch.dispatchEvent(new Event('input', { bubbles: true }))
    await element.updateComplete

    expect(values).toEqual(['#b4674d'])
    expect(element.value).toBe('#b4674d')
  })

  it('submits with a form and restores on reset', async () => {
    const form = document.createElement('form')
    document.body.append(form)
    form.innerHTML =
      '<fd-color-picker-row name="tint" label="Tint" value="#6d9ea5"></fd-color-picker-row>'
    const element = form.firstElementChild as FdColorPickerRow
    await element.updateComplete

    expect(new FormData(form).get('tint')).toBe('#6d9ea5')

    element.value = '#b4674d'
    await element.updateComplete
    expect(new FormData(form).get('tint')).toBe('#b4674d')

    form.reset()
    await element.updateComplete
    expect(element.value).toBe('#6d9ea5')
  })

  it('does not submit while disabled', async () => {
    const form = document.createElement('form')
    form.innerHTML =
      '<fd-color-picker-row name="tint" label="Tint" value="#6d9ea5" disabled></fd-color-picker-row>'
    document.body.append(form)
    const element = form.firstElementChild as FdColorPickerRow
    await element.updateComplete

    expect(new FormData(form).has('tint')).toBe(false)
  })

  it('carries the row caption through', async () => {
    const element = await mount(
      '<fd-color-picker-row label="Tint" caption="Used for highlights."></fd-color-picker-row>',
    )
    const row = element.shadowRoot?.querySelector('fd-row')
    expect(row?.getAttribute('caption')).toBe('Used for highlights.')
  })
})
