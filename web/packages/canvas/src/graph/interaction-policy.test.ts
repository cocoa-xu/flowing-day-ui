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
        defaultConstraints: { minimumWidth: 44, minimumHeight: 32 },
        overrides: new Map([['large', { minimumWidth: 120, minimumHeight: 80 }]]),
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
      minimumWidth: 44,
      minimumHeight: 32,
    })
    expect(graphCanvasNodeSizeConstraints(policy, 'large')).toEqual({
      minimumWidth: 120,
      minimumHeight: 80,
    })
  })
})
