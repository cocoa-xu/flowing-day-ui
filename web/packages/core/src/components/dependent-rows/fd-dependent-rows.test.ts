import { afterEach, describe, expect, it } from 'vitest'
import type { FdSwitchGroup } from '../switch-group/fd-switch-group.js'
import '../switch-group/fd-switch-group.js'
import type { FdDependentRows } from './fd-dependent-rows.js'
import './fd-dependent-rows.js'

async function mount<T extends HTMLElement>(markup: string): Promise<T> {
  const host = document.createElement('div')
  host.innerHTML = markup
  document.body.append(host)
  const element = host.firstElementChild as T & { updateComplete: Promise<unknown> }
  await element.updateComplete
  await element.updateComplete
  return element
}

const BODY = '<div style="height:40px">dependent row</div>'

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-dependent-rows', () => {
  it('collapses to nothing while hidden', async () => {
    const element = await mount<FdDependentRows>(`<fd-dependent-rows>${BODY}</fd-dependent-rows>`)
    expect(element.getBoundingClientRect().height).toBe(0)
  })

  it('expands to its content once visible', async () => {
    const element = await mount<FdDependentRows>(
      `<fd-dependent-rows visible>${BODY}</fd-dependent-rows>`,
    )
    // 40px of content plus the 1px separator rule.
    expect(element.getBoundingClientRect().height).toBe(41)
  })

  it('clips its content so rows cannot spill out mid-collapse', async () => {
    const element = await mount<FdDependentRows>(`<fd-dependent-rows>${BODY}</fd-dependent-rows>`)
    const clip = element.shadowRoot?.querySelector('.clip') as HTMLElement
    expect(getComputedStyle(clip).overflow).toBe('hidden')
  })

  it('shows an indented separator by default', async () => {
    const element = await mount<FdDependentRows>(
      `<fd-dependent-rows visible>${BODY}</fd-dependent-rows>`,
    )
    const separator = element.shadowRoot?.querySelector('fd-separator') as HTMLElement

    expect(separator).not.toBeNull()
    expect(separator.hasAttribute('indented')).toBe(true)
    expect(getComputedStyle(separator).paddingLeft).toBe('52px')
  })

  it('can drop the separator or flush it to the row edge', async () => {
    const flush = await mount<FdDependentRows>(
      `<fd-dependent-rows visible separator-flush>${BODY}</fd-dependent-rows>`,
    )
    expect(
      getComputedStyle(flush.shadowRoot?.querySelector('fd-separator') as Element).paddingLeft,
    ).toBe('18px')

    const none = await mount<FdDependentRows>(
      `<fd-dependent-rows visible no-separator>${BODY}</fd-dependent-rows>`,
    )
    expect(none.shadowRoot?.querySelector('fd-separator')).toBeNull()
  })

  /** PreferencesDependentRowsMotion: 0.18s easeOut with a -5pt entry offset. */
  it('animates on the disclosure motion tokens', async () => {
    const element = await mount<FdDependentRows>(`<fd-dependent-rows>${BODY}</fd-dependent-rows>`)
    const content = element.shadowRoot?.querySelector('.content') as HTMLElement

    expect(getComputedStyle(element).transitionDuration).toBe('0.18s')
    expect(getComputedStyle(element).transitionProperty).toBe('grid-template-rows')
    expect(getComputedStyle(content).translate).toBe('0px -5px')
  })

  it('settles at its resting position once visible', async () => {
    const element = await mount<FdDependentRows>(
      `<fd-dependent-rows visible>${BODY}</fd-dependent-rows>`,
    )
    const content = element.shadowRoot?.querySelector('.content') as HTMLElement
    expect(getComputedStyle(content).opacity).toBe('1')
  })
})

describe('fd-switch-group', () => {
  it('keeps the dependent rows hidden until the switch is on', async () => {
    const element = await mount<FdSwitchGroup>(
      `<fd-switch-group label="Show USB devices">${BODY}</fd-switch-group>`,
    )
    const rows = element.shadowRoot?.querySelector('fd-dependent-rows') as FdDependentRows

    expect(rows.visible).toBe(false)

    element.checked = true
    await element.updateComplete
    expect(rows.visible).toBe(true)
  })

  it('follows the switch when the user toggles it', async () => {
    const element = await mount<FdSwitchGroup>(
      `<fd-switch-group label="Show USB devices">${BODY}</fd-switch-group>`,
    )
    const control = element.shadowRoot
      ?.querySelector('fd-switch-row')
      ?.shadowRoot?.querySelector('fd-switch') as HTMLElement

    control.click()
    await element.updateComplete

    expect(element.checked).toBe(true)
    const rows = element.shadowRoot?.querySelector('fd-dependent-rows') as FdDependentRows
    expect(rows.visible).toBe(true)
  })

  it('passes the separator options through', async () => {
    const element = await mount<FdSwitchGroup>(
      `<fd-switch-group label="Show USB devices" checked no-separator>${BODY}</fd-switch-group>`,
    )
    const rows = element.shadowRoot?.querySelector('fd-dependent-rows') as FdDependentRows

    expect(rows.noSeparator).toBe(true)
    expect(rows.shadowRoot?.querySelector('fd-separator')).toBeNull()
  })
})
