import { afterEach, describe, expect, it } from 'vitest'
import type { FdSlider } from './fd-slider.js'
import './fd-slider.js'

async function mount(html: string): Promise<FdSlider> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const element = host.firstElementChild as FdSlider
  element.style.width = '213px'
  await element.updateComplete
  return element
}

const partOf = (element: FdSlider, selector: string) =>
  element.shadowRoot?.querySelector(selector) as HTMLElement

/** The Swift control reads locationInWindow; a pointer event carries clientX. */
function drag(element: FdSlider, offsetX: number, type = 'pointerdown'): void {
  const bounds = element.getBoundingClientRect()
  element.dispatchEvent(
    new PointerEvent(type, {
      clientX: bounds.left + offsetX,
      clientY: bounds.top + 8,
      bubbles: true,
      pointerId: 1,
    }),
  )
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('fd-slider', () => {
  it('stands 16px tall, as .frame(height: 16) asks', async () => {
    const element = await mount('<fd-slider></fd-slider>')
    expect(getComputedStyle(element).height).toBe('16px')
  })

  it('insets the track by half a knob at each end', async () => {
    const element = await mount('<fd-slider></fd-slider>')
    const track = partOf(element, '.track').getBoundingClientRect()
    const bounds = element.getBoundingClientRect()

    expect(track.left - bounds.left).toBeCloseTo(6.5, 1)
    expect(bounds.right - track.right).toBeCloseTo(6.5, 1)
    expect(track.height).toBeCloseTo(3, 1)
  })

  it('draws a 13px knob with its border inside its own bounds', async () => {
    const element = await mount('<fd-slider></fd-slider>')
    const knob = partOf(element, '.knob')

    expect(knob.getBoundingClientRect().width).toBeCloseTo(13, 1)
    expect(getComputedStyle(knob).boxShadow).toContain('inset')
  })

  it('parks the knob at each end of its travel', async () => {
    const element = await mount('<fd-slider value="0"></fd-slider>')
    const bounds = element.getBoundingClientRect()
    expect(partOf(element, '.knob').getBoundingClientRect().left - bounds.left).toBeCloseTo(0, 1)

    element.value = 1
    await element.updateComplete
    expect(bounds.right - partOf(element, '.knob').getBoundingClientRect().right).toBeCloseTo(0, 1)
  })

  it('runs the fill from the track start to the knob', async () => {
    const element = await mount('<fd-slider value="0.5"></fd-slider>')
    // usableWidth = 213 - 13 = 200, so half of it is 100.
    expect(partOf(element, '.progress').getBoundingClientRect().width).toBeCloseTo(100, 0)
  })

  /** fraction = (x - knobDiameter / 2) / max(width - knobDiameter, 1) */
  it('takes the value from the pointer using the Swift arithmetic', async () => {
    const element = await mount('<fd-slider min="0" max="100"></fd-slider>')

    drag(element, 6.5 + 50)
    expect(element.value).toBeCloseTo(25, 4)

    drag(element, 6.5 + 200)
    expect(element.value).toBeCloseTo(100, 4)
  })

  it('clamps a pointer outside the track', async () => {
    const element = await mount('<fd-slider min="0" max="100"></fd-slider>')

    drag(element, -40)
    expect(element.value).toBe(0)

    drag(element, 400)
    expect(element.value).toBe(100)
  })

  it('quantises to the step before clamping', async () => {
    const element = await mount('<fd-slider min="0" max="100" step="25"></fd-slider>')

    drag(element, 6.5 + 60)
    expect(element.value).toBe(25)

    drag(element, 6.5 + 95)
    expect(element.value).toBe(50)
  })

  /** Steps are counted off the lower bound, so 8 rounds up onto the 3, 5, 7, 9 grid. */
  it('keeps a stepped value on the offset grid of a non-zero lower bound', async () => {
    const element = await mount('<fd-slider min="3" max="13" step="2"></fd-slider>')

    drag(element, 6.5 + 100)
    expect(element.value).toBe(9)
  })

  it('follows the pointer only while the button is down', async () => {
    const element = await mount('<fd-slider min="0" max="100"></fd-slider>')

    drag(element, 6.5 + 100, 'pointermove')
    expect(element.value).toBe(0)

    drag(element, 6.5 + 20)
    drag(element, 6.5 + 100, 'pointermove')
    expect(element.value).toBeCloseTo(50, 4)

    drag(element, 6.5 + 100, 'pointerup')
    drag(element, 6.5 + 200, 'pointermove')
    expect(element.value).toBeCloseTo(50, 4)
  })

  it('reports each move', async () => {
    const element = await mount('<fd-slider min="0" max="100"></fd-slider>')
    const values: number[] = []
    element.addEventListener('fd-change', (event) => {
      values.push(event.detail.valueAsNumber as number)
    })

    drag(element, 6.5 + 50)
    drag(element, 6.5 + 100, 'pointermove')

    expect(values).toEqual([25, 50])
  })

  it('stays put while disabled', async () => {
    const element = await mount('<fd-slider min="0" max="100" disabled></fd-slider>')
    drag(element, 6.5 + 100)

    expect(element.value).toBe(0)
    expect(element.tabIndex).toBe(-1)
  })

  /** The adjustable action steps by the step, or a twentieth of the range without one. */
  it('adjusts by a twentieth of the range from the keyboard', async () => {
    const element = await mount('<fd-slider min="0" max="100"></fd-slider>')

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(element.value).toBe(5)

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(element.value).toBe(0)
  })

  it('adjusts by the step when there is one, and stops at the bounds', async () => {
    const element = await mount('<fd-slider min="0" max="10" step="4" value="8"></fd-slider>')

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    expect(element.value).toBe(10)

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    expect(element.value).toBe(10)
  })

  it('exposes itself as a slider to assistive technology', async () => {
    const element = await mount('<fd-slider min="0" max="10" value="2.5"></fd-slider>')

    expect(element.getAttribute('role')).toBe('slider')
    expect(element.getAttribute('aria-valuemin')).toBe('0')
    expect(element.getAttribute('aria-valuemax')).toBe('10')
    expect(element.getAttribute('aria-valuenow')).toBe('2.5')
    expect(element.getAttribute('aria-valuetext')).toBe('2.50')
    expect(element.tabIndex).toBe(0)
  })

  it('submits with a form and restores on reset', async () => {
    const form = document.createElement('form')
    document.body.append(form)
    form.innerHTML = '<fd-slider name="volume" min="0" max="10" value="4"></fd-slider>'
    const element = form.firstElementChild as FdSlider
    await element.updateComplete

    expect(new FormData(form).get('volume')).toBe('4')
    expect(element.form).toBe(form)

    element.value = 9
    await element.updateComplete
    expect(new FormData(form).get('volume')).toBe('9')

    form.reset()
    await element.updateComplete
    expect(element.value).toBe(4)
  })
})
