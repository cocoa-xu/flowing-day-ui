import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/docs/')
  await page.locator('#window').waitFor()
})

test('landing favicon is discoverable and loadable', async ({ page, request }) => {
  const favicon = page.locator('link[rel="icon"]')

  await expect(favicon).toHaveAttribute('href', './src/favicon.svg')
  await expect(favicon).toHaveAttribute('type', 'image/svg+xml')
  await expect(favicon).toHaveAttribute('sizes', 'any')

  const response = await request.get('/docs/src/favicon.svg')
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('image/svg+xml')
})

test('landing detail overlays stay anchored to their controls', async ({ page }) => {
  const detailRow = page.locator('fd-row[label="A Closer Look"]')
  const tooltip = detailRow.locator('fd-tooltip')
  const tooltipButton = tooltip.locator('fd-icon-button')
  const tooltipSurface = tooltip.locator('.surface')

  await detailRow.scrollIntoViewIfNeeded()
  await tooltipButton.click()
  await expect(tooltipSurface).toBeVisible()
  await expect(tooltipSurface).toContainText('A short explanation, without interrupting your work.')

  const viewport = page.viewportSize()
  const triggerBounds = await tooltipButton.boundingBox()
  const surfaceBounds = await tooltipSurface.boundingBox()
  if (!viewport || !triggerBounds || !surfaceBounds) throw new Error('missing overlay geometry')

  expect(surfaceBounds.x).toBeGreaterThanOrEqual(8)
  expect(surfaceBounds.x + surfaceBounds.width).toBeLessThanOrEqual(viewport.width - 8)
  expect(surfaceBounds.y).toBeGreaterThanOrEqual(8)
  expect(surfaceBounds.y + surfaceBounds.height).toBeLessThanOrEqual(triggerBounds.y - 7)
})

test('landing footer remains restrained at narrow widths', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const footer = page.locator('.site-footer')

  await footer.scrollIntoViewIfNeeded()
  await expect(footer).toBeVisible()
  await expect(footer).toHaveText('Copyright © 2026 Cocoa')
  await expect(footer).toHaveCSS('font-size', '11px')
  await expect(footer).toHaveCSS('border-top-width', '1px')
  const bounds = await footer.boundingBox()
  if (!bounds) throw new Error('missing footer geometry')
  expect(bounds.x).toBeGreaterThanOrEqual(16)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(374)
})
