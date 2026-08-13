import { describe, expect, it } from 'vitest'
import {
  FdCenteredPortAnchorResolver,
  FdFixedNodeSizeResolver,
  FdGraphLayoutDriver,
  FdGraphLayoutDriverError,
  FdGraphLayoutResolution,
} from './driver.js'
import {
  FdGraphLayoutTopology,
  FdLayoutComponentIdentity,
  FdLayoutPipelineIdentity,
} from './model.js'
import {
  FdGraphLayoutResult,
  type FdGraphLayoutStrategy,
  FdGraphNodePlacement,
} from './pipeline.js'

const topology = new FdGraphLayoutTopology<string, string, string>({
  snapshotID: 'driver',
  nodeIDs: ['node'],
  ports: [{ key: { nodeID: 'node', portID: 'port' }, id: 'port', nodeID: 'node' }],
  edges: [],
})

class Strategy implements FdGraphLayoutStrategy<string, string, string> {
  readonly identity = new FdLayoutPipelineIdentity(new FdLayoutComponentIdentity('strategy'))

  layout(input: Parameters<FdGraphLayoutStrategy<string, string, string>['layout']>[0]) {
    return new FdGraphLayoutResult(
      input,
      new FdGraphNodePlacement(
        input,
        [{ nodeID: 'node', frame: { x: 0, y: 0, width: 100, height: 60 } }],
        { x: 0, y: 0, width: 100, height: 60 },
      ),
      [],
    )
  }
}

const options = () => ({
  topology,
  nodeSizeResolver: new FdFixedNodeSizeResolver<string>({ width: 100, height: 60 }),
  portAnchorResolver: new FdCenteredPortAnchorResolver<string, string>(),
  strategy: new Strategy(),
})

describe('Swift-aligned layout driver', () => {
  it('resolves node sizes and centered port anchors into an input', () => {
    const values = options()
    const input = FdGraphLayoutResolution.input({
      topology: values.topology,
      nodeSizeResolver: values.nodeSizeResolver,
      portAnchorResolver: values.portAnchorResolver,
      pipelineIdentity: values.strategy.identity,
    })

    expect(input.size('node')).toEqual({ width: 100, height: 60 })
    expect(input.anchor({ nodeID: 'node', portID: 'port' })).toMatchObject({
      position: { x: 50, y: 30 },
      normal: { dx: 0, dy: 0 },
    })
  })

  it('supersedes an in-flight request when a new request starts', async () => {
    const driver = new FdGraphLayoutDriver<string, string, string>()
    const first = driver.layout(options())
    const second = driver.layout(options())

    await expect(first).resolves.toEqual({ kind: 'superseded' })
    await expect(second).resolves.toMatchObject({ kind: 'completed' })
  })

  it('explicitly cancels an in-flight request', async () => {
    const driver = new FdGraphLayoutDriver<string, string, string>()
    const result = driver.layout(options())
    driver.cancel()
    await expect(result).resolves.toEqual({ kind: 'superseded' })
  })

  it('propagates caller cancellation', async () => {
    const driver = new FdGraphLayoutDriver<string, string, string>()
    const controller = new AbortController()
    const result = driver.layout({ ...options(), signal: controller.signal })
    controller.abort()
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('rejects a result produced for another input', async () => {
    const values = options()
    const foreignInput = FdGraphLayoutResolution.input({
      topology: values.topology,
      nodeSizeResolver: values.nodeSizeResolver,
      portAnchorResolver: values.portAnchorResolver,
      pipelineIdentity: values.strategy.identity,
    })
    const foreignResult = values.strategy.layout(foreignInput)
    const strategy: FdGraphLayoutStrategy<string, string, string> = {
      identity: values.strategy.identity,
      layout: () => foreignResult,
    }
    const driver = new FdGraphLayoutDriver<string, string, string>()

    await expect(driver.layout({ ...values, strategy })).rejects.toBeInstanceOf(
      FdGraphLayoutDriverError,
    )
  })
})
