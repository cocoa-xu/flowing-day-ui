import { describe, expect, it } from 'vitest'
import type { FdAnyGraphSnapshot } from './model.js'
import {
  FdGraphCanvasInteractionPolicy,
  FdGraphCanvasNodeCapabilities,
  FdGraphCanvasNodeCapabilityMap,
  FdGraphCanvasNodeDragAdmissionRequest,
  FdGraphCanvasNodeDragResolver,
  FdGraphCanvasNodeResizeAdmissionRequest,
  FdGraphCanvasNodeResizeResolver,
  FdGraphCanvasNodeSizeConstraintMap,
  FdGraphCanvasNodeSizeConstraints,
} from './interaction-policy.js'

const presentation: FdAnyGraphSnapshot = {
  id: 'presentation-1',
  nodes: [
    { id: 'anchor', frame: { x: 0, y: 0, width: 100, height: 80 }, label: 'Anchor' },
    { id: 'peer', frame: { x: 160, y: 0, width: 100, height: 80 }, label: 'Peer' },
    { id: 'fixed', frame: { x: 320, y: 0, width: 100, height: 80 }, label: 'Fixed' },
  ],
  edges: [],
}

describe('graph canvas interaction policy', () => {
  it('models Swift node capabilities as an option set', () => {
    const capabilities = FdGraphCanvasNodeCapabilities.draggable.union(
      FdGraphCanvasNodeCapabilities.keyboardNavigable,
    )

    expect(capabilities.contains(FdGraphCanvasNodeCapabilities.draggable)).toBe(true)
    expect(capabilities.contains(FdGraphCanvasNodeCapabilities.resizable)).toBe(false)
    expect(
      FdGraphCanvasNodeCapabilities.standard
        .subtracting(FdGraphCanvasNodeCapabilities.resizable)
        .contains(FdGraphCanvasNodeCapabilities.resizable),
    ).toBe(false)
    expect(() => new FdGraphCanvasNodeCapabilities(-1)).toThrow(RangeError)
    expect(() => new FdGraphCanvasNodeCapabilities(256)).toThrow(RangeError)
  })

  it('resolves capability overrides before the default', () => {
    const fixed = FdGraphCanvasNodeCapabilities.standard.subtracting(
      FdGraphCanvasNodeCapabilities.draggable,
    )
    const capabilities = new FdGraphCanvasNodeCapabilityMap({
      defaultCapabilities: FdGraphCanvasNodeCapabilities.draggable,
      overrides: new Map([['fixed', fixed]]),
    })

    expect(capabilities.capabilities('other')).toBe(FdGraphCanvasNodeCapabilities.draggable)
    expect(capabilities.capabilities('fixed')).toBe(fixed)
  })

  it('resolves size constraints before the fallback minimum size', () => {
    const defaults = new FdGraphCanvasNodeSizeConstraints({
      minimumSize: { width: 44, height: 32 },
    })
    const large = new FdGraphCanvasNodeSizeConstraints({
      minimumSize: { width: 120, height: 80 },
      maximumSize: { width: 240, height: 160 },
    })
    const constraints = new FdGraphCanvasNodeSizeConstraintMap({
      defaultConstraints: defaults,
      overrides: new Map([['large', large]]),
    })

    expect(constraints.constraints('default', { width: 20, height: 20 })).toBe(defaults)
    expect(constraints.constraints('large', { width: 20, height: 20 })).toBe(large)
    expect(
      new FdGraphCanvasNodeSizeConstraintMap().constraints('fallback', {
        width: 20,
        height: 18,
      }),
    ).toEqual(new FdGraphCanvasNodeSizeConstraints({ minimumSize: { width: 20, height: 18 } }))
    expect(
      () =>
        new FdGraphCanvasNodeSizeConstraints({
          minimumSize: { width: 80, height: 60 },
          maximumSize: { width: 40, height: 40 },
        }),
    ).toThrow(RangeError)
  })

  it('exposes Swift-aligned admission and transient input closures', () => {
    const request = new FdGraphCanvasNodeDragAdmissionRequest({
      anchorNodeID: 'anchor',
      selectedNodeIDs: ['anchor', 'peer'],
      candidateNodeIDs: ['anchor', 'peer'],
      basePresentationSnapshotID: 'presentation-1',
    })
    const policy = new FdGraphCanvasInteractionPolicy({
      admitNodeDrag: ({ anchorNodeID }) => ({
        kind: 'allowOnly',
        nodeIDs: new Set([anchorNodeID]),
      }),
      isAdditiveSelectionActive: () => true,
      interactionModifiers: () => new Set(['disableSnapping']),
    })

    expect(policy.admission(request)).toEqual({
      kind: 'allowOnly',
      nodeIDs: new Set(['anchor']),
    })
    expect(policy.isAdditiveSelectionActive).toBe(true)
    expect(policy.interactionModifiers).toEqual(new Set(['disableSnapping']))
  })

  it('builds drag requests in presentation order and excludes fixed nodes', () => {
    const capabilities = new FdGraphCanvasNodeCapabilityMap({
      overrides: new Map([
        [
          'fixed',
          FdGraphCanvasNodeCapabilities.standard.subtracting(
            FdGraphCanvasNodeCapabilities.draggable,
          ),
        ],
      ]),
    })
    const request = FdGraphCanvasNodeDragResolver.request(
      'anchor',
      new Set(['fixed', 'peer', 'anchor']),
      presentation,
      'multiple',
      capabilities,
    )

    expect(request).toEqual(
      new FdGraphCanvasNodeDragAdmissionRequest({
        anchorNodeID: 'anchor',
        selectedNodeIDs: ['anchor', 'peer', 'fixed'],
        candidateNodeIDs: ['anchor', 'peer'],
        basePresentationSnapshotID: 'presentation-1',
      }),
    )
    expect(
      FdGraphCanvasNodeDragResolver.request(
        'anchor',
        new Set(['anchor', 'peer']),
        presentation,
        'single',
        capabilities,
      )?.candidateNodeIDs,
    ).toEqual(['anchor'])
    expect(
      FdGraphCanvasNodeDragResolver.request(
        'fixed',
        new Set(['fixed']),
        presentation,
        'multiple',
        capabilities,
      ),
    ).toBeUndefined()
  })

  it('requires admission to retain the drag anchor', () => {
    const request = new FdGraphCanvasNodeDragAdmissionRequest({
      anchorNodeID: 'anchor',
      selectedNodeIDs: ['anchor', 'peer'],
      candidateNodeIDs: ['anchor', 'peer'],
      basePresentationSnapshotID: 'presentation-1',
    })

    expect(FdGraphCanvasNodeDragResolver.admittedNodeIDs(request, { kind: 'allowAll' })).toEqual(
      new Set(['anchor', 'peer']),
    )
    expect(
      FdGraphCanvasNodeDragResolver.admittedNodeIDs(request, {
        kind: 'allowOnly',
        nodeIDs: new Set(['peer']),
      }),
    ).toEqual(new Set())
  })

  it('validates resize requests and applies the same anchor admission rule', () => {
    const baseFrames = new Map([
      ['anchor', { x: 0, y: 0, width: 100, height: 80 }],
      ['peer', { x: 160, y: 0, width: 100, height: 80 }],
    ])
    const request = new FdGraphCanvasNodeResizeAdmissionRequest({
      anchorNodeID: 'anchor',
      selectedNodeIDs: ['anchor', 'peer'],
      candidateNodeIDs: ['anchor', 'peer'],
      baseFrames,
      edges: new Set(['bottom', 'trailing']),
      basePresentationSnapshotID: 'presentation-1',
    })

    expect(FdGraphCanvasNodeResizeResolver.admittedNodeIDs(request, { kind: 'allowAll' })).toEqual(
      new Set(['anchor', 'peer']),
    )
    expect(
      FdGraphCanvasNodeResizeResolver.admittedNodeIDs(request, {
        kind: 'allowOnly',
        nodeIDs: new Set(['peer']),
      }),
    ).toEqual(new Set())
    expect(
      () =>
        new FdGraphCanvasNodeResizeAdmissionRequest({
          anchorNodeID: 'anchor',
          selectedNodeIDs: ['anchor'],
          candidateNodeIDs: ['anchor'],
          baseFrames,
          edges: new Set(),
          basePresentationSnapshotID: 'presentation-1',
        }),
    ).toThrow(RangeError)
    expect(
      () =>
        new FdGraphCanvasNodeResizeAdmissionRequest({
          anchorNodeID: 'anchor',
          selectedNodeIDs: ['anchor', 'missing'],
          candidateNodeIDs: ['anchor', 'missing'],
          baseFrames,
          edges: new Set(['trailing']),
          basePresentationSnapshotID: 'presentation-1',
        }),
    ).toThrow(RangeError)
  })
})
