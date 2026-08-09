export interface FdCanvasPoint {
  readonly x: number
  readonly y: number
}

export interface FdCanvasSize {
  readonly width: number
  readonly height: number
}

export interface FdCanvasRect extends FdCanvasPoint, FdCanvasSize {}

export interface FdCanvasInsets {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

export const zeroCanvasInsets: FdCanvasInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
}

const finite = (value: number, name: string): number => {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`)
  return value
}

const positive = (value: number, name: string): number => {
  if (finite(value, name) <= 0) throw new RangeError(`${name} must be greater than zero`)
  return value
}

export class FdCanvasTransform {
  readonly zoom: number
  readonly offset: FdCanvasPoint

  constructor(zoom: number, offset: FdCanvasPoint) {
    this.zoom = positive(zoom, 'zoom')
    this.offset = {
      x: finite(offset.x, 'offset.x'),
      y: finite(offset.y, 'offset.y'),
    }
  }

  static get identity(): FdCanvasTransform {
    return new FdCanvasTransform(1, { x: 0, y: 0 })
  }

  applyPoint(point: FdCanvasPoint): FdCanvasPoint {
    return {
      x: point.x * this.zoom + this.offset.x,
      y: point.y * this.zoom + this.offset.y,
    }
  }

  applyRect(rect: FdCanvasRect): FdCanvasRect {
    const origin = this.applyPoint(rect)
    return {
      ...origin,
      width: rect.width * this.zoom,
      height: rect.height * this.zoom,
    }
  }

  removePoint(point: FdCanvasPoint): FdCanvasPoint {
    return {
      x: (point.x - this.offset.x) / this.zoom,
      y: (point.y - this.offset.y) / this.zoom,
    }
  }

  removeRect(rect: FdCanvasRect): FdCanvasRect {
    const origin = this.removePoint(rect)
    return {
      ...origin,
      width: rect.width / this.zoom,
      height: rect.height / this.zoom,
    }
  }

  static anchoring(
    worldPoint: FdCanvasPoint,
    viewportPoint: FdCanvasPoint,
    zoom: number,
  ): FdCanvasTransform {
    return new FdCanvasTransform(zoom, {
      x: viewportPoint.x - worldPoint.x * zoom,
      y: viewportPoint.y - worldPoint.y * zoom,
    })
  }

  static focusing(
    contentRect: FdCanvasRect,
    viewportBounds: FdCanvasRect,
    zoom: number,
  ): FdCanvasTransform {
    return FdCanvasTransform.anchoring(
      {
        x: contentRect.x + contentRect.width / 2,
        y: contentRect.y + contentRect.height / 2,
      },
      {
        x: viewportBounds.x + viewportBounds.width / 2,
        y: viewportBounds.y + viewportBounds.height / 2,
      },
      zoom,
    )
  }

  static fitting(
    contentRect: FdCanvasRect,
    viewportBounds: FdCanvasRect,
    padding: number,
    zoomRange: readonly [number, number],
  ): FdCanvasTransform {
    if (padding < 0) throw new RangeError('padding must not be negative')
    const minimumZoom = positive(zoomRange[0], 'minimum zoom')
    const maximumZoom = positive(zoomRange[1], 'maximum zoom')
    if (minimumZoom > maximumZoom) throw new RangeError('zoom range is inverted')
    const availableWidth = Math.max(viewportBounds.width - padding * 2, 1)
    const availableHeight = Math.max(viewportBounds.height - padding * 2, 1)
    const width = Math.max(contentRect.width, 1)
    const height = Math.max(contentRect.height, 1)
    const zoom = Math.min(
      Math.max(Math.min(availableWidth / width, availableHeight / height), minimumZoom),
      maximumZoom,
    )
    return FdCanvasTransform.focusing(contentRect, viewportBounds, zoom)
  }
}

export class FdCanvasViewport {
  readonly transform: FdCanvasTransform
  readonly size: FdCanvasSize
  readonly contentBounds: FdCanvasRect

  constructor(transform: FdCanvasTransform, size: FdCanvasSize, contentBounds: FdCanvasRect) {
    this.transform = transform
    this.size = size
    this.contentBounds = contentBounds
  }

  get visibleWorldRect(): FdCanvasRect {
    return this.transform.removeRect(this.contentBounds)
  }
}

export class FdCanvasRenderSurface {
  readonly localTransform: FdCanvasTransform
  readonly displayedSize: FdCanvasSize
  readonly viewportOffset: FdCanvasPoint

  constructor(worldRect: FdCanvasRect, viewportTransform: FdCanvasTransform) {
    this.localTransform = new FdCanvasTransform(viewportTransform.zoom, {
      x: -worldRect.x * viewportTransform.zoom,
      y: -worldRect.y * viewportTransform.zoom,
    })
    this.displayedSize = {
      width: worldRect.width * viewportTransform.zoom,
      height: worldRect.height * viewportTransform.zoom,
    }
    this.viewportOffset = viewportTransform.applyPoint(worldRect)
  }
}

export interface FdCanvasGridLevel {
  readonly spacing: number
  readonly opacity: number
}

export class FdCanvasGridLevels {
  readonly coarse: FdCanvasGridLevel
  readonly fine: FdCanvasGridLevel

  constructor(
    baseSpacing: number,
    zoom: number,
    minimumVisualSpacing: number,
    scaleFactor: number,
  ) {
    positive(baseSpacing, 'base spacing')
    positive(zoom, 'zoom')
    positive(minimumVisualSpacing, 'minimum visual spacing')
    if (scaleFactor <= 1) throw new RangeError('scale factor must be greater than one')
    const maximumVisualSpacing = minimumVisualSpacing * scaleFactor
    let fineSpacing = baseSpacing * zoom
    while (fineSpacing < minimumVisualSpacing) fineSpacing *= scaleFactor
    while (fineSpacing >= maximumVisualSpacing) fineSpacing /= scaleFactor
    const progress = Math.min(
      Math.max(
        (fineSpacing - minimumVisualSpacing) / (maximumVisualSpacing - minimumVisualSpacing),
        0,
      ),
      1,
    )
    this.coarse = { spacing: fineSpacing * scaleFactor, opacity: 1 - progress }
    this.fine = { spacing: fineSpacing, opacity: progress }
  }
}

export const insetCanvasRect = (rect: FdCanvasRect, amount: number): FdCanvasRect => ({
  x: rect.x + amount,
  y: rect.y + amount,
  width: rect.width - amount * 2,
  height: rect.height - amount * 2,
})

export const canvasRectContains = (outer: FdCanvasRect, inner: FdCanvasRect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height

export const canvasRectsIntersect = (first: FdCanvasRect, second: FdCanvasRect): boolean =>
  first.x <= second.x + second.width &&
  first.x + first.width >= second.x &&
  first.y <= second.y + second.height &&
  first.y + first.height >= second.y

export const unionCanvasRects = (
  first: FdCanvasRect | undefined,
  second: FdCanvasRect,
): FdCanvasRect => {
  if (!first) return second
  const x = Math.min(first.x, second.x)
  const y = Math.min(first.y, second.y)
  const maximumX = Math.max(first.x + first.width, second.x + second.width)
  const maximumY = Math.max(first.y + first.height, second.y + second.height)
  return { x, y, width: maximumX - x, height: maximumY - y }
}
