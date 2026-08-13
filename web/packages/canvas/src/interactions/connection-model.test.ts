import { describe, expect, it, vi } from 'vitest'
import { FdGraphCanvasAnchor } from '../graph/content.js'
import {
  FdLayoutComponentIdentity,
  FdLayoutInputID,
  FdLayoutPipelineIdentity,
  FdLayoutRevision,
} from '../layout/model.js'
import {
  FdGraphCanvasConnectionCancellationIntent,
  FdGraphCanvasConnectionCompletionIntent,
  FdGraphCanvasConnectionFeedback,
  FdGraphCanvasConnectionPolicy,
  FdGraphCanvasConnectionPreview,
  FdGraphCanvasConnectionValidationRequest,
  FdGraphCanvasEdgeReconnectionActions,
  FdGraphCanvasTransientConnection,
  graphCanvasConnectionFixedElementID,
  graphCanvasConnectionMovingElementID,
  graphCanvasConnectionValidationIsValid,
} from './connection-model.js'

const component = new FdLayoutComponentIdentity('connection-test')
const layoutInputID = new FdLayoutInputID(
  'presentation-1',
  new FdLayoutPipelineIdentity(component),
  component,
  component,
  new FdLayoutRevision('state-1'),
)
const stationaryAnchor = new FdGraphCanvasAnchor({ x: 100, y: 40 }, { dx: 1, dy: 0 })
const movingAnchor = new FdGraphCanvasAnchor({ x: 240, y: 40 }, { dx: -1, dy: 0 })

describe('graph canvas connection model', () => {
  it('matches Swift canonical-port connection origins', () => {
    const newOrigin = { kind: 'new' as const, sourcePortID: 'source-output' }
    const reconnectOrigin = {
      kind: 'reconnect' as const,
      edgeID: 'edge',
      endpoint: 'first' as const,
      originalEndpointID: 'source-output',
      fixedEndpointID: 'target-input',
    }

    expect(graphCanvasConnectionMovingElementID(newOrigin)).toBeUndefined()
    expect(graphCanvasConnectionFixedElementID(newOrigin)).toBe('source-output')
    expect(graphCanvasConnectionMovingElementID(reconnectOrigin)).toBe('source-output')
    expect(graphCanvasConnectionFixedElementID(reconnectOrigin)).toBe('target-input')
  })

  it('validates canonical target port requests through the policy', () => {
    const request = new FdGraphCanvasConnectionValidationRequest({
      origin: { kind: 'new', sourcePortID: 'source-output' },
      targetPortID: 'target-input',
      basePresentationSnapshotID: 'presentation-1',
      baseLayoutInputID: layoutInputID,
    })
    const policy = new FdGraphCanvasConnectionPolicy({
      canBegin: (origin) => origin.kind === 'new',
      validate: ({ targetPortID }) =>
        targetPortID === 'target-input'
          ? { kind: 'valid' }
          : { kind: 'invalid', feedback: new FdGraphCanvasConnectionFeedback('Type mismatch') },
    })

    expect(policy.canBegin(request.origin)).toBe(true)
    expect(policy.validate(request)).toEqual({ kind: 'valid' })
    expect(graphCanvasConnectionValidationIsValid(policy.validate(request))).toBe(true)
  })

  it('orders preview anchors according to the reconnected endpoint', () => {
    const connection = new FdGraphCanvasTransientConnection({
      origin: {
        kind: 'reconnect',
        edgeID: 'edge',
        endpoint: 'first',
        originalEndpointID: 'source-output',
        fixedEndpointID: 'target-input',
      },
      basePresentationSnapshotID: 'presentation-1',
      baseLayoutInputID: layoutInputID,
      stationaryAnchor,
      originalMovingAnchor: movingAnchor,
      candidatePortID: 'replacement-output',
      validation: { kind: 'valid' },
    })
    const preview = new FdGraphCanvasConnectionPreview(connection)

    expect(preview.first).toBe(movingAnchor)
    expect(preview.second).toBe(stationaryAnchor)
    expect(preview.candidatePortID).toBe('replacement-output')
  })

  it('gates reconnection actions per endpoint', () => {
    const update = vi.fn()
    const end = vi.fn()
    const cancel = vi.fn()
    const actions = new FdGraphCanvasEdgeReconnectionActions({
      canReconnectFirst: false,
      canReconnectSecond: true,
      firstRenderedPosition: { x: 10, y: 20 },
      secondRenderedPosition: { x: 100, y: 20 },
      update,
      end,
      cancel,
    })

    actions.update('first', { width: 10, height: 0 })
    actions.update('second', { width: 12, height: 0 })
    actions.end('first')
    actions.end('second')
    actions.cancel()

    expect(actions.isEnabled).toBe(true)
    expect(actions.renderedPosition('second')).toEqual({ x: 100, y: 20 })
    expect(update).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledWith('second', { width: 12, height: 0 })
    expect(end).toHaveBeenCalledOnce()
    expect(end).toHaveBeenCalledWith('second')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('keeps completion and cancellation intents bound to exact layout identity', () => {
    expect(
      new FdGraphCanvasConnectionCompletionIntent({
        operation: {
          kind: 'create',
          sourcePortID: 'source-output',
          targetPortID: 'target-input',
        },
        basePresentationSnapshotID: 'presentation-1',
        baseLayoutInputID: layoutInputID,
      }),
    ).toMatchObject({
      operation: {
        kind: 'create',
        sourcePortID: 'source-output',
        targetPortID: 'target-input',
      },
      baseLayoutInputID: layoutInputID,
    })
    expect(
      new FdGraphCanvasConnectionCancellationIntent({
        origin: { kind: 'new', sourcePortID: 'source-output' },
        reason: {
          kind: 'invalidTarget',
          feedback: new FdGraphCanvasConnectionFeedback('Type mismatch'),
        },
        basePresentationSnapshotID: 'presentation-1',
        baseLayoutInputID: layoutInputID,
      }),
    ).toMatchObject({
      reason: { kind: 'invalidTarget', feedback: { message: 'Type mismatch' } },
      baseLayoutInputID: layoutInputID,
    })
  })
})
