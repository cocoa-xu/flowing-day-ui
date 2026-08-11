import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdDialog } from './fd-dialog.js'
import './fd-dialog-action.js'
import './fd-dialog.js'

async function mount(markup: string): Promise<FdDialog> {
  const host = document.createElement('div')
  host.innerHTML = markup
  document.body.append(host)
  const element = host.querySelector('fd-dialog') as FdDialog
  await element.updateComplete
  return element
}

const nativeDialog = (element: FdDialog) =>
  element.shadowRoot?.querySelector('dialog') as HTMLDialogElement

afterEach(() => {
  for (const dialog of document.querySelectorAll<FdDialog>('fd-dialog')) dialog.close()
  document.body.replaceChildren()
})

describe('fd-dialog lifecycle', () => {
  it('delegates modal presentation and close state to a native dialog', async () => {
    const element = await mount(`<fd-dialog heading="Edit Preview">Content</fd-dialog>`)

    element.showModal()
    await element.updateComplete
    expect(element.open).toBe(true)
    expect(nativeDialog(element).open).toBe(true)

    element.close('saved')
    await vi.waitFor(() => expect(element.open).toBe(false))
    expect(nativeDialog(element).returnValue).toBe('saved')
  })

  it('supports modeless presentation without a second visual implementation', async () => {
    const element = await mount(`<fd-dialog heading="Inspector">Content</fd-dialog>`)

    element.show()
    await element.updateComplete

    expect(element.modal).toBe(false)
    expect(nativeDialog(element).open).toBe(true)
  })

  it('reports the native return value after closing', async () => {
    const element = await mount(`<fd-dialog heading="Edit Preview">Content</fd-dialog>`)
    const onClose = vi.fn()
    element.addEventListener('fd-close', onClose)

    element.showModal()
    await element.updateComplete
    element.close('done')
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())

    expect(onClose.mock.calls[0]?.[0].detail).toEqual({ returnValue: 'done' })
  })
})

describe('fd-dialog confirmation', () => {
  it('renders built-in confirmation actions with destructive semantics', async () => {
    const element = await mount(`
      <fd-dialog
        heading="Remove preview?"
        message="This cannot be undone."
        confirmation-kind="destructive"
        confirm-label="Remove"
      ></fd-dialog>
    `)
    const buttons = [
      ...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>('.dialog-action') ?? []),
    ]

    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Cancel', 'Remove'])
    expect(buttons[1]?.hasAttribute('data-destructive')).toBe(true)
    expect(nativeDialog(element).getAttribute('aria-describedby')).toBe('message')
  })

  it('emits a cancelable confirmation before closing', async () => {
    const element = await mount(`
      <fd-dialog heading="Apply changes?" confirm-label="Apply"></fd-dialog>
    `)
    const onConfirm = vi.fn((event: Event) => event.preventDefault())
    element.addEventListener('fd-confirm', onConfirm)
    element.showModal()
    await element.updateComplete

    const confirm = element.shadowRoot?.querySelectorAll<HTMLButtonElement>('.dialog-action')[1]
    confirm?.click()
    await element.updateComplete

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(element.open).toBe(true)
  })

  it('prevents native cancellation when dismissal is disabled', async () => {
    const element = await mount(`<fd-dialog heading="Required" dismissible="false"></fd-dialog>`)
    element.dismissible = false
    element.showModal()
    await element.updateComplete
    const event = new Event('cancel', { cancelable: true })

    nativeDialog(element).dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(element.open).toBe(true)
  })

  it('keeps the explicit cancel action available when implicit dismissal is disabled', async () => {
    const element = await mount(`
      <fd-dialog heading="Required" confirm-label="Continue" dismissible="false"></fd-dialog>
    `)
    element.dismissible = false
    element.showModal()
    await element.updateComplete

    element.shadowRoot?.querySelector<HTMLButtonElement>('.dialog-action')?.click()
    await vi.waitFor(() => expect(element.open).toBe(false))

    expect(nativeDialog(element).returnValue).toBe('cancel')
  })
})

describe('fd-dialog composition', () => {
  it('keeps custom body and action content application-owned', async () => {
    const element = await mount(`
      <fd-dialog heading="Edit Preview" message="Adjust this presentation.">
        <label>Name <input value="Morning Review" /></label>
        <fd-dialog-action slot="actions" label="Cancel"></fd-dialog-action>
        <fd-dialog-action slot="actions" label="Save" prominent></fd-dialog-action>
      </fd-dialog>
    `)
    const actionSlot = element.shadowRoot?.querySelector<HTMLSlotElement>('slot[name="actions"]')

    expect(element.querySelector('input')?.value).toBe('Morning Review')
    expect(actionSlot?.assignedElements()).toHaveLength(2)
  })

  it('uses the same intrinsic width range as the SwiftUI dialog', async () => {
    const element = await mount(`<fd-dialog heading="Edit Preview">Content</fd-dialog>`)
    element.showModal()
    await element.updateComplete

    const width = nativeDialog(element).getBoundingClientRect().width
    expect(width).toBeGreaterThanOrEqual(Math.min(380, document.documentElement.clientWidth - 32))
    expect(width).toBeLessThanOrEqual(560)
  })
})
