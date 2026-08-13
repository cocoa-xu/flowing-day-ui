import { describe, expect, it } from 'vitest'
import {
  defaultGraphCanvasKeyboardCommandResolver,
  type FdGraphCanvasKeyboardCommandContext,
  FdGraphCanvasKeyboardNavigator,
  FdGraphCanvasKeyboardNudger,
} from './keyboard.js'

const context: FdGraphCanvasKeyboardCommandContext = {
  hasSelection: false,
  focusedNodeIsSelected: false,
  navigationEnabled: true,
  nudgingEnabled: true,
  selectionEnabled: true,
  historyEnabled: true,
}

const key = (value: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', { key: value, ...init })

describe('default graph keyboard command resolver', () => {
  it('uses arrows for focus navigation until the focused node is selected', () => {
    expect(defaultGraphCanvasKeyboardCommandResolver(key('ArrowRight'), context)).toEqual({
      kind: 'navigate',
      direction: 'right',
    })
    expect(
      defaultGraphCanvasKeyboardCommandResolver(key('ArrowRight', { shiftKey: true }), {
        ...context,
        hasSelection: true,
        focusedNodeIsSelected: true,
      }),
    ).toEqual({ kind: 'nudge', direction: 'right', large: true })
  })

  it('uses conventional cross-platform undo and redo bindings', () => {
    expect(defaultGraphCanvasKeyboardCommandResolver(key('z', { metaKey: true }), context)).toEqual(
      {
        kind: 'undo',
      },
    )
    expect(
      defaultGraphCanvasKeyboardCommandResolver(
        key('z', { metaKey: true, shiftKey: true }),
        context,
      ),
    ).toEqual({ kind: 'redo' })
    expect(defaultGraphCanvasKeyboardCommandResolver(key('y', { ctrlKey: true }), context)).toEqual(
      {
        kind: 'redo',
      },
    )
  })

  it('does not claim composing, option-modified, or unrelated shortcuts', () => {
    expect(
      defaultGraphCanvasKeyboardCommandResolver(key('ArrowRight', { altKey: true }), context),
    ).toBe(undefined)
    expect(defaultGraphCanvasKeyboardCommandResolver(key('k', { metaKey: true }), context)).toBe(
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
    expect(FdGraphCanvasKeyboardNavigator.nextNodeID(candidates[0], 'right', candidates)).toBe(
      'right',
    )
    expect(FdGraphCanvasKeyboardNavigator.nextNodeID(candidates[0], 'down', candidates)).toBe(
      'down',
    )
    expect(FdGraphCanvasKeyboardNavigator.nextNodeID(candidates[0], 'left', candidates)).toBe(
      undefined,
    )
  })

  it('uses deterministic presentation order for equal candidates', () => {
    const tied = [
      candidates[0],
      { id: 'later', frame: { x: 180, y: 100, width: 20, height: 20 }, presentationOrder: 8 },
      { id: 'earlier', frame: { x: 180, y: 100, width: 20, height: 20 }, presentationOrder: 2 },
    ]

    expect(FdGraphCanvasKeyboardNavigator.nextNodeID(candidates[0], 'right', tied)).toBe('earlier')
  })

  it('matches Swift standard, large, and disabled nudge behavior', () => {
    const configuration = { isEnabled: true, step: 1, largeStep: 10 }

    expect(FdGraphCanvasKeyboardNudger.translation('left', configuration)).toEqual({
      width: -1,
      height: 0,
    })
    expect(
      FdGraphCanvasKeyboardNudger.translation(
        'down',
        configuration,
        new Set(['largeKeyboardNudge'] as const),
      ),
    ).toEqual({ width: 0, height: 10 })
    expect(
      FdGraphCanvasKeyboardNudger.translation('right', {
        ...configuration,
        isEnabled: false,
      }),
    ).toBe(undefined)
  })

  it('scans a hundred-thousand-node model without allocating a DOM representation', () => {
    const large = Array.from({ length: 100_000 }, (_, index) => ({
      id: index,
      frame: { x: index * 24, y: 0, width: 20, height: 20 },
      presentationOrder: index,
    }))
    const current = large[50_000]

    expect(current && FdGraphCanvasKeyboardNavigator.nextNodeID(current, 'right', large)).toBe(
      50_001,
    )
  })
})
