import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import type { FdSelectableTag } from './fd-selectable-tag.js'
import './fd-selectable-tag.js'

async function mount(html: string): Promise<FdSelectableTag> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const element = host.firstElementChild as FdSelectableTag
  await element.updateComplete
  return element
}

const tagOf = (element: FdSelectableTag) =>
  element.shadowRoot?.querySelector('.tag') as HTMLButtonElement

const settle = (element: HTMLElement) =>
  Promise.all(element.getAnimations().map((animation) => animation.finished))

/** Both `rgba(r, g, b, a)` and `color(srgb r g b / a)` come back from color-mix. */
function alphaOf(value: string): number {
  const slashed = value.match(/\/\s*([\d.]+)\s*\)/)
  if (slashed) return Number(slashed[1])

  const channels = value.match(/rgba?\(([^)]+)\)/)?.[1]
  if (!channels) return 1
  const parts = channels.split(/[,\s]+/).filter(Boolean)
  return parts.length > 3 ? Number(parts[3]) : 1
}

async function hover(element: FdSelectableTag): Promise<void> {
  await page.elementLocator(tagOf(element)).hover()
  await settle(tagOf(element))
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-selectable-tag', () => {
  it('shares the tag pill geometry', async () => {
    const element = await mount('<fd-selectable-tag label="beta"></fd-selectable-tag>')
    const style = getComputedStyle(tagOf(element))

    expect(style.paddingLeft).toBe('10px')
    expect(style.paddingTop).toBe('6px')
    expect(style.borderRadius).toBe('8px')
    expect(style.fontSize).toBe('11px')
  })

  it('dims the label to 0.62 and the border to 0.12 while unselected', async () => {
    const element = await mount('<fd-selectable-tag label="beta"></fd-selectable-tag>')
    const style = getComputedStyle(tagOf(element))

    expect(alphaOf(style.color)).toBeCloseTo(0.62, 2)
    expect(alphaOf(style.boxShadow)).toBeCloseTo(0.12, 2)
  })

  it('takes the full foreground and a 0.24 border once selected', async () => {
    const element = await mount('<fd-selectable-tag label="beta" selected></fd-selectable-tag>')
    await settle(tagOf(element))
    const style = getComputedStyle(tagOf(element))

    expect(alphaOf(style.color)).toBeCloseTo(1, 2)
    expect(alphaOf(style.boxShadow)).toBeCloseTo(0.24, 2)
  })

  it('lifts an unselected pill to 0.8 and 0.24 on hover', async () => {
    const element = await mount('<fd-selectable-tag label="beta"></fd-selectable-tag>')
    await hover(element)
    const style = getComputedStyle(tagOf(element))

    expect(alphaOf(style.color)).toBeCloseTo(0.8, 2)
    expect(alphaOf(style.boxShadow)).toBeCloseTo(0.24, 2)
  })

  it('lifts a selected pill to a 0.35 border on hover', async () => {
    const element = await mount('<fd-selectable-tag label="beta" selected></fd-selectable-tag>')
    await hover(element)

    expect(alphaOf(getComputedStyle(tagOf(element)).boxShadow)).toBeCloseTo(0.35, 2)
  })

  it('draws the border inside the shape, as strokeBorder does', async () => {
    const element = await mount('<fd-selectable-tag label="beta"></fd-selectable-tag>')
    expect(getComputedStyle(tagOf(element)).boxShadow).toContain('inset')
  })

  /** .animation(.easeOut(duration: 0.16), value: isSelected) */
  it('animates a selection change over 0.16s', async () => {
    const element = await mount('<fd-selectable-tag label="beta"></fd-selectable-tag>')
    element.selected = true
    await element.updateComplete

    expect(getComputedStyle(tagOf(element)).transitionDuration).toBe('0.16s')
  })

  /** .animation(.easeOut(duration: 0.12), value: isHovering) */
  it('animates a hover change over 0.12s', async () => {
    const element = await mount('<fd-selectable-tag label="beta"></fd-selectable-tag>')
    await hover(element)

    expect(getComputedStyle(tagOf(element)).transitionDuration).toBe('0.12s')
  })

  it('re-derives the accent from inactive-accent while unselected', async () => {
    const element = await mount(
      '<fd-selectable-tag label="beta" inactive-accent="#B4674D"></fd-selectable-tag>',
    )
    const tag = tagOf(element)

    expect(tag.hasAttribute('data-fd-accent-scope')).toBe(true)
    expect(tag.style.getPropertyValue('--fd-accent')).toBe('#B4674D')

    element.selected = true
    await element.updateComplete
    expect(tagOf(element).hasAttribute('data-fd-accent-scope')).toBe(false)
  })

  it('actually retints, rather than only carrying the attribute', async () => {
    const plain = await mount('<fd-selectable-tag label="beta"></fd-selectable-tag>')
    const retinted = await mount(
      '<fd-selectable-tag label="beta" inactive-accent="#B4674D"></fd-selectable-tag>',
    )

    expect(getComputedStyle(tagOf(retinted)).color).not.toBe(getComputedStyle(tagOf(plain)).color)
  })

  it('leaves selection to the caller and reports the press', async () => {
    const element = await mount('<fd-selectable-tag label="beta" value="beta"></fd-selectable-tag>')
    const details: unknown[] = []
    element.addEventListener('fd-activate', (event) => details.push(event.detail))

    tagOf(element).click()
    await element.updateComplete

    expect(details).toEqual([{ value: 'beta' }])
    expect(element.selected).toBe(false)
  })

  it('exposes its state without repeating it in the name', async () => {
    const element = await mount('<fd-selectable-tag label="beta"></fd-selectable-tag>')

    expect(tagOf(element).hasAttribute('aria-label')).toBe(false)
    expect(page.getByRole('button', { name: 'beta', pressed: false }).elements()).toHaveLength(1)

    element.selected = true
    await element.updateComplete
    expect(page.getByRole('button', { name: 'beta', pressed: true }).elements()).toHaveLength(1)
  })
})
