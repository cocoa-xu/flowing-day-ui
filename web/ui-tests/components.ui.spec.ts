import { expect, test } from '@playwright/test'
import type { FdGraphCanvas } from '../packages/canvas/src/components/graph-canvas/fd-graph-canvas.js'
import type { FdAnyGraphNode } from '../packages/canvas/src/graph/model.js'
import {
  graphEdgeReference,
  graphElementReferenceKey,
  graphNodeReference,
  graphPortReference,
} from '../packages/canvas/src/graph/model.js'
import type { FdPopup } from '../packages/core/src/components/popup/fd-popup.js'
import type { FdSlider } from '../packages/core/src/components/slider/fd-slider.js'

declare global {
  interface Window {
    completedConnection: () => { readonly operation: { readonly kind: string } } | undefined
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/ui-tests/fixture.html')
  await page.locator('fd-graph-canvas').waitFor()
})

test('slider follows a trusted pointer drag and popup uses top-layer interaction', async ({
  page,
}) => {
  const slider = page.locator('#slider')
  const sliderBounds = await slider.boundingBox()
  if (!sliderBounds) throw new Error('missing slider bounds')

  await page.mouse.move(sliderBounds.x + 24, sliderBounds.y + sliderBounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    sliderBounds.x + sliderBounds.width - 24,
    sliderBounds.y + sliderBounds.height / 2,
    { steps: 8 },
  )
  await page.mouse.up()

  await expect
    .poll(() => slider.evaluate((element) => (element as FdSlider).value))
    .toBeGreaterThan(7)

  const popup = page.locator('#popup')
  await popup.locator('.button').click()
  await expect.poll(() => popup.evaluate((element) => (element as FdPopup).open)).toBe(true)
  await popup.locator('.option', { hasText: 'Compact' }).click()
  await expect.poll(() => popup.evaluate((element) => (element as FdPopup).value)).toBe('compact')
  await expect.poll(() => popup.evaluate((element) => (element as FdPopup).open)).toBe(false)
})

test('marquee selection updates before pointer release', async ({ page }) => {
  const source = page.locator('article[data-fd-graph-node="s:source"]')
  const bounds = await source.boundingBox()
  if (!bounds) throw new Error('missing source bounds')

  await page.mouse.move(bounds.x - 18, bounds.y - 18)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width + 18, bounds.y + bounds.height + 18, { steps: 4 })

  await expect
    .poll(() =>
      page
        .locator('#graph')
        .evaluate((element) => (element as FdGraphCanvas).selectedNodeIDs.has('source')),
    )
    .toBe(true)
  await expect(page.locator('.selection-marquee')).toBeVisible()
  await page.mouse.up()
  await expect(page.locator('.selection-marquee')).toBeHidden()
})

