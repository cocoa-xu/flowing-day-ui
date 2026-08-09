import { describe, expect, it } from 'vitest'
import {
  defaultGraphKeyboardCommandResolver,
  type FdGraphKeyboardCommandContext,
  graphKeyboardTranslation,
  nextGraphKeyboardNodeID,
  resolveGraphCanvasKeyboardConfiguration,
} from './keyboard.js'

const context: FdGraphKeyboardCommandContext = {
  hasSelection: false,
  focusedNodeIsSelected: false,
  navigationEnabled: true,
  nudgingEnabled: true,
  selectionEnabled: true,
  historyEnabled: true,
}

const key = (value: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', { key: value, ...init })

describe('graph keyboard configuration', () => {
  it('validates nudge distances and permits replacing the command resolver', () => {
    const resolveCommand = () => ({ kind: 'clearSelection' }) as const
    const resolved = resolveGraphCanvasKeyboardConfiguration({
      nudgeStep: 2,
      largeNudgeStep: 16,
      resolveCommand,
    })

    expect(resolved.nudgeStep).toBe(2)
    expect(resolved.largeNudgeStep).toBe(16)
    expect(resolved.resolveCommand).toBe(resolveCommand)
    expect(() =>
      resolveGraphCanvasKeyboardConfiguration({ nudgeStep: 4, largeNudgeStep: 2 }),
    ).toThrow(RangeError)
  })
})

describe('default graph keyboard command resolver', () => {
  it('uses arrows for focus navigation until the focused node is selected', () => {
    expect(defaultGraphKeyboardCommandResolver(key('ArrowRight'), context)).toEqual({
      kind: 'navigate',
      direction: 'right',
    })
    expect(
      defaultGraphKeyboardCommandResolver(key('ArrowRight', { shiftKey: true }), {
        ...context,
        hasSelection: true,
        focusedNodeIsSelected: true,
      }),
    ).toEqual({ kind: 'nudge', direction: 'right', large: true })
  })

  it('uses conventional cross-platform undo and redo bindings', () => {
    expect(defaultGraphKeyboardCommandResolver(key('z', { metaKey: true }), context)).toEqual({
      kind: 'undo',
    })
    expect(
      defaultGraphKeyboardCommandResolver(key('z', { metaKey: true, shiftKey: true }), context),
    ).toEqual({ kind: 'redo' })
    expect(defaultGraphKeyboardCommandResolver(key('y', { ctrlKey: true }), context)).toEqual({
      kind: 'redo',
    })
  })

  it('does not claim composing, option-modified, or unrelated shortcuts', () => {
    expect(defaultGraphKeyboardCommandResolver(key('ArrowRight', { altKey: true }), context)).toBe(
      undefined,
    )
    expect(defaultGraphKeyboardCommandResolver(key('k', { metaKey: true }), context)).toBe(
      undefined,
    )
  })
})

describe('graph keyboard navigation', () => {
  const candidates = [
    { id: 'center', frame: { x: 100, y: 100, width: 20, height: 20 }, presentationOrder: 0 },
    { id: 'right-far', frame: { x: 180, y: 180, width: 20, height: 20 }, presentationOrder: 1 },
    { id: 'right', frame: { x: 180, y: 100, width: 20, height: 20 }, presentationOrder: 2 },
    { id: 'down', frame: { x: 100, y: 180, width: 20, height: 20 }, presentationOrder: 3 },
  ] as const

  it('chooses the nearest node in the requested spatial direction', () => {
    expect(nextGraphKeyboardNodeID(candidates[0], 'right', candidates)).toBe('right')
    expect(nextGraphKeyboardNodeID(candidates[0], 'down', candidates)).toBe('down')
    expect(nextGraphKeyboardNodeID(candidates[0], 'left', candidates)).toBe(undefined)
  })

  it('uses deterministic presentation order for equal candidates', () => {
    const tied = [
      candidates[0],
      { id: 'later', frame: { x: 180, y: 100, width: 20, height: 20 }, presentationOrder: 8 },
      { id: 'earlier', frame: { x: 180, y: 100, width: 20, height: 20 }, presentationOrder: 2 },
    ]

    expect(nextGraphKeyboardNodeID(candidates[0], 'right', tied)).toBe('earlier')
  })

  it('returns exact translations for standard and large nudges', () => {
    expect(graphKeyboardTranslation('left', 1)).toEqual({ width: -1, height: 0 })
    expect(graphKeyboardTranslation('down', 10)).toEqual({ width: 0, height: 10 })
  })

  it('scans a hundred-thousand-node model without allocating a DOM representation', () => {
    const large = Array.from({ length: 100_000 }, (_, index) => ({
      id: index,
      frame: { x: index * 24, y: 0, width: 20, height: 20 },
      presentationOrder: index,
    }))
    const current = large[50_000]

    expect(current && nextGraphKeyboardNodeID(current, 'right', large)).toBe(50_001)
  })
})
