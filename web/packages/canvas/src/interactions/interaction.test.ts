import { describe, expect, it } from 'vitest'
import type { FdCanvasRect } from '../geometry.js'
import type { FdAnyGraphNode } from '../graph/model.js'
import {
  graphSelectionBounds,
  resizeGraphBounds,
  scaleGraphFrames,
  snapGraphTranslation,
} from './arrangement.js'
import { resolveGraphCanvasInteractionConfiguration } from './configuration.js'
import {
  graphSelectionMode,
  resolveGraphMarqueeSelection,
  resolveGraphSelection,
} from './selection.js'

const nodes: FdAnyGraphNode[] = [
  { id: 'one', frame: { x: 0, y: 0, width: 80, height: 60 } },
  { id: 'two', frame: { x: 120, y: 0, width: 80, height: 60 } },
  {
    id: 'locked',
    frame: { x: 240, y: 0, width: 80, height: 60 },
    capabilities: { selectable: false },
  },
]

describe('graph selection', () => {
  it('maps desktop modifiers to selection modes', () => {
    expect(graphSelectionMode(false, false, false)).toBe('replace')
    expect(graphSelectionMode(true, false, false)).toBe('extend')
    expect(graphSelectionMode(false, true, false)).toBe('toggle')
  })

  it('supports replacement, extension, and toggling', () => {
    expect([...resolveGraphSelection(new Set(['one']), 'two', 'replace', 'multiple')]).toEqual([
      'two',
    ])
    expect([...resolveGraphSelection(new Set(['one']), 'two', 'extend', 'multiple')]).toEqual([
      'one',
      'two',
    ])
    expect([...resolveGraphSelection(new Set(['one']), 'one', 'toggle', 'multiple')]).toEqual([])
  })

  it('previews marquee selection while excluding nonselectable nodes', () => {
    expect([
      ...resolveGraphMarqueeSelection(
        new Set(),
        nodes,
        { x: -10, y: -10, width: 300, height: 100 },
        'replace',
        'multiple',
        'intersects',
      ),
    ]).toEqual(['one', 'two'])
  })
})

describe('graph snapping', () => {
  const configuration = resolveGraphCanvasInteractionConfiguration({}).snapping

  it('aligns the closest pair of node anchors', () => {
    const result = snapGraphTranslation(
      { x: 0, y: 0, width: 80, height: 60 },
      { width: 37, height: 117 },
      [{ id: 'target', frame: { x: 120, y: 120, width: 80, height: 60 } }],
      configuration,
      1,
    )
    expect(result.translation).toEqual({ width: 40, height: 120 })
    expect(result.guides).toHaveLength(2)
  })

  it('retains a snap until the larger release threshold is crossed', () => {
    const acquired = snapGraphTranslation(
      { x: 0, y: 0, width: 80, height: 60 },
      { width: 37, height: 0 },
      [{ id: 'target', frame: { x: 120, y: 0, width: 80, height: 60 } }],
      configuration,
      1,
    )
    const retained = snapGraphTranslation(
      { x: 0, y: 0, width: 80, height: 60 },
      { width: 48, height: 0 },
      [{ id: 'target', frame: { x: 120, y: 0, width: 80, height: 60 } }],
      configuration,
      1,
      acquired.state,
    )
    const released = snapGraphTranslation(
      { x: 0, y: 0, width: 80, height: 60 },
      { width: 52, height: 0 },
      [{ id: 'target', frame: { x: 120, y: 0, width: 80, height: 60 } }],
      configuration,
      1,
      acquired.state,
    )
    expect(retained.translation.width).toBe(40)
    expect(released.state.x).toBeUndefined()
  })

  it('supports configurable grid origins and rounding', () => {
    const grid = resolveGraphCanvasInteractionConfiguration({
      snapping: {
        alignment: false,
        grid: { enabled: true, width: 20, height: 20, originX: 5, originY: 5 },
      },
    }).snapping
    expect(
      snapGraphTranslation(
        { x: 0, y: 0, width: 40, height: 40 },
        { width: 23, height: 24 },
        [],
        grid,
        1,
      ).translation,
    ).toEqual({ width: 25, height: 25 })
  })

  it('resolves dense alignment candidates without materializing every guide', () => {
    const candidates = Array.from({ length: 10_000 }, (_, index) => ({
      id: index,
      frame: { x: 120, y: index * 80, width: 80, height: 60 },
    }))
    const result = snapGraphTranslation(
      { x: 0, y: 0, width: 80, height: 60 },
      { width: 37, height: 0 },
      candidates,
      configuration,
      1,
    )

    expect(result.translation.width).toBe(40)
    expect(result.guides[0]?.upperBound).toBe(799_980)
  })
})

describe('graph group resizing', () => {
  const frames = new Map<string, FdCanvasRect>([
    ['one', { x: 0, y: 0, width: 100, height: 50 }],
    ['two', { x: 200, y: 100, width: 100, height: 50 }],
  ])

  it('derives and proportionally resizes a selection bounding box', () => {
    const bounds = graphSelectionBounds(frames)
    expect(bounds).toEqual({ x: 0, y: 0, width: 300, height: 150 })
    const resized = resizeGraphBounds(
      bounds as FdCanvasRect,
      'bottomRight',
      { width: 300, height: 150 },
      { width: 40, height: 32 },
      false,
      false,
    )
    expect([...scaleGraphFrames(frames, bounds as FdCanvasRect, resized).values()]).toEqual([
      { x: 0, y: 0, width: 200, height: 100 },
      { x: 400, y: 200, width: 200, height: 100 },
    ])
  })

  it('resizes symmetrically from the center', () => {
    expect(
      resizeGraphBounds(
        { x: 100, y: 100, width: 200, height: 100 },
        'right',
        { width: 50, height: 0 },
        { width: 40, height: 32 },
        false,
        true,
      ),
    ).toEqual({ x: 50, y: 100, width: 300, height: 100 })
  })
})
