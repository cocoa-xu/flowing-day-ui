import { afterEach, describe, expect, it } from 'vitest'
import type { FdValueText } from './fd-value-text.js'
import './fd-value-text.js'

async function mount(attributes = ''): Promise<FdValueText> {
  const host = document.createElement('div')
  host.innerHTML = `<fd-value-text ${attributes}></fd-value-text>`
  document.body.append(host)
  const element = host.firstElementChild as FdValueText
  await element.updateComplete
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-value-text', () => {
  it('truncates in the middle by default', async () => {
    const element = await mount('value="/Users/cocoa/Documents/FlowingDay.graph"')

    expect(element.shadowRoot?.querySelector('.truncate-head')).not.toBeNull()
    expect(element.shadowRoot?.querySelector('.truncate-tail')?.textContent).toBe('ay.graph')
  })

  it('supports start and end truncation', async () => {
    const element = await mount('value="Long identifier" truncation="start"')
    expect(element.shadowRoot?.querySelector('.start')?.textContent).toBe('Long identifier')

    element.truncation = 'end'
    await element.updateComplete
    expect(element.shadowRoot?.querySelector('.end')?.textContent).toBe('Long identifier')
  })

  it('allows text selection by default and can disable it', async () => {
    const element = await mount('value="Selectable"')
    const selectionStyle = () => {
      const style = getComputedStyle(element)
      return style.userSelect || style.getPropertyValue('-webkit-user-select')
    }
    expect(selectionStyle()).toBe('text')

    element.selectionEnabled = false
    await element.updateComplete
    expect(selectionStyle()).toBe('none')
  })
})
