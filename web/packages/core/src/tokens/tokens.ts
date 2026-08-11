/**
 * Design tokens, expanded from `tokens.json` — the only place a value is written.
 *
 * Two artifacts are generated from what this module exports:
 *  - `themeStyles`   private `--_fd-*` aliases adopted into every shadow root
 *  - `theme.css`     public `--fd-*` declarations for global authoring
 *
 * The JSON stays platform-neutral so the Swift package and any later port can be fed
 * from it too. Anything that is genuinely CSS — a font fallback chain, an `oklch()`
 * derivation, a bezier — is written as a `css` value, which marks it as belonging to
 * this emitter rather than to the source. A token carrying `platform: "web"` has no
 * Swift counterpart at all; see the note on it for why.
 *
 * The value kinds a token may take, all of which may be a single value or a
 * `{ light, dark }` pair:
 *
 *  | kind     | JSON                                    | emitted            |
 *  | -------- | --------------------------------------- | ------------------ |
 *  | colour   | `{ color: "6D9EA5" }`                   | `#6D9EA5`          |
 *  |          | `{ color: {…}, alpha: { light: 0.07 } }` | `rgb(0 0 0 / 0.07)`|
 *  | length   | `{ px: 14 }`                            | `14px`             |
 *  | duration | `{ ms: 180 }`                           | `180ms`            |
 *  | scalar   | `{ number: { light: 0, dark: 0.131 } }` | `0`                |
 *  | ref      | `{ ref: "palette-card" }`               | `var(--fd-…)`      |
 *  | css      | `{ css: "linear" }`                     | verbatim           |
 */

import raw from './tokens.json' with { type: 'json' }

export interface DualTokenValue {
  readonly light: string
  readonly dark: string
}

/** A token is either appearance-independent, or a light/dark pair. */
export type TokenValue = string | DualTokenValue

export interface TokenGroup {
  readonly title: string
  readonly tokens: ReadonlyArray<readonly [name: string, value: TokenValue]>
}

export const isDualValue = (value: TokenValue): value is DualTokenValue => typeof value !== 'string'

export const lightValue = (value: TokenValue): string => (isDualValue(value) ? value.light : value)

export const darkValue = (value: TokenValue): string => (isDualValue(value) ? value.dark : value)

/** Mirrors `FlowingPalette.srgb(_:_:)`. */
export function srgb(hex: number, alpha = 1): string {
  const r = (hex >> 16) & 0xff
  const g = (hex >> 8) & 0xff
  const b = hex & 0xff
  if (alpha >= 1) return `#${hex.toString(16).padStart(6, '0').toUpperCase()}`
  return `rgb(${r} ${g} ${b} / ${alpha})`
}

/**
 * Mirrors `FlowingPalette.translucent(light:lightAlpha:dark:darkAlpha:)`.
 *
 * Deliberately *not* CSS `light-dark()`: Lightning CSS — Vite's default minifier, and
 * therefore in the build of many consumers — downlevels it into a guard-variable pair
 * that is silently wrong inside a custom property declaration. Emitting the two values
 * into separate cascade layers survives every minifier.
 */
export function translucent(
  light: number,
  lightAlpha: number,
  dark: number,
  darkAlpha: number,
): TokenValue {
  return { light: srgb(light, lightAlpha), dark: srgb(dark, darkAlpha) }
}

/** Mirrors `FlowingPalette.dynamic(light:dark:)`. */
export function dynamic(light: number, dark: number): TokenValue {
  return translucent(light, 1, dark, 1)
}

/** The nine cases of `FlowingFontWeight`. */
export type FontWeightName =
  | 'ultraLight'
  | 'thin'
  | 'light'
  | 'regular'
  | 'medium'
  | 'semibold'
  | 'bold'
  | 'heavy'
  | 'black'

/** Mirrors `FlowingFontWeight`, mapped onto the CSS numeric scale. */
export const fontWeights = Object.fromEntries(
  Object.entries(raw.fontWeights).filter(([name]) => !name.startsWith('$')),
) as Readonly<Record<FontWeightName, number>>

/** Mirrors `FlowingFontDesign`. */
export type FontDesignName = 'standard' | 'rounded' | 'serif' | 'monospaced'

/** Mirrors `FlowingTextStyle`, less the AppKit-only `fontName`. */
interface RawTextStyle {
  readonly size: number
  readonly weight?: FontWeightName
  readonly design?: FontDesignName
  readonly monospacedDigits?: boolean
  readonly swift?: string
}

type Appearance = 'light' | 'dark'

type Paired<T> = T | { readonly light: T; readonly dark: T }

interface RawToken {
  readonly color?: Paired<string>
  readonly alpha?: Paired<number>
  readonly number?: Paired<number>
  readonly px?: number
  readonly ms?: number
  readonly ref?: string
  readonly css?: Paired<string>
}

