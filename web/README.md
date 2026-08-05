# FlowingDayUI for the web

Workspace for `@flowing-day/ui`, a framework-agnostic port of the `FlowingDaySettings`
SwiftUI toolkit built as standard Custom Elements.

**Using the library?** The package README is
[`packages/core/README.md`](./packages/core/README.md) — install, theming, components.
This file covers working on it.

## Layout

```
web/
├── packages/core/   @flowing-day/ui — the components and tokens
└── docs/            the landing page, run with `pnpm dev`
```

The landing page is a live, draggable settings window rather than a component gallery.
Its own Appearance page restyles the window it lives in — theme, accent, density, corner
radius and type scale are all just tokens written onto the window element — so the page
doubles as the proof that the theming contract works, and as its own regression test.

It resolves `@flowing-day/ui` to the core package's *sources*, so editing a component
hot-reloads the page instead of waiting on a rebuild.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Serve the landing page |
| `pnpm build` | ESM output, type declarations, `theme.css` and the custom elements manifest |
| `pnpm test` | Run the suite in a real Chromium via Vitest browser mode |
| `pnpm typecheck` | Type-check both packages without emitting |
| `pnpm lint` / `pnpm format` | Biome check / write |

`pnpm --filter @flowing-day/ui check:exports` validates the published entry points with
publint and are-the-types-wrong.

## How the token layer is built

Every token lives in `packages/core/src/tokens/tokens.ts`, annotated with the Swift symbol
it mirrors. Two artifacts are generated from it, so the two can only ever drift in one
place:

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
| Swift | `1.6.0` | `1.6.0` |
| Web | `0.1.0` | `web/v0.1.0` |

Publishing is `pnpm --filter @flowing-day/ui publish`; `publishConfig.access` is already
set, since scoped packages default to restricted.

## Status

Ported: the token layer, `fd-settings-window` with its sidebar and page header, `fd-page`,
`fd-page-group`, `fd-card`, `fd-section`, `fd-separator`, `fd-pane-stack`, `fd-row`,
`fd-switch`, `fd-switch-row`, `fd-popup`, `fd-popup-row`, `fd-segmented-row`,
`fd-symbol-segmented-row`, `fd-multi-select-row`, `fd-check-toggle`, `fd-dependent-rows`,
`fd-switch-group`, `fd-option` and `fd-icon`.

Remaining: the slider, search picker, colour picker, tags, flow and adaptive grids, and
the button, link, expandable, value and empty rows.
