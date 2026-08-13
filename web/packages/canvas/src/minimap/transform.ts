import {
  type FdCanvasPoint,
  type FdCanvasRect,
  type FdCanvasSize,
  unionCanvasRects,
} from '../geometry.js'
import type { FdGraphMiniMapScope } from './configuration.js'

const usableRect = (rect: FdCanvasRect): FdCanvasRect => ({
  x: Number.isFinite(rect.x) ? rect.x : 0,
  y: Number.isFinite(rect.y) ? rect.y : 0,
  width: Number.isFinite(rect.width) ? Math.max(rect.width, 1) : 1,
  height: Number.isFinite(rect.height) ? Math.max(rect.height, 1) : 1,
})

export class FdGraphMiniMapTransform {
  readonly worldBounds: FdCanvasRect
  readonly viewSize: FdCanvasSize
  readonly padding: number
  readonly scale: number
  readonly offset: FdCanvasPoint

  constructor(worldBounds: FdCanvasRect, viewSize: FdCanvasSize, padding: number) {
    if (!Number.isFinite(viewSize.width) || viewSize.width <= 0) {
      throw new RangeError('minimap view width must be positive')
    }
    if (!Number.isFinite(viewSize.height) || viewSize.height <= 0) {
      throw new RangeError('minimap view height must be positive')
    }
    if (!Number.isFinite(padding) || padding < 0) {
      throw new RangeError('minimap padding must not be negative')
    }
    const bounds = usableRect(worldBounds)
    const availableWidth = Math.max(viewSize.width - padding * 2, 1)
    const availableHeight = Math.max(viewSize.height - padding * 2, 1)
    this.worldBounds = bounds
    this.viewSize = viewSize
    this.padding = padding
    this.scale = Math.min(availableWidth / bounds.width, availableHeight / bounds.height)
    this.offset = {
      x: (viewSize.width - bounds.width * this.scale) / 2 - bounds.x * this.scale,
      y: (viewSize.height - bounds.height * this.scale) / 2 - bounds.y * this.scale,
    }
  }

  applyPoint(point: FdCanvasPoint): FdCanvasPoint {
    return {
      x: point.x * this.scale + this.offset.x,
      y: point.y * this.scale + this.offset.y,
    }
  }

  removePoint(point: FdCanvasPoint): FdCanvasPoint {
    return {
      x: (point.x - this.offset.x) / this.scale,
      y: (point.y - this.offset.y) / this.scale,
    }
  }

  applyRect(rect: FdCanvasRect): FdCanvasRect {
    const point = this.applyPoint(rect)
    return {
      ...point,
      width: rect.width * this.scale,
      height: rect.height * this.scale,
    }
  }

  removeSize(size: FdCanvasSize): FdCanvasSize {
    return {
      width: size.width / this.scale,
      height: size.height / this.scale,
    }
  }
}

export function graphMiniMapScopeBounds(
  scope: FdGraphMiniMapScope,
  contentBounds: FdCanvasRect,
  visibleWorldRect: FdCanvasRect,
): FdCanvasRect {
  switch (scope.kind) {
    case 'overview':
      return usableRect(unionCanvasRects(contentBounds, visibleWorldRect))
    case 'localNavigator': {
      const scale = Number.isFinite(scope.surroundingScale)
        ? Math.max(scope.surroundingScale, 1)
        : 1
      const width = Math.max(visibleWorldRect.width * scale, 1)
      const height = Math.max(visibleWorldRect.height * scale, 1)
      return {
        x: visibleWorldRect.x + visibleWorldRect.width / 2 - width / 2,
        y: visibleWorldRect.y + visibleWorldRect.height / 2 - height / 2,
        width,
        height,
      }
    }
    case 'custom':
      return usableRect(scope.bounds)
  }
}

export function graphMiniMapIsVisible(
  visibility: 'always' | 'whenNavigationIsUseful',
  contentBounds: FdCanvasRect,
  visibleWorldRect: FdCanvasRect,
): boolean {
  if (visibility === 'always') return true
  return !(
    contentBounds.x >= visibleWorldRect.x &&
    contentBounds.y >= visibleWorldRect.y &&
    contentBounds.x + contentBounds.width <= visibleWorldRect.x + visibleWorldRect.width &&
    contentBounds.y + contentBounds.height <= visibleWorldRect.y + visibleWorldRect.height
  )
}

export class FdGraphMiniMapPlanProjection {
  readonly scale: number
  readonly offset: FdCanvasPoint

  constructor(source: FdGraphMiniMapTransform, target: FdGraphMiniMapTransform) {
    this.scale = target.scale / source.scale
    this.offset = {
      x: target.offset.x - source.offset.x * this.scale,
      y: target.offset.y - source.offset.y * this.scale,
    }
  }

  applyPoint(point: FdCanvasPoint): FdCanvasPoint {
    return {
      x: point.x * this.scale + this.offset.x,
      y: point.y * this.scale + this.offset.y,
    }
  }

  applyRect(rect: FdCanvasRect): FdCanvasRect {
    return {
      ...this.applyPoint(rect),
      width: rect.width * this.scale,
      height: rect.height * this.scale,
    }
  }
}
