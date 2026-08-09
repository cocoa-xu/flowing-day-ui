# @flowing-day/canvas

A framework-agnostic infinite canvas with the same viewport and interaction boundary as
`FlowingDayCanvas` for SwiftUI.

```ts
import '@flowing-day/canvas'
```

```html
<fd-canvas interaction-mode="pan">
  <div slot="world">World content</div>
  <div slot="overlay">Viewport controls</div>
</fd-canvas>
```

`fd-canvas` owns precise pan, pointer-anchored zoom, focus, fit, smart magnification, viewport
resize preservation, and bounded render coverage. Consumers own world content, overlays, and
virtualization through the render-coverage event.

`fd-graph-canvas` adds an indexed graph model, editing, accessibility, history, and a minimap.
Its `automatic` rendering preference uses the WebGL2 hybrid backend when available and falls back
to DOM/SVG otherwise. WebGL batches graph geometry while visible rich node content remains DOM,
so custom content and accessibility do not depend on the graphics backend. Set `renderingBackend`
to `dom`, `webgl2`, or a custom backend when a product needs an explicit policy.
