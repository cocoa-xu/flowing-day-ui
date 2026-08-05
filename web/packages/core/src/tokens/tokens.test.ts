import { describe, expect, it } from 'vitest'
import { globalThemeCss, themeStyles } from './theme.js'
import {
  darkValue,
  dynamic,
  fontWeights,
  isDualValue,
  lightValue,
  reducedMotionTokens,
  srgb,
  tokenGroups,
  translucent,
} from './tokens.js'
import raw from './tokens.json' with { type: 'json' }

describe('srgb', () => {
  it('renders opaque colours as hex, mirroring the Swift literals', () => {
    expect(srgb(0x6d9ea5)).toBe('#6D9EA5')
    expect(srgb(0xfcfcfb)).toBe('#FCFCFB')
  })

  it('pads short hex values to six digits', () => {
    expect(srgb(0x000000)).toBe('#000000')
  })

  it('decomposes channels the same way SettingsPalette.srgb does', () => {
    expect(srgb(0x1d1d1b, 0.5)).toBe('rgb(29 29 27 / 0.5)')
  })
})

describe('dynamic and translucent', () => {
  it('keeps the two appearances apart rather than composing light-dark()', () => {
    expect(dynamic(0xfcfcfb, 0x161617)).toEqual({ light: '#FCFCFB', dark: '#161617' })
  })

  it('carries per-appearance alpha through, as hairline and edge require', () => {
    expect(translucent(0x000000, 0.07, 0xffffff, 0.09)).toEqual({
      light: 'rgb(0 0 0 / 0.07)',
      dark: 'rgb(255 255 255 / 0.09)',
    })
  })
})

describe('fontWeights', () => {
  it('maps every SettingsFontWeight case onto a CSS numeric weight', () => {
    expect(Object.keys(fontWeights)).toEqual([
      'ultraLight',
      'thin',
      'light',
      'regular',
      'medium',
      'semibold',
      'bold',
      'heavy',
      'black',
    ])
    expect(fontWeights.regular).toBe(400)
    expect(fontWeights.semibold).toBe(600)
  })
})

interface RawGroup {
  readonly title: string
  readonly source: string | null
  readonly note?: string
  readonly expand?: string
  readonly tokens?: Readonly<Record<string, { swift?: string; platform?: string; note?: string }>>
}

const rawGroups = raw.groups as readonly RawGroup[]

const rawTokens = rawGroups.flatMap((group) =>
  Object.entries(group.tokens ?? {}).map(([name, token]) => ({ name, token, group })),
)

/**
 * tokens.json is the only place a value is written, and everything in it is meant to
 * come from the Swift sources. These guard that claim: a value that appears without
 * saying where it came from is the beginning of the drift the file exists to prevent.
 */
describe('tokens.json as the source', () => {
  it('traces every token to a Swift symbol, or says why it cannot', () => {
    const untraceable = rawTokens
      .filter(({ token, group }) => !group.source && !token.swift && token.platform !== 'web')
      .map(({ name }) => name)

    expect(untraceable).toEqual([])
  })

  /** AppKit draws these itself and publishes no values, so there is nothing to align to. */
  it('marks exactly the three tokens with no Swift counterpart as web-only', () => {
    const webOnly = rawTokens
      .filter(({ token }) => token.platform === 'web')
      .map(({ name }) => name)

    expect(webOnly).toEqual(['track-off', 'menu-shadow', 'window-shadow'])
  })

  it('explains every web-only token, on the token or on its group', () => {
    const unexplained = rawTokens
      .filter(({ token }) => token.platform === 'web')
      .filter(({ token, group }) => !token.note && !group.note)
      .map(({ name }) => name)

    expect(unexplained).toEqual([])
  })

  it('expands each value kind into the CSS it stands for', () => {
    const flat = new Map(tokenGroups.flatMap((group) => group.tokens))

    expect(flat.get('metric-card-radius')).toBe('14px') // px
    expect(flat.get('motion-page')).toBe('220ms') // ms
    expect(flat.get('surface-sidebar')).toBe('var(--fd-palette-card)') // ref
    expect(flat.get('motion-easing')).toBe('cubic-bezier(0, 0, 0.58, 1)') // css
    expect(flat.get('accent')).toBe('#6D9EA5') // opaque colour
    expect(flat.get('accent-lift')).toEqual({ light: '0', dark: '0.131' }) // paired scalar
    expect(flat.get('palette-hairline')).toEqual({
      light: 'rgb(0 0 0 / 0.07)',
      dark: 'rgb(255 255 255 / 0.09)',
    }) // paired colour carrying alpha
  })

  it('pairs a token exactly when one of its facets differs by appearance', () => {
    const flat = new Map(tokenGroups.flatMap((group) => group.tokens))

    // Same hex on both sides, different alpha — still appearance-dependent.
    expect(flat.get('knob-border')).toEqual({
      light: 'rgb(0 0 0 / 0.12)',
      dark: 'rgb(0 0 0 / 0.42)',
    })
    expect(isDualValue(flat.get('knob-shadow') ?? '')).toBe(false)
  })

  it('emits every token the JSON declares, and no others', () => {
    const emitted = tokenGroups.flatMap((group) => group.tokens.map(([name]) => name))
    const declared = [
      ...rawTokens.map(({ name }) => name),
      ...Object.keys(raw.typography.roles).flatMap((role) =>
        ['size', 'weight', 'family', 'numeric'].map((facet) => `text-${role}-${facet}`),
      ),
    ]

    expect(new Set(emitted)).toEqual(new Set(declared))
    expect(emitted).toHaveLength(declared.length)
  })
})

