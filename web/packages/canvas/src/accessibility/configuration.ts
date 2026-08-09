import type { FdAnyGraphEdge, FdAnyGraphNode, FdGraphPort } from '../graph/model.js'
import type { FdGraphNavigationDirection } from '../interactions/keyboard.js'

export interface FdGraphAccessibilityCapabilities {
  readonly focusNavigation?: boolean
  readonly selection?: boolean
  readonly movement?: boolean
  readonly activation?: boolean
  readonly connections?: boolean
  readonly elementActions?: boolean
}

export interface FdGraphAccessibilityElementAction {
  readonly id: string
  readonly label: string
}

export interface FdGraphAccessibilityDescription {
  readonly label: string
  readonly value?: string
  readonly hint?: string
  readonly roleDescription?: string
  readonly identifier?: string
  readonly actions?: readonly FdGraphAccessibilityElementAction[]
}

export type FdGraphAccessibilityRepresentation =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'element'; readonly description: FdGraphAccessibilityDescription }

export interface FdGraphAccessibilityPortContext {
  readonly node: FdAnyGraphNode
  readonly port: FdGraphPort
}

export type FdGraphAccessibilityCommand =
  | { readonly kind: 'focusPrevious' }
  | { readonly kind: 'focusNext' }
  | { readonly kind: 'focusFirst' }
  | { readonly kind: 'focusLast' }
  | { readonly kind: 'focusNextRelated' }
  | { readonly kind: 'select' }
  | { readonly kind: 'activate' }
  | { readonly kind: 'perform'; readonly actionID: string }
  | {
      readonly kind: 'move'
      readonly direction: FdGraphNavigationDirection
      readonly large: boolean
    }

export type FdGraphAccessibilityCommandResolver = (
  event: KeyboardEvent,
) => FdGraphAccessibilityCommand | undefined

export interface FdGraphCanvasAccessibilityConfiguration {
  readonly enabled?: boolean
  readonly canvasLabel?: string
  readonly maximumExposedElementCount?: number
  readonly keepsFocusedElementVisible?: boolean
  readonly capabilities?: FdGraphAccessibilityCapabilities
  readonly resolveCommand?: FdGraphAccessibilityCommandResolver
  readonly nodeRepresentation?: (node: FdAnyGraphNode) => FdGraphAccessibilityRepresentation
  readonly portRepresentation?: (
    context: FdGraphAccessibilityPortContext,
  ) => FdGraphAccessibilityRepresentation
  readonly edgeRepresentation?: (edge: FdAnyGraphEdge) => FdGraphAccessibilityRepresentation
}

export interface FdResolvedGraphAccessibilityCapabilities {
  readonly focusNavigation: boolean
  readonly selection: boolean
  readonly movement: boolean
  readonly activation: boolean
  readonly connections: boolean
  readonly elementActions: boolean
}

export interface FdResolvedGraphCanvasAccessibilityConfiguration {
  readonly enabled: boolean
  readonly canvasLabel: string
  readonly maximumExposedElementCount: number
  readonly keepsFocusedElementVisible: boolean
  readonly capabilities: FdResolvedGraphAccessibilityCapabilities
  readonly resolveCommand: FdGraphAccessibilityCommandResolver
  readonly nodeRepresentation: (node: FdAnyGraphNode) => FdGraphAccessibilityRepresentation
  readonly portRepresentation: (
    context: FdGraphAccessibilityPortContext,
  ) => FdGraphAccessibilityRepresentation
  readonly edgeRepresentation: (edge: FdAnyGraphEdge) => FdGraphAccessibilityRepresentation
}

const element = (label: string, value?: string): FdGraphAccessibilityRepresentation => ({
  kind: 'element',
  description: { label, ...(value ? { value } : {}) },
})

const defaultNodeRepresentation = (node: FdAnyGraphNode): FdGraphAccessibilityRepresentation =>
  element(node.accessibilityLabel ?? node.label ?? String(node.id), node.subtitle)

const defaultPortRepresentation = ({
  port,
}: FdGraphAccessibilityPortContext): FdGraphAccessibilityRepresentation =>
  port.label ? element(port.label) : { kind: 'hidden' }

const defaultEdgeRepresentation = (edge: FdAnyGraphEdge): FdGraphAccessibilityRepresentation => {
  const label = edge.accessibilityLabel ?? edge.label
  return label ? element(label) : { kind: 'hidden' }
}

const directions: Readonly<Record<string, FdGraphNavigationDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

export const defaultGraphAccessibilityCommandResolver: FdGraphAccessibilityCommandResolver = (
  event,
) => {
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
  if (event.key === ' ') return { kind: 'select' }
  if (event.key === 'Enter') return { kind: 'activate' }
  return undefined
}

export function resolveGraphCanvasAccessibilityConfiguration(
  configuration: FdGraphCanvasAccessibilityConfiguration = {},
): FdResolvedGraphCanvasAccessibilityConfiguration {
  const maximumExposedElementCount = configuration.maximumExposedElementCount ?? 64
  if (!Number.isInteger(maximumExposedElementCount) || maximumExposedElementCount <= 0) {
    throw new RangeError('maximum exposed accessibility element count must be a positive integer')
  }
  const canvasLabel = configuration.canvasLabel?.trim() || 'Graph Canvas'
  return {
    enabled: configuration.enabled ?? true,
    canvasLabel,
    maximumExposedElementCount,
    keepsFocusedElementVisible: configuration.keepsFocusedElementVisible ?? true,
    capabilities: {
      focusNavigation: configuration.capabilities?.focusNavigation ?? true,
      selection: configuration.capabilities?.selection ?? true,
      movement: configuration.capabilities?.movement ?? true,
      activation: configuration.capabilities?.activation ?? true,
      connections: configuration.capabilities?.connections ?? true,
      elementActions: configuration.capabilities?.elementActions ?? true,
    },
    resolveCommand: configuration.resolveCommand ?? defaultGraphAccessibilityCommandResolver,
    nodeRepresentation: configuration.nodeRepresentation ?? defaultNodeRepresentation,
    portRepresentation: configuration.portRepresentation ?? defaultPortRepresentation,
    edgeRepresentation: configuration.edgeRepresentation ?? defaultEdgeRepresentation,
  }
}
