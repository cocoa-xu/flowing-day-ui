import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdCheckbox } from '../checkbox/fd-checkbox.js'
import type { FdMultiSelect, FdMultiSelectOption } from './fd-multi-select.js'
import './fd-multi-select.js'

const OPTIONS = `
  <fd-option value="usb" selected>USB</fd-option>
  <fd-option value="display" symbol="display">Display</fd-option>
  <fd-option value="network" disabled>Network</fd-option>
`

async function mount(attributes = ''): Promise<FdMultiSelect> {
  const host = document.createElement('div')
  host.innerHTML = `<fd-multi-select label="Devices" ${attributes}>${OPTIONS}</fd-multi-select>`
  document.body.append(host)
  const element = host.firstElementChild as FdMultiSelect
  await element.updateComplete
  await element.updateComplete
  return element
}

const checkboxes = (element: FdMultiSelect) =>
  [...(element.shadowRoot?.querySelectorAll('fd-checkbox') ?? [])] as FdCheckbox[]

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-multi-select', () => {
  it('renders independent checkbox options', async () => {
    const element = await mount()
    expect(checkboxes(element).map((option) => option.label)).toEqual(['USB', 'Display', 'Network'])
    expect(checkboxes(element).map((option) => option.checked)).toEqual([true, false, false])
    expect(checkboxes(element)[1]?.symbol).toBe('display')
  })

  it('renders Swift-aligned options provided as data', async () => {
    const element = await mount()
    const options: readonly FdMultiSelectOption[] = [
      { id: 'usb', label: 'USB', isSelected: true },
      { label: 'Display', symbol: 'display' },
      { id: 'network', label: 'Network', isEnabled: false },
    ]
    element.options = options
    await element.updateComplete

    expect(checkboxes(element).map((option) => option.label)).toEqual(['USB', 'Display', 'Network'])
    expect(checkboxes(element).map((option) => option.checked)).toEqual([true, false, false])
    expect(checkboxes(element)[1]?.symbol).toBe('display')
    expect(element.values).toEqual(['usb'])
  })

  it('uses the label as the default option identifier', async () => {
    const element = await mount()
    element.options = [{ label: 'Display' }]
    await element.updateComplete
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)

    checkboxes(element)[0]?.shadowRoot?.querySelector<HTMLButtonElement>('button')?.click()
    await element.updateComplete

    expect(element.values).toEqual(['Display'])
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({
      value: 'Display',
      selected: true,
      values: ['Display'],
    })
  })

  it('does not change a disabled data option', async () => {
    const element = await mount()
    element.options = [{ id: 'network', label: 'Network', isEnabled: false }]
    await element.updateComplete
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)

    checkboxes(element)[0]?.shadowRoot?.querySelector<HTMLButtonElement>('button')?.click()

    expect(element.values).toEqual([])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('updates its values and reports the changed option', async () => {
    const element = await mount()
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)

    const display = checkboxes(element)[1] as FdCheckbox
    display.shadowRoot?.querySelector<HTMLButtonElement>('button')?.click()
    await display.updateComplete
    await element.updateComplete

    expect(element.values).toEqual(['usb', 'display'])
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({
      value: 'display',
      selected: true,
      values: ['usb', 'display'],
    })
  })

  it('does not change a disabled option', async () => {
    const element = await mount()
    const network = checkboxes(element)[2] as FdCheckbox
    network.shadowRoot?.querySelector<HTMLButtonElement>('button')?.click()
    expect(element.values).toEqual(['usb'])
  })

  it('supports vertical fit-content layout', async () => {
    const element = await mount(
      'axis="vertical" item-width-policy="fitContent" content-alignment="trailing"',
    )
    const group = element.shadowRoot?.querySelector('.group') as HTMLElement

    expect(getComputedStyle(group).flexDirection).toBe('column')
    expect(getComputedStyle(group).alignItems).toBe('flex-end')
    expect(checkboxes(element)[0]?.widthPolicy).toBe('fitContent')
  })

  it('submits every selected value', async () => {
    const form = document.createElement('form')
    form.innerHTML = `<fd-multi-select name="device">${OPTIONS}</fd-multi-select>`
    document.body.append(form)
    const element = form.firstElementChild as FdMultiSelect
    await element.updateComplete
    await element.updateComplete

    expect(new FormData(form).getAll('device')).toEqual(['usb'])
  })

  it('restores every option to its initial state on form reset', async () => {
    const form = document.createElement('form')
    form.innerHTML = `<fd-multi-select name="device">${OPTIONS}</fd-multi-select>`
    document.body.append(form)
    const element = form.firstElementChild as FdMultiSelect
    await element.updateComplete
    await element.updateComplete
    const display = checkboxes(element)[1] as FdCheckbox

    display.shadowRoot?.querySelector<HTMLButtonElement>('button')?.click()
    await element.updateComplete
    expect(element.values).toEqual(['usb', 'display'])

    form.reset()
    await element.updateComplete
    expect(element.values).toEqual(['usb'])
  })

  it('restores data options to their initial state on form reset', async () => {
    const form = document.createElement('form')
    const element = document.createElement('fd-multi-select') as FdMultiSelect
    element.name = 'device'
    element.options = [
      { id: 'usb', label: 'USB', isSelected: true },
      { id: 'display', label: 'Display' },
    ]
    form.append(element)
    document.body.append(form)
    await element.updateComplete

    checkboxes(element)[1]?.shadowRoot?.querySelector<HTMLButtonElement>('button')?.click()
    await element.updateComplete
    expect(element.values).toEqual(['usb', 'display'])

    form.reset()
    await element.updateComplete
    expect(element.values).toEqual(['usb'])
  })

  it('restores a multi-value session state', async () => {
    const element = await mount('name="device"')
    const state = new FormData()
    state.append('device', 'display')

    element.formStateRestoreCallback(state)
    await element.updateComplete

    expect(element.values).toEqual(['display'])
  })

  it('restores a multi-value session state for data options', async () => {
    const element = await mount('name="device"')
    element.options = [
      { id: 'usb', label: 'USB', isSelected: true },
      { id: 'display', label: 'Display' },
    ]
    await element.updateComplete
    const state = new FormData()
    state.append('device', 'display')

    element.formStateRestoreCallback(state)
    await element.updateComplete

    expect(element.values).toEqual(['display'])
  })
})
