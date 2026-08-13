import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdDialogAction } from './fd-dialog-action.js'
import './fd-dialog-action.js'

async function mount(markup: string): Promise<FdDialogAction> {
  const host = document.createElement('div')
  host.innerHTML = markup
  document.body.append(host)
  const element = host.firstElementChild as FdDialogAction
  await element.updateComplete
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-dialog-action', () => {
  it('matches Swift emphasis and destructive role semantics', async () => {
    const element = await mount(
      '<fd-dialog-action title-text="Remove" emphasis="prominent" button-role="destructive"></fd-dialog-action>',
    )
    const button = element.shadowRoot?.querySelector('button') as HTMLButtonElement

    expect(button.textContent?.trim()).toBe('Remove')
    expect(button.hasAttribute('data-prominent')).toBe(true)
    expect(button.hasAttribute('data-destructive')).toBe(true)
  })

  it('emits activation only while enabled', async () => {
    const element = await mount('<fd-dialog-action title-text="Save"></fd-dialog-action>')
    const onActivate = vi.fn()
    const button = element.shadowRoot?.querySelector('button') as HTMLButtonElement
    element.addEventListener('fd-activate', onActivate)

    button.click()
    element.disabled = true
    await element.updateComplete
    button.click()

    expect(onActivate).toHaveBeenCalledOnce()
  })
})
