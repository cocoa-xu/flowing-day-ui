import { type FdCanvas, FdCanvasGridLevels } from '@flowing-day/canvas'
import type {
  FdColorPickerRow,
  FdDependentRows,
  FdExpandableRow,
  FdPopupRow,
  FdPreferencesWindow,
  FdSegmentedRow,
  FdSelectableTag,
  FdSliderRow,
  FdSwitchRow,
  FdValueRow,
  NamedAccentName,
} from '@flowing-day/ui'
import { namedAccentFamilies, namedAccents } from '@flowing-day/ui'
import {
  type CanvasPresentationMode,
  canvasObserverThresholds,
  canvasPresentation,
  shouldActivateCanvas,
  toggledCanvasPresentationMode,
} from './canvas-presentation.js'
import { makeMovableByBackground } from './drag.js'
import { resolveScheme } from './scheme.js'
import { installTheme, registerIcons } from './shared.js'

installTheme()
registerIcons()

const canvasDemo = document.querySelector<FdCanvas>('#canvas-demo')
const canvasShowcase = document.querySelector<HTMLElement>('.canvas-showcase')
const canvasFrame = document.querySelector<HTMLElement>('.canvas-frame')
const canvasGrid = document.querySelector<HTMLElement>('.canvas-grid')
const canvasZoomValue = document.querySelector<HTMLOutputElement>('#canvas-zoom-value')
const canvasPresentationButton = document.querySelector<HTMLButtonElement>('#canvas-presentation')
const canvasContentRect = { x: 40, y: 40, width: 1040, height: 440 }
let canvasPresentationMode: CanvasPresentationMode = 'embedded'
let canvasFrameAnimation: Animation | undefined
let canvasScrollPosition = { x: 0, y: 0 }
let bodyOverflow = ''
let bodyMinimumHeight = ''

function canvasFrameSnapshot(): { rect: DOMRect; borderRadius: string } | undefined {
  if (!canvasFrame) return undefined
  return {
    rect: canvasFrame.getBoundingClientRect(),
    borderRadius: getComputedStyle(canvasFrame).borderRadius,
  }
}

function animateCanvasFrame(from: { rect: DOMRect; borderRadius: string } | undefined): void {
  if (!canvasFrame || !from || matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const to = canvasFrameSnapshot()
  if (!to || to.rect.width <= 0 || to.rect.height <= 0) return

  canvasFrameAnimation = canvasFrame.animate(
    [
      {
        transform: `translate(${from.rect.x - to.rect.x}px, ${from.rect.y - to.rect.y}px) scale(${from.rect.width / to.rect.width}, ${from.rect.height / to.rect.height})`,
        transformOrigin: 'top left',
        borderRadius: from.borderRadius,
      },
      {
        transform: 'none',
        transformOrigin: 'top left',
        borderRadius: to.borderRadius,
      },
    ],
    { duration: 260, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)' },
  )
}

function setCanvasPresentationMode(mode: CanvasPresentationMode): void {
  if (!canvasShowcase || !canvasPresentationButton || mode === canvasPresentationMode) return

  const frameBeforeChange = canvasFrameSnapshot()
  canvasFrameAnimation?.cancel()
  canvasPresentationMode = mode
  const presentation = canvasPresentation(mode)

  canvasPresentationButton.ariaExpanded = `${presentation.expanded}`
  canvasPresentationButton.ariaLabel = presentation.actionLabel
  canvasPresentationButton.title = presentation.actionLabel

  if (presentation.expanded) {
    canvasScrollPosition = { x: window.scrollX, y: window.scrollY }
    bodyOverflow = document.body.style.overflow
    bodyMinimumHeight = document.body.style.minHeight
    document.body.style.minHeight = `${document.documentElement.scrollHeight}px`
    document.body.style.overflow = 'hidden'
    canvasShowcase.toggleAttribute('data-canvas-expanded', true)
    canvasShowcase.toggleAttribute('data-canvas-active', true)
    animateCanvasFrame(frameBeforeChange)
    return
  }

  canvasShowcase.toggleAttribute('data-canvas-expanded', false)
  document.body.style.minHeight = bodyMinimumHeight
  document.body.style.overflow = bodyOverflow
  const scrollBehavior = document.documentElement.style.scrollBehavior
  document.documentElement.style.scrollBehavior = 'auto'
  window.scrollTo(canvasScrollPosition.x, canvasScrollPosition.y)
  document.documentElement.style.scrollBehavior = scrollBehavior
  animateCanvasFrame(frameBeforeChange)
}

function updateCanvasPresentation(canvas: FdCanvas): void {
  const { transform } = canvas.viewport
  const levels = new FdCanvasGridLevels(24, transform.zoom, 18, 2)
  canvasGrid?.style.setProperty('--grid-x', `${transform.offset.x}px`)
  canvasGrid?.style.setProperty('--grid-y', `${transform.offset.y}px`)
  canvasGrid?.style.setProperty('--grid-coarse-spacing', `${levels.coarse.spacing}px`)
  canvasGrid?.style.setProperty('--grid-coarse-opacity', `${levels.coarse.opacity}`)
  canvasGrid?.style.setProperty('--grid-fine-spacing', `${levels.fine.spacing}px`)
  canvasGrid?.style.setProperty('--grid-fine-opacity', `${levels.fine.opacity}`)
  if (canvasZoomValue) canvasZoomValue.value = `${Math.round(transform.zoom * 100)}%`
}

if (canvasDemo) {
  canvasDemo.contentRect = canvasContentRect
  canvasDemo.configuration = {
    initialZoom: 0.8,
    focusedZoom: 1.3,
    minimumZoom: 0.25,
    maximumZoom: 4,
  }
  canvasDemo.addEventListener('fd-viewport-change', () => updateCanvasPresentation(canvasDemo))
  void canvasDemo.updateComplete.then(() => {
    canvasDemo.fitRect(canvasContentRect, 72, 0.92, { animated: false })
    updateCanvasPresentation(canvasDemo)
  })
}

if (canvasShowcase) {
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        canvasShowcase.toggleAttribute(
          'data-canvas-active',
          entry
            ? shouldActivateCanvas(
                entry.isIntersecting,
                entry.intersectionRect.height,
                entry.rootBounds?.height ?? window.innerHeight,
              )
            : false,
        )
      },
      { threshold: canvasObserverThresholds },
    )
    observer.observe(canvasShowcase)
  } else {
    canvasShowcase.toggleAttribute('data-canvas-active', true)
  }
}

