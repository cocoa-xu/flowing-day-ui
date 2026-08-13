import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdConnectedSegmentedControl } from '../connected-segmented-control/fd-connected-segmented-control.js'
import '../connected-segmented-control/fd-connected-segmented-control.js'
import type { FdSegmentedControl } from './fd-segmented-control.js'
import './fd-segmented-control.js'

const OPTIONS = `
  <fd-option value="small">Small</fd-option>
  <fd-option value="medium">Medium</fd-option>
  <fd-option value="large">Large</fd-option>
`

const SYMBOL_OPTIONS = `
  <fd-option value="vertical" label="Vertical" symbol="vertical"></fd-option>
  <fd-option value="horizontal" label="Horizontal" symbol="horizontal"></fd-option>
`

async function mount<T extends FdSegmentedControl | FdConnectedSegmentedControl>(
  tag: string,
  attributes = '',
): Promise<T> {
  const host = document.createElement('div')
  host.innerHTML = `<${tag} label="Size" value="medium" ${attributes}>${OPTIONS}</${tag}>`
  document.body.append(host)
  const element = host.firstElementChild as T
  await element.updateComplete
  await element.updateComplete
  return element
}

const segments = (element: FdSegmentedControl | FdConnectedSegmentedControl) =>
  [...(element.shadowRoot?.querySelectorAll('.segment') ?? [])] as HTMLButtonElement[]

afterEach(() => {
  document.body.replaceChildren()
})

describe('segmented control primitives', () => {
  it('uses radio-group semantics and one selected segment', async () => {
    const element = await mount<FdSegmentedControl>('fd-segmented-control')
    const control = element.shadowRoot?.querySelector('.strip') as HTMLElement

    expect(control.getAttribute('role')).toBe('radiogroup')
    expect(control.getAttribute('aria-label')).toBe('Size')
    expect(segments(element).map((segment) => segment.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ])
  })

  it('selects on click and emits its value', async () => {
    const element = await mount<FdSegmentedControl>('fd-segmented-control')
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)

    segments(element)[2]?.click()
    await element.updateComplete

    expect(element.value).toBe('large')
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({ value: 'large' })
  })

  it('moves through options with the arrow keys', async () => {
    const element = await mount<FdSegmentedControl>('fd-segmented-control')
    const control = element.shadowRoot?.querySelector('.strip') as HTMLElement

    control.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await element.updateComplete
    expect(element.value).toBe('large')

    control.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await element.updateComplete
    expect(element.value).toBe('small')
  })

  it('reverses horizontal keyboard movement in RTL', async () => {
    const element = await mount<FdSegmentedControl>('fd-segmented-control', 'dir="rtl"')
    const control = element.shadowRoot?.querySelector('.strip') as HTMLElement

    control.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await element.updateComplete
    expect(element.value).toBe('small')
  })

  it('draws the connected variant on one shared surface', async () => {
    const element = await mount<FdConnectedSegmentedControl>('fd-connected-segmented-control')
    const control = element.shadowRoot?.querySelector('.strip') as HTMLElement

    expect(control.hasAttribute('data-connected')).toBe(true)
    expect(getComputedStyle(control).columnGap).toBe('0px')
  })

  it('can show an icon and label together', async () => {
    const host = document.createElement('div')
    host.innerHTML = `<fd-connected-segmented-control label="Layout" value="horizontal" label-style="icon-and-text">${SYMBOL_OPTIONS}</fd-connected-segmented-control>`
    document.body.append(host)
    const element = host.firstElementChild as FdConnectedSegmentedControl
    await element.updateComplete
    await element.updateComplete

    expect(element.shadowRoot?.querySelectorAll('.segment-icon')).toHaveLength(2)
    expect(element.shadowRoot?.querySelectorAll('.segment-label')).toHaveLength(2)
  })

  it('supports explicit text-only and icon-only labels', async () => {
    const host = document.createElement('div')
    host.innerHTML = `<fd-segmented-control label="Layout" value="horizontal" label-style="text-only">${SYMBOL_OPTIONS}</fd-segmented-control>`
    document.body.append(host)
    const element = host.firstElementChild as FdSegmentedControl
    await element.updateComplete
    await element.updateComplete

    expect(element.shadowRoot?.querySelectorAll('.segment-icon')).toHaveLength(0)
    expect(element.shadowRoot?.querySelectorAll('.segment-label')).toHaveLength(2)

    element.labelStyle = 'icon-only'
    await element.updateComplete

    expect(element.shadowRoot?.querySelectorAll('.segment-icon')).toHaveLength(2)
    expect(element.shadowRoot?.querySelectorAll('.segment-label')).toHaveLength(0)
  })

  it('participates in form submission', async () => {
    const form = document.createElement('form')
    form.innerHTML = `<fd-segmented-control name="size" label="Size" value="medium">${OPTIONS}</fd-segmented-control>`
    document.body.append(form)
    const element = form.firstElementChild as FdSegmentedControl
    await element.updateComplete
    await element.updateComplete

    expect(new FormData(form).get('size')).toBe('medium')
  })
})
