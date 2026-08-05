import { afterEach, describe, expect, it } from 'vitest'
import type { FdLinkRow } from './fd-link-row.js'
import './fd-link-row.js'

async function mount(html: string): Promise<FdLinkRow> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const element = host.firstElementChild as FdLinkRow
  await element.updateComplete
  return element
}

const linkOf = (element: FdLinkRow) =>
  element.shadowRoot?.querySelector('.soft-button') as HTMLAnchorElement

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-link-row', () => {
  it('points the link at the destination and opens it away from Preferences', async () => {
    const element = await mount(
      '<fd-link-row label="Docs" button-label="Open" href="https://example.com/docs" help="Open the documentation"></fd-link-row>',
    )
    const link = linkOf(element)

    expect(link.getAttribute('href')).toBe('https://example.com/docs')
    expect(link.target).toBe('_blank')
    expect(link.rel).toBe('noreferrer')
  })

  it('renders help as a tooltip on the link, never on the host', async () => {
    const element = await mount(
      '<fd-link-row label="Docs" button-label="Open" href="https://example.com" help="Open the documentation"></fd-link-row>',
    )

    expect(linkOf(element).title).toBe('Open the documentation')
    expect(element.hasAttribute('title')).toBe(false)
  })

  it('names the link by its help text, since the arrow carries no label', async () => {
    const element = await mount(
      '<fd-link-row label="Docs" button-label="Open" href="https://example.com" help="Open the documentation"></fd-link-row>',
    )
    expect(linkOf(element).getAttribute('aria-label')).toBe('Open the documentation')
  })

  /** Deliberately dropped from the SwiftUI original; the tooltip carries the meaning. */
  it('carries no arrow after the label', async () => {
    const element = await mount(
      '<fd-link-row label="Docs" button-label="Open" href="https://example.com" help="Docs"></fd-link-row>',
    )

    expect(element.shadowRoot?.querySelector('svg')).toBeNull()
    expect(linkOf(element).textContent?.trim()).toBe('Open')
  })

  it('shares the soft button geometry with fd-button-row', async () => {
    const element = await mount(
      '<fd-link-row label="Docs" button-label="Open" href="https://example.com" help="Docs"></fd-link-row>',
    )
    const style = getComputedStyle(linkOf(element))

    expect(style.paddingLeft).toBe('12px')
    expect(style.paddingTop).toBe('5px')
    expect(style.borderRadius).toBe('9px')
    expect(style.textDecorationLine).toBe('none')
  })
})
