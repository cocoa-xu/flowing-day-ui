import { describe, expect, it } from 'vitest'
import { FdGraphDefaultGuideRenderer } from './guide-renderer.js'

describe('default graph guide renderer', () => {
  it('renders measurements and customization parts without replacing its element', () => {
    const renderer = new FdGraphDefaultGuideRenderer({
      measurementFormatter: (measurement) => `${measurement} pt`,
    })
    const element = renderer.createElement()
    const guide = {
      axis: 'horizontal' as const,
      position: 80,
      lowerBound: 20,
      upperBound: 120,
      kind: 'resize' as const,
      measurement: 100,
    }

    renderer.updateElement(element, { guide, index: 0, zoom: 1 })

    expect(element.dataset.kind).toBe('resize')
    expect(element.getAttribute('part')).toBe('guide guide-resize')
    expect(element.querySelector('.guide-label')?.textContent).toBe('100 pt')
    expect(element.querySelector('.guide-label')?.getAttribute('part')).toBe('guide-label')
    expect(element.querySelector<HTMLElement>('.guide-tick')?.hidden).toBe(false)
  })

  it('hides labels below the configured rendered length', () => {
    const renderer = new FdGraphDefaultGuideRenderer({ minimumLabelLength: 40 })
    const element = renderer.createElement()
    renderer.updateElement(element, {
      guide: {
        axis: 'vertical',
        position: 40,
        lowerBound: 0,
        upperBound: 100,
        kind: 'equalSpacing',
        measurement: 100,
      },
      index: 0,
      zoom: 0.25,
    })

    expect(element.querySelector<HTMLElement>('.guide-label')?.hidden).toBe(true)
  })

  it('rejects invalid label thresholds', () => {
    expect(() => new FdGraphDefaultGuideRenderer({ minimumLabelLength: -1 })).toThrow(RangeError)
  })
})