document.querySelector<HTMLButtonElement>('#canvas-zoom-out')?.addEventListener('click', () => {
  if (canvasDemo) canvasDemo.setZoom(canvasDemo.viewport.transform.zoom / 1.2, { animated: true })
})

document.querySelector<HTMLButtonElement>('#canvas-zoom-in')?.addEventListener('click', () => {
  if (canvasDemo) canvasDemo.setZoom(canvasDemo.viewport.transform.zoom * 1.2, { animated: true })
})

document.querySelector<HTMLButtonElement>('#canvas-fit')?.addEventListener('click', () => {
  canvasDemo?.fitRect(canvasContentRect, 72, 0.92, { animated: true })
})

canvasPresentationButton?.addEventListener('click', () => {
  setCanvasPresentationMode(toggledCanvasPresentationMode(canvasPresentationMode))
})

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || canvasPresentationMode !== 'expanded') return
  event.preventDefault()
  setCanvasPresentationMode('embedded')
  canvasPresentationButton?.focus()
})

const preferencesWindow = document.querySelector<FdPreferencesWindow>('#window')
const preferencesAppIcon = document.querySelector<HTMLImageElement>('#preferences-app-icon')
const brandAppIcon = document.querySelector<HTMLImageElement>('#brand-app-icon')
const canvasAppIcon = document.querySelector<HTMLImageElement>('#canvas-app-icon')
const lightAppIcon = new URL('./app-icon.svg', import.meta.url).href
const darkAppIcon = new URL('./app-icon-dark.svg', import.meta.url).href

if (preferencesWindow) makeMovableByBackground(preferencesWindow)

/**
 * Every control in this window restyles the window it lives in. Each one writes design
 * tokens onto the window element, so the change reaches the shadow root of every
 * component below without any of them knowing about it — the same propagation
 * `.flowingAccent(_:)` and its siblings give a SwiftUI subtree.
 */
const set = (token: string, value: string) => preferencesWindow?.style.setProperty(token, value)

/** Wires one segmented row and applies its initial value, so markup and page agree. */
function onSegment(id: string, apply: (value: string) => void): void {
  const row = document.querySelector<FdSegmentedRow>(`#${id}`)
  if (!row) return
  row.addEventListener('fd-change', (event) => {
    if (event.detail.value) apply(event.detail.value)
  })
  if (row.value) apply(row.value)
}

/** The same, for the controls that report a number rather than a string. */
function onSlider(id: string, apply: (value: number) => void): void {
  const row = document.querySelector<FdSliderRow>(`#${id}`)
  if (!row) return
  row.addEventListener('fd-change', (event) => {
    if (event.detail.valueAsNumber !== undefined) apply(event.detail.valueAsNumber)
  })
  apply(row.value)
}

