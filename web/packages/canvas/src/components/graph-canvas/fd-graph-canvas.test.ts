import { afterEach, describe, expect, it } from 'vitest'
import type { FdAnyGraphSnapshot } from '../../graph/model.js'
import type {
  FdGraphRenderFrame,
  FdGraphRenderingBackend,
  FdGraphRenderingSurface,
} from '../../rendering/backend.js'
import { FdGraphDOMRenderingBackend } from '../../rendering/dom-backend.js'
import type { FdGraphCanvas } from './fd-graph-canvas.js'
import './fd-graph-canvas.js'

const graphSnapshot = (): FdAnyGraphSnapshot => ({
  id: 'graph-1',
  nodes: [
    {
      id: 'source',
      frame: { x: 40, y: 80, width: 180, height: 88 },
      label: 'Source',
      subtitle: 'Input node',
      ports: [{ id: 'output', side: 'right' }],
    },
    {
      id: 'target',
      frame: { x: 420, y: 220, width: 180, height: 88 },
      label: 'Target',
      ports: [{ id: 'input', side: 'left' }],
    },
  ],
  edges: [
    {
      id: 'connection',
      source: { nodeID: 'source', portID: 'output' },
      target: { nodeID: 'target', portID: 'input' },
      label: 'Data',
    },
  ],
})

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

async function mount(
  snapshot: FdAnyGraphSnapshot = graphSnapshot(),
  backend?: FdGraphRenderingBackend,
): Promise<FdGraphCanvas> {
  const element = document.createElement('fd-graph-canvas')
  element.style.width = '800px'
  element.style.height = '600px'
  element.snapshot = snapshot
  if (backend) element.renderingBackend = backend
  document.body.append(element)
  await element.updateComplete
  await nextFrame()
  await nextFrame()
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

class RecordingBackend implements FdGraphRenderingBackend {
  readonly kind = 'recording'
  readonly frames: FdGraphRenderFrame[] = []
  mounts = 0
  unmounts = 0

  mount(_surface: FdGraphRenderingSurface): void {
    this.mounts += 1
  }

  render(frame: FdGraphRenderFrame): void {
    this.frames.push(frame)
  }

  unmount(): void {
    this.unmounts += 1
  }
}

describe('fd-graph-canvas rendering boundary', () => {
  it('renders indexed nodes, ports, edges, and labels with the automatic backend', async () => {
    const element = await mount()
    const root = element.shadowRoot

    expect(element.resolvedRenderingBackend?.kind).toBe('dom')
    expect(root?.querySelectorAll('.graph-node')).toHaveLength(2)
    expect(root?.querySelectorAll('.graph-port')).toHaveLength(2)
    expect(root?.querySelectorAll('.graph-edge')).toHaveLength(1)
    expect(root?.querySelector('.graph-edge-label')?.textContent).toBe('Data')
  })

  it('keeps keyed node elements while applying a new immutable snapshot', async () => {
    const element = await mount()
    const original = element.shadowRoot?.querySelector<HTMLElement>(
      '[data-fd-graph-node="s:source"]',
    )
    const current = graphSnapshot()
    element.snapshot = {
      ...current,
      id: 'graph-2',
      nodes: current.nodes.map((node) =>
        node.id === 'source'
          ? { ...node, frame: { ...node.frame, x: 120 }, label: 'Moved source' }
          : node,
      ),
    }
    await element.updateComplete
    await nextFrame()
    await nextFrame()

    const updated = element.shadowRoot?.querySelector<HTMLElement>(
      '[data-fd-graph-node="s:source"]',
    )
    expect(updated).toBe(original)
    expect(updated?.style.transform).toContain('120px')
    expect(updated?.textContent).toContain('Moved source')
  })

  it('accepts a consumer-supplied rendering backend', async () => {
    const backend = new RecordingBackend()
    const element = await mount(graphSnapshot(), backend)

    expect(element.resolvedRenderingBackend).toBe(backend)
    expect(backend.mounts).toBe(1)
    expect(backend.frames.at(-1)?.nodes).toHaveLength(2)
    expect(backend.frames.at(-1)?.edges).toHaveLength(1)

    element.remove()
    expect(backend.unmounts).toBe(1)
  })

  it('supports standard DOM node content without coupling the graph model to Lit', async () => {
    const backend = new FdGraphDOMRenderingBackend({
      createNodeContent: ({ node }) => {
        const content = document.createElement('span')
        content.textContent = `Custom ${node.label}`
        return content
      },
    })
    const element = await mount(graphSnapshot(), backend)

    expect(element.shadowRoot?.querySelector('.graph-node')?.textContent).toContain('Custom Source')
  })

  it('only sends a bounded visible slice of a hundred-thousand-node graph to the backend', async () => {
    const backend = new RecordingBackend()
    const snapshot: FdAnyGraphSnapshot = {
      id: 'large',
      nodes: Array.from({ length: 100_000 }, (_, index) => ({
        id: index,
        frame: {
          x: (index % 1_000) * 40,
          y: Math.floor(index / 1_000) * 40,
          width: 24,
          height: 24,
        },
      })),
      edges: [],
    }
    await mount(snapshot, backend)

    const visibleCount = backend.frames.at(-1)?.nodes.length ?? 0
    expect(visibleCount).toBeGreaterThan(0)
    expect(visibleCount).toBeLessThan(20_000)
  })
})
