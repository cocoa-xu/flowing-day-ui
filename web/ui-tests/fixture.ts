import '../packages/core/src/index.js'
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

  fd-graph-canvas {
    width: 1000px;
    height: 700px;
    border-radius: 24px;
    background: #fbfcfa;
    box-shadow: inset 0 0 0 1px #d7dcd8;
  }
`
document.head.append(style)

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
