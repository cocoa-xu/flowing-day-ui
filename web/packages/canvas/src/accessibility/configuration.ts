import type { FdAnyGraphEdge, FdAnyGraphNode, FdGraphPort } from '../graph/model.js'
import type { FdGraphCanvasPlatformAdapter } from '../graph/platform-adapter.js'
import type { FdGraphCanvasNavigationDirection } from '../interactions/keyboard.js'

export interface FdGraphCanvasAccessibilityCapabilities {
  readonly focusNavigation?: boolean
  readonly selection?: boolean
  readonly movement?: boolean
  readonly connections?: boolean
  readonly elementActions?: boolean
}

export interface FdGraphCanvasAccessibilityActionLabels {
  readonly nextElement?: string
  readonly previousElement?: string
  readonly nextRelatedElement?: string
  readonly moveUp?: string
  readonly moveDown?: string
  readonly moveLeft?: string
  readonly moveRight?: string
}

export type FdGraphCanvasElementAction =
  | 'collapse'
  | 'expand'
  | 'drillIn'
  | 'inspect'
  | 'beginConnection'
  | 'completeConnection'
  | 'cancelConnection'

export interface FdGraphCanvasAccessibilityAction {
  readonly action: FdGraphCanvasElementAction
  readonly label: string
}

export interface FdGraphCanvasAccessibilityDescription {
  readonly label: string
  readonly value?: string
  readonly hint?: string
  readonly roleDescription?: string
  readonly identifier?: string
  readonly actions?: readonly FdGraphCanvasAccessibilityAction[]
}

export type FdGraphCanvasAccessibilityRepresentation =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'element'; readonly description: FdGraphCanvasAccessibilityDescription }

export interface FdGraphCanvasAccessibilityPortContext {
  readonly node: FdAnyGraphNode
  readonly port: FdGraphPort
}

export type FdGraphCanvasAccessibilityCommand =
  | { readonly kind: 'focusPrevious' }
  | { readonly kind: 'focusNext' }
  | { readonly kind: 'focusFirst' }
  | { readonly kind: 'focusLast' }
  | { readonly kind: 'focusNextRelated' }
  | { readonly kind: 'select' }
  | { readonly kind: 'perform'; readonly action: FdGraphCanvasElementAction }
  | {
      readonly kind: 'move'
      readonly direction: FdGraphCanvasNavigationDirection
      readonly large: boolean
    }

export type FdGraphCanvasAccessibilityCommandResolver = (
  event: KeyboardEvent,
) => FdGraphCanvasAccessibilityCommand | undefined

export interface FdGraphCanvasAccessibilityConfiguration {
  readonly maximumExposedElementCount?: number
  readonly keepsFocusedElementVisible?: boolean
  readonly capabilities?: FdGraphCanvasAccessibilityCapabilities
  readonly actionLabels?: FdGraphCanvasAccessibilityActionLabels
}

export interface FdResolvedGraphCanvasAccessibilityCapabilities {
  readonly focusNavigation: boolean
  readonly selection: boolean
  readonly movement: boolean
  readonly connections: boolean
  readonly elementActions: boolean
}

export interface FdResolvedGraphCanvasAccessibilityConfiguration {
  readonly enabled: boolean
  readonly canvasLabel: string
  readonly maximumExposedElementCount: number
  readonly keepsFocusedElementVisible: boolean
  readonly capabilities: FdResolvedGraphCanvasAccessibilityCapabilities
  readonly actionLabels: Required<FdGraphCanvasAccessibilityActionLabels>
  readonly resolveCommand: FdGraphCanvasAccessibilityCommandResolver
  readonly nodeRepresentation: (node: FdAnyGraphNode) => FdGraphCanvasAccessibilityRepresentation
  readonly portRepresentation: (
    context: FdGraphCanvasAccessibilityPortContext,
  ) => FdGraphCanvasAccessibilityRepresentation
  readonly edgeRepresentation: (edge: FdAnyGraphEdge) => FdGraphCanvasAccessibilityRepresentation
}

const element = (label: string, value?: string): FdGraphCanvasAccessibilityRepresentation => ({
  kind: 'element',
  description: { label, ...(value ? { value } : {}) },
})

const defaultNodeRepresentation = (
  node: FdAnyGraphNode,
): FdGraphCanvasAccessibilityRepresentation =>
  element(node.accessibilityLabel ?? node.label ?? String(node.id), node.subtitle)

