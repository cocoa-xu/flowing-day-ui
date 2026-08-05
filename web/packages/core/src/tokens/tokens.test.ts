import { describe, expect, it } from 'vitest'
import { globalThemeCss, themeStyles } from './theme.js'
import {
  darkValue,
  dynamic,
  fontWeights,
  lightValue,
  reducedMotionTokens,
  srgb,
  tokenGroups,
  translucent,
} from './tokens.js'

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

describe('tokenGroups', () => {
  const flat = new Map(tokenGroups.flatMap((group) => group.tokens))
  const light = (name: string) => lightValue(flat.get(name) ?? '')
  const dark = (name: string) => darkValue(flat.get(name) ?? '')

  it('carries the celadon accent from SettingsAccent.celadon', () => {
    expect(flat.get('accent-fill')).toEqual({ light: '#6D9EA5', dark: '#93C8CF' })
    expect(flat.get('accent-foreground')).toEqual({ light: '#4E7B82', dark: '#9FD1D8' })
  })

  it('derives wash and veil from fill at the Swift opacities', () => {
    expect(light('accent-wash')).toBe('color-mix(in srgb, var(--fd-accent-fill) 13%, transparent)')
    expect(light('accent-veil')).toBe('color-mix(in srgb, var(--fd-accent-fill) 8%, transparent)')
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
