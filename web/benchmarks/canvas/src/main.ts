import type { FdGraphCanvas, FdGraphCanvasRenderingBackendPreference } from '@flowing-day/canvas'
import {
  FdGraphCanvasContent,
  FdGraphCanvasLayoutAdapter,
  FdGraphCanvasSessionCommand,
  FdGraphCanvasWebGL2VisualAdapter,
  FdGraphEdgeRoute,
  FdGraphElementAddress,
  FdGraphInstanceHandle,
  FdGraphInstancePath,
  FdGraphLayoutInput,
  FdGraphLayoutResult,
  FdGraphNodePlacement,
  FdGraphPresentation,
  FdGraphPresentationLocalElementID,
  FdGraphWebGL2RenderingBackend,
  FdLayoutComponentIdentity,
  FdLayoutInputID,
  FdLayoutPipelineIdentity,
  FdLayoutRevision,
  graphCanvasRenderingBackendCapabilities,
  resolveGraphCanvasRenderingBackend,
} from '@flowing-day/canvas'
import '@flowing-day/canvas'
import './style.css'

type FdBenchmarkScenario = 'pan' | 'zoom' | 'drag' | 'click'

interface FdFrameMetrics {
  readonly duration: number
  readonly refreshInterval: number
  readonly frameCount: number
  readonly expectedFrameCount: number
  readonly frameDelivery: number
  readonly p50: number
  readonly p95: number
  readonly p99: number
  readonly maximum: number
  readonly longFrameCount: number
  readonly droppedFrameCount: number
  readonly inputP95: number
  readonly inputP99: number
  readonly inputMaximum: number
}

interface FdCanvasBenchmarkAPI {
  readonly ready: Promise<void>
  readonly nodeCount: number
  readonly edgeCount: number
  readonly buildDuration: number
  readonly initializationDuration: Promise<number>
  readonly backend: string
  measure(scenario: FdBenchmarkScenario, duration: number): Promise<FdFrameMetrics>
}

declare global {
  interface Window {
    fdCanvasBenchmark: FdCanvasBenchmarkAPI
  }
}

const graphElement = document.querySelector<FdGraphCanvas>('#graph')
const statusElement = document.querySelector<HTMLOutputElement>('#status')
if (!graphElement || !statusElement) throw new Error('benchmark surface is missing')
const graph = graphElement
const status = statusElement

const parameters = new URLSearchParams(location.search)
const nodeCount = Math.max(Number(parameters.get('nodes') ?? 1_000), 1)
const requestedBackend = (parameters.get('backend') ??
  'automatic') as FdGraphCanvasRenderingBackendPreference
const columnCount = Math.max(Math.ceil(Math.sqrt(nodeCount * 1.7)), 1)
const horizontalSpacing = 132
const verticalSpacing = 84

