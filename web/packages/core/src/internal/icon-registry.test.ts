import { afterEach, describe, expect, it, vi } from 'vitest'
import '../components/icon/fd-icon.js'
import type { FdIcon } from '../components/icon/fd-icon.js'
import { FdIcons } from './icon-registry.js'

const GEAR = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>'

afterEach(() => {
  FdIcons.clear()
  document.body.replaceChildren()
})

describe('FdIcons', () => {
  it('registers and resolves icons by name', () => {
    FdIcons.register({ gearshape: GEAR })

    expect(FdIcons.has('gearshape')).toBe(true)
    expect(FdIcons.resolve('gearshape')).toBe(GEAR)
    expect(FdIcons.names()).toEqual(['gearshape'])
  })

  it('lets a later registration replace an earlier one', () => {
    FdIcons.register({ gearshape: GEAR })
    FdIcons.register({ gearshape: '<svg id="new"></svg>' })

    expect(FdIcons.resolve('gearshape')).toBe('<svg id="new"></svg>')
    expect(FdIcons.names()).toHaveLength(1)
  })

  it('resolves nothing for an unregistered name', () => {
    expect(FdIcons.resolve('nope')).toBeUndefined()
    expect(FdIcons.has('nope')).toBe(false)
  })

  it('notifies subscribers on register and clear, and stops after unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = FdIcons.subscribe(listener)

    FdIcons.register({ gearshape: GEAR })
    expect(listener).toHaveBeenCalledOnce()

    FdIcons.clear()
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    FdIcons.register({ gearshape: GEAR })
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe('fd-icon', () => {
  async function mount(html: string): Promise<FdIcon> {
    const host = document.createElement('div')
    host.innerHTML = html
    document.body.append(host)
    const element = host.firstElementChild as FdIcon
    await element.updateComplete
    return element
  }

  it('renders nothing until its icon is registered, then fills in', async () => {
    const element = await mount('<fd-icon name="gearshape"></fd-icon>')
    expect(element.shadowRoot?.querySelector('svg')).toBeNull()

    FdIcons.register({ gearshape: GEAR })
    await element.updateComplete

    expect(element.shadowRoot?.querySelector('svg')).not.toBeNull()
  })

  it('hides itself from assistive technology unless labelled', async () => {
    FdIcons.register({ gearshape: GEAR })

    const unlabelled = await mount('<fd-icon name="gearshape"></fd-icon>')
    expect(unlabelled.getAttribute('aria-hidden')).toBe('true')

    const labelled = await mount('<fd-icon name="gearshape" label="Settings"></fd-icon>')
    expect(labelled.getAttribute('role')).toBe('img')
    expect(labelled.getAttribute('aria-label')).toBe('Settings')
  })

  it('sizes from font-size so it behaves like an SF Symbol in text', async () => {
    FdIcons.register({ gearshape: GEAR })
    const element = await mount('<fd-icon name="gearshape" style="font-size:13px"></fd-icon>')

    expect(getComputedStyle(element).width).toBe('13px')
    expect(getComputedStyle(element).height).toBe('13px')
  })
})
