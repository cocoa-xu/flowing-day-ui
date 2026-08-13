# FlowingDayUI for the web

Workspace for `@flowing-day/ui`, a framework-agnostic port of the `FlowingDayControls`
SwiftUI module and its Preferences compositions, built as standard Custom Elements.

**Using the library?** The package README is
[`packages/core/README.md`](./packages/core/README.md) — install, theming, components.
This file covers working on it.

## Layout

```
web/
├── packages/core/   @flowing-day/ui — the components and tokens
├── packages/canvas/ @flowing-day/canvas — infinite canvas and graph interactions
├── benchmarks/      opt-in headed canvas performance benchmarks
└── docs/            the landing page, run with `pnpm dev`
```

The landing page begins with live reusable controls, composes them into a draggable
Preferences window, provides direct SwiftUI and web starting points, and ends with the
interactive infinite canvas. The Appearance page restyles the window it lives in, so the
page also proves that theme, accent, density, corner radius, and type scale propagate
through the complete component hierarchy.

It resolves `@flowing-day/ui` to the core package's *sources*, so editing a component
hot-reloads the page instead of waiting on a rebuild.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Serve the landing page |
| `pnpm build` | ESM output, type declarations, `theme.css` and the custom elements manifest |
| `pnpm test` | Run the suite in Chromium, Firefox and WebKit via Vitest browser mode |
| `pnpm test:ui` | Run opt-in headed interaction tests in Chromium, Firefox and WebKit |
| `pnpm test:ui:headless` | Run the same opt-in interaction tests without browser windows |
| `pnpm typecheck` | Type-check both packages without emitting |
| `pnpm typecheck:ui` | Type-check the local Playwright interaction suite |
| `pnpm lint` / `pnpm format` | Biome check / write |
| `pnpm tokens:swift` | Regenerate the Swift theme from `tokens.json` |
| `pnpm tokens:check` | Verify that the committed Swift theme is current |
| `pnpm benchmark:canvas` | Run the headed graph benchmark on the main display |

The Playwright UI suite is intentionally local-only. It exercises trusted pointer, keyboard,
top-layer, canvas, minimap, and accessibility interactions, and is not part of the CI workflow.

`pnpm --filter @flowing-day/ui check:exports` validates the published entry points with
publint and are-the-types-wrong.

## How the token layer is built

Every design value lives in `packages/core/src/tokens/tokens.json`. It is the sole token
source for every platform. The TypeScript token module reads it directly, and
`scripts/generate-swift-theme.mjs` emits the committed Swift theme artifacts for
`FlowingDayControls` and `FlowingDayPreferences`.
Do not edit generated Swift values by hand.

The web token module produces two CSS artifacts from the same data:

- `themeStyles` — private `--_fd-*` aliases adopted into every shadow root, each falling
  back to its public `--fd-*` token, which is what makes an override anywhere up the tree
  win.
- `theme.css` — the public declarations, for authoring against the tokens directly.

Two rules the generator enforces, both learned the hard way:

**No `light-dark()`.** Lightning CSS, Vite's default minifier and therefore part of many
consumers' builds, downlevels it into a guard-variable pair that is silently wrong inside
a custom property declaration. Tokens ship as a light base plus a `prefers-color-scheme`
override instead, and a test asserts neither artifact ever contains it.

**No derived accent tokens on `:root`.** A `var()` is substituted at the element its
declaration sits on, so publishing `--fd-accent-fill` on `:root` would freeze it there and
setting `--fd-accent` on a window or page could never move it. The formulas are declared
only where they are derived: inside each shadow root, and on `[data-fd-accent-scope]`.

## Releasing

The Swift package and this one version independently — see *Versioning* in the package
README for why. Git tags have to distinguish them, and SPM requires bare semver tags:

| | Version | Tag |
| --- | --- | --- |
| Swift | `2.2.0` | `2.2.0` |
| Web UI | `0.1.0` | `web/v0.1.0` |
| Web Canvas | `0.2.0` | `web/canvas-v0.2.0` |

Publish a package with `pnpm --filter <package-name> publish`; `publishConfig.access` is already
set, since scoped packages default to restricted.

## Status

The public Custom Elements are listed by group in
[the package README](packages/core/README.md#components). Shared design values come from
the same token source as SwiftUI; browser-specific interaction and accessibility behavior
is implemented with native web platform semantics.

Two are deliberately left out. `PreferencesWindowPresenter` has no web counterpart: `NSPanel`
is the presenter's job, not the view's, so how the window is presented is the page's call —
which is why the landing page keeps its drag logic in `docs/src/drag.ts`. And
`FlowingSliderRepresentable` is the SwiftUI↔AppKit bridge; the `FlowingSliderControl`
behind it is what `fd-slider` reproduces.

Swift and web now share the same token source. A generated-file check fails CI if either
the JSON or the Swift artifact changes without the other.

`@flowing-day/canvas` keeps graph mutations consumer-owned. Node frame changes and
connection completion are semantic events; applications can apply them locally, through an
undo policy, or through a collaborative reducer. Connection editing is opt-in through
`connectionEditingConfiguration` and supports default or consumer-rendered previews,
validation feedback, new links, and endpoint reconnection.

Large graphs can use `FdGraphSearchIndex` without rendering or scanning DOM nodes. The
bounded index supports ranked metadata search over 100,000 elements, while
`jumpToElement()` applies explicit focus, selection, zoom, and animation behavior.

Custom snapping strategies can replace translation and resize independently or refine the
standard solver. They stay outside the graph model, so business anchors and timeline scales do not
leak into the reusable canvas core.

The built-in arrangement layer includes hysteresis, grid and alignment snapping, equal-spacing
chains, equal-size resizing, measurement guides, and explicit align/distribute actions. Snap
candidate searches remain spatially bounded for large graphs.
