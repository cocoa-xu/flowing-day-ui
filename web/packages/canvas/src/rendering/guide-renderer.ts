import type { FdGraphGuide } from '../interactions/arrangement.js'

export interface FdGraphGuideRenderContext {
  readonly guide: FdGraphGuide
  readonly index: number
  readonly zoom: number
}

export interface FdGraphGuideRenderer {
  createElement(): HTMLElement
  updateElement(element: HTMLElement, context: FdGraphGuideRenderContext): void
}

export interface FdGraphDefaultGuideRendererConfiguration {
  readonly measurementFormatter?: (measurement: number, guide: FdGraphGuide) => string
  readonly minimumLabelLength?: number
}

const defaultMeasurementFormatter = (measurement: number): string => String(Math.round(measurement))

interface FdGraphDefaultGuideElements {
  readonly startTick: HTMLElement
  readonly endTick: HTMLElement
  readonly label: HTMLElement
}

const guidePart = {
  alignment: 'guide-alignment',
  equalSpacing: 'guide-equal-spacing',
  equalSize: 'guide-equal-size',
  grid: 'guide-grid',
  resize: 'guide-resize',
} as const

export class FdGraphDefaultGuideRenderer implements FdGraphGuideRenderer {
  private readonly measurementFormatter: (measurement: number, guide: FdGraphGuide) => string
  private readonly minimumLabelLength: number
  private readonly elements = new WeakMap<HTMLElement, FdGraphDefaultGuideElements>()

  constructor(configuration: FdGraphDefaultGuideRendererConfiguration = {}) {
    this.measurementFormatter = configuration.measurementFormatter ?? defaultMeasurementFormatter
    this.minimumLabelLength = configuration.minimumLabelLength ?? 24
    if (!Number.isFinite(this.minimumLabelLength) || this.minimumLabelLength < 0) {
      throw new RangeError('minimum guide label length must not be negative')
    }
  }

  createElement(): HTMLElement {
    const element = document.createElement('span')
    element.className = 'graph-guide'
    const line = document.createElement('span')
    line.className = 'guide-line'
    line.setAttribute('part', 'guide-line')
    const startTick = document.createElement('span')
    startTick.className = 'guide-tick guide-tick-start'
    startTick.setAttribute('part', 'guide-tick guide-start-tick')
    const endTick = document.createElement('span')
    endTick.className = 'guide-tick guide-tick-end'
    endTick.setAttribute('part', 'guide-tick guide-end-tick')
    const label = document.createElement('span')
    label.className = 'guide-label'
    label.setAttribute('part', 'guide-label')
    element.append(line, startTick, endTick, label)
    this.elements.set(element, { startTick, endTick, label })
    return element
  }

  updateElement(element: HTMLElement, { guide, zoom }: FdGraphGuideRenderContext): void {
    const children = this.elements.get(element)
    if (!children) throw new TypeError('guide element was not created by this renderer')
    element.hidden = false
    if (element.dataset.axis !== guide.axis) element.dataset.axis = guide.axis
    if (element.dataset.kind !== guide.kind) {
      element.dataset.kind = guide.kind
      element.setAttribute('part', `guide ${guidePart[guide.kind]}`)
    }
    const length = guide.upperBound - guide.lowerBound
    if (guide.axis === 'vertical') {
      element.style.transform = `translate3d(${guide.position}px, ${guide.lowerBound}px, 0)`
      element.style.width = '0'
      element.style.height = `${length}px`
    } else {
      element.style.transform = `translate3d(${guide.lowerBound}px, ${guide.position}px, 0)`
      element.style.width = `${length}px`
      element.style.height = '0'
    }
    const usesTicks =
      guide.kind === 'equalSpacing' || guide.kind === 'equalSize' || guide.kind === 'resize'
    children.startTick.hidden = !usesTicks
    children.endTick.hidden = !usesTicks
    const showsLabel =
      guide.measurement !== undefined && Math.abs(length) * zoom >= this.minimumLabelLength
    children.label.hidden = !showsLabel
    if (showsLabel && guide.measurement !== undefined) {
      children.label.textContent = this.measurementFormatter(guide.measurement, guide)
    }
  }
}