/**
 * One colour each. Fill, foreground, wash and veil derive from it, in both
 * appearances — an accent is a set, not four values to keep in step by hand.
 */
const accentTitle = (name: NamedAccentName): string =>
  `${name[0]?.toUpperCase() ?? ''}${name.slice(1)}`

const isNamedAccent = (value: string): value is NamedAccentName =>
  Object.hasOwn(namedAccents, value)

const landingAccentNames = [
  'petal',
  'apricot',
  'honey',
  'leaf',
  'seafoam',
  'brook',
  'wisteria',
] as const satisfies readonly NamedAccentName[]

function populateNamedAccents(): void {
  const popup = document.querySelector<FdPopupRow>('#accent')

  if (popup) {
    popup.options = [
      ...landingAccentNames.map((name) => ({
        value: name,
        label: accentTitle(name),
        accent: namedAccents[name],
      })),
      { value: 'all', label: 'All Colors…' },
      { value: 'custom', label: 'Custom', accent: '#6d9ea5' },
    ]
  }

  for (const id of ['appearance-accent-chips', 'accent-chips']) {
    const grid = document.querySelector<HTMLElement>(`#${id}`)
    if (grid) {
      for (const names of Object.values(namedAccentFamilies)) {
        for (const name of names) {
          const value = namedAccents[name]
          const title = accentTitle(name)
          const chip = document.createElement('fd-chip')
          chip.value = name
          chip.textContent = title
          chip.style.setProperty('--fd-accent', value)
          grid.append(chip)
        }
      }
    }
  }
}

populateNamedAccents()

const CORNERS: Record<string, { window: string; card: string; control: string }> = {
  soft: { window: '18px', card: '14px', control: '9px' },
  medium: { window: '12px', card: '9px', control: '6px' },
  sharp: { window: '4px', card: '3px', control: '3px' },
}

const DENSITY: Record<string, { inset: string; section: string }> = {
  compact: { inset: '12px', section: '14px' },
  default: { inset: '18px', section: '20px' },
  roomy: { inset: '26px', section: '28px' },
}

const TEXT_SIZE: Record<string, { title: string; caption: string; page: string }> = {
  small: { title: '12px', caption: '10px', page: '22px' },
  default: { title: '13px', caption: '11px', page: '25px' },
  large: { title: '14.5px', caption: '12px', page: '28px' },
}

const systemScheme = matchMedia('(prefers-color-scheme: dark)')
const schemeControl = document.querySelector<FdSegmentedRow>('#scheme')

function applyScheme(value: string): void {
  const scheme = resolveScheme(value, systemScheme.matches)
  document.documentElement.dataset.fdScheme = scheme
  document.documentElement.dataset.landingScheme = scheme
  document.documentElement.style.colorScheme = scheme

  if (preferencesWindow) {
    preferencesWindow.dataset.fdScheme = scheme
    preferencesWindow.style.colorScheme = scheme
  }
  const icon = scheme === 'dark' ? darkAppIcon : lightAppIcon
  for (const image of [preferencesAppIcon, brandAppIcon, canvasAppIcon]) {
    if (image) image.src = icon
  }
}

onSegment('scheme', applyScheme)
systemScheme.addEventListener('change', () => {
  if (schemeControl?.value === 'system') applyScheme('system')
})

function applyAccent(hex: string): void {
  set('--fd-accent', hex)
  document.documentElement.style.setProperty('--fd-accent', hex)
  scheduleLandingAccent(hex)
  const well = document.querySelector<FdColorPickerRow>('#custom-accent')
  if (well) well.value = hex.toLowerCase()
}

let pendingLandingAccent: string | null = null
let landingAccentFrame: number | null = null

function scheduleLandingAccent(hex: string): void {
  pendingLandingAccent = hex
  if (landingAccentFrame !== null) return
  landingAccentFrame = requestAnimationFrame(() => {
    if (pendingLandingAccent) {
      document.body.style.setProperty('--landing-accent', pendingLandingAccent)
    }
    pendingLandingAccent = null
    landingAccentFrame = null
  })
}

const accentPopup = document.querySelector<FdPopupRow>('#accent')
const allAccentRows = document.querySelector<FdDependentRows>('#all-accent-rows')
accentPopup?.addEventListener('fd-change', (event) => {
  if (event.detail.value === 'all') {
    if (allAccentRows) allAccentRows.visible = true
    return
  }
  if (allAccentRows) allAccentRows.visible = false
  if (event.detail.value && isNamedAccent(event.detail.value)) {
    applyAccent(namedAccents[event.detail.value])
  }
})
if (accentPopup?.value && isNamedAccent(accentPopup.value)) {
  applyAccent(namedAccents[accentPopup.value])
}

