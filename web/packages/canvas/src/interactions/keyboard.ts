import type { FdCanvasRect, FdCanvasSize } from '../geometry.js'
import type { FdGraphElementID } from '../graph/model.js'

export type FdGraphNavigationDirection = 'up' | 'down' | 'left' | 'right'
export type FdGraphKeyboardSelectionBehavior = 'preserve' | 'replace'

export type FdGraphKeyboardCommand =
  | { readonly kind: 'navigate'; readonly direction: FdGraphNavigationDirection }
  | {
      readonly kind: 'nudge'
      readonly direction: FdGraphNavigationDirection
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

export interface FdGraphKeyboardCommandContext {
  readonly hasSelection: boolean
  readonly focusedNodeIsSelected: boolean
  readonly navigationEnabled: boolean
  readonly nudgingEnabled: boolean
  readonly selectionEnabled: boolean
  readonly historyEnabled: boolean
}

export type FdGraphKeyboardCommandResolver = (
  event: KeyboardEvent,
  context: FdGraphKeyboardCommandContext,
) => FdGraphKeyboardCommand | undefined

export interface FdGraphCanvasKeyboardConfiguration {
  readonly enabled?: boolean
  readonly navigation?: boolean
  readonly nudging?: boolean
  readonly selection?: boolean
  readonly history?: boolean
  readonly nudgeStep?: number
  readonly largeNudgeStep?: number
  readonly selectionBehavior?: FdGraphKeyboardSelectionBehavior
  readonly keepsFocusedNodeVisible?: boolean
  readonly resolveCommand?: FdGraphKeyboardCommandResolver
}

export interface FdResolvedGraphCanvasKeyboardConfiguration {
  readonly enabled: boolean
  readonly navigation: boolean
  readonly nudging: boolean
  readonly selection: boolean
  readonly history: boolean
  readonly nudgeStep: number
  readonly largeNudgeStep: number
  readonly selectionBehavior: FdGraphKeyboardSelectionBehavior
  readonly keepsFocusedNodeVisible: boolean
  readonly resolveCommand: FdGraphKeyboardCommandResolver
}

export interface FdGraphKeyboardNavigationCandidate {
  readonly id: FdGraphElementID
  readonly frame: FdCanvasRect
  readonly presentationOrder: number
}

const arrowDirections: Readonly<Record<string, FdGraphNavigationDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

const positive = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive`)
  return value
}

export function defaultGraphKeyboardCommandResolver(
  event: KeyboardEvent,
  context: FdGraphKeyboardCommandContext,
): FdGraphKeyboardCommand | undefined {
  if (event.isComposing || event.altKey) return undefined
  const primaryModifier = event.metaKey || event.ctrlKey
  const key = event.key.toLowerCase()
  if (context.historyEnabled && primaryModifier && !event.altKey) {
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

export function resolveGraphCanvasKeyboardConfiguration(
  configuration: FdGraphCanvasKeyboardConfiguration = {},
): FdResolvedGraphCanvasKeyboardConfiguration {
  const nudgeStep = positive(configuration.nudgeStep ?? 1, 'keyboard nudge step')
  const largeNudgeStep = positive(configuration.largeNudgeStep ?? 10, 'large keyboard nudge step')
  if (largeNudgeStep < nudgeStep) {
    throw new RangeError('large keyboard nudge step must not be smaller than the standard step')
  }
  return {
    enabled: configuration.enabled ?? true,
    navigation: configuration.navigation ?? true,
    nudging: configuration.nudging ?? true,
    selection: configuration.selection ?? true,
    history: configuration.history ?? true,
    nudgeStep,
    largeNudgeStep,
    selectionBehavior: configuration.selectionBehavior ?? 'replace',
    keepsFocusedNodeVisible: configuration.keepsFocusedNodeVisible ?? true,
    resolveCommand: configuration.resolveCommand ?? defaultGraphKeyboardCommandResolver,
  }
}

export function graphKeyboardTranslation(
  direction: FdGraphNavigationDirection,
  distance: number,
): FdCanvasSize {
  positive(distance, 'keyboard translation distance')
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

export function nextGraphKeyboardNodeID(
  current: FdGraphKeyboardNavigationCandidate,
  direction: FdGraphNavigationDirection,
  candidates: readonly FdGraphKeyboardNavigationCandidate[],
): FdGraphElementID | undefined {
  const currentX = current.frame.x + current.frame.width / 2
  const currentY = current.frame.y + current.frame.height / 2
  let best: FdGraphKeyboardNavigationCandidate | undefined
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
