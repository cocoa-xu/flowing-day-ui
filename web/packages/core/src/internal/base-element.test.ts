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

function userSelect(element: Element): string {
  const style = getComputedStyle(element)
  return style.userSelect || style.getPropertyValue('-webkit-user-select')
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('FdElement text selection', () => {
  it('uses desktop-style nonselectable labels while preserving text entry', async () => {
    const element = await mount()
    const input = element.shadowRoot?.querySelector('input') as HTMLInputElement

    expect(userSelect(element)).toBe('none')
    expect(userSelect(input)).toBe('text')
  })

  it('allows consumers to restore text selection explicitly', async () => {
    const element = await mount()

    element.style.setProperty('--fd-user-select', 'text')

    expect(userSelect(element)).toBe('text')
  })
})
