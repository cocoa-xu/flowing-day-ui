import type {
  FdGraphAccessibilityCommandResolver,
  FdGraphAccessibilityPortContext,
  FdGraphAccessibilityRepresentation,
} from '../accessibility/configuration.js'
import type { FdGraphKeyboardCommandResolver } from '../interactions/keyboard.js'
import type { FdAnyGraphEdge, FdAnyGraphNode } from './model.js'

export interface FdGraphCanvasPlatformAdapter {
  readonly resolveKeyboardCommand?: FdGraphKeyboardCommandResolver
  readonly resolveAccessibilityCommand?: FdGraphAccessibilityCommandResolver
  readonly accessibilityCanvasLabel?: string
  readonly nodeAccessibilityRepresentation?: (
    node: FdAnyGraphNode,
  ) => FdGraphAccessibilityRepresentation
  readonly portAccessibilityRepresentation?: (
    context: FdGraphAccessibilityPortContext,
  ) => FdGraphAccessibilityRepresentation
  readonly edgeAccessibilityRepresentation?: (
    edge: FdAnyGraphEdge,
  ) => FdGraphAccessibilityRepresentation
}
