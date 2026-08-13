import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdTabs } from './fd-tabs.js'
import './fd-tabs.js'

async function mount(markup: string): Promise<FdTabs> {
  const host = document.createElement('div')
  host.innerHTML = markup
  document.body.append(host)
  const element = host.querySelector('fd-tabs') as FdTabs
  await element.updateComplete
  await element.updateComplete
  return element
}

const markup = (attributes = '') => `
  <fd-tabs label="Library areas" value="overview" ${attributes}>
    <fd-option value="overview" symbol="sparkles">Overview</fd-option>
    <fd-option value="components">Components</fd-option>
    <fd-option value="accessibility" disabled>Accessibility</fd-option>
    <section slot="overview"><input value="preserved" /></section>
    <section slot="components">Component reference</section>
    <section slot="accessibility">Accessibility notes</section>
  </fd-tabs>
`

const tabs = (element: FdTabs) => [
  ...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []),
]

const panels = (element: FdTabs) => [
  ...(element.shadowRoot?.querySelectorAll<HTMLElement>('[role="tabpanel"]') ?? []),
]

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-tabs semantics', () => {
  it('accepts Swift-style options directly', async () => {
    const element = await mount(`
      <fd-tabs label="Library areas" value="overview">
        <section slot="overview">Overview</section>
        <section slot="components">Components</section>
      </fd-tabs>
    `)
    element.options = [
      { value: 'overview', label: 'Overview', symbol: 'sparkles' },
      { value: 'components', label: 'Components', isEnabled: false },
    ]
    await element.updateComplete

    expect(tabs(element)).toHaveLength(2)
    expect(tabs(element)[1]?.disabled).toBe(true)
  })

  it('associates every tab with a mounted panel', async () => {
    const element = await mount(markup())
    const controls = tabs(element)
    const content = panels(element)

    expect(controls).toHaveLength(3)
    expect(content).toHaveLength(3)
    expect(controls[0]?.getAttribute('aria-controls')).toBe(content[0]?.id)
    expect(content[0]?.getAttribute('aria-labelledby')).toBe(controls[0]?.id)
    expect(content.map((panel) => panel.hidden)).toEqual([false, true, true])
  })

  it('keeps inactive panel content mounted', async () => {
    const element = await mount(markup())
    const input = element.querySelector('input') as HTMLInputElement
    input.value = 'edited'

    tabs(element)[1]?.click()
    await element.updateComplete
    tabs(element)[0]?.click()
    await element.updateComplete

    expect(input.value).toBe('edited')
  })

  it('reports selection once and does not report the active tab again', async () => {
    const element = await mount(markup())
    const onChange = vi.fn()
    element.addEventListener('fd-change', onChange)

    tabs(element)[1]?.click()
    await element.updateComplete
    tabs(element)[1]?.click()
    await element.updateComplete

    expect(element.value).toBe('components')
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({ value: 'components' })
  })
})

describe('fd-tabs keyboard navigation', () => {
  it('uses roving focus and skips disabled tabs', async () => {
    const element = await mount(markup())
    const controls = tabs(element)
    controls[0]?.focus()
    controls[0]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }),
    )
    await element.updateComplete

    expect(element.value).toBe('components')
    expect(element.shadowRoot?.activeElement).toBe(tabs(element)[1])
  })

  it('resolves horizontal navigation from writing direction', async () => {
    const element = await mount(markup('dir="rtl"'))
    const first = tabs(element)[0]
    first?.focus()
    first?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }),
    )
    await element.updateComplete

    expect(element.value).toBe('components')
  })

  it('supports Home and End without landing on a disabled option', async () => {
    const element = await mount(markup())
    const first = tabs(element)[0]
    first?.focus()
    first?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }),
    )
    await element.updateComplete

    expect(element.value).toBe('components')
  })
})

describe('fd-tabs presentation', () => {
  it('supports both SwiftUI visual variants', async () => {
    const element = await mount(markup('tabs-style="softSurface"'))
    expect(tabs(element).every((tab) => tab.dataset.style === 'softSurface')).toBe(true)

    element.tabsStyle = 'underline'
    await element.updateComplete
    expect(tabs(element).every((tab) => tab.dataset.style === 'underline')).toBe(true)
  })

  it('equalizes widths without measuring on every selection', async () => {
    const element = await mount(markup('style="width:600px" sizing="equal"'))
    const widths = tabs(element).map((tab) => tab.getBoundingClientRect().width)

    expect(widths[0]).toBeCloseTo(widths[1] ?? 0, 1)
    expect(widths[1]).toBeCloseTo(widths[2] ?? 0, 1)
  })

  it('lets fit-content tabs retain distinct intrinsic widths', async () => {
    const element = await mount(markup('style="width:600px" sizing="fitContent"'))
    const widths = tabs(element).map((tab) => tab.getBoundingClientRect().width)

    expect(widths[1]).toBeGreaterThan(widths[0] ?? 0)
  })

  it('renders icon and text labels without depending on icon registration', async () => {
    const element = await mount(markup('label-content="iconAndText"'))
    expect(tabs(element)[0]?.querySelector('fd-icon')).not.toBeNull()
    expect(tabs(element)[0]?.textContent).toContain('Overview')
  })
})
