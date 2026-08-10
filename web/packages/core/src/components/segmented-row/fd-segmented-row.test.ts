import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdSymbolSegmentedRow } from '../symbol-segmented-row/fd-symbol-segmented-row.js'
import '../symbol-segmented-row/fd-symbol-segmented-row.js'
import { FdIcons } from '../../internal/icon-registry.js'
import type { FdSegmentedRow } from './fd-segmented-row.js'
import './fd-segmented-row.js'

const OPTIONS = `
  <fd-option value="left">Leading</fd-option>
  <fd-option value="center">Centre</fd-option>
  <fd-option value="right">Trailing</fd-option>
`

async function mount<T extends HTMLElement>(markup: string): Promise<T> {
  const host = document.createElement('div')
  host.innerHTML = markup
  document.body.append(host)
  const element = host.firstElementChild as T & { updateComplete: Promise<unknown> }
  await element.updateComplete
  await element.updateComplete
  return element
}

const segments = (element: HTMLElement) =>
  [...(element.shadowRoot?.querySelectorAll('.segment') ?? [])] as HTMLButtonElement[]

afterEach(() => {
  FdIcons.clear()
  document.body.replaceChildren()
})

describe('fd-segmented-row', () => {
  it('renders one segment per option', async () => {
    const element = await mount<FdSegmentedRow>(
      `<fd-segmented-row label="Alignment" value="center">${OPTIONS}</fd-segmented-row>`,
    )
    expect(segments(element).map((segment) => segment.textContent?.trim())).toEqual([
      'Leading',
      'Centre',
      'Trailing',
    ])
  })

  it('marks only the selected segment', async () => {
    const element = await mount<FdSegmentedRow>(
      `<fd-segmented-row label="Alignment" value="center">${OPTIONS}</fd-segmented-row>`,
    )
    expect(segments(element).map((segment) => segment.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ])
    expect(element.selectedIndex).toBe(1)
  })

  it('selects on click and reports the value', async () => {
    const element = await mount<FdSegmentedRow>(
      `<fd-segmented-row label="Alignment" value="center">${OPTIONS}</fd-segmented-row>`,
    )
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)

    segments(element)[2]?.click()
    await element.updateComplete

    expect(element.value).toBe('right')
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({ value: 'right' })
  })

  it('stays silent when the selected segment is clicked again', async () => {
    const element = await mount<FdSegmentedRow>(
      `<fd-segmented-row label="Alignment" value="center">${OPTIONS}</fd-segmented-row>`,
    )
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)

    segments(element)[1]?.click()
    await element.updateComplete

    expect(onChange).not.toHaveBeenCalled()
  })

  it('is a radio group with a single tab stop', async () => {
    const element = await mount<FdSegmentedRow>(
      `<fd-segmented-row label="Alignment" value="center">${OPTIONS}</fd-segmented-row>`,
    )
    const strip = element.shadowRoot?.querySelector('.strip') as HTMLElement

    expect(strip.getAttribute('role')).toBe('radiogroup')
    expect(strip.getAttribute('aria-label')).toBe('Alignment')
    expect(segments(element).map((segment) => segment.tabIndex)).toEqual([-1, 0, -1])
  })

  it('moves the selection with the arrow keys, wrapping at the ends', async () => {
    const element = await mount<FdSegmentedRow>(
      `<fd-segmented-row label="Alignment" value="center">${OPTIONS}</fd-segmented-row>`,
    )
    const strip = element.shadowRoot?.querySelector('.strip') as HTMLElement
    const press = async (key: string) => {
      strip.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      await element.updateComplete
    }

    await press('ArrowRight')
    expect(element.value).toBe('right')

    await press('ArrowRight')
    expect(element.value).toBe('left')

    await press('ArrowLeft')
    expect(element.value).toBe('right')
  })

  it('takes the 300px control width by default and follows an override', async () => {
    const element = await mount<FdSegmentedRow>(
      `<fd-segmented-row label="Alignment" value="center">${OPTIONS}</fd-segmented-row>`,
    )
    const strip = element.shadowRoot?.querySelector('.strip') as HTMLElement
    expect(strip.getBoundingClientRect().width).toBe(300)

    element.controlWidth = 180
    await element.updateComplete
    expect(strip.getBoundingClientRect().width).toBe(180)
  })

  it('shares the width equally between segments, with the 6px gap', async () => {
    const element = await mount<FdSegmentedRow>(
      `<fd-segmented-row label="Alignment" value="center">${OPTIONS}</fd-segmented-row>`,
    )
    const rects = segments(element).map((segment) => segment.getBoundingClientRect())

    expect(rects[0]?.width).toBeCloseTo(rects[1]?.width ?? 0, 1)
    expect(Math.round((rects[1]?.left ?? 0) - (rects[0]?.right ?? 0))).toBe(6)
  })

  it('uses the reusable control 9px horizontal padding', async () => {
    const element = await mount<FdSegmentedRow>(
      `<fd-segmented-row label="Alignment" value="center">${OPTIONS}</fd-segmented-row>`,
    )
    const style = getComputedStyle(segments(element)[0] as Element)

    expect(style.paddingLeft).toBe('9px')
    expect(style.paddingTop).toBe('7px')
    expect(style.borderRadius).toBe('9px')
  })

  it('renders a symbol option through the shared icon registry', async () => {
    FdIcons.register({ left: '<svg></svg>' })
    const element = await mount<FdSegmentedRow>(
      '<fd-segmented-row label="Alignment" value="left"><fd-option value="left" symbol="left">Leading</fd-option><fd-option value="right">Trailing</fd-option></fd-segmented-row>',
    )

    expect(segments(element)[0]?.querySelector('fd-icon')).not.toBeNull()
    expect(segments(element)[1]?.textContent?.trim()).toBe('Trailing')
  })

  it('participates in a form', async () => {
    const form = document.createElement('form')
    form.innerHTML = `<fd-segmented-row name="align" label="Alignment" value="center">${OPTIONS}</fd-segmented-row>`
    document.body.append(form)
    const element = form.firstElementChild as FdSegmentedRow
    await element.updateComplete
    await element.updateComplete

    expect(new FormData(form).get('align')).toBe('center')
  })
})

