import { afterEach, describe, expect, it } from 'vitest'
import type { FdSlider } from '../slider/fd-slider.js'
import type { FdSliderRow } from './fd-slider-row.js'
import './fd-slider-row.js'

async function mount(html: string): Promise<FdSliderRow> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const element = host.firstElementChild as FdSliderRow
  await element.updateComplete
  return element
}

const partOf = (element: FdSliderRow, selector: string) =>
  element.shadowRoot?.querySelector(selector) as HTMLElement

const sliderOf = (element: FdSliderRow) =>
  element.shadowRoot?.querySelector('fd-slider') as FdSlider

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-slider-row', () => {
  it('stacks header, slider and caption 7px apart, padded 18/11', async () => {
    const element = await mount(
      '<fd-slider-row label="Volume" caption="Applies to alerts."></fd-slider-row>',
    )
    const style = getComputedStyle(partOf(element, '.stack'))

    expect(style.rowGap).toBe('7px')
    expect(style.paddingLeft).toBe('18px')
    expect(style.paddingTop).toBe('11px')
    expect(style.paddingBottom).toBe('11px')
  })

  /** The header spaces by 10, not the 14 a PreferencesRow uses. */
  it('spaces the header by 10', async () => {
    const element = await mount('<fd-slider-row label="Volume"></fd-slider-row>')
    expect(getComputedStyle(partOf(element, '.header')).columnGap).toBe('10px')
  })

  it('draws the value in the slider value role, with tabular digits', async () => {
    const element = await mount('<fd-slider-row label="Volume" value="0.5"></fd-slider-row>')
    const style = getComputedStyle(partOf(element, '.value'))

    expect(style.fontSize).toBe('11.5px')
    expect(style.fontVariantNumeric).toBe('tabular-nums')
  })

  it('formats the value with the supplied formatter', async () => {
    const element = await mount('<fd-slider-row label="Volume" min="0" max="1"></fd-slider-row>')
    element.format = (value) => `${Math.round(value * 100)}%`
    element.value = 0.42
    await element.updateComplete
    await sliderOf(element).updateComplete

    expect(partOf(element, '.value').textContent).toBe('42%')
    expect(sliderOf(element).getAttribute('aria-valuetext')).toBe('42%')
  })

  it('hands the range and step down to the slider', async () => {
    const element = await mount(
      '<fd-slider-row label="Volume" min="0" max="10" step="2" value="4"></fd-slider-row>',
    )
    const slider = sliderOf(element)

    expect(slider.min).toBe(0)
    expect(slider.max).toBe(10)
    expect(slider.step).toBe(2)
    expect(slider.value).toBe(4)
  })

  it('follows the slider and re-renders the formatted value', async () => {
    const element = await mount('<fd-slider-row label="Volume" min="0" max="100"></fd-slider-row>')
    const slider = sliderOf(element)
    slider.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: { valueAsNumber: 60 },
        bubbles: true,
        composed: true,
      }),
    )
    await element.updateComplete

    expect(element.value).toBe(60)
    expect(partOf(element, '.value').textContent).toBe('60')
  })

  it('lets the change reach a listener on the row', async () => {
    const element = await mount('<fd-slider-row label="Volume" min="0" max="100"></fd-slider-row>')
    const values: number[] = []
    element.addEventListener('fd-change', (event) => {
      values.push(event.detail.valueAsNumber as number)
    })

    sliderOf(element).dispatchEvent(
      new CustomEvent('fd-change', {
        detail: { valueAsNumber: 60 },
        bubbles: true,
        composed: true,
      }),
    )

    expect(values).toEqual([60])
  })

  it('names the slider by the row label', async () => {
    const element = await mount('<fd-slider-row label="Volume"></fd-slider-row>')
    expect(sliderOf(element).getAttribute('aria-label')).toBe('Volume')
  })

  it('omits the caption and the symbol when neither is given', async () => {
    const element = await mount('<fd-slider-row label="Volume"></fd-slider-row>')

    expect(element.shadowRoot?.querySelector('.caption')).toBeNull()
    expect(element.shadowRoot?.querySelector('fd-icon')).toBeNull()
  })

  it('spans the row with the slider', async () => {
    const element = await mount('<fd-slider-row label="Volume"></fd-slider-row>')
    element.style.width = '400px'
    await element.updateComplete

    // 400 less the 18px inset on each side.
    expect(sliderOf(element).getBoundingClientRect().width).toBeCloseTo(364, 0)
  })
})
