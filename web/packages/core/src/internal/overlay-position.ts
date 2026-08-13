export type FdEdge = 'top' | 'bottom' | 'leading' | 'trailing'

export interface FdEdgeInsets {
  top: number
  leading: number
  bottom: number
  trailing: number
}

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
  arrowEdge: FdEdge,
  gap: number,
  margin: number,
  isRTL: boolean,
): FdOverlayPosition {
  const resolvedEdge =
    arrowEdge === 'leading'
      ? isRTL
        ? 'trailing'
        : 'leading'
      : arrowEdge === 'trailing'
        ? isRTL
          ? 'leading'
          : 'trailing'
        : arrowEdge

  const centeredLeft = anchor.left + (anchor.width - overlay.width) / 2
  const centeredTop = anchor.top + (anchor.height - overlay.height) / 2
  const above = anchor.top - overlay.height - gap
  const below = anchor.bottom + gap
  const before = anchor.left - overlay.width - gap
  const after = anchor.right + gap

  let left = centeredLeft
  let top = above

  switch (resolvedEdge) {
    case 'top':
      top = below + overlay.height <= viewport.height - margin ? below : above
      break
    case 'bottom':
      top = above >= margin ? above : below
      break
    case 'leading':
      left = after + overlay.width <= viewport.width - margin ? after : before
      top = centeredTop
      break
    case 'trailing':
      left = before >= margin ? before : after
      top = centeredTop
      break
  }

  return {
    left: clamp(left, margin, viewport.width - overlay.width - margin),
    top: clamp(top, margin, viewport.height - overlay.height - margin),
  }
}
