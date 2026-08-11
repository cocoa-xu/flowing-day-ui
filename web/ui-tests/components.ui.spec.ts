import { expect, test } from '@playwright/test'
import type { FdGraphCanvas } from '../packages/canvas/src/components/graph-canvas/fd-graph-canvas.js'
import type { FdAnyGraphNode } from '../packages/canvas/src/graph/model.js'
import {
  graphEdgeReference,
  graphElementReferenceKey,
  graphNodeReference,
  graphPortReference,
} from '../packages/canvas/src/graph/model.js'
import type { FdCheckbox } from '../packages/core/src/components/checkbox/fd-checkbox.js'
import type { FdConnectedSegmentedControl } from '../packages/core/src/components/connected-segmented-control/fd-connected-segmented-control.js'
import type { FdDialog } from '../packages/core/src/components/dialog/fd-dialog.js'
import type { FdDisclosure } from '../packages/core/src/components/disclosure/fd-disclosure.js'
import type { FdIconButton } from '../packages/core/src/components/icon-button/fd-icon-button.js'
import type { FdMultiSelect } from '../packages/core/src/components/multi-select/fd-multi-select.js'
import type { FdPopover } from '../packages/core/src/components/popover/fd-popover.js'
import type { FdPopup } from '../packages/core/src/components/popup/fd-popup.js'
import type { FdProgress } from '../packages/core/src/components/progress/fd-progress.js'
import type { FdSearchPicker } from '../packages/core/src/components/search-picker/fd-search-picker.js'
import type { FdSecureField } from '../packages/core/src/components/secure-field/fd-secure-field.js'
import type { FdSlider } from '../packages/core/src/components/slider/fd-slider.js'
import type { FdTabs } from '../packages/core/src/components/tabs/fd-tabs.js'
import type { FdTextArea } from '../packages/core/src/components/text-area/fd-text-area.js'
import type { FdTextField } from '../packages/core/src/components/text-field/fd-text-field.js'
import type { FdTooltip } from '../packages/core/src/components/tooltip/fd-tooltip.js'

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

test('field, icon button, and progress primitives retain native interaction', async ({ page }) => {
  const textField = page.locator('#text-field')
  await textField.locator('input').fill('Flowing Day')
  await expect
    .poll(() => textField.evaluate((element) => (element as FdTextField).value))
    .toBe('Flowing Day')

  const secureField = page.locator('#secure-field')
  await expect(secureField.locator('input')).toHaveAttribute('type', 'password')
  await secureField.locator('input').fill('private')
  await expect
    .poll(() => secureField.evaluate((element) => (element as FdSecureField).value))
    .toBe('private')

  const textArea = page.locator('#text-area')
  await textArea.locator('textarea').fill('First\nSecond')
  await expect
    .poll(() => textArea.evaluate((element) => (element as FdTextArea).value))
    .toBe('First\nSecond')

  const pinButton = page.locator('#pin-button')
  await pinButton.locator('button').click()
  await expect
    .poll(() => pinButton.evaluate((element) => (element as FdIconButton).selected))
    .toBe(true)
  await expect(pinButton.locator('button')).toHaveAttribute('aria-pressed', 'true')

  const progress = page.locator('#progress')
  await expect(progress).toHaveAttribute('role', 'progressbar')
  await expect.poll(() => progress.evaluate((element) => (element as FdProgress).value)).toBe(0.64)
})

