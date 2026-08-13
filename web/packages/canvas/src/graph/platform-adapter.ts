import type {
  FdGraphCanvasAccessibilityCommandResolver,
  FdGraphCanvasAccessibilityPortContext,
  FdGraphCanvasAccessibilityRepresentation,
} from '../accessibility/configuration.js'
import type { FdGraphKeyboardCommandResolver } from '../interactions/keyboard.js'
import type { FdAnyGraphEdge, FdAnyGraphNode } from './model.js'

export interface FdGraphCanvasPlatformAdapter {
  readonly resolveKeyboardCommand?: FdGraphKeyboardCommandResolver
  readonly resolveAccessibilityCommand?: FdGraphCanvasAccessibilityCommandResolver
  readonly accessibilityCanvasLabel?: string
  readonly nodeAccessibilityRepresentation?: (
    node: FdAnyGraphNode,
  ) => FdGraphCanvasAccessibilityRepresentation
  readonly portAccessibilityRepresentation?: (
    context: FdGraphCanvasAccessibilityPortContext,
  ) => FdGraphCanvasAccessibilityRepresentation
  readonly edgeAccessibilityRepresentation?: (
    edge: FdAnyGraphEdge,
  ) => FdGraphCanvasAccessibilityRepresentation
}
