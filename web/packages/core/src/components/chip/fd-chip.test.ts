import { afterEach, describe, expect, it } from 'vitest'
import type { FdChip } from './fd-chip.js'
import './fd-chip.js'

async function mount(html: string): Promise<FdChip> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const element = host.firstElementChild as FdChip
  await element.updateComplete
  return element
}

const chipOf = (element: FdChip) => element.shadowRoot?.querySelector('.chip') as HTMLButtonElement

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-chip', () => {
  it('pads 6px vertically and nothing horizontally, on a radius of 8', async () => {
    const element = await mount('<fd-chip label="Reset"></fd-chip>')
    const style = getComputedStyle(chipOf(element))

    expect(style.paddingTop).toBe('6px')
    expect(style.paddingBottom).toBe('6px')
    expect(style.paddingLeft).toBe('0px')
    expect(style.borderRadius).toBe('8px')
  })

  it('fills the width it is given and centres its label', async () => {
    const element = await mount('<fd-chip label="Reset"></fd-chip>')
    element.style.width = '200px'
    await element.updateComplete

    expect(Math.round(chipOf(element).getBoundingClientRect().width)).toBe(200)
    expect(getComputedStyle(chipOf(element)).textAlign).toBe('center')
  })

  it('uses the selection label role', async () => {
    const element = await mount('<fd-chip label="Reset"></fd-chip>')
    const style = getComputedStyle(chipOf(element))

    expect(style.fontSize).toBe('11.5px')
    expect(style.fontWeight).toBe('500')
  })

  it('keeps a long label on one line', async () => {
    const element = await mount('<fd-chip label="Reset every preference"></fd-chip>')
    const style = getComputedStyle(chipOf(element))

    expect(style.whiteSpace).toBe('nowrap')
    expect(style.textOverflow).toBe('ellipsis')
  })

  it('reports its value on activation', async () => {
    const element = await mount('<fd-chip label="Reset" value="reset"></fd-chip>')
    const details: unknown[] = []
    element.addEventListener('fd-activate', (event) => details.push(event.detail))

    chipOf(element).click()

    expect(details).toEqual([{ value: 'reset' }])
  })

  it('falls back to its text content', async () => {
    const element = await mount('<fd-chip>Reset</fd-chip>')
    expect(element.shadowRoot?.querySelector('slot')).not.toBeNull()
    expect(element.textContent?.trim()).toBe('Reset')
  })

  it('stays silent while disabled', async () => {
    const element = await mount('<fd-chip label="Reset" disabled></fd-chip>')
    const details: unknown[] = []
    element.addEventListener('fd-activate', (event) => details.push(event.detail))

    chipOf(element).click()

    expect(details).toEqual([])
    expect(chipOf(element).disabled).toBe(true)
  })
})