function makeContent(count: number): FdGraphCanvasContent<string> {
  const nodes = Array.from({ length: count }, (_, index) => ({
    id: `node-${index}`,
    nodeID: index,
    frame: {
      x: (index % columnCount) * horizontalSpacing,
      y: Math.floor(index / columnCount) * verticalSpacing,
      width: 104,
      height: 56,
    },
    label: `Node ${index + 1}`,
    ...(index % 3 === 0 ? { subtitle: 'Benchmark' } : {}),
  }))
  const edges = Array.from({ length: Math.max(count - 1, 0) }, (_, index) => ({
    id: `edge-${index}`,
    edgeID: index,
    source: `node-${index}`,
    target: `node-${index + 1}`,
  }))
  const instanceHandle = new FdGraphInstanceHandle(0)
  const localNodeID = (nodeID: number) =>
    FdGraphPresentationLocalElementID.source({
      instanceHandle,
      elementID: { kind: 'node', nodeID },
    })
  const localEdgeID = (edgeID: number) =>
    FdGraphPresentationLocalElementID.source({
      instanceHandle,
      elementID: { kind: 'edge', edgeID },
    })
  const address = (
    elementID:
      | { readonly kind: 'node'; readonly nodeID: number }
      | { readonly kind: 'edge'; readonly edgeID: number },
  ) =>
    new FdGraphElementAddress({
      instancePath: FdGraphInstancePath.root,
      graphID: 'benchmark',
      elementID,
    })
  const snapshotID = `benchmark-${count}`
  const presentation = new FdGraphPresentation({
    snapshotID,
    documentSnapshotID: snapshotID,
    entryPointID: 'main',
    focusPath: FdGraphInstancePath.root,
    instances: [],
    nodes: nodes.map((node) => ({
      id: node.id,
      localID: localNodeID(node.nodeID),
      address: address({ kind: 'node', nodeID: node.nodeID }),
      value: node,
    })),
    ports: [],
    edges: edges.map((edge) => ({
      id: edge.id,
      localID: localEdgeID(edge.edgeID),
      address: address({ kind: 'edge', edgeID: edge.edgeID }),
      endpoints: {
        kind: 'directed' as const,
        source: { kind: 'node' as const, id: edge.source },
        target: { kind: 'node' as const, id: edge.target },
      },
      value: edge,
    })),
    contextEdges: [],
  })
  const component = new FdLayoutComponentIdentity('benchmark')
  const topology = FdGraphCanvasLayoutAdapter.topology(presentation)
  const input = new FdGraphLayoutInput({
    id: new FdLayoutInputID(
      snapshotID,
      new FdLayoutPipelineIdentity(component),
      component,
      component,
      new FdLayoutRevision('benchmark'),
    ),
    topology,
    nodeSizes: nodes.map((node) => ({
      nodeID: localNodeID(node.nodeID),
      size: { width: node.frame.width, height: node.frame.height },
    })),
    portAnchors: [],
  })
  const placement = new FdGraphNodePlacement(
    input,
    nodes.map((node) => ({ nodeID: localNodeID(node.nodeID), frame: node.frame })),
    {
      x: 0,
      y: 0,
      width: (Math.min(count, columnCount) - 1) * horizontalSpacing + 104,
      height: Math.floor((count - 1) / columnCount) * verticalSpacing + 56,
    },
  )
  const result = new FdGraphLayoutResult(
    input,
    placement,
    edges.map((edge) => {
      const source = nodes[edge.edgeID]?.frame
      const target = nodes[edge.edgeID + 1]?.frame
      if (!source || !target) throw new Error('benchmark edge invariant failed')
      return {
        edgeID: localEdgeID(edge.edgeID),
        route: new FdGraphEdgeRoute(
          { x: source.x + source.width, y: source.y + source.height / 2 },
          [{ kind: 'line', end: { x: target.x, y: target.y + target.height / 2 } }],
        ),
      }
    }),
  )
  return new FdGraphCanvasContent({ presentation, layoutInput: input, layoutResult: result })
}

const buildStartedAt = performance.now()
const content = makeContent(nodeCount)
graph.configuration = {
  renderingBackend: requestedBackend,
  canvas: {
    initialZoom: 1,
    focusedZoom: 1,
    zoomRange: [0.001, 8],
    renderOverscan: 240,
    renderRetentionRatio: 0.4,
  },
  nodeDraggingMode: 'multiple',
  nodeResizing: { isEnabled: true },
}
graph.contentChangeBehavior = { kind: 'fit', padding: 48, maximumZoom: 1 }
graph.webGL2VisualAdapter = new FdGraphCanvasWebGL2VisualAdapter({
  content: () => new FdGraphWebGL2RenderingBackend(),
})
graph.content = content
const buildDuration = performance.now() - buildStartedAt

const animationFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))

async function settle(): Promise<void> {
  await graph.updateComplete
  const engine = graph.shadowRoot?.querySelector<
    HTMLElement & { updateComplete: Promise<boolean> }
  >('fd-graph-canvas-engine')
  if (engine) await engine.updateComplete
  await animationFrame()
  await animationFrame()
}

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) return 0
  return values[Math.min(Math.floor((values.length - 1) * ratio), values.length - 1)] ?? 0
}

