import { afterEach, describe, expect, it } from 'vitest'
import type { FdTag } from './fd-tag.js'
import './fd-tag.js'

async function mount(html: string): Promise<FdTag> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const element = host.firstElementChild as FdTag
  await element.updateComplete
  return element
}

const tagOf = (element: FdTag) => element.shadowRoot?.querySelector('.tag') as HTMLElement

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-tag', () => {
  it('pads 10/6 on a radius of 8', async () => {
    const element = await mount('<fd-tag label="beta"></fd-tag>')
    const style = getComputedStyle(tagOf(element))

    expect(style.paddingLeft).toBe('10px')
    expect(style.paddingRight).toBe('10px')
    expect(style.paddingTop).toBe('6px')
    expect(style.paddingBottom).toBe('6px')
    expect(style.borderRadius).toBe('8px')
  })

  it('uses the monospaced tag role', async () => {
    const element = await mount('<fd-tag label="beta"></fd-tag>')
    const style = getComputedStyle(tagOf(element))

    expect(style.fontSize).toBe('11px')
    expect(style.fontFamily).toContain('ui-monospace')
  })

  it('sizes to its text and never wraps', async () => {
    const element = await mount('<fd-tag label="a rather long tag"></fd-tag>')
    element.style.width = '40px'
    await element.updateComplete

    expect(getComputedStyle(tagOf(element)).whiteSpace).toBe('nowrap')
    expect(tagOf(element).getBoundingClientRect().width).toBeGreaterThan(40)
  })

  it('carries no interactive affordance', async () => {
    const element = await mount('<fd-tag label="beta"></fd-tag>')

    expect(tagOf(element).tagName).toBe('SPAN')
    expect(getComputedStyle(tagOf(element)).cursor).toBe('default')
  })

  it('falls back to its text content', async () => {
    const element = await mount('<fd-tag>beta</fd-tag>')
    expect(element.shadowRoot?.querySelector('slot')).not.toBeNull()
  })
})
