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

Products with domain-specific alignment can set `interactionConfiguration.snappingStrategy`.
Translation and resize solvers are replaceable independently, and custom solvers can delegate to
`snapGraphTranslationRequest()` or `snapGraphResize()` before refining the standard result. These
callbacks run synchronously in the pointer hot path and should remain deterministic and bounded.

Drag and resize admission callbacks can allow all candidates, deny the operation, or admit a
subset while requiring the interaction anchor to remain included. Per-node size constraints can
set independent minimum and maximum dimensions without putting product policy into the graph
model.

The standard solver supports alignment, configurable grid rounding, equal-spacing chains,
equal-size resizing, hysteresis, and measurement guides. Candidate lookup is constrained by
`searchRadius` and `maximumCandidates` so dense graphs do not turn pointer input into a full graph
scan. `arrangeSelectedNodes()` applies align and distribute actions through the same semantic
frame-change and undo boundary as direct manipulation.

The default guide renderer exposes `guide`, kind-specific guide parts, `guide-line`, `guide-tick`,
and `guide-label`, plus CSS variables for line and label colors. Use
`FdGraphDefaultGuideRenderer` to customize measurement formatting, or assign a
`FdGraphGuideRenderer` for completely custom incremental rendering. Guide elements are pooled and
updated in place during pointer movement.