onSegment('corners', (value) => {
  const corners = CORNERS[value]
  if (!corners) return
  set('--fd-window-radius', corners.window)
  set('--fd-metric-card-radius', corners.card)
  set('--fd-metric-control-radius', corners.control)
})

onSegment('density', (value) => {
  const density = DENSITY[value]
  if (!density) return
  set('--fd-metric-row-inset', density.inset)
  set('--fd-metric-section-spacing', density.section)
})

onSegment('content-layout', (value) => {
  if (!preferencesWindow) return
  preferencesWindow.contentLayout = value === 'fluid' ? 'fluid' : 'centered'
  const maximumWidth = document.querySelector<FdDependentRows>('#content-maximum-width')
  if (maximumWidth) maximumWidth.visible = preferencesWindow.contentLayout === 'centered'
})

onSegment('content-width', (value) => set('--fd-preferences-content-max-width', `${value}px`))

const sidebarWidth = document.querySelector<FdSliderRow>('#sidebar-width')
if (sidebarWidth) sidebarWidth.format = (value) => `${Math.round(value)}px`
onSlider('sidebar-width', (value) => set('--fd-sidebar-width', `${Math.round(value)}px`))

onSegment('text-size', (value) => {
  const size = TEXT_SIZE[value]
  if (!size) return
  set('--fd-text-row-title-size', size.title)
  set('--fd-text-row-caption-size', size.caption)
  set('--fd-text-page-title-size', size.page)
})

onSegment('heading-font', (value) => {
  set('--fd-text-page-title-family', `var(--fd-font-${value})`)
  set('--fd-text-brand-title-family', `var(--fd-font-${value})`)
})

document.querySelector<FdSwitchRow>('#separators')?.addEventListener('fd-change', (event) => {
  if (preferencesWindow) preferencesWindow.dataset.separators = event.detail.checked ? 'on' : 'off'
})

document
  .querySelector<FdColorPickerRow>('#custom-accent')
  ?.addEventListener('fd-change', (event) => {
    const value = event.detail.value
    if (!value) return
    applyAccent(value)
    if (allAccentRows) allAccentRows.visible = false
    if (accentPopup) {
      accentPopup.options = accentPopup.options.map((option) =>
        option.value === 'custom' ? { ...option, accent: value } : option,
      )
      accentPopup.value = 'custom'
    }
  })

for (const id of ['appearance-accent-chips', 'accent-chips']) {
  document.querySelector<HTMLElement>(`#${id}`)?.addEventListener('fd-activate', (event) => {
    if (!event.detail.value || !isNamedAccent(event.detail.value)) return
    applyAccent(namedAccents[event.detail.value])
    if (accentPopup) accentPopup.value = 'all'
    if (allAccentRows) allAccentRows.visible = true
  })
}

function singleSelectTagGroup(id: string): void {
  const group = document.querySelector<HTMLElement>(`#${id}`)
  group?.addEventListener('fd-activate', (event) => {
    const pressed = event.target as FdSelectableTag
    for (const tag of group.querySelectorAll<FdSelectableTag>('fd-selectable-tag')) {
      tag.selected = tag === pressed
    }
  })
}

singleSelectTagGroup('tag-group')
singleSelectTagGroup('discovery-tag-group')

function discloses(rowId: string, rowsId: string): void {
  const row = document.querySelector<FdExpandableRow>(`#${rowId}`)
  const rows = document.querySelector<FdDependentRows>(`#${rowsId}`)
  if (!row || !rows) return
  rows.visible = row.expanded
  row.addEventListener('fd-change', (event) => {
    rows.visible = event.detail.checked ?? false
  })
}

discloses('advanced', 'advanced-rows')
discloses('reference-expand', 'reference-expand-rows')
discloses('discovery-expand', 'discovery-expand-rows')

let pressCount = 0
document.querySelector<HTMLElement>('#press')?.addEventListener('fd-activate', () => {
  pressCount += 1
  const readout = document.querySelector<FdValueRow>('#press-readout')
  if (readout) readout.value = `Pressed ${pressCount} ${pressCount === 1 ? 'time' : 'times'}`
})

document.querySelector<HTMLElement>('#hero-save')?.addEventListener('fd-activate', () => {
  const readout = document.querySelector<FdValueRow>('#hero-save-value')
  if (readout) readout.value = 'Just now'
})

for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-page]')) {
  link.addEventListener('click', () => {
    if (preferencesWindow && link.dataset.page) preferencesWindow.page = link.dataset.page
  })
}

preferencesWindow?.addEventListener('fd-close', () => {
  preferencesWindow.animate([{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }], { duration: 260 })
})
