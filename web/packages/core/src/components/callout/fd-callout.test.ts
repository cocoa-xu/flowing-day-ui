import { afterEach, describe, expect, it } from 'vitest'
import './fd-callout.js'

afterEach(() => document.body.replaceChildren())

describe('fd-callout', () => {
  it('defaults to the Swift informational card presentation', async () => {
    const callout = document.createElement('fd-callout')
    callout.title = 'Connected'
    callout.textContent = 'The device is ready.'
    document.body.append(callout)
    await callout.updateComplete

    expect(callout.tone).toBe('informational')
    expect(callout.presentation).toBe('card')
    expect(callout.shadowRoot?.querySelector('.title')?.textContent).toBe('Connected')
    expect(callout.shadowRoot?.querySelector('.symbol svg')).not.toBeNull()
  })

  it('uses an explicitly supplied symbol', async () => {
    const callout = document.createElement('fd-callout')
    callout.symbol = 'network'
    document.body.append(callout)
    await callout.updateComplete

    expect(callout.shadowRoot?.querySelector('fd-icon')?.name).toBe('network')
  })
})
