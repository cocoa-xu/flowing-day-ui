import type { FdAnyGraphEdge, FdAnyGraphNode, FdGraphPort } from '../graph/model.js'

export interface FdGraphAccessibilityCapabilities {
  readonly focusNavigation?: boolean
  readonly selection?: boolean
  readonly movement?: boolean
  readonly activation?: boolean
}

export interface FdGraphAccessibilityDescription {
  readonly label: string
  readonly value?: string
  readonly hint?: string
  readonly roleDescription?: string
}

export type FdGraphAccessibilityRepresentation =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'element'; readonly description: FdGraphAccessibilityDescription }

export interface FdGraphAccessibilityPortContext {
  readonly node: FdAnyGraphNode
  readonly port: FdGraphPort
}

export interface FdGraphCanvasAccessibilityConfiguration {
  readonly enabled?: boolean
  readonly canvasLabel?: string
  readonly maximumExposedElementCount?: number
  readonly keepsFocusedElementVisible?: boolean
  readonly capabilities?: FdGraphAccessibilityCapabilities
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
}

export interface FdResolvedGraphCanvasAccessibilityConfiguration {
  readonly enabled: boolean
  readonly canvasLabel: string
  readonly maximumExposedElementCount: number
  readonly keepsFocusedElementVisible: boolean
  readonly capabilities: FdResolvedGraphAccessibilityCapabilities
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
    },
    nodeRepresentation: configuration.nodeRepresentation ?? defaultNodeRepresentation,
    portRepresentation: configuration.portRepresentation ?? defaultPortRepresentation,
    edgeRepresentation: configuration.edgeRepresentation ?? defaultEdgeRepresentation,
  }
}