async function sampleFrames(
  duration: number,
  update?: (elapsed: number, frame: number) => void,
  updateDurations?: number[],
): Promise<readonly number[]> {
  const timestamps: number[] = []
  const startedAt = await animationFrame()
  return new Promise((resolve) => {
    const step = (now: number): void => {
      const elapsed = now - startedAt
      timestamps.push(now)
      if (update) {
        const updateStartedAt = performance.now()
        update(elapsed, timestamps.length)
        updateDurations?.push(performance.now() - updateStartedAt)
      }
      if (elapsed >= duration) resolve(timestamps)
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

async function measureRefreshInterval(): Promise<number> {
  const timestamps = await sampleFrames(750)
  const intervals = timestamps
    .slice(1)
    .map((timestamp, index) => timestamp - (timestamps[index] ?? timestamp))
    .sort((first, second) => first - second)
  return percentile(intervals, 0.5)
}

function metrics(
  timestamps: readonly number[],
  refreshInterval: number,
  updateDurations: readonly number[],
): FdFrameMetrics {
  const intervals = timestamps
    .slice(1)
    .map((timestamp, index) => timestamp - (timestamps[index] ?? timestamp))
  const sorted = [...intervals].sort((first, second) => first - second)
  const sortedUpdateDurations = [...updateDurations].sort((first, second) => first - second)
  const duration = Math.max((timestamps.at(-1) ?? 0) - (timestamps[0] ?? 0), 0)
  const expectedFrameCount = duration / refreshInterval
  return {
    duration,
    refreshInterval,
    frameCount: intervals.length,
    expectedFrameCount,
    frameDelivery: expectedFrameCount > 0 ? intervals.length / expectedFrameCount : 1,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    maximum: sorted.at(-1) ?? 0,
    longFrameCount: intervals.filter((interval) => interval > refreshInterval * 1.5).length,
    droppedFrameCount: intervals.reduce(
      (total, interval) => total + Math.max(Math.round(interval / refreshInterval) - 1, 0),
      0,
    ),
    inputP95: percentile(sortedUpdateDurations, 0.95),
    inputP99: percentile(sortedUpdateDurations, 0.99),
    inputMaximum: sortedUpdateDurations.at(-1) ?? 0,
  }
}

function canvasTarget(): HTMLElement {
  const engine = graph.shadowRoot?.querySelector<HTMLElement>('fd-graph-canvas-engine')
  const target = engine?.shadowRoot?.querySelector<HTMLElement>('fd-canvas')
  if (!target) throw new Error('canvas target is unavailable')
  return target
}

function dispatchWheel(deltaX: number, deltaY: number, control = false): void {
  canvasTarget().dispatchEvent(
    new WheelEvent('wheel', {
      deltaX,
      deltaY,
      ctrlKey: control,
      bubbles: true,
      composed: true,
      cancelable: true,
    }),
  )
}

async function prepareScenario(scenario: FdBenchmarkScenario): Promise<void> {
  graph.contentChangeBehavior = { kind: 'preserveViewport' }
  await settle()
  graph.command = new FdGraphCanvasSessionCommand(
    graph.sessionID,
    scenario === 'drag' || scenario === 'click'
      ? { kind: 'focus', elementID: 'node-0', zoom: 1 }
      : { kind: 'fit', scope: { kind: 'presentation' }, padding: 48, maximumZoom: 1 },
    false,
  )
  await settle()
}

function pointerDispatcher(
  scenario: 'drag' | 'click',
  duration: number,
): (elapsed: number, frame: number) => void {
  const target = canvasTarget()
  target.setPointerCapture = () => undefined
  const bounds = graph.getBoundingClientRect()
  const start = graph.session.viewport.transform.applyPoint({ x: 52, y: 28 })
  const clientX = bounds.left + start.x
  const clientY = bounds.top + start.y
  let active = false
  let finished = false
  return (elapsed, frame) => {
    if (finished) return
    if (!active) {
      target.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          buttons: 1,
          clientX,
          clientY,
          bubbles: true,
          composed: true,
          cancelable: true,
        }),
      )
      active = true
    }
    const shouldRelease = scenario === 'click' ? frame % 8 === 0 : elapsed >= duration - 32
    const displacement = scenario === 'drag' ? Math.sin(elapsed / 280) * 180 : 0
    target.dispatchEvent(
      new PointerEvent(shouldRelease ? 'pointerup' : 'pointermove', {
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        buttons: shouldRelease ? 0 : 1,
        clientX: clientX + displacement,
        clientY: clientY + displacement * 0.35,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    )
    if (shouldRelease) {
      active = false
      finished = scenario === 'drag'
    }
  }
}

async function measure(scenario: FdBenchmarkScenario, duration: number): Promise<FdFrameMetrics> {
  await prepareScenario(scenario)
  const refreshInterval = await measureRefreshInterval()
  const update =
    scenario === 'pan'
      ? (elapsed: number) => dispatchWheel(Math.cos(elapsed / 320) * 2.5, 1.25)
      : scenario === 'zoom'
        ? (elapsed: number) => dispatchWheel(0, Math.sin(elapsed / 520) * 0.7, true)
        : pointerDispatcher(scenario, duration)
  const updateDurations: number[] = []
  return metrics(
    await sampleFrames(duration, update, updateDurations),
    refreshInterval,
    updateDurations,
  )
}

const initializationStartedAt = performance.now()
const initializationDuration = settle().then(() => performance.now() - initializationStartedAt)
const resolvedBackend = resolveGraphCanvasRenderingBackend(
  requestedBackend,
  graphCanvasRenderingBackendCapabilities(),
)
const ready = initializationDuration.then(() => {
  status.value = `${nodeCount.toLocaleString()} nodes · ${Math.max(nodeCount - 1, 0).toLocaleString()} edges · ${resolvedBackend}`
})

window.fdCanvasBenchmark = {
  ready,
  nodeCount,
  edgeCount: Math.max(nodeCount - 1, 0),
  buildDuration,
  initializationDuration,
  get backend() {
    return resolvedBackend
  },
  measure,
}
