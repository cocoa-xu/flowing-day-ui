import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdTextField } from '../text-field/fd-text-field.js'
import type { FdSearchPicker } from './fd-search-picker.js'
import './fd-search-picker.js'

const OPTIONS = `
  <fd-option value="amsterdam">Amsterdam</fd-option>
  <fd-option value="berlin">Berlin</fd-option>
  <fd-option value="copenhagen">Copenhagen</fd-option>
  <fd-option value="dublin">Dublin</fd-option>
  <fd-option value="edinburgh">Edinburgh</fd-option>
  <fd-option value="florence">Florence</fd-option>
  <fd-option value="geneva">Geneva</fd-option>
`

async function mount(attributes = ''): Promise<FdSearchPicker> {
  const host = document.createElement('div')
  host.innerHTML = `<fd-search-picker label="City" ${attributes}>${OPTIONS}</fd-search-picker>`
  document.body.append(host)
  const element = host.firstElementChild as FdSearchPicker
  await element.updateComplete
  await element.updateComplete
  return element
}

const optionsOf = (element: FdSearchPicker) => [
  ...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>('.option') ?? []),
]

async function search(element: FdSearchPicker, query: string): Promise<void> {
  const field = element.shadowRoot?.querySelector('fd-text-field') as FdTextField
  const input = field.shadowRoot?.querySelector('input') as HTMLInputElement
  input.value = query
  input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }))
  await field.updateComplete
  await element.updateComplete
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-search-picker', () => {
  it('accepts Swift-style option values directly', async () => {
    const element = await mount()
    element.options = [
      { value: 'tokyo', label: 'Tokyo' },
      { value: 'kyoto', label: 'Kyoto' },
    ]
    await element.updateComplete

    expect(element.filteredOptions.map((option) => option.label)).toEqual(['Tokyo', 'Kyoto'])
  })

  it('renders and filters options', async () => {
    const element = await mount()
    expect(optionsOf(element)).toHaveLength(7)

    await search(element, 'in')
    expect(optionsOf(element).map((option) => option.textContent?.trim())).toEqual([
      'Berlin',
      'Dublin',
      'Edinburgh',
    ])
  })

  it('publishes externally observable query changes', async () => {
    const element = await mount()
    const onQuery = vi.fn()
    element.addEventListener('fd-query-change', onQuery)

    await search(element, 'ber')
    expect(element.query).toBe('ber')
    expect(onQuery.mock.calls[0]?.[0].detail).toEqual({ query: 'ber' })
  })

  it('selects an option, clears the query and emits its value', async () => {
    const element = await mount()
    const onChange = vi.fn()
    const onQuery = vi.fn()
    element.addEventListener('fd-change', onChange)
    element.addEventListener('fd-query-change', onQuery)
    await search(element, 'ber')

    optionsOf(element)[0]?.click()
    await element.updateComplete

    expect(element.value).toBe('berlin')
    expect(element.query).toBe('')
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({ value: 'berlin' })
    expect(onQuery.mock.calls.map(([event]) => event.detail)).toEqual([
      { query: 'ber' },
      { query: '' },
    ])
  })

  it('limits the visible list height', async () => {
    const element = await mount('maximum-visible-options="3"')
    const list = element.shadowRoot?.querySelector('.list') as HTMLElement
    expect(list.style.height).toBe('102px')
  })

  it('reveals the selected option without moving an outer scroller', async () => {
    const element = await mount('value="geneva" maximum-visible-options="3"')
    const list = element.shadowRoot?.querySelector('.list') as HTMLElement

    expect(list.scrollTop).toBeGreaterThan(0)
  })

  it('moves keyboard focus from search into the list', async () => {
    const element = await mount()
    const field = element.shadowRoot?.querySelector('fd-text-field') as FdTextField
    const input = field.shadowRoot?.querySelector('input') as HTMLInputElement
    input.focus()
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }),
    )

    expect(element.shadowRoot?.activeElement).toBe(optionsOf(element)[0])
  })

  it('participates in a form', async () => {
    const form = document.createElement('form')
    form.innerHTML = `<fd-search-picker name="city" label="City" value="berlin">${OPTIONS}</fd-search-picker>`
    document.body.append(form)
    const element = form.firstElementChild as FdSearchPicker
    await element.updateComplete

    expect(new FormData(form).get('city')).toBe('berlin')
  })
})
