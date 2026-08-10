import { FdIcons } from '../packages/core/src/index.js'
import '../packages/canvas/src/index.js'
import type { FdGraphCanvas } from '../packages/canvas/src/components/graph-canvas/fd-graph-canvas.js'
import type { FdGraphConnectionCompleteDetail } from '../packages/canvas/src/graph/events.js'

const style = document.createElement('style')
style.textContent = `
  :root {
    color-scheme: light;
    font-family: ui-rounded, system-ui, sans-serif;
  }

  body {
    min-width: 1120px;
    margin: 0;
    background: #f5f7f4;
  }

  main {
    display: grid;
    gap: 20px;
    padding: 24px;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  fd-slider {
    width: 260px;
  }

  .primitives {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) 30px 220px;
    align-items: center;
    gap: 16px;
  }

  .primitives fd-text-area {
    grid-column: 1 / span 2;
  }

  fd-graph-canvas {
    width: 1000px;
    height: 700px;
    border-radius: 24px;
    background: #fbfcfa;
    box-shadow: inset 0 0 0 1px #d7dcd8;
  }
`
document.head.append(style)

FdIcons.register({
  pencil:
    '<svg viewBox="0 0 16 16"><path d="M3 11.8 11.8 3l1.2 1.2L4.2 13H3z" fill="currentColor"/></svg>',
  lock: '<svg viewBox="0 0 16 16"><path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2h1v7h-9V7zm1.5 0h4V5a2 2 0 1 0-4 0z" fill="currentColor"/></svg>',
  pin: '<svg viewBox="0 0 16 16"><path d="m5 2 6 6-1.5 1.5-1-1L6 11l-1-1 2.5-2.5-1-1zM4 10l2 2-3 2z" fill="currentColor"/></svg>',
})

const graph = document.querySelector<FdGraphCanvas>('#graph')
if (!graph) throw new Error('missing graph fixture')

graph.snapshot = {
  id: 'ui-fixture',
  nodes: [
    {
      id: 'source',
      frame: { x: 80, y: 100, width: 180, height: 96 },
      label: 'Source',
      ports: [{ id: 'output', side: 'right', label: 'Output' }],
    },
    {
      id: 'target',
      frame: { x: 460, y: 260, width: 180, height: 96 },
      label: 'Target',
      ports: [{ id: 'input', side: 'left', label: 'Input' }],
    },
    {
      id: 'observer',
      frame: { x: 800, y: 80, width: 180, height: 96 },
      label: 'Observer',
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
}
graph.contentChangeBehavior = { kind: 'preserveViewport' }
graph.interactionConfiguration = {
  frameUpdates: 'local',
  snapping: { enabled: false },
}
graph.connectionEditingConfiguration = { enabled: true }
graph.miniMapConfiguration = { visibility: 'always' }

let completedConnection: FdGraphConnectionCompleteDetail | undefined
graph.addEventListener('fd-graph-connection-complete', (event) => {
  completedConnection = event.detail
})

Object.assign(window, {
  graphFixture: graph,
  completedConnection: () => completedConnection,
})
