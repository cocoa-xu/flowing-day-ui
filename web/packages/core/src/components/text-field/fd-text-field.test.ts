import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FdSecureField } from '../secure-field/fd-secure-field.js'
import type { FdTextArea } from '../text-area/fd-text-area.js'
import type { FdTextField } from './fd-text-field.js'
import '../secure-field/fd-secure-field.js'
import '../text-area/fd-text-area.js'
import './fd-text-field.js'

type Field = FdTextField | FdSecureField | FdTextArea

async function mount<T extends Field>(markup: string): Promise<T> {
  const host = document.createElement('div')
  host.innerHTML = markup
  document.body.append(host)
  const element = host.firstElementChild as T
  await element.updateComplete
  return element
}

const inputOf = (element: Field) =>
  element.shadowRoot?.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement

afterEach(() => {
  document.body.replaceChildren()
})

describe('text input family', () => {
  it('matches the Swift single-line field geometry', async () => {
    const element = await mount<FdTextField>('<fd-text-field label="Name"></fd-text-field>')
    const field = element.shadowRoot?.querySelector('.field') as HTMLElement

    expect(field.getBoundingClientRect().height).toBeCloseTo(30, 1)
    expect(getComputedStyle(field).borderRadius).toBe('8px')
    expect(getComputedStyle(field).paddingInlineStart).toBe('10px')
  })

  it('uses text and password inputs for their respective controls', async () => {
    const text = await mount<FdTextField>('<fd-text-field label="Name"></fd-text-field>')
    const secure = await mount<FdSecureField>(
      '<fd-secure-field label="Password"></fd-secure-field>',
    )

    expect(inputOf(text).type).toBe('text')
    expect(inputOf(secure).type).toBe('password')
    expect(inputOf(text).placeholder).toBe('Name')
    expect(inputOf(secure).getAttribute('aria-label')).toBe('Password')
  })

  it('reports live edits and submission', async () => {
    const element = await mount<FdTextField>('<fd-text-field label="Name"></fd-text-field>')
    const changes: string[] = []
    const submit = vi.fn()
    element.addEventListener('fd-change', (event) => changes.push(event.detail.value ?? ''))
    element.addEventListener('fd-submit', submit)

    const input = inputOf(element)
    input.value = 'Flowing Day'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    expect(element.value).toBe('Flowing Day')
    expect(changes).toEqual(['Flowing Day'])
    expect(submit).toHaveBeenCalledOnce()
  })

  it('participates in form submission and reset', async () => {
    const form = document.createElement('form')
    form.innerHTML = '<fd-text-field name="project" value="Flowing Day"></fd-text-field>'
    document.body.append(form)
    const element = form.firstElementChild as FdTextField
    await element.updateComplete

    expect(new FormData(form).get('project')).toBe('Flowing Day')
    element.value = 'Changed'
    await element.updateComplete
    form.reset()

    expect(element.value).toBe('Flowing Day')
    expect(new FormData(form).get('project')).toBe('Flowing Day')
  })

  it('excludes a disabled field from form data', async () => {
    const form = document.createElement('form')
    form.innerHTML = '<fd-secure-field name="secret" value="hidden" disabled></fd-secure-field>'
    document.body.append(form)
    const element = form.firstElementChild as FdSecureField
    await element.updateComplete

    expect(new FormData(form).has('secret')).toBe(false)
    expect(inputOf(element).disabled).toBe(true)
  })

  it('uses the requested textarea height and falls back for invalid values', async () => {
    const element = await mount<FdTextArea>(
      '<fd-text-area label="Notes" minimum-height="112"></fd-text-area>',
    )
    const field = element.shadowRoot?.querySelector('.field') as HTMLElement
    expect(field.getBoundingClientRect().height).toBeGreaterThanOrEqual(112)

    element.minimumHeight = Number.NaN
    await element.updateComplete
    expect(field.getBoundingClientRect().height).toBeGreaterThanOrEqual(84)
  })

  it('reports multiline edits without turning Enter into submit', async () => {
    const element = await mount<FdTextArea>('<fd-text-area label="Notes"></fd-text-area>')
    const submit = vi.fn()
    element.addEventListener('fd-submit', submit)
    const input = inputOf(element)
    input.value = 'First\nSecond'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    expect(element.value).toBe('First\nSecond')
    expect(submit).not.toHaveBeenCalled()
  })
})
