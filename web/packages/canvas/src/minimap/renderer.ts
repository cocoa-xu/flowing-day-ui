import type {
  FdResolvedGraphMiniMapConfiguration,
  FdResolvedGraphMiniMapStyle,
} from './configuration.js'
import type { FdGraphMiniMapRenderPlan } from './planner.js'
import type { FdGraphMiniMapPlanProjection } from './transform.js'

export interface FdGraphMiniMapRenderFrame {
  readonly plan: FdGraphMiniMapRenderPlan
  readonly projection: FdGraphMiniMapPlanProjection
  readonly configuration: FdResolvedGraphMiniMapConfiguration
  readonly style: FdResolvedGraphMiniMapStyle
  readonly pixelRatio: number
}

export interface FdGraphMiniMapRenderingBackend {
  mount(canvas: HTMLCanvasElement): void
  render(frame: FdGraphMiniMapRenderFrame): void
  unmount(): void
}

export class FdGraphMiniMapCanvasRenderingBackend implements FdGraphMiniMapRenderingBackend {
  private canvas: HTMLCanvasElement | undefined
  private context: CanvasRenderingContext2D | undefined

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.context = canvas.getContext('2d', { alpha: true }) ?? undefined
  }

  render(frame: FdGraphMiniMapRenderFrame): void {
    const canvas = this.canvas
    const context = this.context
    if (!canvas || !context) return
    const width = frame.configuration.size.width
    const height = frame.configuration.size.height
    const pixelWidth = Math.max(Math.ceil(width * frame.pixelRatio), 1)
    const pixelHeight = Math.max(Math.ceil(height * frame.pixelRatio), 1)
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight
    context.setTransform(frame.pixelRatio, 0, 0, frame.pixelRatio, 0, 0)
    context.clearRect(0, 0, width, height)

    if (frame.plan.edgeSegments.length > 0) {
      const edges = new Path2D()
      for (const edge of frame.plan.edgeSegments) {
        const source = frame.projection.applyPoint(edge.source)
        const target = frame.projection.applyPoint(edge.target)
        edges.moveTo(source.x, source.y)
        edges.lineTo(target.x, target.y)
      }
      context.strokeStyle = frame.style.edge
      context.lineWidth = 1
      context.stroke(edges)
    }

    for (const batch of frame.plan.nodeBatches) {
      const style = frame.style.nodeStyles[batch.styleIndex] ?? frame.style.nodeStyles[0]
      if (!style) continue
      const nodes = new Path2D()
      for (const rect of batch.rects) {
        const projected = frame.projection.applyRect(rect)
        nodes.rect(projected.x, projected.y, projected.width, projected.height)
      }
      context.fillStyle = style.fill
      context.fill(nodes)
      if (batch.drawsStroke && style.strokeWidth > 0 && style.stroke !== 'transparent') {
        context.strokeStyle = style.stroke
        context.lineWidth = style.strokeWidth
        context.stroke(nodes)
      }
    }
  }

  unmount(): void {
    this.canvas = undefined
    this.context = undefined
  }
}
