/**
 * Single source of truth for every design token, mirroring `SettingsTheme.swift`.
 *
 * Two artifacts are generated from this file:
 *  - `themeStyles`   private `--_fd-*` aliases adopted into every shadow root
 *  - `theme.css`     public `--fd-*` declarations for global authoring
 *
 * Both come from `tokenGroups` so the Swift package and the web package can only
 * ever drift in one place.
 */

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

/** Mirrors `SettingsPalette.srgb(_:_:)`. */
export function srgb(hex: number, alpha = 1): string {
  const r = (hex >> 16) & 0xff
  const g = (hex >> 8) & 0xff
  const b = hex & 0xff
  if (alpha >= 1) return `#${hex.toString(16).padStart(6, '0').toUpperCase()}`
  return `rgb(${r} ${g} ${b} / ${alpha})`
}

/**
 * Mirrors `SettingsPalette.translucent(light:lightAlpha:dark:darkAlpha:)`.
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

/** Mirrors `SettingsPalette.dynamic(light:dark:)`. */
export function dynamic(light: number, dark: number): TokenValue {
  return translucent(light, 1, dark, 1)
}

/** Mirrors `SettingsFontWeight`. */
export const fontWeights = {
  ultraLight: 100,
  thin: 200,
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  heavy: 800,
  black: 900,
} as const

export type FontWeightName = keyof typeof fontWeights

/** Mirrors `SettingsFontDesign`. */
export type FontDesignName = 'standard' | 'rounded' | 'serif' | 'monospaced'

interface TextStyle {
  readonly size: number
  readonly weight?: FontWeightName
  readonly design?: FontDesignName
  readonly usesMonospacedDigits?: boolean
}

/** Mirrors `SettingsTypography.standard`, keyed by kebab-case role name. */
const textStyles: Record<string, TextStyle> = {
  'brand-title': { size: 16, weight: 'bold', design: 'rounded' },
  'brand-subtitle': { size: 10.5, weight: 'medium' },
  'sidebar-group': { size: 9, weight: 'semibold' },
  'sidebar-item': { size: 12.5 },
  'sidebar-item-selected': { size: 12.5, weight: 'semibold' },
  'page-title': { size: 25, weight: 'semibold', design: 'rounded' },
  'page-subtitle': { size: 11.5 },
  'content-title': { size: 21, weight: 'semibold' },
  body: { size: 12 },
  'section-header': { size: 10.5, weight: 'semibold' },
  'row-title': { size: 13 },
  'row-caption': { size: 11 },
  value: { size: 12.5 },
  'slider-value': { size: 11.5, usesMonospacedDigits: true },
  'selection-label': { size: 11.5, weight: 'medium' },
  'button-label': { size: 12.5, weight: 'medium' },
  tag: { size: 11, design: 'monospaced' },
}

function textStyleTokens(): Array<readonly [string, TokenValue]> {
  return Object.entries(textStyles).flatMap(([role, style]) => [
    [`text-${role}-size`, `${style.size}px`] as const,
    [`text-${role}-weight`, `${fontWeights[style.weight ?? 'regular']}`] as const,
    [`text-${role}-family`, `var(--fd-font-${style.design ?? 'standard'})`] as const,
    [`text-${role}-numeric`, style.usesMonospacedDigits ? 'tabular-nums' : 'normal'] as const,
  ])
}

/**
 * `.rounded` and `.serif` resolve to SF Pro Rounded / New York on Apple platforms only.
 * The fallback chains keep the intent recognisable everywhere else.
 */