describe('tokenGroups', () => {
  const flat = new Map(tokenGroups.flatMap((group) => group.tokens))
  const light = (name: string) => lightValue(flat.get(name) ?? '')
  const dark = (name: string) => darkValue(flat.get(name) ?? '')

  it('takes the celadon fill of SettingsAccent.celadon as the single accent knob', () => {
    expect(flat.get('accent')).toBe('#6D9EA5')
  })

  /**
   * The four literals of SettingsAccent.celadon are one hue at four lightnesses, so
   * every other accent token chains off `accent` rather than being spelled out.
   */
  it('derives the whole accent set from that one colour', () => {
    expect(light('accent-fill')).toBe(
      'oklch(from var(--fd-accent) calc(l + var(--fd-accent-lift)) c h)',
    )
    expect(light('accent-foreground')).toBe(
      'oklch(from var(--fd-accent-fill) calc(l + var(--fd-accent-contrast)) c h)',
    )
    expect(light('accent-wash')).toBe('color-mix(in srgb, var(--fd-accent-fill) 13%, transparent)')
    expect(light('accent-veil')).toBe('color-mix(in srgb, var(--fd-accent-fill) 8%, transparent)')
  })

  /**
   * The formulas stay appearance-independent so they can be re-evaluated wherever
   * `--fd-accent` is set; only the two lightness steps differ between appearances.
   */
  it('keeps the appearance difference in the two lightness steps alone', () => {
    expect(flat.get('accent-lift')).toEqual({ light: '0', dark: '0.131' })
    expect(flat.get('accent-contrast')).toEqual({ light: '-0.114', dark: '0.03' })
    expect(dark('accent-fill')).toBe(light('accent-fill'))
    expect(dark('accent-foreground')).toBe(light('accent-foreground'))
  })

  it('leaves derived tokens appearance-independent so one override retints both', () => {
    expect(dark('accent-wash')).toBe(light('accent-wash'))
    expect(dark('surface-card')).toBe(light('surface-card'))
  })

  it('cross-maps surfaces onto the palette exactly as SettingsSurfaces.standard does', () => {
    expect(light('surface-sidebar')).toBe('var(--fd-palette-card)')
    expect(light('surface-card')).toBe('var(--fd-palette-control)')
  })

  it('carries SettingsMetrics.standard', () => {
    expect(light('metric-card-radius')).toBe('14px')
    expect(light('metric-control-radius')).toBe('9px')
    expect(light('metric-row-inset')).toBe('18px')
    expect(light('metric-content-width')).toBe('720px')
    expect(light('metric-section-spacing')).toBe('20px')
  })

  it('carries the full SettingsPalette, both appearances', () => {
    expect(flat.get('palette-canvas')).toEqual({ light: '#FCFCFB', dark: '#161617' })
    expect(flat.get('palette-card')).toEqual({ light: '#F2F2EF', dark: '#232326' })
    expect(flat.get('palette-control')).toEqual({ light: '#FFFFFF', dark: '#2E2E31' })
    expect(flat.get('palette-field')).toEqual({ light: '#E9E9E5', dark: '#2A2A2D' })
    expect(flat.get('palette-ink')).toEqual({ light: '#1D1D1B', dark: '#F1F1EF' })
    expect(flat.get('palette-muted')).toEqual({ light: '#6C6C66', dark: '#9B9B96' })
    expect(flat.get('palette-faint')).toEqual({ light: '#91918A', dark: '#8A8A84' })
  })

  it('defines all four sub-tokens for each of the 17 typography roles', () => {
    const roles = new Set(
      [...flat.keys()]
        .filter((name) => name.startsWith('text-'))
        .map((name) => name.replace(/-(size|weight|family|numeric)$/, '')),
    )
    expect(roles.size).toBe(17)
    for (const role of roles) {
      for (const facet of ['size', 'weight', 'family', 'numeric']) {
        expect(flat.has(`${role}-${facet}`)).toBe(true)
      }
    }
  })

  it('keeps the literal type scale from SettingsTypography.standard', () => {
    expect(light('text-row-title-size')).toBe('13px')
    expect(light('text-row-caption-size')).toBe('11px')
    expect(light('text-page-title-size')).toBe('25px')
    expect(light('text-page-title-weight')).toBe('600')
    expect(light('text-brand-title-family')).toBe('var(--fd-font-rounded)')
    expect(light('text-tag-family')).toBe('var(--fd-font-monospaced)')
  })

  it('only sliderValue uses monospaced digits', () => {
    const tabular = [...flat.entries()]
      .filter(([name, value]) => name.endsWith('-numeric') && lightValue(value) === 'tabular-nums')
      .map(([name]) => name)
    expect(tabular).toEqual(['text-slider-value-numeric'])
  })

  it('carries the literal animation durations from the SwiftUI sources', () => {
    expect(light('motion-disclosure')).toBe('180ms')
    expect(light('motion-disclosure-offset')).toBe('-5px')
    expect(light('motion-hover')).toBe('120ms')
    expect(light('motion-selection')).toBe('160ms')
    expect(light('motion-page')).toBe('220ms')
  })

  it('never defines the same token twice', () => {
    const all = tokenGroups.flatMap((group) => group.tokens.map(([name]) => name))
    expect(all.length).toBe(new Set(all).size)
  })
})

