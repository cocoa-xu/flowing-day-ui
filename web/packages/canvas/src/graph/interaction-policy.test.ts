import { describe, expect, it } from 'vitest'
import {
  type FdGraphCanvasInteractionPolicy,
  graphCanvasNodeCapabilities,
  graphCanvasNodeSizeConstraints,
} from './interaction-policy.js'

describe('graph canvas interaction policy', () => {
  it('uses the same standard node capabilities as Swift', () => {
    expect(graphCanvasNodeCapabilities({}, 'node')).toEqual({
      draggable: true,
      arrangementParticipant: true,
      keyboardNavigable: true,
      resizable: true,
    })
  })

  it('resolves node capability and size overrides before defaults', () => {
    const policy: FdGraphCanvasInteractionPolicy = {
      nodeCapabilities: {
        defaultCapabilities: { draggable: false },
        overrides: new Map([['movable', { draggable: true, resizable: false }]]),
      },
      nodeSizeConstraints: {
        defaultConstraints: { minimumSize: { width: 44, height: 32 } },
        overrides: new Map([['large', { minimumSize: { width: 120, height: 80 } }]]),
      },
    }

    expect(graphCanvasNodeCapabilities(policy, 'fixed').draggable).toBe(false)
    expect(graphCanvasNodeCapabilities(policy, 'movable')).toEqual({
      draggable: true,
      arrangementParticipant: true,
      keyboardNavigable: true,
      resizable: false,
    })
    expect(graphCanvasNodeSizeConstraints(policy, 'default')).toEqual({
      minimumSize: { width: 44, height: 32 },
    })
    expect(graphCanvasNodeSizeConstraints(policy, 'large')).toEqual({
      minimumSize: { width: 120, height: 80 },
    })
  })
})