interface RawGroup {
  readonly title: string
  readonly expand?: string
  readonly tokens?: Readonly<Record<string, RawToken>>
}

type Values<T> = T[keyof T]
type KeysOfUnion<T> = T extends unknown ? keyof T : never
type RawNamedAccentFamilies = typeof raw.namedAccents.families

export type NamedAccentFamilyName = Extract<keyof RawNamedAccentFamilies, string>
export type NamedAccentName = Extract<KeysOfUnion<Values<RawNamedAccentFamilies>>, string>

const isPaired = <T>(value: Paired<T>): value is { light: T; dark: T } =>
  typeof value === 'object' && value !== null && 'light' in value

const pick = <T>(value: Paired<T>, appearance: Appearance): T =>
  isPaired(value) ? value[appearance] : (value as T)

/** True when any facet of the token differs between appearances. */
const isAppearanceDependent = (token: RawToken): boolean =>
  [token.color, token.alpha, token.number, token.css].some(
    (facet) => facet !== undefined && isPaired(facet),
  )

function resolve(token: RawToken, appearance: Appearance): string {
  if (token.ref !== undefined) return `var(--fd-${token.ref})`
  if (token.css !== undefined) return pick(token.css, appearance)
  if (token.px !== undefined) return `${token.px}px`
  if (token.ms !== undefined) return `${token.ms}ms`
  if (token.number !== undefined) return String(pick(token.number, appearance))
  if (token.color !== undefined) {
    const hex = Number.parseInt(pick(token.color, appearance), 16)
    return srgb(hex, token.alpha === undefined ? 1 : pick(token.alpha, appearance))
  }
  throw new Error(`Token carries no value: ${JSON.stringify(token)}`)
}

const toTokenValue = (token: RawToken): TokenValue =>
  isAppearanceDependent(token)
    ? { light: resolve(token, 'light'), dark: resolve(token, 'dark') }
    : resolve(token, 'light')

const rawNamedAccentFamilies = raw.namedAccents.families as Readonly<
  Record<NamedAccentFamilyName, Readonly<Record<NamedAccentName, RawToken>>>
>

const namedAccentEntries = Object.values(rawNamedAccentFamilies).flatMap((family) =>
  Object.entries(family),
)

export const namedAccents = Object.freeze(
  Object.fromEntries(namedAccentEntries.map(([name, token]) => [name, resolve(token, 'light')])),
) as Readonly<Record<NamedAccentName, string>>

export const namedAccentFamilies = Object.freeze(
  Object.fromEntries(
    Object.entries(rawNamedAccentFamilies).map(([family, accents]) => [
      family,
      Object.freeze(Object.keys(accents)) as readonly NamedAccentName[],
    ]),
  ),
) as Readonly<Record<NamedAccentFamilyName, readonly NamedAccentName[]>>

/** Expands the shared Controls and Preferences typography roles into four token reads each. */
function textStyleTokens(): Array<readonly [string, TokenValue]> {
  return Object.entries(raw.typography.roles as Readonly<Record<string, RawTextStyle>>).flatMap(
    ([role, style]) => [
      [`text-${role}-size`, `${style.size}px`] as const,
      [`text-${role}-weight`, `${fontWeights[style.weight ?? 'regular']}`] as const,
      [`text-${role}-family`, `var(--fd-font-${style.design ?? 'standard'})`] as const,
      [`text-${role}-numeric`, style.monospacedDigits ? 'tabular-nums' : 'normal'] as const,
    ],
  )
}

function expandedTokens(group: RawGroup): ReadonlyArray<readonly [string, TokenValue]> {
  if (group.expand === 'typography') return textStyleTokens()
  if (group.expand === 'namedAccents') {
    return namedAccentEntries.map(
      ([name, token]) => [`accent-${name}`, toTokenValue(token)] as const,
    )
  }
  return Object.entries(group.tokens ?? {}).map(
    ([name, token]) => [name, toTokenValue(token)] as const,
  )
}

const expandGroup = (group: RawGroup): TokenGroup => ({
  title: group.title,
  tokens: expandedTokens(group),
})

export const tokenGroups: readonly TokenGroup[] = (raw.groups as readonly RawGroup[]).map(
  expandGroup,
)

/**
 * Reduce Motion collapses the disclosure animation to 0.12s linear and disables the
 * rest outright, matching every `accessibilityReduceMotion` branch in the Swift source.
 */
export const reducedMotionTokens: ReadonlyArray<readonly [string, string]> = Object.entries(
  raw.reducedMotion as Readonly<Record<string, RawToken>>,
)
  .filter(([name]) => !name.startsWith('$'))
  .map(([name, token]) => [name, resolve(token, 'light')] as const)
