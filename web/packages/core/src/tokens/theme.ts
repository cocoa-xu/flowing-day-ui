import { type CSSResult, unsafeCSS } from 'lit'
import {
  darkValue,
  isDualValue,
  lightValue,
  reducedMotionTokens,
  type TokenValue,
  tokenGroups,
} from './tokens.js'

/**
 * Inside a shadow root every token is read through a private `--_fd-*` alias whose
 * fallback is the public `--fd-*` token. Declaring the public name anywhere up the
 * tree therefore wins, which is how `.flowingAccent(_:)` and friends propagate in
 * SwiftUI — an environment value overridden for a subtree.
 */
const toPrivateRefs = (value: string) => value.replaceAll('var(--fd-', 'var(--_fd-')

const allTokens = () => tokenGroups.flatMap((group) => group.tokens)

const dualTokens = () => allTokens().filter(([, value]) => isDualValue(value))

const alias = (indent: string, name: string, value: string) =>
  `${indent}--_fd-${name}: var(--fd-${name}, ${toPrivateRefs(value)});`

const aliasBlock = (indent: string, pick: (value: TokenValue) => string, dualOnly = false) =>
  (dualOnly ? dualTokens() : allTokens())
    .map(([name, value]) => alias(indent, name, pick(value)))
    .join('\n')

/** Reduce Motion is not overridable, matching SwiftUI where the environment value wins. */
const reducedMotionBlock = (indent: string) =>
  reducedMotionTokens.map(([name, value]) => `${indent}--_fd-${name}: ${value};`).join('\n')

const ACCENT_DERIVATION_TOKENS = new Set([
  'accent',
  'accent-lift',
  'accent-contrast',
  'accent-fill',
  'accent-foreground',
  'accent-wash',
  'accent-veil',
])

const accentTokens = () => allTokens().filter(([name]) => ACCENT_DERIVATION_TOKENS.has(name))

/**
 * These are formulas over `--fd-accent`, and a `var()` is substituted at the element its
 * declaration sits on. Publishing them on `:root` would freeze them there for the whole
 * document, so setting `--fd-accent` on a window or a page could never move them.
 *
 * They are therefore declared only where they are derived: inside each shadow root, and
 * on any element opting in with `data-fd-accent-scope`.
 */
const LOCALLY_DERIVED = new Set(['accent-fill', 'accent-foreground', 'accent-wash', 'accent-veil'])

/**
 * Private aliases are computed once on `:host` and inherited, so redeclaring a public
 * token deeper in the same shadow root has no effect. `data-fd-accent-scope` re-derives
 * the accent aliases at that element, which is what lets a component retint one part of
 * its own shadow tree — `PreferencesView` giving the sidebar the selected page's accent.
 */
const accentScopeBlock = (indent: string, pick: (value: TokenValue) => string, dualOnly = false) =>
  accentTokens()
    .filter(([, value]) => !dualOnly || isDualValue(value))
    .map(([name, value]) => alias(indent, name, pick(value)))
    .join('\n')

const publicBlock = (indent: string, pick: (value: TokenValue) => string, dualOnly = false) =>
  (dualOnly ? dualTokens() : allTokens())
    .map(([name, value]) => `${indent}--fd-${name}: ${pick(value)};`)
    .join('\n')

const publicGroupedBlock = () =>
  tokenGroups
    .map(
      (group) =>
        `  /* ${group.title} */\n` +
        group.tokens
          .filter(([name]) => !LOCALLY_DERIVED.has(name))
          .map(([name, value]) => `  --fd-${name}: ${lightValue(value)};`)
          .join('\n'),
    )
    .join('\n\n')

const publicAccentScopeBlock = (indent: string) =>
  accentTokens()
    .filter(([name]) => LOCALLY_DERIVED.has(name))
    .map(([name, value]) => `${indent}--fd-${name}: ${lightValue(value)};`)
    .join('\n')

/** Adopted by every component so tokens resolve with no stylesheet import at all. */
export const themeStyles: CSSResult = unsafeCSS(`
:host {
${aliasBlock('  ', lightValue)}
}

[data-fd-accent-scope] {
${accentScopeBlock('  ', lightValue)}
}

@media (prefers-color-scheme: dark) {
  :host {
${aliasBlock('    ', darkValue, true)}
  }

  [data-fd-accent-scope] {
${accentScopeBlock('    ', darkValue, true)}
  }
}

@media (prefers-reduced-motion: reduce) {
  :host {
${reducedMotionBlock('    ')}
  }
}
`)

/**
 * Source text for the standalone `theme.css` artifact.
 *
 * Appearance follows the OS by default; `data-fd-scheme` on any element forces one
 * appearance for that subtree, which is the web analogue of handing a different
 * `FlowingSurfaces` to part of the view tree.
 */
export function globalThemeCss(): string {
  return `/* Generated from src/tokens/tokens.ts — do not edit by hand. */

:root {
  color-scheme: light dark;

${publicGroupedBlock()}
}

/*
 * The accent formulas are published only here, never on :root, so that setting
 * --fd-accent anywhere in the tree still moves them. Opt an element in when its own
 * CSS needs the derived colours; components already derive them inside their shadow root.
 */
[data-fd-accent-scope] {
${publicAccentScopeBlock('  ')}
}

@media (prefers-color-scheme: dark) {
  :root {
${publicBlock('    ', darkValue, true)}
  }
}

[data-fd-scheme='light'] {
  color-scheme: light;
${publicBlock('  ', lightValue, true)}
}

[data-fd-scheme='dark'] {
  color-scheme: dark;
${publicBlock('  ', darkValue, true)}
}

@media (prefers-reduced-motion: reduce) {
  :root {
${reducedMotionTokens.map(([name, value]) => `    --fd-${name}: ${value};`).join('\n')}
  }
}
`
}
