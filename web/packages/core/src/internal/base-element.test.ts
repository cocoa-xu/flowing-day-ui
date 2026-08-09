import { html } from 'lit'
import { afterEach, describe, expect, it } from 'vitest'
import { FdElement } from './base-element.js'

class FdBaseElementTest extends FdElement {
  override render() {
    return html`<span>Label</span><input value="Editable" /><slot></slot>`
  }
}

if (!customElements.get('fd-base-element-test')) {
  customElements.define('fd-base-element-test', FdBaseElementTest)
}

async function mount(): Promise<FdBaseElementTest> {
  const element = document.createElement('fd-base-element-test') as FdBaseElementTest
  element.innerHTML = '<span>Slotted label</span>'
  document.body.append(element)
  await element.updateComplete
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('FdElement text selection', () => {
  it('uses desktop-style nonselectable labels while preserving text entry', async () => {
    const element = await mount()
    const label = element.shadowRoot?.querySelector('span') as HTMLElement
    const input = element.shadowRoot?.querySelector('input') as HTMLInputElement
    const slottedLabel = element.querySelector('span') as HTMLElement

    expect(getComputedStyle(element).userSelect).toBe('none')
    expect(getComputedStyle(label).userSelect).toBe('none')
    expect(getComputedStyle(slottedLabel).userSelect).toBe('none')
    expect(getComputedStyle(input).userSelect).toBe('text')
  })

  it('allows consumers to restore text selection explicitly', async () => {
    const element = await mount()
    const label = element.shadowRoot?.querySelector('span') as HTMLElement

    element.style.setProperty('--fd-user-select', 'text')

    expect(getComputedStyle(element).userSelect).toBe('text')
    expect(getComputedStyle(label).userSelect).toBe('text')
  })
})
