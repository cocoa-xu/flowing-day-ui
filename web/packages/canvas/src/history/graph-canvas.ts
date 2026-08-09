import type { FdGraphNodeFrameChange, FdGraphNodeFrameChangeKind } from '../graph/events.js'
import type {
  FdGraphHistoryApplyResult,
  FdGraphHistoryConfiguration,
  FdGraphHistoryDirection,
  FdGraphHistoryExecutionMode,
  FdResolvedGraphHistoryConfiguration,
} from './model.js'
import { resolveGraphHistoryConfiguration } from './model.js'

export type FdGraphCanvasHistoryChange = readonly FdGraphNodeFrameChange[]

export interface FdGraphCanvasHistoryActionContext {
  readonly kind: Exclude<FdGraphNodeFrameChangeKind, 'history'>
  readonly changes: FdGraphCanvasHistoryChange
}

export interface FdGraphCanvasHistoryConfiguration extends FdGraphHistoryConfiguration {
  readonly mode?: FdGraphHistoryExecutionMode
  readonly apply?: (
    change: FdGraphCanvasHistoryChange,
    direction: FdGraphHistoryDirection,
  ) =>
    | FdGraphHistoryApplyResult<FdGraphCanvasHistoryChange, unknown>
    | Promise<FdGraphHistoryApplyResult<FdGraphCanvasHistoryChange, unknown>>
  readonly actionName?: (context: FdGraphCanvasHistoryActionContext) => string
}

export interface FdResolvedGraphCanvasHistoryConfiguration
  extends FdResolvedGraphHistoryConfiguration {
  readonly mode: FdGraphHistoryExecutionMode
  readonly apply?: FdGraphCanvasHistoryConfiguration['apply']
  readonly actionName: (context: FdGraphCanvasHistoryActionContext) => string
}

const defaultActionName = ({ kind }: FdGraphCanvasHistoryActionContext): string => {
  switch (kind) {
    case 'drag':
      return 'Move Nodes'
    case 'resize':
      return 'Resize Nodes'
    case 'keyboard':
      return 'Move Nodes'
  }
}

export function resolveGraphCanvasHistoryConfiguration(
  configuration: FdGraphCanvasHistoryConfiguration = {},
): FdResolvedGraphCanvasHistoryConfiguration {
  const mode = configuration.mode ?? 'local'
  if (mode === 'collaborative' && !configuration.apply) {
    throw new RangeError('collaborative graph history requires an apply policy')
  }
  const actionName = configuration.actionName ?? defaultActionName
  return {
    ...resolveGraphHistoryConfiguration(configuration),
    mode,
    ...(configuration.apply ? { apply: configuration.apply } : {}),
    actionName: (context) => {
      const value = actionName(context).trim()
      if (!value) throw new RangeError('graph history action name must not be empty')
      return value
    },
  }
}
