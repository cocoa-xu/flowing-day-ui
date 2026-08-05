# FlowingDayUI for the web

A framework-agnostic port of the `FlowingDaySettings` SwiftUI toolkit, built as standard
Custom Elements. The published output is plain ESM plus plain CSS custom properties, so it
works in a bare HTML file, React, Vue, Svelte, Solid, Angular, Astro, Rails, Django or a
CodePen — with no build step required of the consumer.

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@flowing-day/ui/+esm"></script>

<fd-section label="Startup" footer="Applies the next time the app launches.">
  <fd-switch-row symbol="power" label="Launch at login" checked></fd-switch-row>
  <fd-separator indented></fd-separator>
  <fd-switch-row symbol="eye" label="Show in menu bar"></fd-switch-row>
</fd-section>
```

## Layout

```
web/
├── packages/core/   @flowing-day/ui — the components and tokens
└── docs/            playground, run with `pnpm dev`
```

The Swift package at the repository root is untouched; it remains the design's source of
truth and every ported value is annotated with the Swift symbol it came from.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm build` | Build ESM output, type declarations, `theme.css` and the custom elements manifest |
| `pnpm test` | Run the suite in a real Chromium via Vitest browser mode |
| `pnpm typecheck` | Type-check without emitting |
| `pnpm lint` / `pnpm format` | Biome check / write |
| `pnpm dev` | Serve the playground |

`pnpm --filter @flowing-day/ui check:exports` validates the published entry points with
publint and are-the-types-wrong.

## Theming

Every token in `SettingsTheme.swift` becomes a CSS custom property. Because custom
properties inherit through shadow boundaries, setting one anywhere retints the subtree
below it — the same semantics as overriding a SwiftUI environment value:

```css
:root                { --fd-accent-fill: #6D9EA5; }  /* whole document */
.danger-zone         { --fd-accent-fill: #C4453D; }  /* one subtree     */
```

Derived tokens follow, exactly as `wash ?? fill.opacity(0.13)` does in Swift — override
`--fd-accent-fill` alone and `--fd-accent-wash` and `--fd-accent-veil` move with it.

Internally each component reads a private `--_fd-*` alias whose fallback is the public
token, so the defaults work with no stylesheet import at all. Import `theme.css` when you
want the tokens available to your own CSS as well:

```js
import '@flowing-day/ui/theme.css'
```

Appearance follows the OS. `data-fd-scheme="light" | "dark"` on any element forces one
appearance for that subtree.

### Why not `light-dark()`

It reads better, and it was the first implementation — but Lightning CSS, the default
minifier in Vite, downlevels `light-dark()` into a guard-variable pair that is silently
wrong inside a custom property declaration. Consumer build configurations are not ours to
control, so tokens ship as a light base plus a `prefers-color-scheme` override instead.
A test asserts neither generated artifact ever contains `light-dark(`.

## Icons

SF Symbols cannot be redistributed, so the core ships the icon interface and no icon data:

```js
import { FdIcons } from '@flowing-day/ui'

FdIcons.register({ gearshape: '<svg …></svg>' })
```

Names are conventionally the SF Symbol names, which keeps call sites identical to the
Swift source. A `@flowing-day/ui-icons-lucide` mapping package is planned.

## Deviations from the Swift API

| Swift | Web | Reason |
| --- | --- | --- |
| `title:` | `label` attribute | `title` is a global HTML attribute and would raise a native tooltip |
| `SettingsWindowPresenter` | not ported | `NSPanel` has no web equivalent; a `<dialog>`-based shell is planned |
| `RoundedRectangle(style: .continuous)` | `border-radius` | CSS `corner-shape` is not yet broadly available |
| `Toggle(.switch)` | custom-drawn `fd-switch` | AppKit chrome publishes no metrics; geometry is tokenised for tuning |

## Status

Ported: `fd-icon`, `fd-card`, `fd-section`, `fd-separator`, `fd-pane-stack`, `fd-row`,
`fd-switch`, `fd-switch-row`, and the complete token layer.

Remaining: the slider, popup, search picker, segmented and multi-select rows, tags, grids,
buttons, links, expandable and value rows, and the sidebar navigation shell.
