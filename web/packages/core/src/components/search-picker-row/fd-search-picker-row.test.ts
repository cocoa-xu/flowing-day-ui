import { afterEach, describe, expect, it } from 'vitest'
import type { FdSearchPickerRow } from './fd-search-picker-row.js'
import './fd-search-picker-row.js'

const OPTIONS = ['Amsterdam', 'Berlin', 'Copenhagen', 'Dublin', 'Edinburgh', 'Florence', 'Geneva']

async function mount(attributes = '', options = OPTIONS): Promise<FdSearchPickerRow> {
  const host = document.createElement('div')
  host.innerHTML = `<fd-search-picker-row label="City" ${attributes}>${options
    .map((label) => `<fd-option value="${label.toLowerCase()}" label="${label}"></fd-option>`)
    .join('')}</fd-search-picker-row>`
  document.body.append(host)
  const element = host.firstElementChild as FdSearchPickerRow
  await element.updateComplete
  // Options arrive on slotchange, a frame after the first render.
  await element.updateComplete
  return element
}

const partOf = (element: FdSearchPickerRow, selector: string) =>
  element.shadowRoot?.querySelector(selector) as HTMLElement

const optionsOf = (element: FdSearchPickerRow) => [
  ...(element.shadowRoot?.querySelectorAll('.option') ?? []),
]

async function search(element: FdSearchPickerRow, query: string): Promise<void> {
  const input = partOf(element, '.query') as HTMLInputElement
  input.value = query
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await element.updateComplete
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-search-picker-row', () => {
  it('collects fd-option children', async () => {
    const element = await mount()
    expect(optionsOf(element)).toHaveLength(7)
  })

  it('shows an em dash until something is selected', async () => {
    const element = await mount()
    expect(partOf(element, '.selected').textContent).toBe('—')

    element.value = 'berlin'
    await element.updateComplete
    expect(partOf(element, '.selected').textContent).toBe('Berlin')
  })

  it('keeps the header at the SettingsRow geometry', async () => {
    const element = await mount()
    const style = getComputedStyle(partOf(element, '.row'))

    expect(style.paddingTop).toBe('10px')
    expect(style.paddingLeft).toBe('18px')
    expect(style.minHeight).toBe('42px')
    expect(style.columnGap).toBe('14px')
  })

  it('grows to 11px vertical padding once a caption is present', async () => {
    const element = await mount('caption="Where you are."')
    expect(getComputedStyle(partOf(element, '.row')).paddingTop).toBe('11px')
  })

  it('stays collapsed until the header is pressed', async () => {
    const element = await mount()
    expect(getComputedStyle(partOf(element, '.reveal')).gridTemplateRows).toBe('0px')

    partOf(element, '.row').click()
    await element.updateComplete
    expect(element.expanded).toBe(true)
    expect(partOf(element, '.row').getAttribute('aria-expanded')).toBe('true')
  })

  it('turns the chevron over 0.18s', async () => {
    const element = await mount()
    const style = getComputedStyle(partOf(element, '.chevron'))

    expect(style.transitionDuration).toBe('0.18s')
    expect(style.width).toBe('9px')
  })

  it('filters the list as the query narrows it', async () => {
    const element = await mount()
    partOf(element, '.row').click()
    await element.updateComplete

    await search(element, 'in')
    expect(optionsOf(element).map((option) => option.textContent?.trim())).toEqual([
      'Berlin',
      'Dublin',
      'Edinburgh',
    ])
  })

  it('matches case insensitively', async () => {
    const element = await mount()
    partOf(element, '.row').click()
    await element.updateComplete

    await search(element, 'BERL')
    expect(optionsOf(element)).toHaveLength(1)
  })

  it('shows the no-results message when nothing matches', async () => {
    const element = await mount()
    partOf(element, '.row').click()
    await element.updateComplete

    await search(element, 'Reykjavik')
    expect(partOf(element, '.empty').textContent?.trim()).toBe('No Results')
    expect(element.shadowRoot?.querySelector('.list')).toBeNull()
  })

  /** optionListHeight = min(count, maximumVisibleOptions) * 34 */
  it('sizes the list to at most the visible option count', async () => {
    const element = await mount('expanded')
    expect(partOf(element, '.list').style.height).toBe('204px')

    await search(element, 'in')
    expect(partOf(element, '.list').style.height).toBe('102px')
  })

  it('honours a custom maximum, floored at one', async () => {
    const element = await mount('expanded max-visible-options="3"')
    expect(partOf(element, '.list').style.height).toBe('102px')

    element.maxVisibleOptions = 0
    await element.updateComplete
    expect(partOf(element, '.list').style.height).toBe('34px')
  })

  it('selects, clears the query and collapses', async () => {
    const element = await mount('expanded')
    await search(element, 'ber')

    const values: string[] = []
    element.addEventListener('fd-change', (event) => {
      values.push(event.detail.value as string)
    })
    ;(optionsOf(element)[0] as HTMLElement).click()
    await element.updateComplete

    expect(values).toEqual(['berlin'])
    expect(element.value).toBe('berlin')
    expect(element.expanded).toBe(false)
    expect((partOf(element, '.query') as HTMLInputElement).value).toBe('')
  })

  it('clears the query when the header closes it again', async () => {
    const element = await mount('expanded')
    await search(element, 'ber')

    partOf(element, '.row').click()
    await element.updateComplete

    expect(element.expanded).toBe(false)
    expect(optionsOf(element)).toHaveLength(7)
  })

  it('marks the selected option and gives it the accent wash', async () => {
    const element = await mount('expanded value="dublin"')
    const selected = optionsOf(element).find(
      (option) => option.getAttribute('aria-selected') === 'true',
    ) as HTMLElement

    expect(selected.textContent?.trim()).toBe('Dublin')
    expect(selected.querySelector('.check')).not.toBeNull()
    expect(getComputedStyle(selected).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  it('names the header by its label and current selection', async () => {
    const element = await mount('value="geneva"')
    expect(partOf(element, '.row').getAttribute('aria-label')).toBe('City, Geneva')
  })

  it('submits with a form and restores on reset', async () => {
    const form = document.createElement('form')
    document.body.append(form)
    form.innerHTML =
      '<fd-search-picker-row name="city" label="City" value="berlin"><fd-option value="berlin" label="Berlin"></fd-option></fd-search-picker-row>'
    const element = form.firstElementChild as FdSearchPickerRow
    await element.updateComplete

    expect(new FormData(form).get('city')).toBe('berlin')

    element.value = 'dublin'
    await element.updateComplete
    expect(new FormData(form).get('city')).toBe('dublin')

    form.reset()
    await element.updateComplete
    expect(element.value).toBe('berlin')
  })

  it('stays shut while disabled', async () => {
    const element = await mount('disabled')
    partOf(element, '.row').click()
    await element.updateComplete

    expect(element.expanded).toBe(false)
  })
})