const fontFamilies: Array<readonly [string, TokenValue]> = [
  [
    'font-standard',
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
  ],
  [
    'font-rounded',
    'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Varela Round", -apple-system, system-ui, sans-serif',
  ],
  ['font-serif', 'ui-serif, "New York", Georgia, "Times New Roman", serif'],
  ['font-monospaced', 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace'],
]

export const tokenGroups: readonly TokenGroup[] = [
  {
    title: 'Palette — SettingsPalette',
    tokens: [
      ['palette-canvas', dynamic(0xfcfcfb, 0x161617)],
      ['palette-card', dynamic(0xf2f2ef, 0x232326)],
      ['palette-control', dynamic(0xffffff, 0x2e2e31)],
      ['palette-field', dynamic(0xe9e9e5, 0x2a2a2d)],
      ['palette-ink', dynamic(0x1d1d1b, 0xf1f1ef)],
      ['palette-muted', dynamic(0x6c6c66, 0x9b9b96)],
      ['palette-faint', dynamic(0x91918a, 0x8a8a84)],
      ['palette-hairline', translucent(0x000000, 0.07, 0xffffff, 0.09)],
      ['palette-edge', translucent(0x000000, 0.05, 0xffffff, 0.07)],
    ],
  },
  {
    title: 'Surfaces — SettingsSurfaces.standard',
    tokens: [
      ['surface-canvas', 'var(--fd-palette-canvas)'],
      ['surface-sidebar', 'var(--fd-palette-card)'],
      ['surface-card', 'var(--fd-palette-control)'],
      ['surface-control', 'var(--fd-palette-control)'],
      ['surface-field', 'var(--fd-palette-field)'],
    ],
  },
  {
    title: 'Accent — SettingsAccent.celadon (wash/veil derive from fill, as in Swift)',
    tokens: [
      ['accent-fill', dynamic(0x6d9ea5, 0x93c8cf)],
      ['accent-foreground', dynamic(0x4e7b82, 0x9fd1d8)],
      ['accent-wash', 'color-mix(in srgb, var(--fd-accent-fill) 13%, transparent)'],
      ['accent-veil', 'color-mix(in srgb, var(--fd-accent-fill) 8%, transparent)'],
    ],
  },
  {
    title: 'Metrics — SettingsMetrics.standard',
    tokens: [
      ['metric-card-radius', '14px'],
      ['metric-control-radius', '9px'],
      ['metric-row-inset', '18px'],
      ['metric-content-width', '720px'],
      ['metric-section-spacing', '20px'],
    ],
  },
  { title: 'Font families — SettingsFontDesign', tokens: fontFamilies },
  { title: 'Text roles — SettingsTypography.standard', tokens: textStyleTokens() },
  {
    title: 'Motion — literal durations from the SwiftUI sources',
    tokens: [
      ['motion-disclosure', '180ms'],
      ['motion-disclosure-offset', '-5px'],
      ['motion-hover', '120ms'],
      ['motion-selection', '160ms'],
      ['motion-page', '220ms'],
      ['motion-easing', 'cubic-bezier(0, 0, 0.58, 1)'],
      ['motion-easing-page', 'cubic-bezier(0.42, 0, 0.58, 1)'],
    ],
  },
  {
    title: 'Control chrome — knob treatment shared by switch and slider',
    tokens: [
      ['knob-fill', dynamic(0xffffff, 0xe2e2de)],
      ['knob-border', translucent(0x000000, 0.12, 0x000000, 0.42)],
      ['knob-shadow', `0 -0.5px 1.5px ${srgb(0x000000, 0.16)}`],
      ['track-off', dynamic(0xe3e3e1, 0x48484a)],
    ],
  },
]

/**
 * Reduce Motion collapses the disclosure animation to 0.12s linear and disables the
 * rest outright, matching every `accessibilityReduceMotion` branch in the Swift source.
 */
export const reducedMotionTokens: ReadonlyArray<readonly [string, string]> = [
  ['motion-disclosure', '120ms'],
  ['motion-disclosure-offset', '0px'],
  ['motion-hover', '1ms'],
  ['motion-selection', '1ms'],
  ['motion-page', '1ms'],
  ['motion-easing', 'linear'],
  ['motion-easing-page', 'linear'],
]
