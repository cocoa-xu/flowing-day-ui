import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdPage } from '../page/fd-page.js'
import type { FdPreferencesWindow } from './fd-preferences-window.js'
import './fd-preferences-window.js'

const MARKUP = `
  <fd-preferences-window app-name="Afloat" sidebar-footer="Version 1.6.0" page="general">
    <fd-page-group>
      <fd-page page-id="general" label="General" subtitle="Behavior" symbol="gearshape">
        <p id="general-body">general body</p>
      </fd-page>
      <fd-page page-id="appearance" label="Appearance" symbol="paintbrush"></fd-page>
    </fd-page-group>
    <fd-page-group label="Advanced" indented>
      <fd-page page-id="usb" label="USB" symbol="cable" accent="#B4795E"></fd-page>
      <fd-page page-id="privacy" label="Privacy" unavailable></fd-page>
    </fd-page-group>
  </fd-preferences-window>
`

async function mount(markup = MARKUP): Promise<FdPreferencesWindow> {
  const host = document.createElement('div')
  host.innerHTML = markup
  document.body.append(host)
  const element = host.querySelector('fd-preferences-window') as FdPreferencesWindow
  await element.updateComplete
  await element.updateComplete
  return element
}

const navRows = (element: FdPreferencesWindow) =>
  [...(element.shadowRoot?.querySelectorAll('.nav-row') ?? [])] as HTMLButtonElement[]

const text = (element: FdPreferencesWindow, selector: string) =>
  element.shadowRoot?.querySelector(selector)?.textContent?.trim()

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-preferences-window sidebar', () => {
  it('builds one nav row per page, in declaration order', async () => {
    const element = await mount()
    expect(navRows(element).map((row) => row.textContent?.trim())).toEqual([
      'General',
      'Appearance',
      'USB',
      'Privacy',
    ])
  })

  it('renders group labels uppercase and skips unlabelled groups', async () => {
    const element = await mount()
    const labels = [...(element.shadowRoot?.querySelectorAll('.group-label') ?? [])]

    expect(labels).toHaveLength(1)
    expect(labels[0]?.textContent).toBe('Advanced')
    expect(getComputedStyle(labels[0] as Element).textTransform).toBe('uppercase')
    expect(getComputedStyle(labels[0] as Element).letterSpacing).toBe('0.8px')
  })

  it('carries the brand block and footer', async () => {
    const element = await mount()
    expect(text(element, '.brand-name')).toBe('Afloat')
    expect(text(element, '.brand-subtitle')).toBe('Preferences')
    expect(text(element, '.sidebar-footer')).toBe('Version 1.6.0')
  })

  it('uses the 224px sidebar width from PreferencesViewConfiguration', async () => {
    const element = await mount()
    const sidebar = element.shadowRoot?.querySelector('.sidebar') as HTMLElement
    expect(sidebar.getBoundingClientRect().width).toBe(224)
  })

  it('indents the rows of an indented group', async () => {
    const element = await mount()
    const rows = navRows(element)
    expect(getComputedStyle(rows[0] as Element).paddingLeft).toBe('10px')
    expect(getComputedStyle(rows[2] as Element).paddingLeft).toBe('20px')
  })

  it('dims and disables unavailable pages', async () => {
    const element = await mount()
    const privacy = navRows(element)[3] as HTMLButtonElement

    expect(privacy.disabled).toBe(true)
    expect(getComputedStyle(privacy).opacity).toBe('0.45')
  })
})

describe('fd-preferences-window sizing', () => {
  it('uses the Swift window defaults as its initial and constrained size', async () => {
    const element = await mount()
    const style = getComputedStyle(element)

    expect(style.width).toBe('900px')
    expect(style.height).toBe('640px')
    expect(style.minWidth).toBe('900px')
    expect(style.minHeight).toBe('640px')
    expect(style.maxWidth).toBe('1160px')
    expect(style.maxHeight).toBe('860px')
  })

  it('accepts application-defined minimum and maximum bounds', async () => {
    const element = await mount()
    element.style.setProperty('--fd-preferences-min-width', '840px')
    element.style.setProperty('--fd-preferences-min-height', '600px')
    element.style.setProperty('--fd-preferences-max-width', '1080px')
    element.style.setProperty('--fd-preferences-max-height', '760px')
    const style = getComputedStyle(element)

    expect(style.minWidth).toBe('840px')
    expect(style.minHeight).toBe('600px')
    expect(style.maxWidth).toBe('1080px')
    expect(style.maxHeight).toBe('760px')
  })
})

describe('fd-preferences-window selection', () => {
  it('activates only the selected page', async () => {
    const element = await mount()
    const pages = [...element.querySelectorAll('fd-page')] as FdPage[]

    expect(pages.map((page) => page.active)).toEqual([true, false, false, false])
    expect(getComputedStyle(pages[0] as Element).display).toBe('block')
    expect(getComputedStyle(pages[1] as Element).display).toBe('none')
  })

  it('marks the selected nav row as the current page', async () => {
    const element = await mount()
    expect(navRows(element)[0]?.getAttribute('aria-current')).toBe('page')
    expect(navRows(element)[1]?.hasAttribute('aria-current')).toBe(false)
  })

  it('changes page on click and reports it', async () => {
    const element = await mount()
    const onChange = vi.fn()
    element.addEventListener('fd-page-change', onChange)

    navRows(element)[1]?.click()
    await element.updateComplete

    expect(element.page).toBe('appearance')
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({ page: 'appearance' })
    expect(element.selectedPage?.pageId).toBe('appearance')
  })

  it('refuses to select an unavailable page', async () => {
    const element = await mount()
    const onChange = vi.fn()
    element.addEventListener('fd-page-change', onChange)

    navRows(element)[3]?.click()
    await element.updateComplete

    expect(element.page).toBe('general')
    expect(onChange).not.toHaveBeenCalled()
  })

  /** Mirrors reconcileSelection, which falls back to the first available page. */
  it('falls back to the first available page for an unknown id', async () => {
    const element = await mount(MARKUP.replace('page="general"', 'page="nope"'))
    expect(element.selectedPage?.pageId).toBe('general')
  })

  it('re-reads the sidebar when pages are added', async () => {
    const element = await mount()
    const group = element.querySelector('fd-page-group') as HTMLElement
    const page = document.createElement('fd-page')
    page.setAttribute('page-id', 'late')
    page.setAttribute('label', 'Late')
    group.append(page)

    await new Promise((resolve) => setTimeout(resolve, 0))
    await element.updateComplete

    expect(navRows(element).map((row) => row.textContent?.trim())).toContain('Late')
  })
})

