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

    expect(components).toBeGreaterThan(-1)
    expect(moreComponents).toBeGreaterThan(components)
    expect(preferences).toBeGreaterThan(moreComponents)
    expect(start).toBeGreaterThan(preferences)
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

  it('uses a quiet decorative backdrop without graph content', () => {
    const backdrop = landing.slice(
      landing.indexOf('<div id="landing-backdrop"'),
      landing.indexOf('<header class="site-header">'),
    )
    const backdropStyles = landingStyles.slice(
      landingStyles.indexOf('.landing-backdrop {'),
      landingStyles.indexOf('}', landingStyles.indexOf('.landing-backdrop {')),
    )

    expect(backdrop).toContain('class="landing-canvas-surface"')
    expect(backdrop).not.toContain('landing-canvas-world')
    expect(landing).not.toContain('landing-canvas-routes')
    expect(landing).not.toContain('landing-map-node')
    expect(backdropStyles).toContain('pointer-events: none')
  })

  it('keeps the backdrop surface neutral', () => {
    const surfaceStyles = landingStyles.slice(
      landingStyles.indexOf('.landing-canvas-surface {'),
      landingStyles.indexOf('}', landingStyles.indexOf('.landing-canvas-surface {')),
    )

    expect(surfaceStyles).not.toContain('radial-gradient')
    expect(surfaceStyles).not.toContain('--landing-honey')
    expect(surfaceStyles).not.toContain('--landing-sprout')
  })

  it('links navigation to each experience', () => {
    expect(landing).toContain('<a href="#components">Components</a>')
    expect(landing).toContain('<a href="#preferences" data-page="appearance">In Action</a>')
    expect(landing).toContain('<a href="#start">Start</a>')
  })

  it('offers direct paths from the live experience to platform code', () => {
    const start = landing.slice(landing.indexOf('id="start"'), landing.indexOf('</main>'))

    expect(start).toContain('FlowingDayControls')
    expect(start).toContain('@flowing-day/ui')
    expect(start).toContain('Swift Guide')
    expect(start).toContain('Web Guide')
    expect(start).not.toContain('Swift guide')
    expect(start).not.toContain('Web guide')
  })

  it('ends with a restrained copyright footer', () => {
    const footer = landing.slice(landing.indexOf('<footer class="site-footer">'))

    expect(footer).toContain('<small>Copyright © 2026 Cocoa</small>')
    expect(footer.indexOf('</footer>')).toBeLessThan(footer.indexOf('<script'))
  })

  it('does not advertise the canvas without a meaningful demonstration', () => {
    expect(landing).not.toContain('href="#canvas"')
    expect(landing).not.toContain('id="canvas-demo"')
    expect(landingStyles).not.toContain('.canvas-showcase')
  })

  it('lets mixed-row sections align separators with the leading text edge', () => {
    const start = landing.indexOf('id="preferences"')
    const end = landing.indexOf('id="start"')
    const preferences = landing.slice(start, end)

    expect(preferences).not.toContain('leading-edge="icon-text"')

    for (const marker of [
      'label="Switch Group"',
      '<fd-section label="Rows">',
      '<fd-section label="FlowingDayUI">',
    ]) {
      const sectionStart = landing.indexOf(marker)
      const section = landing.slice(sectionStart, landing.indexOf('</fd-section>', sectionStart))

      expect(sectionStart).toBeGreaterThan(-1)
      expect(section).not.toContain('leading-edge="icon-text"')
    }
  })
})
