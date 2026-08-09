export const canvasInteractionThreshold = 0.9

export const canvasObserverThresholds = Array.from({ length: 101 }, (_, index) => index / 100)

export function shouldActivateCanvas(
  isIntersecting: boolean,
  intersectionHeight: number,
  viewportHeight: number,
): boolean {
  if (!isIntersecting || viewportHeight <= 0) return false
  return intersectionHeight / viewportHeight >= canvasInteractionThreshold
}