describe('fd-preferences-window page header', () => {
  it('shows the page title and subtitle', async () => {
    const element = await mount()
    expect(text(element, '.page-title')).toBe('General')
    expect(text(element, '.page-subtitle')).toBe('Behavior')
  })

  it('omits the subtitle when the page has none', async () => {
    const element = await mount()
    element.page = 'appearance'
    await element.updateComplete

    expect(text(element, '.page-title')).toBe('Appearance')
    expect(element.shadowRoot?.querySelector('.page-subtitle')).toBeNull()
  })

  it('caps the content column before padding, matching maxWidth: .infinity', async () => {
    const element = await mount()
    const inner = element.shadowRoot?.querySelector('.content-inner') as HTMLElement
    const style = getComputedStyle(inner)

    expect(style.boxSizing).toBe('content-box')
    expect(style.maxWidth).toBe('720px')
    expect(style.paddingTop).toBe('38px')
    expect(style.paddingLeft).toBe('34px')
    expect(style.paddingBottom).toBe('40px')
  })
})

describe('fd-preferences-window accent', () => {
  const scope = (element: FdPreferencesWindow) =>
    element.shadowRoot?.querySelector('.root') as HTMLElement

  it('retints its own chrome from the selected page', async () => {
    const element = await mount()
    expect(scope(element).style.getPropertyValue('--fd-accent')).toBe('')

    element.page = 'usb'
    await element.updateComplete
    expect(scope(element).style.getPropertyValue('--fd-accent')).toBe('#B4795E')

    element.page = 'general'
    await element.updateComplete
    expect(scope(element).style.getPropertyValue('--fd-accent')).toBe('')
  })

  /**
   * The host's inline style belongs to the consumer. Writing the page accent there
   * silently undid any theming they had applied on the very next render.
   */
  it("never writes to the host, so a caller's own accent survives navigation", async () => {
    const element = await mount()
    element.style.setProperty('--fd-accent', '#123456')

    element.page = 'usb'
    await element.updateComplete
    element.page = 'general'
    await element.updateComplete

    expect(element.style.getPropertyValue('--fd-accent')).toBe('#123456')
  })

  it('publishes the accent on the page itself, which its slotted content inherits', async () => {
    const element = await mount()
    const usb = element.querySelector('fd-page[page-id="usb"]') as HTMLElement
    const general = element.querySelector('fd-page[page-id="general"]') as HTMLElement

    expect(usb.style.getPropertyValue('--fd-accent')).toBe('#B4795E')
    expect(general.style.getPropertyValue('--fd-accent')).toBe('')
  })

  it('gives a page-specific accent to its own sidebar row', async () => {
    const element = await mount()
    expect(navRows(element)[2]?.style.getPropertyValue('--fd-accent')).toBe('#B4795E')
    expect(navRows(element)[0]?.style.getPropertyValue('--fd-accent')).toBe('')
  })

  /** One colour in, a whole accent set out — fill, foreground, wash and veil. */
  it('re-derives the whole accent set inside an accent scope', async () => {
    const element = await mount()
    const defaultForeground = getComputedStyle(navRows(element)[0] as Element).color

    element.page = 'usb'
    await element.updateComplete

    const style = getComputedStyle(scope(element))
    expect(style.getPropertyValue('--_fd-accent').trim()).toBe('#B4795E')
    expect(style.getPropertyValue('--_fd-accent-fill')).toContain('oklch(from #B4795E')
    expect(style.getPropertyValue('--_fd-accent-foreground')).toContain(
      'oklch(from oklch(from #B4795E',
    )
    expect(style.getPropertyValue('--_fd-accent-wash')).toContain('#B4795E')

    const icon = element.shadowRoot?.querySelector(
      '.nav-row[aria-current="page"] .nav-icon',
    ) as HTMLElement
    const resolved = getComputedStyle(icon).color

    expect(resolved).toMatch(/^(rgb|color|oklch)/)
    expect(resolved).not.toBe(defaultForeground)
  })
})

describe('fd-preferences-window close button', () => {
  it('reports a close request', async () => {
    const element = await mount()
    const onClose = vi.fn()
    element.addEventListener('fd-close', onClose)

    const close = element.shadowRoot?.querySelector('.close') as HTMLButtonElement
    expect(close.getAttribute('aria-label')).toBe('Close Preferences')
    close.click()

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('can be suppressed for embeds', async () => {
    const element = await mount(MARKUP.replace('app-name="Afloat"', 'app-name="Afloat" hide-close'))
    expect(element.shadowRoot?.querySelector('.close')).toBeNull()
  })
})