test('selection, disclosure, and search primitives retain native interaction', async ({ page }) => {
  const checkbox = page.locator('#checkbox')
  await checkbox.locator('button').click()
  await expect
    .poll(() => checkbox.evaluate((element) => (element as FdCheckbox).checked))
    .toBe(true)

  const multiSelect = page.locator('#multi-select')
  await multiSelect.getByRole('checkbox', { name: 'Display' }).click()
  await expect
    .poll(() => multiSelect.evaluate((element) => (element as FdMultiSelect).values))
    .toEqual(['usb', 'display'])

  const segmented = page.locator('#segmented')
  await segmented.getByRole('radio', { name: 'Select' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect
    .poll(() => segmented.evaluate((element) => (element as FdConnectedSegmentedControl).value))
    .toBe('pan')

  const disclosure = page.locator('#disclosure')
  await disclosure.locator('button').click()
  await expect
    .poll(() => disclosure.evaluate((element) => (element as FdDisclosure).expanded))
    .toBe(true)
  await expect(disclosure.locator('p')).toBeVisible()

  const searchPicker = page.locator('#search-picker')
  await searchPicker.locator('input').fill('dub')
  await searchPicker.getByRole('option', { name: 'Dublin' }).click()
  await expect
    .poll(() => searchPicker.evaluate((element) => (element as FdSearchPicker).value))
    .toBe('dublin')
})

test('tabs provide native content navigation by pointer and keyboard', async ({ page }) => {
  const tabs = page.locator('#tabs')
  const overview = tabs.getByRole('tabpanel', { name: 'Overview' })
  const details = tabs.getByRole('tabpanel', { name: 'Details' })

  await expect(overview).toBeVisible()
  await expect(details).toBeHidden()
  await tabs.getByRole('tab', { name: 'Details' }).click()
  await expect.poll(() => tabs.evaluate((element) => (element as FdTabs).value)).toBe('details')
  await expect(overview).toBeHidden()
  await expect(details).toBeVisible()

  await tabs.getByRole('tab', { name: 'Details' }).focus()
  await page.keyboard.press('Home')
  await expect.poll(() => tabs.evaluate((element) => (element as FdTabs).value)).toBe('overview')
  await expect(tabs.getByRole('tab', { name: 'Overview' })).toBeFocused()

  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => tabs.evaluate((element) => (element as FdTabs).value)).toBe('details')
  await expect(tabs.getByRole('tab', { name: 'Details' })).toBeFocused()
})

test('dialog uses native modal focus, cancellation, and focus restoration', async ({ page }) => {
  const trigger = page.locator('#dialog-trigger')
  const dialog = page.locator('#dialog')

  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => dialog.evaluate((element) => (element as FdDialog).open)).toBe(true)
  await expect(dialog.getByRole('dialog')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect.poll(() => dialog.evaluate((element) => (element as FdDialog).open)).toBe(false)
  await expect(trigger).toBeFocused()
})

test('popover and tooltip preserve top-layer browser interaction', async ({ page }) => {
  const popover = page.locator('#popover')
  const popoverTrigger = page.locator('#popover-trigger')
  await popoverTrigger.click()
  await expect.poll(() => popover.evaluate((element) => (element as FdPopover).open)).toBe(true)
  await expect(popover.getByRole('dialog')).toBeVisible()
  await expect(popoverTrigger).toHaveAttribute('aria-expanded', 'true')

  await page.keyboard.press('Escape')
  await expect.poll(() => popover.evaluate((element) => (element as FdPopover).open)).toBe(false)
  await expect(popoverTrigger).toHaveAttribute('aria-expanded', 'false')

  await popoverTrigger.click()
  await expect.poll(() => popover.evaluate((element) => (element as FdPopover).open)).toBe(true)
  await page.mouse.click(1, 1)
  await expect.poll(() => popover.evaluate((element) => (element as FdPopover).open)).toBe(false)

  const tooltip = page.locator('#tooltip')
  const tooltipTrigger = page.locator('#tooltip-trigger')
  await tooltipTrigger.hover()
  await expect.poll(() => tooltip.evaluate((element) => (element as FdTooltip).open)).toBe(true)
  await expect(tooltip.getByRole('tooltip')).toBeVisible()
  await expect(tooltip.getByRole('tooltip')).toHaveCSS('pointer-events', 'none')
  await expect(tooltipTrigger).toHaveAttribute('aria-describedby', /fd-tooltip-/)

  await page.keyboard.press('Escape')
  await expect.poll(() => tooltip.evaluate((element) => (element as FdTooltip).open)).toBe(false)
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
  await graph.evaluate(async (element) => {
    const canvas = element as FdGraphCanvas
    canvas.request = {
      id: 'minimap-test-zoom',
      action: {
        kind: 'anchor',
        worldPoint: { x: 500, y: 250 },
        viewportPoint: { x: 500, y: 350 },
        zoom: 2,
      },
      animated: false,
    }
    await canvas.updateComplete
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
  const offsetBeforeMiniMap = await graph.evaluate(
    (element) => (element as FdGraphCanvas).viewport.transform.offset,
  )
  const miniMapBounds = await miniMap.boundingBox()
  if (!miniMapBounds) throw new Error('missing minimap bounds')
  await page.mouse.click(miniMapBounds.x + 16, miniMapBounds.y + 16)
  await expect
    .poll(() => graph.evaluate((element) => (element as FdGraphCanvas).viewport.transform.offset))
    .not.toEqual(offsetBeforeMiniMap)
})
