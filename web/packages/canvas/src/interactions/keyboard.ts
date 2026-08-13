import type { FdCanvasRect, FdCanvasSize } from '../geometry.js'
import type { FdGraphCanvasKeyboardNudgingConfiguration } from '../graph/configuration.js'
import type { FdGraphCanvasInteractionModifier } from '../graph/interaction-policy.js'
import type { FdGraphElementID } from '../graph/model.js'

export type FdGraphCanvasNavigationDirection = 'up' | 'down' | 'left' | 'right'
export type FdGraphCanvasKeyboardSelectionBehavior = 'preserve' | 'replace'

export type FdGraphCanvasKeyboardCommand =
  | { readonly kind: 'navigate'; readonly direction: FdGraphCanvasNavigationDirection }
  | {
      readonly kind: 'nudge'
      readonly direction: FdGraphCanvasNavigationDirection
      readonly large: boolean
    }
  | { readonly kind: 'focusFirst' }
  | { readonly kind: 'focusLast' }
  | { readonly kind: 'toggleSelection' }
  | { readonly kind: 'selectAll' }
  | { readonly kind: 'clearSelection' }
  | { readonly kind: 'activate' }
  | { readonly kind: 'undo' }
  | { readonly kind: 'redo' }

export interface FdGraphCanvasKeyboardCommandContext {
  readonly hasSelection: boolean
  readonly focusedNodeIsSelected: boolean
  readonly navigationEnabled: boolean
  readonly nudgingEnabled: boolean
  readonly selectionEnabled: boolean
  readonly historyEnabled: boolean
}

export type FdGraphCanvasKeyboardCommandResolver = (
  event: KeyboardEvent,
  context: FdGraphCanvasKeyboardCommandContext,
) => FdGraphCanvasKeyboardCommand | undefined

export interface FdGraphCanvasNavigationCandidate {
  readonly id: FdGraphElementID
  readonly frame: FdCanvasRect
  readonly presentationOrder: number
}

const arrowDirections: Readonly<Record<string, FdGraphCanvasNavigationDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

export function defaultGraphCanvasKeyboardCommandResolver(
  event: KeyboardEvent,
  context: FdGraphCanvasKeyboardCommandContext,
): FdGraphCanvasKeyboardCommand | undefined {
  if (event.isComposing || event.altKey) return undefined
  const primaryModifier = event.metaKey || event.ctrlKey
  const key = event.key.toLowerCase()
  if (context.historyEnabled && primaryModifier) {
    if (key === 'z') return { kind: event.shiftKey ? 'redo' : 'undo' }
    if (key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey) return { kind: 'redo' }
  }
  if (context.selectionEnabled && primaryModifier && !event.shiftKey && key === 'a') {
    return { kind: 'selectAll' }
  }
  if (primaryModifier) return undefined

  const direction = arrowDirections[event.key]
  if (direction) {
    if (context.nudgingEnabled && context.focusedNodeIsSelected) {
      return { kind: 'nudge', direction, large: event.shiftKey }
    }
    if (context.navigationEnabled && !event.shiftKey) return { kind: 'navigate', direction }
    return undefined
  }
  if (event.key === 'Home' && context.navigationEnabled && !event.shiftKey) {
    return { kind: 'focusFirst' }
  }
  if (event.key === 'End' && context.navigationEnabled && !event.shiftKey) {
    return { kind: 'focusLast' }
  }
  if (event.key === ' ' && context.selectionEnabled) return { kind: 'toggleSelection' }
  if (event.key === 'Escape' && context.selectionEnabled && context.hasSelection) {
    return { kind: 'clearSelection' }
  }
  if (event.key === 'Enter') return { kind: 'activate' }
  return undefined
}

export class FdGraphCanvasKeyboardNudger {
  private constructor() {}

  static translation(
    direction: FdGraphCanvasNavigationDirection,
    configuration: Required<FdGraphCanvasKeyboardNudgingConfiguration>,
    modifiers: ReadonlySet<FdGraphCanvasInteractionModifier> = new Set(),
  ): FdCanvasSize | undefined {
    if (!configuration.isEnabled) return undefined
    const distance = modifiers.has('largeKeyboardNudge')
      ? configuration.largeStep
      : configuration.step
    switch (direction) {
      case 'up':
        return { width: 0, height: -distance }
      case 'down':
        return { width: 0, height: distance }
      case 'left':
        return { width: -distance, height: 0 }
      case 'right':
        return { width: distance, height: 0 }
    }
  }
}

export class FdGraphCanvasKeyboardNavigator {
  private constructor() {}

  static nextNodeID(
    current: FdGraphCanvasNavigationCandidate,
    direction: FdGraphCanvasNavigationDirection,
    candidates: readonly FdGraphCanvasNavigationCandidate[],
  ): FdGraphElementID | undefined {
    const currentX = current.frame.x + current.frame.width / 2
    const currentY = current.frame.y + current.frame.height / 2
    let best: FdGraphCanvasNavigationCandidate | undefined
    let bestDistance = Number.POSITIVE_INFINITY
    let bestOrthogonalDistance = Number.POSITIVE_INFINITY
    for (const candidate of candidates) {
      if (candidate.id === current.id) continue
      const x = candidate.frame.x + candidate.frame.width / 2
      const y = candidate.frame.y + candidate.frame.height / 2
      const dx = x - currentX
      const dy = y - currentY
      if (
        (direction === 'up' && dy >= 0) ||
        (direction === 'down' && dy <= 0) ||
        (direction === 'left' && dx >= 0) ||
        (direction === 'right' && dx <= 0)
      ) {
        continue
      }
      const distance = dx * dx + dy * dy
      const orthogonalDistance =
        direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx)
      if (
        distance < bestDistance ||
        (distance === bestDistance && orthogonalDistance < bestOrthogonalDistance) ||
        (distance === bestDistance &&
          orthogonalDistance === bestOrthogonalDistance &&
          candidate.presentationOrder < (best?.presentationOrder ?? Number.POSITIVE_INFINITY))
      ) {
        best = candidate
        bestDistance = distance
        bestOrthogonalDistance = orthogonalDistance
      }
    }
    return best?.id
  }
}
