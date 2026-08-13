import type { FdCanvasSize } from '../geometry.js'
import type { FdGraphElementID } from '../graph/model.js'
import {
  FdGraphLayoutInput,
  type FdGraphLayoutPort,
  type FdGraphLayoutTopology,
  type FdGraphNodePlacementState,
  type FdGraphPortAnchor,
  FdLayoutComponentIdentity,
  FdLayoutInputID,
  type FdLayoutPipelineIdentity,
  FdLayoutRevision,
  sameLayoutInputID,
} from './model.js'
import type { FdGraphLayoutResult, FdGraphLayoutStrategy } from './pipeline.js'

export interface FdGraphNodeSizeResolver<NodeID extends FdGraphElementID = FdGraphElementID> {
  readonly identity: FdLayoutComponentIdentity
  sizeForNode(nodeID: NodeID): FdCanvasSize
}

export interface FdGraphPortAnchorResolver<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
> {
  readonly identity: FdLayoutComponentIdentity
  anchor(
    port: FdGraphLayoutPort<NodeID, PortID>,
    nodeSize: FdCanvasSize,
  ): FdGraphPortAnchor<NodeID, PortID>
}

export class FdFixedNodeSizeResolver<NodeID extends FdGraphElementID = FdGraphElementID>
  implements FdGraphNodeSizeResolver<NodeID>
{
  readonly identity: FdLayoutComponentIdentity
  readonly size: FdCanvasSize

  constructor(size: FdCanvasSize, identity = new FdLayoutComponentIdentity()) {
    this.size = size
    this.identity = identity
  }

  sizeForNode(_nodeID: NodeID): FdCanvasSize {
    return this.size
  }
}

export class FdCenteredPortAnchorResolver<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
> implements FdGraphPortAnchorResolver<NodeID, PortID>
{
  readonly identity: FdLayoutComponentIdentity

  constructor(identity = new FdLayoutComponentIdentity()) {
    this.identity = identity
  }

  anchor(
    port: FdGraphLayoutPort<NodeID, PortID>,
    nodeSize: FdCanvasSize,
  ): FdGraphPortAnchor<NodeID, PortID> {
    return {
      key: port.key,
      position: { x: nodeSize.width / 2, y: nodeSize.height / 2 },
      normal: { dx: 0, dy: 0 },
    }
  }
}

export const FdGraphLayoutResolution = Object.freeze({
  input<
    NodeID extends FdGraphElementID,
    PortID extends FdGraphElementID,
    EdgeID extends FdGraphElementID,
  >(options: {
    readonly topology: FdGraphLayoutTopology<NodeID, PortID, EdgeID>
    readonly nodeSizeResolver: FdGraphNodeSizeResolver<NodeID>
    readonly portAnchorResolver: FdGraphPortAnchorResolver<NodeID, PortID>
    readonly pipelineIdentity: FdLayoutPipelineIdentity
    readonly layoutStateRevision?: FdLayoutRevision
    readonly placementState?: readonly FdGraphNodePlacementState<NodeID>[]
  }): FdGraphLayoutInput<NodeID, PortID, EdgeID> {
    const sizeByNodeID = new Map<NodeID, FdCanvasSize>()
    const nodeSizes = options.topology.nodeIDs.map((nodeID) => {
      const size = options.nodeSizeResolver.sizeForNode(nodeID)
      sizeByNodeID.set(nodeID, size)
      return { nodeID, size }
    })
    const portAnchors = options.topology.ports.map((port) =>
      options.portAnchorResolver.anchor(
        port,
        required(sizeByNodeID.get(port.nodeID), 'layout node size'),
      ),
    )
    return new FdGraphLayoutInput({
      id: new FdLayoutInputID(
        options.topology.snapshotID,
        options.pipelineIdentity,
        options.nodeSizeResolver.identity,
        options.portAnchorResolver.identity,
        options.layoutStateRevision ?? new FdLayoutRevision(),
      ),
      topology: options.topology,
      nodeSizes,
      portAnchors,
      placementState: options.placementState ?? [],
    })
  },
})

export type FdGraphLayoutDriverOutcome<
  NodeID extends FdGraphElementID,
  PortID extends FdGraphElementID,
  EdgeID extends FdGraphElementID,
> =
  | { readonly kind: 'completed'; readonly result: FdGraphLayoutResult<NodeID, PortID, EdgeID> }
  | { readonly kind: 'superseded' }

export class FdGraphLayoutDriverError extends Error {
  readonly kind = 'resultIdentityMismatch'

  constructor() {
    super('resultIdentityMismatch')
    this.name = 'FdGraphLayoutDriverError'
  }
}

export class FdGraphLayoutDriver<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  #requestID: symbol | undefined
  #abortController: AbortController | undefined

  async layout(options: {
    readonly topology: FdGraphLayoutTopology<NodeID, PortID, EdgeID>
    readonly nodeSizeResolver: FdGraphNodeSizeResolver<NodeID>
    readonly portAnchorResolver: FdGraphPortAnchorResolver<NodeID, PortID>
    readonly layoutStateRevision?: FdLayoutRevision
    readonly placementState?: readonly FdGraphNodePlacementState<NodeID>[]
    readonly strategy: FdGraphLayoutStrategy<NodeID, PortID, EdgeID>
    readonly signal?: AbortSignal
  }): Promise<FdGraphLayoutDriverOutcome<NodeID, PortID, EdgeID>> {
    this.#abortController?.abort()
    const requestID = Symbol()
    const abortController = new AbortController()
    this.#requestID = requestID
    this.#abortController = abortController
    const onAbort = () => abortController.abort()
    options.signal?.addEventListener('abort', onAbort, { once: true })
    try {
      await Promise.resolve()
      if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const input = FdGraphLayoutResolution.input({
        topology: options.topology,
        nodeSizeResolver: options.nodeSizeResolver,
        portAnchorResolver: options.portAnchorResolver,
        pipelineIdentity: options.strategy.identity,
        ...(options.layoutStateRevision === undefined
          ? {}
          : { layoutStateRevision: options.layoutStateRevision }),
        ...(options.placementState === undefined ? {} : { placementState: options.placementState }),
      })
      const result = options.strategy.layout(input)
      if (!sameLayoutInputID(result.inputID, input.id)) throw new FdGraphLayoutDriverError()
      if (this.#requestID !== requestID) return { kind: 'superseded' }
      this.#abortController = undefined
      return { kind: 'completed', result }
    } catch (error) {
      if (this.#requestID !== requestID && isAbortError(error)) return { kind: 'superseded' }
      if (this.#requestID === requestID) this.#abortController = undefined
      throw error
    } finally {
      options.signal?.removeEventListener('abort', onAbort)
    }
  }

  cancel(): void {
    this.#requestID = undefined
    this.#abortController?.abort()
    this.#abortController = undefined
  }
}

const required = <Value>(value: Value | undefined, name: string): Value => {
  if (value === undefined) throw new Error(`${name} invariant failed`)
  return value
}

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'
