import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/docs/')
  await page.locator('#window').waitFor()
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