describe('fd-symbol-segmented-row', () => {
  const SYMBOL_OPTIONS = `
    <fd-option value="list" symbol="list">List</fd-option>
    <fd-option value="grid" symbol="grid">Grid</fd-option>
    <fd-option value="plain">Plain</fd-option>
  `

  it('draws an icon where one is given and the label otherwise', async () => {
    FdIcons.register({ list: '<svg></svg>', grid: '<svg></svg>' })
    const element = await mount<FdSymbolSegmentedRow>(
      `<fd-symbol-segmented-row label="Layout" value="list">${SYMBOL_OPTIONS}</fd-symbol-segmented-row>`,
    )
    const rows = segments(element)

    expect(rows[0]?.querySelector('fd-icon')).not.toBeNull()
    expect(rows[2]?.querySelector('fd-icon')).toBeNull()
    expect(rows[2]?.textContent?.trim()).toBe('Plain')
  })

  it('uses the label as tooltip and accessible name', async () => {
    const element = await mount<FdSymbolSegmentedRow>(
      `<fd-symbol-segmented-row label="Layout" value="list">${SYMBOL_OPTIONS}</fd-symbol-segmented-row>`,
    )
    expect(segments(element)[0]?.title).toBe('List')
  })

  it('takes the taller 8px vertical padding', async () => {
    const element = await mount<FdSymbolSegmentedRow>(
      `<fd-symbol-segmented-row label="Layout" value="list">${SYMBOL_OPTIONS}</fd-symbol-segmented-row>`,
    )
    const style = getComputedStyle(segments(element)[0] as Element)

    expect(style.paddingTop).toBe('8px')
    expect(style.paddingLeft).toBe('6px')
  })
})
