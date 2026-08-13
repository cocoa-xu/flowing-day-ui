import { describe, expect, it } from 'vitest'
import { resolveGraphCanvasConfiguration } from './configuration.js'

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
})
