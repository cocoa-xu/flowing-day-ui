import { describe, expect, it } from 'vitest'
import type { FdCanvasRect } from '../geometry.js'
import type { FdAnyGraphNode } from '../graph/model.js'
import {
  FdGraphCanvasArrangement,
  FdGraphCanvasResizeSnapRequest,
  type FdGraphCanvasResizeSnapRequestOptions,
  FdGraphCanvasSnappingStrategy,
  FdGraphCanvasSnapState,
  FdGraphCanvasTranslationSnapRequest,
  graphSelectionBounds,
  resizeGraphBounds,
  scaleGraphFrames,
  snapGraphResize,
  snapGraphTranslation,
} from './arrangement.js'
import {
  admittedGraphNodeIDs,
  resolveGraphCanvasInteractionConfiguration,
} from './configuration.js'
import {
  FdGraphCanvasMarquee,
  FdGraphCanvasMarqueeSelectionResolver,
  FdGraphCanvasMarqueeSelectionState,
  FdGraphCanvasSessionReducer,
  graphEdgeDistance,
  graphSelectionMode,
  resolveGraphMarqueeSelection,
  resolveGraphSelection,
} from './selection.js'

const nodes: FdAnyGraphNode[] = [
  { id: 'one', frame: { x: 0, y: 0, width: 80, height: 60 } },
  { id: 'two', frame: { x: 120, y: 0, width: 80, height: 60 } },
]

