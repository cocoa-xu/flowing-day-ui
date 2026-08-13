import type {
  FdGraphCanvasAccessibilityCommandResolver,
  FdGraphCanvasAccessibilityPortContext,
  FdGraphCanvasAccessibilityRepresentation,
} from '../accessibility/configuration.js'
import type { FdGraphCanvasKeyboardCommandResolver } from '../interactions/keyboard.js'
import type { FdAnyGraphEdge, FdAnyGraphNode } from './model.js'

export interface FdGraphCanvasPlatformAdapter {
  readonly resolveKeyboardCommand?: FdGraphCanvasKeyboardCommandResolver
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
