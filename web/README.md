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

A whole settings window is declarative too, which is what makes it embeddable in a
marketing page as a live, clickable mock rather than a screenshot:

```html
<fd-settings-window app-name="Afloat" page="general">
  <fd-page-group label="Monitors">
    <fd-page page-id="network" label="Network" symbol="network">…</fd-page>
  </fd-page-group>
</fd-settings-window>
```

## Layout

```
web/
├── packages/core/   @flowing-day/ui — the components and tokens
└── docs/            the landing page, run with `pnpm dev`
```

The landing page is a live, draggable settings window rather than a component gallery.
Its own Appearance page restyles the window it lives in — theme, accent, density, corner
radius and type scale are all just tokens written onto the window element — so the page
doubles as the proof that the theming contract works.

Dragging mirrors `NSPanel.isMovableByWindowBackground`, which `SettingsWindowPresenter`
sets. It lives with the page, not the component: presentation is the caller's business.

The page resolves `@flowing-day/ui` to the core package's *sources*, so editing a
component hot-reloads it instead of waiting on a rebuild.

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

### An accent is one colour

`--fd-accent` is the only knob you need. Fill, foreground, wash and veil all derive from
it, in both appearances:

```css
:root { --fd-accent: #B4795E; }   /* that is the whole change */
```

`SettingsAccent` spells out `fill` and `foreground` per appearance, but the four literals
of `.celadon` are a single hue at four lightnesses — the fill lifts by 0.131 for dark
surfaces, and the foreground steps away from whatever surface it sits on. Deriving them in
oklch reproduces every Swift literal to within 3/255, and means "make it copper" is one
line rather than four values to keep in step. Each derived token stays individually
overridable when one appearance needs art direction by hand.

Only `--fd-accent-lift` and `--fd-accent-contrast` — the two lightness steps — depend on
the appearance. The formulas themselves do not, which is what lets `--fd-accent` be set at
any depth: a `var()` is substituted at the element its declaration sits on, so a derived
token published on `:root` would be frozen there for everything below it. That is also why
`theme.css` publishes the formulas under `[data-fd-accent-scope]` rather than on `:root`;
components derive them inside their own shadow root, and plain HTML opts in with the
attribute.

This is the one place the port deliberately improves on the original rather than copying
it, and it relies on relative colour syntax — Chrome 119, Safari 16.4, Firefox 128.

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
| `SettingsPopupControl`'s `NSPanel` | Popover API | The top layer escapes the scroll container as a child window did; light dismiss and Escape come from the platform |
| `SettingsWindowPresenter` | not ported | `NSPanel` has no web equivalent; `fd-settings-window` is the view, and the page decides how to present it |
| `RoundedRectangle(style: .continuous)` | `border-radius` | CSS `corner-shape` is not yet broadly available |
| `Toggle(.switch)` | custom-drawn `fd-switch` | AppKit chrome publishes no metrics; geometry is tokenised for tuning |
| `SettingsPage<ID: Hashable>` | `page-id` string | Attributes are strings; anything else would need JavaScript to author |

## Status

Ported: the token layer, `fd-settings-window` with its sidebar and page header, `fd-page`,
`fd-page-group`, `fd-card`, `fd-section`, `fd-separator`, `fd-pane-stack`, `fd-row`,
`fd-switch`, `fd-switch-row`, `fd-popup`, `fd-popup-row`, `fd-segmented-row`,
`fd-symbol-segmented-row`, `fd-multi-select-row`, `fd-check-toggle`, `fd-dependent-rows`,
`fd-switch-group`, `fd-option` and `fd-icon`.

Remaining: the slider, search picker, colour picker, tags, flow and adaptive grids, and
the button, link, expandable, value and empty rows.
