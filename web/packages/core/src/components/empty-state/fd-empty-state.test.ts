import { afterEach, describe, expect, it } from 'vitest'
import type { FdEmptyState } from './fd-empty-state.js'
import './fd-empty-state.js'

async function mount(attributes = ''): Promise<FdEmptyState> {
  const host = document.createElement('div')
  host.innerHTML = `<fd-empty-state message="Nothing connected" ${attributes}></fd-empty-state>`
  document.body.append(host)
  const element = host.firstElementChild as FdEmptyState
  await element.updateComplete
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-empty-state', () => {
  it('defaults to the centered stacked layout', async () => {
    const element = await mount('symbol="tray"')
    const state = element.shadowRoot?.querySelector('.state') as HTMLElement

    expect(getComputedStyle(state).flexDirection).toBe('column')
    expect(element.shadowRoot?.querySelector('fd-icon')).not.toBeNull()
    expect(state.textContent?.trim()).toBe('Nothing connected')
    expect(state.hasAttribute('role')).toBe(false)
  })

  it('offers a leading inline layout', async () => {
    const element = await mount('layout="inline" symbol="tray"')
    const state = element.shadowRoot?.querySelector('.state') as HTMLElement

    expect(getComputedStyle(state).flexDirection).toBe('row')
    expect(getComputedStyle(state).justifyContent).toBe('flex-start')
  })
})
