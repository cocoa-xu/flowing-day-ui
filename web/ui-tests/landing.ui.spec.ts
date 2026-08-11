import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/docs/')
  await page.locator('#canvas-demo').waitFor()
})

test('canvas presentation expands in place and returns to the page', async ({ page }) => {
  const showcase = page.locator('.canvas-showcase')
  const frame = page.locator('.canvas-frame')
  const presentationButton = page.locator('#canvas-presentation')

  await showcase.scrollIntoViewIfNeeded()
  await expect(showcase).toHaveAttribute('data-canvas-active', '')
  await expect(presentationButton).toHaveAttribute('aria-expanded', 'false')
  await expect(presentationButton).toHaveAttribute('aria-label', 'Expand Canvas')
  await expect(presentationButton).toHaveAttribute('aria-controls', 'canvas-demo')

  const viewport = page.viewportSize()
  if (!viewport) throw new Error('missing viewport size')
  const embeddedFrame = await frame.boundingBox()
  if (!embeddedFrame) throw new Error('missing embedded canvas frame')
  expect(embeddedFrame.width).toBeLessThan(viewport.width)
  expect(embeddedFrame.height).toBeLessThan(viewport.height)
  await expect(frame).toHaveCSS('border-top-width', '0px')

  await presentationButton.click()

  await expect(showcase).toHaveAttribute('data-canvas-expanded', '')
  await expect(presentationButton).toHaveAttribute('aria-expanded', 'true')
  await expect(presentationButton).toHaveAttribute('aria-label', 'Collapse Canvas')
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden')
  const expandedScrollPosition = await page.evaluate(() => window.scrollY)

  const expandedFrame = await frame.boundingBox()
  if (!expandedFrame) throw new Error('missing expanded canvas frame')
  expect(expandedFrame.x).toBeCloseTo(0, 0)
  expect(expandedFrame.y).toBeCloseTo(0, 0)
  expect(expandedFrame.width).toBeCloseTo(viewport.width, 0)
  expect(expandedFrame.height).toBeCloseTo(viewport.height, 0)

  await page.keyboard.press('Escape')

  await expect(showcase).not.toHaveAttribute('data-canvas-expanded', '')
  await expect(presentationButton).toHaveAttribute('aria-expanded', 'false')
  await expect(presentationButton).toHaveAttribute('aria-label', 'Expand Canvas')
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('')
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeCloseTo(expandedScrollPosition, 0)
})
