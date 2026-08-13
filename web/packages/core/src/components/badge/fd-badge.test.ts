import { afterEach, describe, expect, it } from 'vitest'
import type { FdBadge } from './fd-badge.js'
import './fd-badge.js'

afterEach(() => document.body.replaceChildren())

describe('fd-badge', () => {
  it('defaults to Swift subtle neutral presentation', async () => {
    const badge = document.createElement('fd-badge')
    badge.title = 'Available'
    document.body.append(badge)
    await badge.updateComplete

    expect(badge.tone).toBe('neutral')
    expect(badge.emphasis).toBe('subtle')
    expect(badge.getAttribute('title')).toBeNull()
    expect(badge.shadowRoot?.querySelector('.title')?.textContent).toBe('Available')
  })

  it('renders an optional symbol through the shared registry', async () => {
    const badge = document.createElement('fd-badge') as FdBadge
    badge.symbol = 'sparkles'
    document.body.append(badge)
    await badge.updateComplete

    expect(badge.shadowRoot?.querySelector('fd-icon')?.name).toBe('sparkles')
  })
})
