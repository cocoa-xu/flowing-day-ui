# Changelog

## 2026-08-14

### @flowing-day/canvas 0.5.0

- Adds focused graph, interaction, layout, minimap, rendering, and geometry package entries.
- Preserves consumer-owned node and edge presentation across DOM and WebGL2 backends.
- Reduces redundant DOM updates and WebGL2 uploads during viewport and interaction frames.
- Adds headed Safari profiling to the opt-in canvas benchmark harness.

## 2026-08-13

### @flowing-day/ui 0.3.0

- Aligns control names, options, defaults, and interaction ownership with FlowingDayControls.
- Adds the Swift-aligned date picker, radio controls, stepper, menu, status components,
  validation model, and reusable content and layout primitives.
- Removes earlier Web-only API shapes where they conflicted with the Swift source of truth.

### @flowing-day/canvas 0.4.0

- Aligns graph content, configuration, session, interaction, rendering, minimap, history,
  accessibility, and builder boundaries with FlowingDayCanvas.
- Adds the Swift-aligned graph core, transactional storage, traversal, DAG validation,
  layout pipeline, force-directed, SCC-layered, layered, compound, and edge-routing models.
- Adds a stale-result-safe layout driver and bounded spatial and render indexes.
- Removes divergent Web-only graph configuration rather than carrying compatibility shims.

Both packages remain pre-1.0. Consumers should compile against the current exported types
when moving to these releases.
