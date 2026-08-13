import { afterEach, describe, expect, it } from 'vitest'
import type { FdSecureField } from '../secure-field/fd-secure-field.js'
import type { FdTextArea } from '../text-area/fd-text-area.js'
import type { FdTextField } from './fd-text-field.js'
import '../secure-field/fd-secure-field.js'
import '../text-area/fd-text-area.js'
import './fd-text-field.js'

afterEach(() => document.body.replaceChildren())

describe('field validation', () => {
  it.each([
    ['fd-text-field', 'text'] as const,
    ['fd-secure-field', 'password'] as const,
    ['fd-text-area', null] as const,
  ])('shows validation consistently for %s', async (tagName, inputType) => {
    const field = document.createElement(tagName) as FdTextField | FdSecureField | FdTextArea
    field.validation = { kind: 'warning', message: 'Check this value.' }
    field.supportingText = 'Supporting context.'
    document.body.append(field)
    await field.updateComplete

    expect(field.shadowRoot?.querySelector('.field')?.getAttribute('data-validation')).toBe(
      'warning',
    )
    expect(field.shadowRoot?.querySelector('.supporting')?.textContent).toContain(
      'Check this value.',
    )
    if (inputType) {
      expect(field.shadowRoot?.querySelector('input')?.type).toBe(inputType)
    }
  })

  it('falls back to supporting text when success has no message', async () => {
    const field = document.createElement('fd-text-field')
    field.validation = { kind: 'success' }
    field.supportingText = 'Saved automatically.'
    document.body.append(field)
    await field.updateComplete

    const supporting = field.shadowRoot?.querySelector('.supporting')
    expect(supporting?.getAttribute('data-validation')).toBe('none')
    expect(supporting?.querySelector('.validation-icon')).toBeNull()
    expect(supporting?.textContent).toContain('Saved automatically.')
  })
})
