import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdConnectedSegmentedRow } from './fd-connected-segmented-row.js'
import '../option/fd-option.js'
import './fd-connected-segmented-row.js'

const OPTIONS = `
  <fd-option value="select">Select</fd-option>
  <fd-option value="pan">Pan</fd-option>
  <fd-option value="connect">Connect</fd-option>
`

async function mount(value = 'pan', options = OPTIONS): Promise<FdConnectedSegmentedRow> {
  const host = document.createElement('div')
  host.innerHTML = `<fd-connected-segmented-row label="Canvas tool" value="${value}">${options}</fd-connected-segmented-row>`
  document.body.append(host)
  const element = host.firstElementChild as FdConnectedSegmentedRow
  await element.updateComplete
  await element.updateComplete
  return element
}

const segments = (element: FdConnectedSegmentedRow) => [
  ...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>('.segment') ?? []),
]

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-connected-segmented-row', () => {
  it('renders one connected equal-width surface', async () => {
    const element = await mount()
    const strip = element.shadowRoot?.querySelector('.strip') as HTMLElement
    const buttons = segments(element)
    const rects = buttons.map((button) => button.getBoundingClientRect())

    expect(strip.hasAttribute('data-connected')).toBe(true)
    expect(getComputedStyle(strip).gap).toBe('0px')
    expect(rects[0]?.width).toBeCloseTo(rects[1]?.width ?? 0, 1)
    expect(rects[1]?.left).toBeCloseTo(rects[0]?.right ?? 0, 1)
  })

  it('hides only the dividers adjacent to the selection', async () => {
    const element = await mount('pan')

    expect(segments(element).map((segment) => segment.hasAttribute('data-hide-divider'))).toEqual([
      true,
      true,
      false,
    ])
  })

  it('selects immediately and reports the new value', async () => {
    const element = await mount()
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)

    segments(element)[2]?.click()
    await element.updateComplete

    expect(element.value).toBe('connect')
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({ value: 'connect' })
  })

  it('preserves radio-group keyboard navigation', async () => {
    const element = await mount('connect')
    const strip = element.shadowRoot?.querySelector('.strip') as HTMLElement

    strip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await element.updateComplete

    expect(element.value).toBe('select')
    expect(segments(element).map((segment) => segment.tabIndex)).toEqual([0, -1, -1])
  })

  it('skips disabled options during keyboard navigation', async () => {
    const element = await mount(
      'select',
      `
        <fd-option value="select">Select</fd-option>
        <fd-option value="pan" disabled>Pan</fd-option>
        <fd-option value="connect">Connect</fd-option>
      `,
    )
    const strip = element.shadowRoot?.querySelector('.strip') as HTMLElement

    strip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await element.updateComplete

    expect(element.value).toBe('connect')
  })

  it('does not select a disabled option by pointer', async () => {
    const element = await mount(
      'select',
      `
        <fd-option value="select">Select</fd-option>
        <fd-option value="pan" disabled>Pan</fd-option>
        <fd-option value="connect">Connect</fd-option>
      `,
    )

    segments(element)[1]?.click()
    await element.updateComplete

    expect(element.value).toBe('select')
  })
})
