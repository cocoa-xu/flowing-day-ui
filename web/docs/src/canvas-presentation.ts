export const canvasInteractionThreshold = 0.9

export const canvasObserverThresholds = Array.from({ length: 101 }, (_, index) => index / 100)

export type CanvasPresentationMode = 'embedded' | 'expanded'

export interface CanvasPresentation {
  readonly expanded: boolean
  readonly actionLabel: string
}

export function canvasPresentation(mode: CanvasPresentationMode): CanvasPresentation {
  return mode === 'expanded'
    ? { expanded: true, actionLabel: 'Collapse Canvas' }
    : { expanded: false, actionLabel: 'Expand Canvas' }
}

export function toggledCanvasPresentationMode(
  mode: CanvasPresentationMode,
): CanvasPresentationMode {
  return mode === 'expanded' ? 'embedded' : 'expanded'
}

export function shouldActivateCanvas(
  isIntersecting: boolean,
  intersectionHeight: number,
  viewportHeight: number,
): boolean {
  if (!isIntersecting || viewportHeight <= 0) return false
  return intersectionHeight / viewportHeight >= canvasInteractionThreshold
}
