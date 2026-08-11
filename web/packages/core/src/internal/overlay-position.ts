export type FdOverlayPlacement = 'top' | 'bottom' | 'leading' | 'trailing'

export interface FdOverlayPosition {
  left: number
  top: number
}

export interface FdOverlayViewport {
  width: number
  height: number
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum))

export function positionOverlay(
  anchor: DOMRectReadOnly,
  overlay: DOMRectReadOnly,
  viewport: FdOverlayViewport,
  placement: FdOverlayPlacement,
  gap: number,
  margin: number,
  isRTL: boolean,
): FdOverlayPosition {
  const resolvedPlacement =
    placement === 'leading'
      ? isRTL
        ? 'trailing'
        : 'leading'
      : placement === 'trailing'
        ? isRTL
          ? 'leading'
          : 'trailing'
        : placement

  const centeredLeft = anchor.left + (anchor.width - overlay.width) / 2
  const centeredTop = anchor.top + (anchor.height - overlay.height) / 2
  const above = anchor.top - overlay.height - gap
  const below = anchor.bottom + gap
  const before = anchor.left - overlay.width - gap
  const after = anchor.right + gap

  let left = centeredLeft
  let top = above

  switch (resolvedPlacement) {
    case 'top':
      top = above >= margin ? above : below
      break
    case 'bottom':
      top = below + overlay.height <= viewport.height - margin ? below : above
      break
    case 'leading':
      left = before >= margin ? before : after
      top = centeredTop
      break
    case 'trailing':
      left = after + overlay.width <= viewport.width - margin ? after : before
      top = centeredTop
      break
  }

  return {
    left: clamp(left, margin, viewport.width - overlay.width - margin),
    top: clamp(top, margin, viewport.height - overlay.height - margin),
  }
}
