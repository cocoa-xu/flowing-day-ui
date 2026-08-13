import { describe, expect, it } from 'vitest'
import { FdCanvasTransform, FdCanvasViewport } from '../geometry.js'
import {
  FdLayoutComponentIdentity,
  FdLayoutInputID,
  FdLayoutPipelineIdentity,
  FdLayoutRevision,
} from '../layout/model.js'
import {
  FdGraphCanvasElementActionIntent,
  FdGraphCanvasNavigation,
  FdGraphCanvasNodeArrangementIntent,
  FdGraphCanvasNodeDragIntent,
  FdGraphCanvasNodeResizeChange,
  FdGraphCanvasNodeResizeIntent,
  FdGraphCanvasSessionCommand,
  FdGraphCanvasSessionID,
  FdGraphCanvasSessionState,
  FdGraphCanvasTransientNodeDrag,
  FdGraphCanvasTransientNodeResize,
} from './session.js'

const layoutInputID = new FdLayoutInputID(
  'snapshot',
  new FdLayoutPipelineIdentity(new FdLayoutComponentIdentity('pipeline')),
  new FdLayoutComponentIdentity('sizes'),
  new FdLayoutComponentIdentity('anchors'),
  new FdLayoutRevision(),
)

describe('graph canvas session model', () => {
  it('creates a Swift-aligned empty session state', () => {
    const state = new FdGraphCanvasSessionState()

    expect(state.viewport).toEqual(new FdCanvasViewport())
    expect(state.viewport.visibleWorldRect).toEqual({ x: 0, y: 0, width: 0, height: 0 })
    expect(state.selection).toEqual(new Set())
    expect(state.tool).toBe('select')
    expect(state.focusedElementID).toBeUndefined()
    expect(state.transientNodeDrag).toBeUndefined()
  })

  it('preserves session command identity and targeting', () => {
    const sessionID = new FdGraphCanvasSessionID('session')
    const command = new FdGraphCanvasSessionCommand(
      sessionID,
      { kind: 'restoreViewport', transform: new FdCanvasTransform(1.5, { x: 20, y: 30 }) },
      false,
      'command',
    )

    expect(command).toMatchObject({ id: 'command', animated: false })
    expect(command.targets(new FdGraphCanvasSessionID('session'))).toBe(true)
    expect(command.targets(new FdGraphCanvasSessionID('other'))).toBe(false)
  })

  it('creates the standard jump command with Swift defaults', () => {
    const sessionID = new FdGraphCanvasSessionID('session')

    const command = FdGraphCanvasNavigation.jumpCommand('node', sessionID)

    expect(command.targetSessionID).toBe(sessionID)
    expect(command.animated).toBe(true)
    expect(command.action).toEqual({
      kind: 'jumpToElement',
      elementID: 'node',
      selection: 'replace',
    })
  })

  it('tracks transient multi-node drag state against exact layout identity', () => {
    const drag = new FdGraphCanvasTransientNodeDrag({
      nodeID: 'anchor',
      nodeIDs: new Set(['anchor', 'peer']),
      basePresentationSnapshotID: 'snapshot',
      baseLayoutInputID: layoutInputID,
    })

    expect(drag.nodeIDs).toEqual(new Set(['anchor', 'peer']))
    expect(drag.baseLayoutInputID).toBe(layoutInputID)
    expect(drag.translation).toEqual({ width: 0, height: 0 })
    expect(
      () =>
        new FdGraphCanvasTransientNodeDrag({
          nodeID: 'anchor',
          nodeIDs: new Set(['peer']),
          basePresentationSnapshotID: 'snapshot',
          baseLayoutInputID: layoutInputID,
        }),
    ).toThrow(RangeError)
  })

  it('derives transient resize bounds and validates node order', () => {
    const baseFrames = new Map([
      ['anchor', { x: 10, y: 20, width: 100, height: 50 }],
      ['peer', { x: 150, y: 40, width: 80, height: 60 }],
    ])
    const resize = new FdGraphCanvasTransientNodeResize({
      anchorNodeID: 'anchor',
      basePresentationSnapshotID: 'snapshot',
      baseLayoutInputID: layoutInputID,
      nodeOrder: ['anchor', 'peer'],
      baseFrames,
      minimumBoundsSize: { width: 40, height: 30 },
      maximumBoundsSize: { width: 500, height: 400 },
      edges: new Set(['trailing', 'bottom']),
    })

    expect(resize.nodeIDs).toEqual(new Set(['anchor', 'peer']))
    expect(resize.baseBounds).toEqual({ x: 10, y: 20, width: 220, height: 80 })
    expect(resize.bounds).toEqual(resize.baseBounds)
    expect(
      () =>
        new FdGraphCanvasTransientNodeResize({
          anchorNodeID: 'anchor',
          basePresentationSnapshotID: 'snapshot',
          baseLayoutInputID: layoutInputID,
          nodeOrder: ['peer', 'anchor'],
          baseFrames,
          edges: new Set(['trailing']),
        }),
    ).toThrow(RangeError)
  })

  it('validates drag, resize, arrangement, and element action intents', () => {
    const drag = new FdGraphCanvasNodeDragIntent(
      'anchor',
      'snapshot',
      layoutInputID,
      { width: 20, height: -10 },
      new Set(['anchor', 'peer']),
    )
    const change = new FdGraphCanvasNodeResizeChange(
      'anchor',
      { width: 0, height: 0 },
      { width: 20, height: 10 },
    )
    const resize = new FdGraphCanvasNodeResizeIntent(
      'anchor',
      [change],
      new Set(['trailing']),
      'snapshot',
      layoutInputID,
    )
    const arrangement = new FdGraphCanvasNodeArrangementIntent(
      { kind: 'align', alignment: 'leading' },
      new Map([['anchor', { width: 4, height: 0 }]]),
      'snapshot',
      layoutInputID,
    )
    const action = new FdGraphCanvasElementActionIntent('inspect', 'anchor', 'snapshot')

    expect(drag.nodeIDs).toEqual(new Set(['anchor', 'peer']))
    expect(resize.changes).toEqual([change])
    expect(arrangement.translations.get('anchor')).toEqual({ width: 4, height: 0 })
    expect(action.action).toBe('inspect')
    expect(
      () =>
        new FdGraphCanvasNodeResizeIntent(
          'anchor',
          [],
          new Set(['trailing']),
          'snapshot',
          layoutInputID,
        ),
    ).toThrow(RangeError)
  })
})
