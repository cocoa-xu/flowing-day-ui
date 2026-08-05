import { afterEach, describe, expect, it } from 'vitest'
import type { FdCard } from '../card/fd-card.js'
import type { FdSeparator } from '../separator/fd-separator.js'
import '../separator/fd-separator.js'
import type { FdSection } from './fd-section.js'
import './fd-section.js'

async function mount<T extends HTMLElement>(html: string): Promise<T> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const element = host.firstElementChild as T & { updateComplete?: Promise<unknown> }
  await element.updateComplete
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-section', () => {
  it('renders an uppercase, letter-spaced header', async () => {
    const element = await mount<FdSection>('<fd-section label="Startup"></fd-section>')
    const header = element.shadowRoot?.querySelector('.header') as HTMLElement
    const style = getComputedStyle(header)

    expect(header.textContent).toBe('Startup')
    expect(style.textTransform).toBe('uppercase')
    expect(style.letterSpacing).toBe('0.7px')
    expect(style.fontSize).toBe('10.5px')
    expect(style.fontWeight).toBe('600')
  })

  it('omits the header and footer when unset', async () => {
    const element = await mount<FdSection>('<fd-section></fd-section>')

    expect(element.shadowRoot?.querySelector('.header')).toBeNull()
    expect(element.shadowRoot?.querySelector('.footer')).toBeNull()
  })

  it('aligns the footer with the row text above it', async () => {
    const element = await mount<FdSection>(
      '<fd-section label="Startup" footer="Applies at next launch."></fd-section>',
    )
    const footer = element.shadowRoot?.querySelector('.footer') as HTMLElement
    const style = getComputedStyle(footer)

    expect(footer.textContent).toBe('Applies at next launch.')
    expect(style.paddingLeft).toBe('18px')
    expect(style.paddingTop).toBe('7px')
    expect(style.fontSize).toBe('11px')
  })

  it('stretches to fill a pane stack, matching maxWidth: .infinity', async () => {
    const element = await mount<FdSection>('<fd-section label="Startup"></fd-section>')
    expect(getComputedStyle(element).alignSelf).toBe('stretch')
  })
})

describe('fd-card', () => {
  it('uses the card radius metric and a hairline inset border', async () => {
    const element = await mount<FdCard>('<fd-card></fd-card>')
    const style = getComputedStyle(element)

    expect(style.borderTopLeftRadius).toBe('14px')
    expect(style.overflow).toBe('hidden')
    expect(getComputedStyle(element, '::after').borderTopWidth).toBe('1px')
  })

  it('follows a card radius override', async () => {
    const element = await mount<FdCard>('<fd-card></fd-card>')
    element.style.setProperty('--fd-metric-card-radius', '4px')
    expect(getComputedStyle(element).borderTopLeftRadius).toBe('4px')
  })
})

describe('fd-separator', () => {
  it('insets by the row inset', async () => {
    const element = await mount<FdSeparator>('<fd-separator></fd-separator>')
    expect(getComputedStyle(element).paddingLeft).toBe('18px')
  })

  it('adds the 34px symbol gutter when indented', async () => {
    const element = await mount<FdSeparator>('<fd-separator indented></fd-separator>')
    expect(getComputedStyle(element).paddingLeft).toBe('52px')
  })

  it('draws a one pixel rule', async () => {
    const element = await mount<FdSeparator>('<fd-separator></fd-separator>')
    const rule = element.shadowRoot?.querySelector('.rule') as HTMLElement
    expect(rule.getBoundingClientRect().height).toBe(1)
  })
})
