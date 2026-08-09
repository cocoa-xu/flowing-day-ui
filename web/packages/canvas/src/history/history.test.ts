import { describe, expect, it } from 'vitest'
import { FdGraphHistoryDriver } from './driver.js'
import { resolveGraphCanvasHistoryConfiguration } from './graph-canvas.js'

describe('graph history driver', () => {
  it('uses independent undo and redo stacks for local transactions', async () => {
    let value = 10
    const driver = new FdGraphHistoryDriver<number, string>({
      apply: (change) => {
        value += change
        return { kind: 'applied' }
      },
    })
    driver.register({
      id: 'move',
      actionName: 'Move Nodes',
      mode: 'local',
      undoChange: -4,
      redoChange: 4,
    })

    expect(driver.undoActionName).toBe('Move Nodes')
    expect(await driver.undo()).toBe(true)
    expect(value).toBe(6)
    expect(driver.canRedo).toBe(true)
    expect(await driver.redo()).toBe(true)
    expect(value).toBe(10)
  })

  it('allows local and collaborative history to be enabled independently', () => {
    const driver = new FdGraphHistoryDriver<number, string>({
      configuration: { capabilities: { localUndoRedo: false } },
      apply: () => ({ kind: 'applied' }),
    })

    expect(
      driver.register({
        id: 'local',
        actionName: 'Local',
        mode: 'local',
        undoChange: 1,
        redoChange: 2,
      }),
    ).toBe(false)
    expect(
      driver.register({
        id: 'collaborative',
        actionName: 'Collaborative',
        mode: 'collaborative',
        undoChange: 1,
        redoChange: 2,
      }),
    ).toBe(true)
  })

  it('reports rejected compensation without creating a redo entry', async () => {
    const conflicts: string[] = []
    const driver = new FdGraphHistoryDriver<number, string>({
      apply: () => ({ kind: 'rejected', failure: 'stale state' }),
      onConflict: ({ failure }) => conflicts.push(failure),
    })
    driver.register({
      id: 'move',
      actionName: 'Move Nodes',
      mode: 'collaborative',
      undoChange: -1,
      redoChange: 1,
    })

    expect(await driver.undo()).toBe(false)
    expect(conflicts).toEqual(['stale state'])
    expect(driver.canRedo).toBe(false)
  })

  it('accepts a collaboration policy supplied reciprocal', async () => {
    const applied: number[] = []
    const driver = new FdGraphHistoryDriver<number, string>({
      apply: (change, direction) => {
        applied.push(change)
        return direction === 'undo'
          ? { kind: 'appliedWithReciprocal', reciprocal: 99 }
          : { kind: 'applied' }
      },
    })
    driver.register({
      id: 'compensation',
      actionName: 'Compensate Move',
      mode: 'collaborative',
      undoChange: 10,
      redoChange: 20,
    })

    await driver.undo()
    await driver.redo()
    expect(applied).toEqual([10, 99])
  })

  it('bounds retained history and clears redo on a new edit', async () => {
    const driver = new FdGraphHistoryDriver<number, string>({
      configuration: { maximumDepth: 2 },
      apply: () => ({ kind: 'applied' }),
    })
    for (let index = 0; index < 3; index += 1) {
      driver.register({
        id: String(index),
        actionName: String(index),
        mode: 'local',
        undoChange: -index,
        redoChange: index,
      })
    }

    await driver.undo()
    expect(driver.canRedo).toBe(true)
    driver.register({
      id: 'new',
      actionName: 'New',
      mode: 'local',
      undoChange: -4,
      redoChange: 4,
    })
    expect(driver.canRedo).toBe(false)
    await driver.undo()
    await driver.undo()
    expect(driver.canUndo).toBe(false)
  })

  it('serializes asynchronous operations and does not restore invalidated redo', async () => {
    let finish: (() => void) | undefined
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    const driver = new FdGraphHistoryDriver<number, string>({
      apply: async () => {
        await pending
        return { kind: 'applied' }
      },
    })
    driver.register({
      id: 'old',
      actionName: 'Old',
      mode: 'collaborative',
      undoChange: -1,
      redoChange: 1,
    })

    const undo = driver.undo()
    expect(driver.isApplying).toBe(true)
    expect(await driver.redo()).toBe(false)
    driver.register({
      id: 'new',
      actionName: 'New',
      mode: 'collaborative',
      undoChange: -2,
      redoChange: 2,
    })
    finish?.()
    expect(await undo).toBe(true)
    expect(driver.canRedo).toBe(false)
    expect(driver.undoActionName).toBe('New')
  })

  it('restores an idle state when an apply callback throws', async () => {
    const states: boolean[] = []
    const driver = new FdGraphHistoryDriver<number, string>({
      apply: () => {
        throw new Error('transport failed')
      },
      onStateChange: ({ isApplying }) => states.push(isApplying),
    })
    driver.register({
      id: 'failure',
      actionName: 'Failure',
      mode: 'collaborative',
      undoChange: -1,
      redoChange: 1,
    })

    await expect(driver.undo()).rejects.toThrow('transport failed')
    expect(driver.isApplying).toBe(false)
    expect(states.at(-1)).toBe(false)
  })

  it('requires collaborative consumers to provide an apply policy', () => {
    expect(() => resolveGraphCanvasHistoryConfiguration({ mode: 'collaborative' })).toThrow(
      RangeError,
    )
    expect(
      resolveGraphCanvasHistoryConfiguration({
        mode: 'collaborative',
        apply: () => ({ kind: 'applied' }),
      }).mode,
    ).toBe('collaborative')
  })
})
