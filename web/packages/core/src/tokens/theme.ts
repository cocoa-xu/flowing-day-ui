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
 * tree therefore wins, which is how `.settingsAccent(_:)` and friends propagate in
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

const publicBlock = (indent: string, pick: (value: TokenValue) => string, dualOnly = false) =>
  (dualOnly ? dualTokens() : allTokens())
    .map(([name, value]) => `${indent}--fd-${name}: ${pick(value)};`)
    .join('\n')

const publicGroupedBlock = () =>
  tokenGroups
    .map(
      (group) =>
        `  /* ${group.title} */\n` +
        group.tokens.map(([name, value]) => `  --fd-${name}: ${lightValue(value)};`).join('\n'),
    )
    .join('\n\n')

/** Adopted by every component so tokens resolve with no stylesheet import at all. */
export const themeStyles: CSSResult = unsafeCSS(`
:host {
${aliasBlock('  ', lightValue)}
}

@media (prefers-color-scheme: dark) {
  :host {
${aliasBlock('    ', darkValue, true)}
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
 * `SettingsSurfaces` to part of the view tree.
 */
export function globalThemeCss(): string {
  return `/* Generated from src/tokens/tokens.ts — do not edit by hand. */

:root {
  color-scheme: light dark;

${publicGroupedBlock()}
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