const defaultPortRepresentation = ({
  port,
}: FdGraphCanvasAccessibilityPortContext): FdGraphCanvasAccessibilityRepresentation =>
  port.label ? element(port.label) : { kind: 'hidden' }

const defaultEdgeRepresentation = (
  edge: FdAnyGraphEdge,
): FdGraphCanvasAccessibilityRepresentation => {
  const label = edge.accessibilityLabel ?? edge.label
  return label ? element(label) : { kind: 'hidden' }
}

const directions: Readonly<Record<string, FdGraphCanvasNavigationDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

export const defaultGraphCanvasAccessibilityCommandResolver: FdGraphCanvasAccessibilityCommandResolver =
  (event) => {
    if (event.isComposing) return undefined
    const direction = directions[event.key]
    const primaryModifier = event.metaKey || event.ctrlKey
    if (event.altKey && !primaryModifier && event.key === 'ArrowRight') {
      return { kind: 'focusNextRelated' }
    }
    if (event.altKey) return undefined
    if (direction && primaryModifier) return { kind: 'move', direction, large: event.shiftKey }
    if (direction && !event.shiftKey) {
      return { kind: direction === 'up' || direction === 'left' ? 'focusPrevious' : 'focusNext' }
    }
    if (primaryModifier) return undefined
    if (event.key === 'Home' && !event.shiftKey) return { kind: 'focusFirst' }
    if (event.key === 'End' && !event.shiftKey) return { kind: 'focusLast' }
    if (event.key === ' ' || event.key === 'Enter') return { kind: 'select' }
    return undefined
  }

export function resolveGraphCanvasAccessibilityConfiguration(
  configuration: FdGraphCanvasAccessibilityConfiguration = {},
  platformAdapter: FdGraphCanvasPlatformAdapter = {},
): FdResolvedGraphCanvasAccessibilityConfiguration {
  const maximumExposedElementCount = configuration.maximumExposedElementCount ?? 64
  if (!Number.isInteger(maximumExposedElementCount) || maximumExposedElementCount <= 0) {
    throw new RangeError('maximum exposed accessibility element count must be a positive integer')
  }
  const canvasLabel = platformAdapter.accessibilityCanvasLabel?.trim() || 'Graph Canvas'
  const capabilities = {
    focusNavigation: configuration.capabilities?.focusNavigation ?? true,
    selection: configuration.capabilities?.selection ?? true,
    movement: configuration.capabilities?.movement ?? true,
    connections: configuration.capabilities?.connections ?? true,
    elementActions: configuration.capabilities?.elementActions ?? true,
  }
  const actionLabel = (value: string | undefined, fallback: string, name: string): string => {
    const resolved = value ?? fallback
    if (!resolved.trim()) throw new RangeError(`${name} must not be empty`)
    return resolved
  }
  return {
    enabled: Object.values(capabilities).some(Boolean),
    canvasLabel,
    maximumExposedElementCount,
    keepsFocusedElementVisible: configuration.keepsFocusedElementVisible ?? true,
    capabilities,
    actionLabels: {
      nextElement: actionLabel(
        configuration.actionLabels?.nextElement,
        'Next Element',
        'next element accessibility action label',
      ),
      previousElement: actionLabel(
        configuration.actionLabels?.previousElement,
        'Previous Element',
        'previous element accessibility action label',
      ),
      nextRelatedElement: actionLabel(
        configuration.actionLabels?.nextRelatedElement,
        'Next Connected Element',
        'next related element accessibility action label',
      ),
      moveUp: actionLabel(
        configuration.actionLabels?.moveUp,
        'Move Up',
        'move up accessibility action label',
      ),
      moveDown: actionLabel(
        configuration.actionLabels?.moveDown,
        'Move Down',
        'move down accessibility action label',
      ),
      moveLeft: actionLabel(
        configuration.actionLabels?.moveLeft,
        'Move Left',
        'move left accessibility action label',
      ),
      moveRight: actionLabel(
        configuration.actionLabels?.moveRight,
        'Move Right',
        'move right accessibility action label',
      ),
    },
    resolveCommand:
      platformAdapter.resolveAccessibilityCommand ?? defaultGraphCanvasAccessibilityCommandResolver,
    nodeRepresentation:
      platformAdapter.nodeAccessibilityRepresentation ?? defaultNodeRepresentation,
    portRepresentation:
      platformAdapter.portAccessibilityRepresentation ?? defaultPortRepresentation,
    edgeRepresentation:
      platformAdapter.edgeAccessibilityRepresentation ?? defaultEdgeRepresentation,
  }
}
