import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const landing = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const landingStyles = readFileSync(new URL('./landing.css', import.meta.url), 'utf8')

describe('landing page structure', () => {
  it('introduces components before composed experiences', () => {
    const components = landing.indexOf('id="components"')
    const moreComponents = landing.indexOf('id="more-components"')
    const preferences = landing.indexOf('id="preferences"')
    const start = landing.indexOf('id="start"')
    const canvas = landing.indexOf('id="canvas"')

    expect(components).toBeGreaterThan(-1)
    expect(moreComponents).toBeGreaterThan(components)
    expect(preferences).toBeGreaterThan(moreComponents)
    expect(start).toBeGreaterThan(preferences)
    expect(canvas).toBeGreaterThan(start)
  })

  it('uses live controls in the first component composition', () => {
    const start = landing.indexOf('id="components"')
    const end = landing.indexOf('id="more-components"')
    const composition = landing.slice(start, end)

    expect(composition).toContain('<fd-connected-segmented-row')
    expect(composition).toContain('<fd-popup-row')
    expect(composition).toContain('<fd-slider-row')
    expect(composition).toContain('<fd-switch-row')
    expect(composition).toContain('<fd-button-row')
    expect(composition).toContain('<fd-checkbox')
    expect(composition).toContain('<fd-progress')
    expect(composition).toContain('<fd-text-field')
    expect(composition).not.toContain('id="hero-accent"')
  })

  it('continues discovery with a second set of live controls', () => {
    const start = landing.indexOf('id="more-components"')
    const end = landing.indexOf('id="preferences"')
    const composition = landing.slice(start, end)

    expect(composition).toContain('<fd-search-picker-row')
    expect(composition).toContain('<fd-multi-select-row')
    expect(composition).toContain('<fd-expandable-row')
    expect(composition).toContain('<fd-selectable-tag')
    expect(composition).toContain('<fd-tabs')
    expect(composition).toContain('<fd-tooltip')
    expect(composition).toContain('<fd-popover')
    expect(composition).toContain('href="#preferences"')
  })

  it('keeps variable-height discovery cards in document flow', () => {
    const secondaryStyles = landingStyles.slice(
      landingStyles.indexOf('.component-composition-secondary {'),
      landingStyles.indexOf(
        '.component-card-search {',
        landingStyles.indexOf('.component-composition-secondary {'),
      ),
    )

    expect(secondaryStyles).toContain('display: grid')
    expect(secondaryStyles).toContain('position: relative')
    expect(secondaryStyles).toContain('inset: auto')
  })

  it('starts the decorative graph with reusable controls', () => {
    const backdrop = landing.slice(
      landing.indexOf('class="landing-canvas-world"'),
      landing.indexOf('</fd-canvas>'),
    )

    expect(backdrop.indexOf('Controls')).toBeGreaterThan(-1)
    expect(backdrop.indexOf('Preferences')).toBeGreaterThan(backdrop.indexOf('Controls'))
  })

  it('keeps the decorative backdrop out of pointer interaction', () => {
    const backdrop = landing.slice(
      landing.indexOf('<fd-canvas\n      id="landing-backdrop"'),
      landing.indexOf('>', landing.indexOf('id="landing-backdrop"')),
    )
    const backdropStyles = landingStyles.slice(
      landingStyles.indexOf('.landing-backdrop {'),
      landingStyles.indexOf('}', landingStyles.indexOf('.landing-backdrop {')),
    )

    expect(backdrop).not.toContain('interaction-mode')
    expect(backdrop).not.toContain('allows-page-scroll')
    expect(backdropStyles).toContain('pointer-events: none')
  })

  it('keeps the backdrop neutral and reserves color for small markers', () => {
    const surfaceStyles = landingStyles.slice(
      landingStyles.indexOf('.landing-canvas-surface {'),
      landingStyles.indexOf('}', landingStyles.indexOf('.landing-canvas-surface {')),
    )
    const markerStyles = landingStyles.slice(
      landingStyles.indexOf('.landing-map-marker {'),
      landingStyles.indexOf('}', landingStyles.indexOf('.landing-map-marker {')),
    )

    expect(surfaceStyles).not.toContain('radial-gradient')
    expect(surfaceStyles).not.toContain('--landing-honey')
    expect(surfaceStyles).not.toContain('--landing-sprout')
    expect(markerStyles).toContain('--map-accent')
  })

  it('links navigation to each experience', () => {
    expect(landing).toContain('<a href="#components">Components</a>')
    expect(landing).toContain('<a href="#preferences" data-page="appearance">Preferences</a>')
    expect(landing).toContain('<a href="#start">Start</a>')
    expect(landing).toContain('<a href="#canvas">Canvas</a>')
  })

  it('offers direct paths from the live experience to platform code', () => {
    const start = landing.slice(landing.indexOf('id="start"'), landing.indexOf('id="canvas"'))

    expect(start).toContain('FlowingDayControls')
    expect(start).toContain('@flowing-day/ui')
    expect(start).toContain('Swift guide')
    expect(start).toContain('Web guide')
  })
})
