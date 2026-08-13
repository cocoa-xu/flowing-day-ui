import { afterEach, describe, expect, it } from 'vitest'
import type { FdDisclosureContent } from './fd-disclosure-content.js'
import './fd-disclosure-content.js'

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-disclosure-content', () => {
  it('exposes the Swift content-only expansion primitive', async () => {
    const element = document.createElement('fd-disclosure-content') as FdDisclosureContent
    element.innerHTML = '<p>Details</p>'
    document.body.append(element)
    await element.updateComplete

    expect(getComputedStyle(element).gridTemplateRows).toBe('0px')

    element.isExpanded = true
    await element.updateComplete
    expect(element.hasAttribute('expanded')).toBe(true)
    expect(element.textContent).toContain('Details')
  })
})