test('multi-node dragging and constrained resize update the local snapshot', async ({ page }) => {
  const graph = page.locator('#graph')
  await graph.evaluate(async (element) => {
    const canvas = element as FdGraphCanvas
    canvas.selectedNodeIDs = new Set(['source', 'target'])
    await canvas.updateComplete
  })
  const source = page.locator('article[data-fd-graph-node="s:source"]')
  const sourceBounds = await source.boundingBox()
  if (!sourceBounds) throw new Error('missing source bounds')

  await page.mouse.move(sourceBounds.x + 60, sourceBounds.y + 40)
  await page.mouse.down()
  await page.mouse.move(sourceBounds.x + 100, sourceBounds.y + 70, { steps: 6 })
  await page.mouse.up()

  await expect
    .poll(() =>
      graph.evaluate((element) =>
        (element as FdGraphCanvas).snapshot.nodes.map(({ frame }) => [frame.x, frame.y]),
      ),
    )
    .toEqual([
      [120, 130],
      [500, 290],
      [800, 80],
    ])

  await graph.evaluate(async (element) => {
    const canvas = element as FdGraphCanvas
    canvas.selectedNodeIDs = new Set(['source'])
    canvas.interactionConfiguration = {
      frameUpdates: 'local',
      snapping: { enabled: false },
      nodeSizeConstraints: ({ id }: FdAnyGraphNode) =>
        id === 'source' ? { maximumWidth: 220, maximumHeight: 120 } : undefined,
    }
    await canvas.updateComplete
  })
  const handle = page.locator('[data-fd-resize-handle="bottomRight"]')
  const handleBounds = await handle.boundingBox()
  if (!handleBounds) throw new Error('missing resize handle bounds')
  await page.mouse.move(
    handleBounds.x + handleBounds.width / 2,
    handleBounds.y + handleBounds.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(handleBounds.x + 220, handleBounds.y + 180, { steps: 8 })
  await page.mouse.up()

  await expect
    .poll(() =>
      graph.evaluate((element) => {
        const frame = (element as FdGraphCanvas).snapshot.nodes[0]?.frame
        if (!frame) throw new Error('missing source frame')
        return [Math.round(frame.width), Math.round(frame.height)]
      }),
    )
    .toEqual([220, 120])
})

test('wheel navigation, connection editing, minimap, and accessibility stay operable', async ({
  page,
}) => {
  const graph = page.locator('#graph')
  const initialViewport = await graph.evaluate(
    (element) => (element as FdGraphCanvas).viewport.transform,
  )
  const graphBounds = await graph.boundingBox()
  if (!graphBounds) throw new Error('missing graph bounds')
  await page.mouse.move(graphBounds.x + 500, graphBounds.y + 350)
  await page.mouse.wheel(24, 18)
  await expect
    .poll(() => graph.evaluate((element) => (element as FdGraphCanvas).viewport.transform.offset.x))
    .not.toBe(initialViewport.offset.x)

  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -60)
  await page.keyboard.up('Control')
  await expect
    .poll(() => graph.evaluate((element) => (element as FdGraphCanvas).viewport.transform.zoom))
    .toBeGreaterThan(initialViewport.zoom)

  await graph.evaluate(async (element) => {
    const canvas = element as FdGraphCanvas
    canvas.request = {
      id: 'connection-test-reset',
      action: {
        kind: 'anchor',
        worldPoint: { x: 500, y: 350 },
        viewportPoint: { x: 500, y: 350 },
        zoom: 1,
      },
      animated: false,
    }
    await canvas.updateComplete
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
  const sourcePort = page.locator('[data-fd-graph-node="s:source"][data-fd-graph-port="s:output"]')
  const targetPort = page.locator('[data-fd-graph-node="s:target"][data-fd-graph-port="s:input"]')
  const sourcePortBounds = await sourcePort.boundingBox()
  const targetPortBounds = await targetPort.boundingBox()
  if (!sourcePortBounds || !targetPortBounds) throw new Error('missing port bounds')
  await page.mouse.move(
    sourcePortBounds.x + sourcePortBounds.width / 2,
    sourcePortBounds.y + sourcePortBounds.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    targetPortBounds.x + targetPortBounds.width / 2,
    targetPortBounds.y + targetPortBounds.height / 2,
    { steps: 8 },
  )
  await page.mouse.up()
  await expect
    .poll(() => page.evaluate(() => window.completedConnection()?.operation.kind))
    .toBe('create')

  await sourcePort.click()
  await expect
    .poll(() => graph.evaluate((element) => (element as FdGraphCanvas).selectedElements))
    .toEqual([graphPortReference('source', 'output')])

  const resetGraphBounds = await graph.boundingBox()
  if (!resetGraphBounds) throw new Error('missing reset graph bounds')
  await page.keyboard.down('Shift')
  await page.mouse.click(resetGraphBounds.x + 360, resetGraphBounds.y + 228)
  await page.keyboard.up('Shift')
  await expect
    .poll(() => graph.evaluate((element) => (element as FdGraphCanvas).selectedElements))
    .toEqual([graphPortReference('source', 'output'), graphEdgeReference('connection')])

  const surface = page.locator('.accessibility-surface')
  await graph.evaluate(async (element) => {
    const canvas = element as FdGraphCanvas
    canvas.focusedElement = { kind: 'node', nodeID: 'source' }
    await canvas.updateComplete
  })
  await surface.focus()
  await page.keyboard.down('Alt')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.up('Alt')
  await expect(surface).toHaveAttribute(
    'aria-activedescendant',
    new RegExp(encodeURIComponent(graphElementReferenceKey(graphNodeReference('target')))),
  )

  const miniMap = page.locator('fd-graph-minimap')
  const offsetBeforeMiniMap = await graph.evaluate(
    (element) => (element as FdGraphCanvas).viewport.transform.offset,
  )
  const miniMapBounds = await miniMap.boundingBox()
  if (!miniMapBounds) throw new Error('missing minimap bounds')
  await page.mouse.click(miniMapBounds.x + miniMapBounds.width - 16, miniMapBounds.y + 16)
  await expect
    .poll(() => graph.evaluate((element) => (element as FdGraphCanvas).viewport.transform.offset))
    .not.toEqual(offsetBeforeMiniMap)
})
