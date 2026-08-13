# @flowing-day/canvas

A framework-agnostic infinite canvas and graph toolkit that mirrors the public
FlowingDayCanvas Swift API with standard Custom Elements and TypeScript models.

```sh
npm install @flowing-day/canvas
```

```js
import '@flowing-day/canvas'
```

Use `fd-canvas` for a pannable and zoomable world surface. Use `fd-graph-canvas`
when the application already has graph presentation, layout, and session state:

```js
import {
  FdGraphCanvasContent,
  FdGraphCanvasSessionState,
} from '@flowing-day/canvas'

const canvas = document.querySelector('fd-graph-canvas')
canvas.content = new FdGraphCanvasContent({ presentation, layoutInput, layoutResult })
canvas.session = new FdGraphCanvasSessionState()
canvas.node = (node, context) => renderNode(node, context)
canvas.edge = (edge, context) => renderEdge(edge, context)
```

Graph mutations remain consumer-owned. The canvas emits semantic interaction intents;
the application decides whether to apply them locally, register them with undo, or send
them through a collaborative reducer.

## Public layers

- **Graph core**: stable identities, ports, links, subgraphs, snapshots, storage,
  transactions, change sets, traversal, and DAG validation.
- **Presentation**: explicit graph projection, content identity, node and edge builders,
  render contexts, spatial indexing, and bounded search.
- **Layout**: pipeline identities, force-directed and layered strategies, SCC handling,
  compound layout, edge routing, and the stale-result-safe layout driver.
- **Interaction**: selection, dragging, resizing, snapping, arrangement, keyboard
  navigation, connection editing, session commands, and transient geometry.
- **Rendering**: DOM and WebGL2 backends selected through the same rendering policy as
  Swift, plus minimap and rendering-context boundaries.
- **Accessibility and history**: virtualized navigation, consumer-provided descriptions
  and actions, configurable undo integration, and conflict feedback.

## Swift parity

FlowingDayCanvas for Swift is the source of truth. Web names, defaults, configuration
boundaries, and ownership rules follow the Swift API unless the browser platform requires
a native representation. Browser-only mechanics stay internal and do not define a second
product model.

The package intentionally provides no compatibility layer for earlier 0.x Web-only APIs.
Rebuild consumers against the current exported types when upgrading.

## Browser support

Chrome 119, Safari 16.4, Firefox 128 and newer. The automatic rendering backend uses
WebGL2 when it is available and falls back to DOM rendering.

## Licence

Apache-2.0.
