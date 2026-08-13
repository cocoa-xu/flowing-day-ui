import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import type { FdCheckToggle } from '../check-toggle/fd-check-toggle.js'
import '../check-toggle/fd-check-toggle.js'
import type { FdCheckbox } from '../checkbox/fd-checkbox.js'
import type { FdMultiSelect } from '../multi-select/fd-multi-select.js'
import type { FdOption } from '../option/fd-option.js'
import type { FdMultiSelectRow } from './fd-multi-select-row.js'
import './fd-multi-select-row.js'

const OPTIONS = `
  <fd-option value="activity" selected>Activity</fd-option>
  <fd-option value="chart">Chart</fd-option>
  <fd-option value="peaks" disabled>Peaks</fd-option>
`

async function mount<T extends HTMLElement>(markup: string): Promise<T> {
  const host = document.createElement('div')
  host.innerHTML = markup
  document.body.append(host)
  const element = host.firstElementChild as T & { updateComplete: Promise<unknown> }
  await element.updateComplete
  await element.updateComplete
  if (element.localName === 'fd-multi-select-row') {
    await settleMultiSelect(element)
  }
  return element
}

const multiSelectOf = (element: HTMLElement) =>
  element.shadowRoot?.querySelector('fd-multi-select') as FdMultiSelect

const checkboxes = (element: HTMLElement) =>
  [...(multiSelectOf(element).shadowRoot?.querySelectorAll('fd-checkbox') ?? [])] as FdCheckbox[]

const segments = (element: HTMLElement) =>
  checkboxes(element).map(
    (checkbox) => checkbox.shadowRoot?.querySelector('.button') as HTMLButtonElement,
  )

async function settleMultiSelect(element: HTMLElement): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  const primitive = multiSelectOf(element)
  await primitive.updateComplete
  await primitive.updateComplete
  await Promise.all(checkboxes(element).map((checkbox) => checkbox.updateComplete))
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-multi-select-row', () => {
  it("reflects each option's own state", async () => {
    const element = await mount<FdMultiSelectRow>(
      `<fd-multi-select-row label="Network">${OPTIONS}</fd-multi-select-row>`,
    )
    expect(segments(element).map((segment) => segment.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
    ])
    expect(element.values).toEqual(['activity'])
  })

  it('toggles options independently rather than as a single selection', async () => {
    const element = await mount<FdMultiSelectRow>(
      `<fd-multi-select-row label="Network">${OPTIONS}</fd-multi-select-row>`,
    )

    segments(element)[1]?.click()
    await element.updateComplete

    expect(element.values).toEqual(['activity', 'chart'])
  })

  it('writes the state back onto the option element', async () => {
    const element = await mount<FdMultiSelectRow>(
      `<fd-multi-select-row label="Network">${OPTIONS}</fd-multi-select-row>`,
    )
    const chart = element.querySelectorAll('fd-option')[1] as FdOption

    segments(element)[1]?.click()
    await element.updateComplete

    expect(chart.selected).toBe(true)
    expect(chart.hasAttribute('selected')).toBe(true)
  })

  it('reports which option changed alongside the whole set', async () => {
    const element = await mount<FdMultiSelectRow>(
      `<fd-multi-select-row label="Network">${OPTIONS}</fd-multi-select-row>`,
    )
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)

    segments(element)[0]?.click()
    await element.updateComplete

    expect(onChange.mock.calls[0]?.[0].detail).toEqual({
      value: 'activity',
      selected: false,
      values: [],
    })
  })

  /** PreferencesMultiSelectOption.toggle() guards on isEnabled. */
  it('refuses to toggle a disabled option', async () => {
    const element = await mount<FdMultiSelectRow>(
      `<fd-multi-select-row label="Network">${OPTIONS}</fd-multi-select-row>`,
    )
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)

    expect(segments(element)[2]?.disabled).toBe(true)
    segments(element)[2]?.click()
    await element.updateComplete

    expect(element.values).toEqual(['activity'])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('groups the options for assistive technology', async () => {
    const element = await mount<FdMultiSelectRow>(
      `<fd-multi-select-row label="Network">${OPTIONS}</fd-multi-select-row>`,
    )
    const strip = multiSelectOf(element).shadowRoot?.querySelector('.group') as HTMLElement

    expect(strip.getAttribute('role')).toBe('group')
    expect(segments(element)[0]?.getAttribute('aria-label')).toBe('Activity')
    expect(page.getByRole('checkbox', { name: 'Activity', checked: true }).elements()).toHaveLength(
      1,
    )
    expect(page.getByRole('checkbox', { name: 'Chart', checked: false }).elements()).toHaveLength(1)
  })

  it('submits every selected value under one name', async () => {
    const form = document.createElement('form')
    form.innerHTML = `<fd-multi-select-row name="net" label="Network">${OPTIONS}</fd-multi-select-row>`
    document.body.append(form)
    const element = form.firstElementChild as FdMultiSelectRow
    await element.updateComplete
    await element.updateComplete
    await settleMultiSelect(element)

    segments(element)[1]?.click()
    await element.updateComplete

    expect(new FormData(form).getAll('net')).toEqual(['activity', 'chart'])
  })
})

describe('fd-check-toggle', () => {
  it('takes its label from text content and toggles', async () => {
    const element = await mount<FdCheckToggle>('<fd-check-toggle>Peaks</fd-check-toggle>')
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)

    const checkbox = element.shadowRoot?.querySelector('fd-checkbox') as FdCheckbox
    expect(checkbox.label).toBe('Peaks')

    checkbox.shadowRoot?.querySelector<HTMLButtonElement>('.button')?.click()
    await element.updateComplete

    expect(element.checked).toBe(true)
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({ checked: true })
  })

  it('restores its initial state on form reset', async () => {
    const form = document.createElement('form')
    form.innerHTML = '<fd-check-toggle name="peaks" checked>Peaks</fd-check-toggle>'
    document.body.append(form)
    const element = form.firstElementChild as FdCheckToggle
    await element.updateComplete

    expect(new FormData(form).get('peaks')).toBe('on')

    element.checked = false
    await element.updateComplete
    form.reset()
    await element.updateComplete

    expect(element.checked).toBe(true)
  })

  it('supports trailing indicators and compact width', async () => {
    const element = await mount<FdCheckToggle>(
      '<fd-check-toggle indicator-placement="trailing" width-policy="fitContent" maximum-width="120">Peaks</fd-check-toggle>',
    )
    const checkbox = element.shadowRoot?.querySelector('fd-checkbox') as FdCheckbox
    const button = checkbox.shadowRoot?.querySelector('.button') as HTMLButtonElement

    expect(button.lastElementChild?.getAttribute('part')).toBe('indicator')
    expect(element.getBoundingClientRect().width).toBeLessThanOrEqual(120)
  })
})
