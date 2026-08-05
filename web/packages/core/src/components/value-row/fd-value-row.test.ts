import { afterEach, describe, expect, it } from 'vitest'
import type { FdValueRow } from './fd-value-row.js'
import './fd-value-row.js'

async function mount(html: string): Promise<FdValueRow> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const element = host.firstElementChild as FdValueRow
  await element.updateComplete
  return element
}

const partOf = (element: FdValueRow, selector: string) =>
  element.shadowRoot?.querySelector(selector) as HTMLElement

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-value-row', () => {
  it('renders the value at the trailing edge in the value text role', async () => {
    const element = await mount('<fd-value-row label="Version" value="1.4.2"></fd-value-row>')
    const value = partOf(element, '.value')

    expect(value.textContent).toBe('1.4.2')
    expect(getComputedStyle(value).fontSize).toBe('12.5px')
  })

  /** truncationMode(.middle): the tail is held back so it can never be clipped. */
  it('splits the value so the last characters survive truncation', async () => {
    const element = await mount(
      '<fd-value-row label="Path" value="/Users/ada/Library/Application Support/flowing-day.json"></fd-value-row>',
    )

    expect(partOf(element, '.truncate-tail').textContent).toBe('day.json')
    expect(partOf(element, '.truncate-head').textContent).toBe(
      '/Users/ada/Library/Application Support/flowing-',
    )
  })

  it('honours a custom tail length', async () => {
    const element = await mount(
      '<fd-value-row label="Key" value="ABCDEFGHIJ" tail-length="3"></fd-value-row>',
    )

    expect(partOf(element, '.truncate-head').textContent).toBe('ABCDEFG')
    expect(partOf(element, '.truncate-tail').textContent).toBe('HIJ')
  })

  it('keeps a value shorter than the tail whole', async () => {
    const element = await mount('<fd-value-row label="Version" value="1.4"></fd-value-row>')

    expect(partOf(element, '.truncate-head').textContent).toBe('')
    expect(partOf(element, '.truncate-tail').textContent).toBe('1.4')
  })

  it('ellipsises the head rather than wrapping', async () => {
    const element = await mount(
      '<fd-value-row label="Path" value="/a/very/long/path"></fd-value-row>',
    )
    const head = getComputedStyle(partOf(element, '.truncate-head'))

    expect(head.textOverflow).toBe('ellipsis')
    expect(head.overflow).toBe('hidden')
    expect(getComputedStyle(partOf(element, '.value')).whiteSpace).toBe('nowrap')
  })

  it('actually compresses inside a narrow row instead of overflowing', async () => {
    const element = await mount(
      '<fd-value-row label="Path" value="/Users/ada/Library/Application Support/flowing-day.json"></fd-value-row>',
    )
    element.style.width = '260px'
    await element.updateComplete

    const row = element.getBoundingClientRect()
    const value = partOf(element, '.value').getBoundingClientRect()
    expect(value.right).toBeLessThanOrEqual(row.right + 1)
  })

  it('leaves the value selectable', async () => {
    const element = await mount('<fd-value-row label="Version" value="1.4.2"></fd-value-row>')
    expect(getComputedStyle(partOf(element, '.value')).userSelect).toBe('text')
  })

  it('places a trailing control 10px after the value', async () => {
    const element = await mount(
      '<fd-value-row label="Version" value="1.4.2"><span slot="trailing" style="width:20px">x</span></fd-value-row>',
    )
    expect(getComputedStyle(partOf(element, '.value-group')).columnGap).toBe('10px')
    expect(element.querySelector('[slot="trailing"]')).not.toBeNull()
  })
})
