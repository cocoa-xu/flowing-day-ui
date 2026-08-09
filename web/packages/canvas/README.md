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
