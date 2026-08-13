import { afterEach, describe, expect, it, vi } from 'vitest'
import './fd-menu.js'

async function mount() {
  const menu = document.createElement('fd-menu')
  menu.title = 'Actions'
  for (const label of ['Duplicate', 'Archive']) {
    const button = document.createElement('button')
    button.textContent = label
    menu.append(button)
  }
  document.body.append(menu)
  await menu.updateComplete
  return menu
}

afterEach(() => document.body.replaceChildren())

describe('fd-menu', () => {
  it('matches the Swift trigger defaults', async () => {
    const menu = await mount()
    const trigger = menu.shadowRoot?.querySelector<HTMLButtonElement>('.trigger')

    expect(menu.minimumWidth).toBe(0)
    expect(menu.fillsAvailableWidth).toBe(false)
    expect(trigger?.ariaHasPopup).toBe('menu')
    expect(trigger?.textContent).toContain('Actions')
  })

  it('prepares slotted controls as menu items', async () => {
    const menu = await mount()
    await new Promise(requestAnimationFrame)
    const items = [...menu.querySelectorAll('button')]

    expect(items.map((item) => item.getAttribute('role'))).toEqual(['menuitem', 'menuitem'])
    expect(items.map((item) => item.tabIndex)).toEqual([-1, -1])
  })

  it('does not open while disabled', async () => {
    const menu = await mount()
    menu.disabled = true
    await menu.updateComplete
    menu.show()

    expect(menu.open).toBe(false)
  })

  it('reports native presentation changes', async () => {
    const menu = await mount()
    const listener = vi.fn()
    menu.addEventListener('fd-open', listener)
    menu.show()
    await menu.updateComplete
    await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce())

    expect(menu.open).toBe(true)
  })
})
