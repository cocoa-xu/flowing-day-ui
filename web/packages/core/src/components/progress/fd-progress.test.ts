import { afterEach, describe, expect, it } from 'vitest'
import type { FdProgress } from './fd-progress.js'
import './fd-progress.js'

async function mount(markup: string): Promise<FdProgress> {
  const host = document.createElement('div')
  host.innerHTML = markup
  document.body.append(host)
  const element = host.firstElementChild as FdProgress
  element.style.width = '200px'
  await element.updateComplete
  return element
}

const partOf = (element: FdProgress, selector: string) =>
  element.shadowRoot?.querySelector(selector) as HTMLElement

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-progress', () => {
  it('draws the determinate fraction with the Swift track height', async () => {
    const element = await mount('<fd-progress label="Loading" value="1" total="4"></fd-progress>')
    const track = partOf(element, '.track')
    const fill = partOf(element, '.fill')

    expect(track.getBoundingClientRect().height).toBeCloseTo(4, 1)
    expect(getComputedStyle(fill).scale).toBe('0.25 1')
    expect(element.getAttribute('aria-valuenow')).toBe('0.25')
  })

  it('clamps determinate progress to the available range', async () => {
    const element = await mount('<fd-progress value="5" total="2"></fd-progress>')
    expect(Number.parseFloat(partOf(element, '.fill').style.scale)).toBe(1)

    element.value = -2
    await element.updateComplete
    expect(Number.parseFloat(partOf(element, '.fill').style.scale)).toBe(0)
  })

  it('uses zero for invalid determinate arithmetic', async () => {
    const element = await mount('<fd-progress value="1" total="0"></fd-progress>')
    expect(Number.parseFloat(partOf(element, '.fill').style.scale)).toBe(0)
  })

  it('draws a custom ongoing indicator when value is absent', async () => {
    const element = await mount('<fd-progress label="Syncing"></fd-progress>')

    expect(element.shadowRoot?.querySelector('.indicator')).not.toBeNull()
    expect(element.shadowRoot?.querySelector('.track')).toBeNull()
    expect(element.hasAttribute('aria-valuenow')).toBe(false)
  })

  it('accepts rich label content through its default slot', async () => {
    const element = await mount('<fd-progress value="0.5"><strong>Halfway</strong></fd-progress>')
    await element.updateComplete

    expect(partOf(element, '.label').hidden).toBe(false)
    expect(element.getAttribute('aria-label')).toBe('Halfway')
  })

  it('keeps an unlabeled progress control compact', async () => {
    const element = await mount('<fd-progress value="0.5"></fd-progress>')
    expect(partOf(element, '.label').hidden).toBe(true)
  })
})