describe('graph selection', () => {
  it('hit-tests the rendered cubic edge instead of its bounding box', () => {
    const source = { x: 0, y: 0 }
    const target = { x: 200, y: 100 }

    expect(graphEdgeDistance({ x: 100, y: 50 }, source, target)).toBeLessThan(1)
    expect(graphEdgeDistance({ x: 100, y: 90 }, source, target)).toBeGreaterThan(30)
    expect(() => graphEdgeDistance({ x: 0, y: 0 }, source, target, 0)).toThrow(RangeError)
  })

  it('maps desktop modifiers to selection modes', () => {
    expect(graphSelectionMode(false, false, false)).toBe('replace')
    expect(graphSelectionMode(true, false, false)).toBe('additive')
    expect(graphSelectionMode(false, true, false)).toBe('toggle')
  })

  it('supports replacement, additive selection, and toggling', () => {
    expect([...resolveGraphSelection(new Set(['one']), 'two', 'replace', 'multiple')]).toEqual([
      'two',
    ])
    expect([...resolveGraphSelection(new Set(['one']), 'two', 'additive', 'multiple')]).toEqual([
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

  it('matches Swift marquee selection resolution', () => {
    expect([
      ...FdGraphCanvasMarqueeSelectionResolver.selection(
        new Set(['one', 'two']),
        new Set(['two', 'three']),
        'toggle',
      ),
    ]).toEqual(['one', 'three'])
  })

  it('activates marquee state only after the minimum distance is exceeded', () => {
    const state = new FdGraphCanvasMarqueeSelectionState(new Set(['one']), 'additive')

    expect([...state.update(new Set(['two']), false)]).toEqual(['one'])
    expect(state.isActive).toBe(false)
    expect([...state.update(new Set(['two']), true)]).toEqual(['one', 'two'])
    expect(state.isActive).toBe(true)
    expect([...state.candidates]).toEqual(['two'])
  })

  it('calculates the marquee rectangle independently of drag direction', () => {
    expect(new FdGraphCanvasMarquee({ x: 12, y: 15 }, { x: 2, y: 5 }).rect).toEqual({
      x: 2,
      y: 5,
      width: 10,
      height: 10,
    })
  })

  it('applies Swift selection commands in place', () => {
    const selection = new Set(['one', 'two'])

    FdGraphCanvasSessionReducer.apply(
      { kind: 'toggle', elementIDs: new Set(['two', 'three']) },
      selection,
    )
    expect([...selection]).toEqual(['one', 'three'])

    FdGraphCanvasSessionReducer.apply({ kind: 'replace', elementIDs: new Set(['four']) }, selection)
    expect([...selection]).toEqual(['four'])

    FdGraphCanvasSessionReducer.apply({ kind: 'clear' }, selection)
    expect(selection.size).toBe(0)
  })
})

describe('graph interaction policy', () => {
  const request = {
    anchorNode: nodes[0] as FdAnyGraphNode,
    selectedNodes: nodes.slice(0, 2),
    candidateNodes: nodes.slice(0, 2),
    snapshotID: 'policy',
  }

  it('matches the Swift graph canvas interaction defaults', () => {
    const configuration = resolveGraphCanvasInteractionConfiguration({})

    expect(configuration.nodeDragging).toBe(true)
    expect(configuration.multipleNodeDragging).toBe(false)
    expect(configuration.nodeResizing).toBe(false)
    expect(configuration.minimumNodeWidth).toBe(44)
    expect(configuration.minimumNodeHeight).toBe(32)
    expect(configuration.snapping.enabled).toBe(false)
    expect(configuration.snapping.showsGuides).toBe(false)
  })

  it('admits only candidate nodes while requiring the anchor', () => {
    expect([
      ...admittedGraphNodeIDs(request, {
        kind: 'allowOnly',
        nodeIDs: new Set(['one', 'missing']),
      }),
    ]).toEqual(['one'])
    expect(
      admittedGraphNodeIDs(request, {
        kind: 'allowOnly',
        nodeIDs: new Set(['two']),
      }).size,
    ).toBe(0)
  })

  it('resolves and validates per-node size constraints', () => {
    const configuration = resolveGraphCanvasInteractionConfiguration({
      minimumNodeWidth: 44,
      minimumNodeHeight: 32,
      nodeSizeConstraints: ({ id }) =>
        id === 'one' ? { minimumWidth: 80, maximumWidth: 160, maximumHeight: 120 } : undefined,
    })

    expect(configuration.nodeSizeConstraints(nodes[0] as FdAnyGraphNode)).toEqual({
      minimumWidth: 80,
      minimumHeight: 32,
      maximumWidth: 160,
      maximumHeight: 120,
    })
    expect(configuration.nodeSizeConstraints(nodes[1] as FdAnyGraphNode)).toEqual({
      minimumWidth: 44,
      minimumHeight: 32,
    })
    expect(
      resolveGraphCanvasInteractionConfiguration({
        nodeSizeConstraints: () => ({
          minimumWidth: 0,
          minimumHeight: 0,
          maximumWidth: 0,
          maximumHeight: 0,
        }),
      }).nodeSizeConstraints(nodes[0] as FdAnyGraphNode),
    ).toEqual({
      minimumWidth: 0,
      minimumHeight: 0,
      maximumWidth: 0,
      maximumHeight: 0,
    })
    expect(() =>
      resolveGraphCanvasInteractionConfiguration({
        nodeSizeConstraints: () => ({ minimumWidth: 80, maximumWidth: 40 }),
      }).nodeSizeConstraints(nodes[0] as FdAnyGraphNode),
    ).toThrow('maximum node width must not be smaller than its minimum')
  })
})

describe('graph snapping', () => {
  const configuration = resolveGraphCanvasInteractionConfiguration({
    snapping: { enabled: true },
  }).snapping

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
        enabled: true,
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

  it('matches the Swift request and strategy boundary', () => {
    const request = new FdGraphCanvasTranslationSnapRequest({
      movingBounds: { x: 0, y: 0, width: 40, height: 40 },
      proposedTranslation: { width: 23, height: 24 },
      candidates: [],
      configuration: {
        isEnabled: true,
        targets: new Set(['grid']),
        grid: {
          origin: { x: 5, y: 5 },
          majorCellSize: { width: 20, height: 20 },
        },
      },
      zoom: 1,
    })
    const custom = new FdGraphCanvasSnappingStrategy({
      translation: (value) => {
        const standard = value.standardResult()
        return {
          ...standard,
          translation: { ...standard.translation, width: standard.translation.width + 1 },
        }
      },
    })

    expect(request.standardResult().translation).toEqual({ width: 25, height: 25 })
    expect(FdGraphCanvasSnappingStrategy.standard.snap(request).translation).toEqual({
      width: 25,
      height: 25,
    })
    expect(custom.snap(request).translation).toEqual({ width: 26, height: 25 })
    expect(() => new FdGraphCanvasTranslationSnapRequest({ ...request, zoom: 0 })).toThrow(
      'zoom must be positive',
    )
  })

  it('bounds dense alignment candidates without materializing every guide', () => {
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
    expect(result.guides[0]?.upperBound).toBe(60)
  })

  it('recognizes and presents a longer equal-spacing chain', () => {
    const spacing = resolveGraphCanvasInteractionConfiguration({
      snapping: { enabled: true, alignment: false, equalSpacing: true, guideOffset: 8 },
    }).snapping
    const result = snapGraphTranslation(
      { x: 120, y: 0, width: 20, height: 20 },
      { width: -2, height: 0 },
      [
        { id: 'one', frame: { x: 0, y: 0, width: 20, height: 20 } },
        { id: 'two', frame: { x: 40, y: 0, width: 20, height: 20 } },
        { id: 'three', frame: { x: 80, y: 0, width: 20, height: 20 } },
      ],
      spacing,
      1,
    )

    expect(result.translation.width).toBe(0)
    expect(result.guides).toHaveLength(3)
    expect(
      result.guides.every(({ kind, measurement }) => kind === 'equalSpacing' && measurement === 20),
    ).toBe(true)
  })
})

describe('graph group resizing', () => {
  it('matches the Swift resize request boundary', () => {
    const options = {
      baseFrame: { x: 0, y: 0, width: 100, height: 50 },
      proposedFrame: { x: 0, y: 0, width: 150, height: 75 },
      edges: new Set(['trailing', 'bottom']),
      candidates: [],
      configuration: { isEnabled: false },
      minimumSize: { width: 20, height: 20 },
      zoom: 1,
    } satisfies FdGraphCanvasResizeSnapRequestOptions
    const request = new FdGraphCanvasResizeSnapRequest(options)

    expect(request.standardResult()).toEqual({
      frame: { x: 0, y: 0, width: 150, height: 75 },
      guides: [],
      snapState: expect.any(FdGraphCanvasSnapState),
    })
    expect(
      () =>
        new FdGraphCanvasResizeSnapRequest({
          ...options,
          edges: new Set(['leading', 'trailing']),
        }),
    ).toThrow('resize edges must be valid')
    expect(
      () =>
        new FdGraphCanvasResizeSnapRequest({
          ...options,
          behavior: { preservesAspectRatio: true },
        }),
    ).toThrow('aspect ratio preservation requires a driving axis')
  })

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
      undefined,
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
        undefined,
        false,
        true,
      ),
    ).toEqual({ x: 50, y: 100, width: 300, height: 100 })
  })

  it('clamps ordinary and aspect-ratio resize to maximum bounds', () => {
    expect(
      resizeGraphBounds(
        { x: 0, y: 0, width: 100, height: 50 },
        'bottomRight',
        { width: 200, height: 200 },
        { width: 40, height: 32 },
        { width: 180, height: 90 },
        false,
        false,
      ),
    ).toEqual({ x: 0, y: 0, width: 180, height: 90 })
    expect(
      resizeGraphBounds(
        { x: 0, y: 0, width: 100, height: 50 },
        'bottomRight',
        { width: 200, height: 10 },
        { width: 40, height: 32 },
        { width: 180, height: 90 },
        true,
        false,
      ),
    ).toEqual({ x: 0, y: 0, width: 180, height: 90 })
  })

  it('exposes the standard resize solver through a reusable request', () => {
    const baseBounds = graphSelectionBounds(frames) as FdCanvasRect
    const result = snapGraphResize({
      baseFrames: frames,
      baseBounds,
      proposedBounds: { x: 0, y: 0, width: 298, height: 148 },
      proposedTranslation: { width: -2, height: -2 },
      handle: 'bottomRight',
      candidates: [],
      configuration: resolveGraphCanvasInteractionConfiguration({
        snapping: {
          enabled: true,
          alignment: false,
          grid: { enabled: true, width: 50, height: 50 },
        },
      }).snapping,
      minimumSize: { width: 40, height: 32 },
      zoom: 1,
      previous: {},
      preservesAspectRatio: false,
      resizesFromCenter: false,
    })

    expect(result.bounds).toEqual({ x: 0, y: 0, width: 300, height: 150 })
    expect(result.frames.get('two')).toEqual({ x: 200, y: 100, width: 100, height: 50 })
  })

  it('snaps resize dimensions and emits measurement guides', () => {
    const baseFrames = new Map([['one', { x: 0, y: 0, width: 100, height: 60 }]])
    const result = snapGraphResize({
      baseFrames,
      baseBounds: { x: 0, y: 0, width: 100, height: 60 },
      proposedBounds: { x: 0, y: 0, width: 147, height: 60 },
      proposedTranslation: { width: 47, height: 0 },
      handle: 'right',
      candidates: [{ id: 'target', frame: { x: 300, y: 0, width: 150, height: 80 } }],
      configuration: resolveGraphCanvasInteractionConfiguration({
        snapping: { enabled: true, alignment: false, equalSpacing: false, equalSize: true },
      }).snapping,
      minimumSize: { width: 40, height: 32 },
      zoom: 1,
      previous: {},
      preservesAspectRatio: false,
      resizesFromCenter: false,
    })

    expect(result.bounds.width).toBe(150)
    expect(result.guides.map(({ kind }) => kind)).toEqual(['equalSize', 'resize'])
    expect(result.guides.at(-1)?.measurement).toBe(150)
  })
})

describe('graph arrangement actions', () => {
  const geometries = [
    { id: 'one', frame: { x: 0, y: 0, width: 20, height: 20 } },
    { id: 'two', frame: { x: 50, y: 40, width: 10, height: 10 } },
    { id: 'three', frame: { x: 100, y: 80, width: 20, height: 20 } },
  ]

  it('aligns a selection to its shared bounds', () => {
    expect(
      FdGraphCanvasArrangement.translations(geometries, {
        kind: 'align',
        alignment: 'trailing',
      }),
    ).toEqual(
      new Map([
        ['one', { width: 100, height: 0 }],
        ['two', { width: 60, height: 0 }],
      ]),
    )
  })

  it('distributes a selection while preserving its outer nodes', () => {
    expect(
      FdGraphCanvasArrangement.translations(geometries, {
        kind: 'distribute',
        distribution: 'horizontal',
      }),
    ).toEqual(new Map([['two', { width: 5, height: 0 }]]))
  })
})
