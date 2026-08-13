# @flowing-day/ui

A framework-agnostic port of the [FlowingDayUI](https://github.com/cocoa-xu/flowing-day-ui)
SwiftUI toolkit, built as standard Custom Elements. The published output is plain ESM plus
plain CSS custom properties, so it works in a bare HTML file, React, Vue, Svelte, Solid,
Angular, Astro, Rails, Django or a CodePen — with no build step required of you.

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@flowing-day/ui/+esm"></script>

<fd-section label="Startup" footer="Applies the next time the app launches.">
  <fd-switch-row symbol="power" label="Launch at login" checked></fd-switch-row>
  <fd-separator leading-edge="icon-text"></fd-separator>
  <fd-switch-row symbol="eye" label="Show in menu bar"></fd-switch-row>
</fd-section>
```

```sh
npm install @flowing-day/ui
```

```js
import '@flowing-day/ui'                       // everything
import '@flowing-day/ui/components/switch-row' // or one component
```

## A whole preferences window, declaratively

Pages are light DOM, so a static page can build one with no JavaScript at all:

```html
<fd-preferences-window app-name="Flowing Day" page="general">
  <fd-page-group label="Monitors">
    <fd-page page-id="general" label="General" symbol="gearshape">
      <fd-pane-stack>…</fd-pane-stack>
    </fd-page>
  </fd-page-group>
</fd-preferences-window>
```

The window starts at `900 × 640`, which is also its default minimum. Its default maximum
is `1160 × 860`. Applications can set their own bounds without reaching into the shadow
tree:

```css
fd-preferences-window {
  --fd-preferences-min-width: 840px;
  --fd-preferences-min-height: 600px;
  --fd-preferences-max-width: 1080px;
  --fd-preferences-max-height: 760px;
}
```

Content is centered at `720px` by default. Use `content-layout="fluid"` to fill the pane,
or set `--fd-preferences-content-max-width` to choose another centered measure.

Component chrome is nonselectable by default, matching desktop controls. Editable fields
and copyable value rows remain selectable. Set `--fd-user-select: text` on any component
or subtree when its labels should also allow text selection.

## Theming

Every value in `FlowingTheme.swift` is a CSS custom property. Because custom properties
inherit through shadow boundaries, setting one anywhere retints the subtree below it — the
same semantics as overriding a SwiftUI environment value:

```css
:root         { --fd-accent: #6D9EA5; }  /* whole document */
.danger-zone  { --fd-accent: #C4453D; }  /* one subtree     */
```

`--fd-accent` is the only accent knob you need. Fill, foreground, wash and veil all derive
from it in both light and dark, using the same lightness steps as `FlowingAccent`.

The named Swift palette is available as CSS tokens and JavaScript values:

```css
fd-preferences-window { --fd-accent: var(--fd-accent-bloom); }
```

```js
import { namedAccentFamilies, namedAccents } from '@flowing-day/ui/tokens'
```

Import the stylesheet when you want the tokens available to your own CSS too:

```js
import '@flowing-day/ui/theme.css'
```

Appearance follows the OS. `data-fd-scheme="light" | "dark"` on any element forces one
appearance for that subtree.

## Icons

SF Symbols cannot be redistributed, so the package ships the icon interface and no icon
data. Register any set you like, under whatever names you want to call them by:

```js
import { FdIcons } from '@flowing-day/ui'

FdIcons.register({ gearshape: '<svg …></svg>' })
```

Icons already on the page pick up a later registration.

## Components

**Structure** — `fd-preferences-window`, `fd-page`, `fd-page-group`, `fd-pane-stack`,
`fd-section`, `fd-card`, `fd-separator`, `fd-dependent-rows`, `fd-disclosure`.

**Rows** — `fd-row`, `fd-switch-row`, `fd-popup-row`, `fd-slider-row`, `fd-value-row`,
`fd-button-row`, `fd-link-row`, `fd-expandable-row`, `fd-color-picker-row`,
`fd-search-picker-row`, `fd-empty-row`.

**Selection** — `fd-checkbox`, `fd-multi-select`, `fd-segmented-control`,
`fd-connected-segmented-control`, `fd-segmented-row`, `fd-connected-segmented-row`,
`fd-symbol-segmented-row`, `fd-multi-select-row`, `fd-switch-group`, `fd-check-toggle`,
`fd-icon-selection-button`, `fd-tabs`, `fd-option`.

**Controls** — `fd-button`, `fd-switch`, `fd-slider`, `fd-select`, `fd-text-field`, `fd-secure-field`,
`fd-text-area`, `fd-search-picker`, `fd-color-picker`, `fd-icon-button`, `fd-progress`.

**Display** — `fd-empty-state`, `fd-value-text`.

**Overlays** — `fd-dialog`, `fd-dialog-action`, `fd-popover`, `fd-tooltip`.

**Pills and layout** — `fd-chip`, `fd-tag`, `fd-selectable-tag`, `fd-wrapping-grid`, `fd-adaptive-grid`, `fd-flow-grid`, `fd-grid`.

**Icons** — `fd-icon`.

Editors pick up attribute and event completions from the bundled
[custom elements manifest](https://github.com/webcomponents/custom-elements-manifest).

## Differences from the SwiftUI original

| Swift | Web | Why |
| --- | --- | --- |
| `title:` | `label` attribute | `title` is a global HTML attribute and would raise a native tooltip |
| `FlowingAccent(fill:foreground:)` | one `--fd-accent` | The four literals are one hue at four lightnesses, so they derive |
| `FlowingSelectButton`'s `NSPanel` | Popover API | The top layer escapes the scroll container as a child window did |
| `PreferencesWindowPresenter` | not ported | `NSPanel` has no web equivalent; the page decides how to present the view |
| `Toggle(.switch)` | custom-drawn | AppKit chrome publishes no metrics, so the geometry is tokenised |
| `truncationMode(.middle)` | split head and tail | No CSS keyword truncates a middle, so the tail is held back and the head ellipsises into it |
| `FlowingWrappingLayout` | `flex-wrap` | The custom `Layout` places each item at its ideal size on the row's top edge, which is a wrapping flex line |
| `action:` closure | `fd-activate` event | A `click` on the host also fires for the row label, which never ran the closure |
| `accessibilityValue(_:)` for state | `aria-checked` / `aria-pressed` / `aria-expanded` / `aria-selected` | The state is native to the platform, and a screen reader speaks it in its own language rather than the page's |

Everything else — metrics, colours, type scale, motion durations — is taken from the Swift
sources rather than eyeballed, and the tests pin the literals.

## Versioning

This package versions independently of the Swift package. They measure different things:
the Swift package has a release history, this one is still filling in components, and a
breaking change on either side should not force a release on the other.

Each release records which Swift revision it was ported from. The current source tree is
kept in parity with the Swift package; published versions remain independent until the web
package reaches 1.0.

## Browser support

Chrome 119, Safari 16.4, Firefox 128 and up — set by CSS relative colour syntax, which
the accent derivation uses. Also relies on the Popover API, `color-mix()` and
`ElementInternals`.

## Licence

Apache-2.0.
