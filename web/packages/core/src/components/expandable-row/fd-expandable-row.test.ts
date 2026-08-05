import { afterEach, describe, expect, it } from 'vitest'
import type { FdExpandableRow } from './fd-expandable-row.js'
import './fd-expandable-row.js'

async function mount(html: string): Promise<FdExpandableRow> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const element = host.firstElementChild as FdExpandableRow
  await element.updateComplete
  return element
}

const rowOf = (element: FdExpandableRow) =>
  element.shadowRoot?.querySelector('.row') as HTMLButtonElement

const chevronOf = (element: FdExpandableRow) =>
  element.shadowRoot?.querySelector('.chevron') as HTMLElement

/** getComputedStyle reports the interpolated value while the rotation is still running. */
const settle = (element: HTMLElement) =>
  Promise.all(element.getAnimations().map((animation) => animation.finished))

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-expandable-row', () => {
  it('keeps the SettingsRow geometry', async () => {
    const element = await mount('<fd-expandable-row label="Advanced"></fd-expandable-row>')
    const style = getComputedStyle(rowOf(element))

    expect(style.paddingTop).toBe('6px')
    expect(style.paddingLeft).toBe('18px')
    expect(style.minHeight).toBe('42px')
    expect(style.columnGap).toBe('14px')
  })

  it('grows to 11px vertical padding once a caption is present', async () => {
    const element = await mount(
      '<fd-expandable-row label="Advanced" caption="Rarely needed."></fd-expandable-row>',
    )
    expect(getComputedStyle(rowOf(element)).paddingTop).toBe('11px')
  })

  it('turns the chevron 180 degrees when expanded', async () => {
    const element = await mount('<fd-expandable-row label="Advanced"></fd-expandable-row>')
    expect(getComputedStyle(chevronOf(element)).rotate).toBe('none')

    element.expanded = true
    await element.updateComplete
    await settle(chevronOf(element))
    expect(getComputedStyle(chevronOf(element)).rotate).toBe('180deg')
  })

  it('turns it over the 0.18s the SwiftUI original animates with', async () => {
    const element = await mount('<fd-expandable-row label="Advanced"></fd-expandable-row>')
    const style = getComputedStyle(chevronOf(element))

    expect(style.transitionProperty).toBe('rotate')
    expect(style.transitionDuration).toBe('0.18s')
  })

  it('draws the chevron at 10px in the accent foreground', async () => {
    const element = await mount('<fd-expandable-row label="Advanced"></fd-expandable-row>')
    const chevron = chevronOf(element)

    expect(getComputedStyle(chevron).width).toBe('10px')
    expect(getComputedStyle(chevron).height).toBe('10px')
  })

  /**
   * An inline SVG rides the text baseline of its own line box and drops out the bottom
   * of a box sized to the glyph — it sat five pixels low on a mark ten tall.
   */
  it('centres the glyph itself, not just the box around it', async () => {
    const element = await mount('<fd-expandable-row label="Advanced"></fd-expandable-row>')
    const chevron = chevronOf(element)
    const glyph = chevron.querySelector('svg') as SVGElement

    expect(getComputedStyle(glyph).display).toBe('block')

    const middle = (rect: DOMRect) => rect.y + rect.height / 2
    expect(middle(glyph.getBoundingClientRect())).toBeCloseTo(
      middle(chevron.getBoundingClientRect()),
      1,
    )
    expect(middle(glyph.getBoundingClientRect())).toBeCloseTo(
      middle(rowOf(element).getBoundingClientRect()),
      1,
    )
  })

  it('toggles and reports the new state on click', async () => {
    const element = await mount('<fd-expandable-row label="Advanced"></fd-expandable-row>')
    const states: boolean[] = []
    element.addEventListener('fd-change', (event) => {
      states.push(event.detail.checked as boolean)
    })

    rowOf(element).click()
    await element.updateComplete
    expect(element.expanded).toBe(true)

    rowOf(element).click()
    await element.updateComplete
    expect(element.expanded).toBe(false)
    expect(states).toEqual([true, false])
  })

  it('exposes the disclosure state to assistive technology', async () => {
    const element = await mount('<fd-expandable-row label="Advanced"></fd-expandable-row>')
    expect(rowOf(element).getAttribute('aria-expanded')).toBe('false')
    expect(rowOf(element).getAttribute('aria-label')).toBe('Advanced, Collapsed')

    element.expanded = true
    await element.updateComplete
    expect(rowOf(element).getAttribute('aria-expanded')).toBe('true')
    expect(rowOf(element).getAttribute('aria-label')).toBe('Advanced, Expanded')
  })

  /** contentShape(Rectangle()) — the padding is part of the hit target, not dead space. */
  it('makes the whole row the hit target', async () => {
    const element = await mount('<fd-expandable-row label="Advanced"></fd-expandable-row>')
    const row = rowOf(element).getBoundingClientRect()
    const host = element.getBoundingClientRect()

    expect(Math.round(row.width)).toBe(Math.round(host.width))
    expect(Math.round(row.height)).toBe(Math.round(host.height))
  })

  it('stays put while disabled', async () => {
    const element = await mount('<fd-expandable-row label="Advanced" disabled></fd-expandable-row>')
    rowOf(element).click()
    await element.updateComplete

    expect(element.expanded).toBe(false)
  })
})
