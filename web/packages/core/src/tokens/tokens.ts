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
    /**
     * An accent is one colour, not four. `SettingsAccent` spells out `fill` and
     * `foreground` per appearance, but the four literals of `.celadon` are a single hue
     * at four lightnesses: the fill lifts by 0.131 for dark surfaces, and the foreground
     * steps away from the surface it sits on — down 0.114 on light, up 0.030 on dark.
     *
     * Deriving them reproduces every Swift literal to within 3/255, and makes the accent
     * a single knob that adapts to both appearances, which is what a caller wants when
     * they say "make it copper". Each derived token stays individually overridable for
     * anyone who needs to art-direct one appearance by hand.
     */
    title: 'Accent — one colour, adapted per appearance (SettingsAccent.celadon)',
    tokens: [
      ['accent', srgb(0x6d9ea5)],
      /*
       * Only the two lightness steps depend on the appearance. Keeping the formulas
       * themselves appearance-independent is what lets `--fd-accent` be set at any depth:
       * a derived token substituted high up would be frozen for everything below it.
       */
      ['accent-lift', { light: '0', dark: '0.131' }],
      ['accent-contrast', { light: '-0.114', dark: '0.03' }],
      ['accent-fill', 'oklch(from var(--fd-accent) calc(l + var(--fd-accent-lift)) c h)'],
      [
        'accent-foreground',
        'oklch(from var(--fd-accent-fill) calc(l + var(--fd-accent-contrast)) c h)',
      ],
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
      /* SwiftUI `.default`, which the selection buttons animate their tint with. */
      ['motion-default', '350ms'],
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
  {
    title: 'Window chrome — SettingsViewConfiguration and the close button',
    tokens: [
      ['window-radius', '18px'],
      ['sidebar-width', '224px'],
      ['close-hover', dynamic(0xff5f57, 0xff6961)],
    ],
  },
  {
    /**
     * AppKit draws the popup panel and settings window shadows itself and publishes no
     * values, so these approximate the platform look and are exposed for tuning.
     */
    title: 'Elevation — approximations of the AppKit panel and window shadows',
    tokens: [
      [
        'menu-shadow',
        {
          light: `0 8px 24px ${srgb(0x000000, 0.16)}, 0 2px 6px ${srgb(0x000000, 0.1)}`,
          dark: `0 8px 24px ${srgb(0x000000, 0.46)}, 0 2px 6px ${srgb(0x000000, 0.32)}`,
        },
      ],
      [
        'window-shadow',
        {
          light: `0 28px 68px ${srgb(0x000000, 0.28)}, 0 6px 18px ${srgb(0x000000, 0.14)}`,
          dark: `0 28px 68px ${srgb(0x000000, 0.62)}, 0 6px 18px ${srgb(0x000000, 0.4)}`,
        },
      ],
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
