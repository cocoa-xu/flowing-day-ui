import { describe, expect, it } from 'vitest'
import {
  resolveGraphCanvasConfiguration,
  resolveGraphCanvasGridConfiguration,
} from './configuration.js'

describe('graph canvas configuration', () => {
  it('matches the Swift defaults', () => {
    const configuration = resolveGraphCanvasConfiguration()

    expect(configuration.renderingBackend).toBe('automatic')
    expect(configuration.edgeRenderPadding).toBe(12)
    expect(configuration.marqueeMinimumDistance).toBe(2)
    expect(configuration.nodeDraggingMode).toBe('single')
    expect(configuration.nodeResizing).toEqual({
      isEnabled: false,
      minimumSize: { width: 44, height: 32 },
    })
    expect(configuration.connectionEditing).toEqual({
      isEnabled: false,
      allowsReconnection: true,
      targetHitRadius: 18,
      sourceHitPadding: 6,
      minimumDragDistance: 2,
      rendersDefaultPreview: true,
    })
    expect(configuration.snapping).toEqual({
      isEnabled: false,
      targets: new Set(['alignment', 'grid', 'equalSpacing', 'equalSize']),
      tolerance: 6,
      searchRadius: 600,
      maximumCandidates: 512,
      showsGuides: false,
      guideOffset: 8,
      releaseTolerance: 10,
    })
    expect(configuration.rendersDefaultGuides).toBe(true)
    expect(configuration.allowsArrangementCommands).toBe(true)
    expect(configuration.keyboardNavigation).toEqual({
      isEnabled: true,
      selectionBehavior: 'replace',
      keepsFocusedNodeVisible: true,
    })
    expect(configuration.keyboardNudging).toEqual({
      isEnabled: true,
      step: 1,
      largeStep: 10,
    })
    expect(configuration.accessibility).toEqual({})
  })

  it('validates configuration values at the public boundary', () => {
    expect(() => resolveGraphCanvasConfiguration({ edgeRenderPadding: -1 })).toThrow(
      'edge render padding must not be negative',
    )
    expect(() =>
      resolveGraphCanvasConfiguration({
        keyboardNudging: { step: 8, largeStep: 4 },
      }),
    ).toThrow('large keyboard nudge step must not be smaller than the standard step')
  })

  it('matches Swift node resizing and snapping initializer semantics', () => {
    expect(
      resolveGraphCanvasConfiguration({
        nodeResizing: { isEnabled: true, minimumSize: { width: 0, height: 0 } },
        snapping: { isEnabled: false },
      }),
    ).toMatchObject({
      nodeResizing: { isEnabled: true, minimumSize: { width: 0, height: 0 } },
      snapping: { isEnabled: false, showsGuides: true },
    })
  })

  it('resolves and validates Swift-aligned grid values', () => {
    expect(
      resolveGraphCanvasGridConfiguration({
        origin: { x: 5, y: 10 },
        majorCellSize: { width: 80, height: 60 },
        subdivisions: { x: 4, y: 3 },
        enabledAxes: new Set(['x']),
        roundingPolicy: 'down',
      }),
    ).toEqual({
      origin: { x: 5, y: 10 },
      majorCellSize: { width: 80, height: 60 },
      minorCellSize: { width: 20, height: 20 },
      subdivisions: { x: 4, y: 3 },
      enabledAxes: new Set(['x']),
      roundingPolicy: 'down',
    })
    expect(() =>
      resolveGraphCanvasGridConfiguration({
        origin: { x: Number.NaN, y: 0 },
        majorCellSize: { width: 20, height: 20 },
      }),
    ).toThrow('grid origin must be finite')
    expect(() =>
      resolveGraphCanvasGridConfiguration({
        majorCellSize: { width: 20, height: 20 },
        subdivisions: { x: 0 },
      }),
    ).toThrow('horizontal grid subdivisions must be positive')
  })
})
