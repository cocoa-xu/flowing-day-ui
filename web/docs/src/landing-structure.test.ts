import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const landing = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

describe('landing page structure', () => {
  it('introduces components before composed experiences', () => {
    const components = landing.indexOf('id="components"')
    const preferences = landing.indexOf('id="preferences"')
    const canvas = landing.indexOf('id="canvas"')

    expect(components).toBeGreaterThan(-1)
    expect(preferences).toBeGreaterThan(components)
    expect(canvas).toBeGreaterThan(preferences)
  })

  it('uses live controls in the first component composition', () => {
    const start = landing.indexOf('id="components"')
    const end = landing.indexOf('id="preferences"')
    const composition = landing.slice(start, end)

    expect(composition).toContain('<fd-connected-segmented-row')
    expect(composition).toContain('<fd-popup-row')
    expect(composition).toContain('<fd-slider-row')
    expect(composition).toContain('<fd-switch-row')
    expect(composition).toContain('<fd-button-row')
  })

  it('links navigation to each experience', () => {
    expect(landing).toContain('<a href="#components">Components</a>')
    expect(landing).toContain('<a href="#preferences" data-page="appearance">Preferences</a>')
    expect(landing).toContain('<a href="#canvas">Canvas</a>')
  })
})