describe('reducedMotionTokens', () => {
  it('shortens disclosure to the SettingsDependentRowsMotion reduced values', () => {
    const reduced = new Map(reducedMotionTokens)
    expect(reduced.get('motion-disclosure')).toBe('120ms')
    expect(reduced.get('motion-disclosure-offset')).toBe('0px')
    expect(reduced.get('motion-easing')).toBe('linear')
  })

  it('only overrides motion tokens that actually exist', () => {
    const known = new Set(tokenGroups.flatMap((group) => group.tokens.map(([name]) => name)))
    for (const [name] of reducedMotionTokens) expect(known.has(name)).toBe(true)
  })
})

describe('generated stylesheets', () => {
  const css = globalThemeCss()
  const shadow = themeStyles.cssText

  it('publishes every token under its public name', () => {
    for (const group of tokenGroups) {
      for (const [name, value] of group.tokens) {
        expect(css).toContain(`--fd-${name}: ${lightValue(value)};`)
      }
    }
  })

  /**
   * A var() is substituted at the element its declaration sits on, so publishing the
   * accent formulas on :root would freeze them there and setting --fd-accent deeper in
   * the tree could never move them.
   */
  it('keeps the accent formulas off :root so they can be re-derived at any depth', () => {
    const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('[data-fd-accent-scope]'))

    expect(rootBlock).toContain('--fd-accent:')
    expect(rootBlock).toContain('--fd-accent-lift:')
    expect(rootBlock).not.toContain('--fd-accent-fill:')
    expect(rootBlock).not.toContain('--fd-accent-foreground:')
    expect(rootBlock).not.toContain('--fd-accent-wash:')
  })

  it('publishes the accent formulas on an opt-in scope instead', () => {
    const scopeBlock = css.slice(css.indexOf('[data-fd-accent-scope]'))

    expect(scopeBlock).toContain('--fd-accent-fill:')
    expect(scopeBlock).toContain('--fd-accent-foreground:')
    expect(scopeBlock).toContain('--fd-accent-wash:')
    expect(scopeBlock).toContain('--fd-accent-veil:')
  })

  it('aliases every token privately with a public fallback', () => {
    for (const group of tokenGroups) {
      for (const [name] of group.tokens) {
        expect(shadow).toContain(`--_fd-${name}: var(--fd-${name},`)
      }
    }
  })

  it('rewrites cross-token references to the private namespace', () => {
    expect(shadow).toContain(
      '--_fd-surface-card: var(--fd-surface-card, var(--_fd-palette-control))',
    )
  })

  /**
   * Lightning CSS rewrites `light-dark()` into a guard-variable pair that is silently
   * wrong inside a custom property, so neither artifact may ever contain it.
   */
  it('never emits light-dark(), which minifiers corrupt inside custom properties', () => {
    expect(css).not.toContain('light-dark(')
    expect(shadow).not.toContain('light-dark(')
  })

  it('supplies dark values through a preference query in both artifacts', () => {
    expect(css).toContain('@media (prefers-color-scheme: dark)')
    expect(css).toContain('--fd-palette-canvas: #161617;')
    expect(shadow).toContain('@media (prefers-color-scheme: dark)')
    expect(shadow).toContain('--_fd-palette-canvas: var(--fd-palette-canvas, #161617);')
  })

  it('lets a subtree force one appearance', () => {
    expect(css).toContain("[data-fd-scheme='dark']")
    expect(css).toContain("[data-fd-scheme='light']")
  })

  it('only re-declares appearance-dependent tokens in the dark blocks', () => {
    const darkBlock = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'))
    expect(darkBlock).not.toContain('--fd-metric-row-inset')
    expect(darkBlock).not.toContain('--fd-text-row-title-size')
  })

  it('never leaks a private alias into the public stylesheet', () => {
    expect(css).not.toContain('--_fd-')
  })

  it('emits a reduced-motion block', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(shadow).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
