import type {
  FdColorPickerRow,
  FdDependentRows,
  FdExpandableRow,
  FdSearchPickerRow,
  FdSegmentedRow,
  FdSelectableTag,
  FdSettingsWindow,
  FdSliderRow,
  FdSwitchRow,
  FdValueRow,
} from '@flowing-day/ui'
import '@flowing-day/ui'
import { makeMovableByBackground } from './drag.js'
import { type IconStyle, installTheme, registerIcons } from './shared.js'

installTheme()
registerIcons()

const root = document.documentElement
const settingsWindow = document.querySelector<FdSettingsWindow>('#window')

if (settingsWindow) makeMovableByBackground(settingsWindow)

/**
 * Every control in this window restyles the window it lives in. Each one writes design
 * tokens onto the window element, so the change reaches the shadow root of every
 * component below without any of them knowing about it — the same propagation
 * `.settingsAccent(_:)` and its siblings give a SwiftUI subtree.
 */
const set = (token: string, value: string) => settingsWindow?.style.setProperty(token, value)

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
const ACCENTS: Record<string, string> = {
  celadon: '#6D9EA5',
  copper: '#B4795E',
  iris: '#8286C4',
  moss: '#7E9B6B',
}

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

onSegment('scheme', (value) => {
  if (value === 'system') {
    delete root.dataset.fdScheme
    root.style.colorScheme = ''
  } else {
    root.dataset.fdScheme = value
    root.style.colorScheme = value
  }
})

/**
 * Every accent control on the page ends here. One custom property is the whole knob, so
 * a segmented row, a searchable list, a colour well and a grid of chips can all drive it
 * without knowing about one another.
 */
function applyAccent(hex: string): void {
  set('--fd-accent', hex)
  const readout = document.querySelector<FdValueRow>('#accent-readout')
  if (readout) readout.value = hex.toUpperCase()
  const well = document.querySelector<FdColorPickerRow>('#custom-accent')
  if (well) well.value = hex.toLowerCase()
}

onSegment('accent', (value) => {
  const accent = ACCENTS[value]
  if (accent) applyAccent(accent)
})

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

onSegment('content-width', (value) => set('--fd-metric-content-width', `${value}px`))

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

onSegment('motion-speed', (value) => set('--fd-motion-disclosure', value))

// Re-registering under the same names swaps every icon already on the page.
onSegment('icon-style', (value) => registerIcons(value as IconStyle))

document.querySelector<FdSwitchRow>('#separators')?.addEventListener('fd-change', (event) => {
  if (settingsWindow) settingsWindow.dataset.separators = event.detail.checked ? 'on' : 'off'
})

document
  .querySelector<FdSearchPickerRow>('#accent-library')
  ?.addEventListener('fd-change', (event) => {
    if (event.detail.value) applyAccent(event.detail.value)
  })

document
  .querySelector<FdColorPickerRow>('#custom-accent')
  ?.addEventListener('fd-change', (event) => {
    if (event.detail.value) applyAccent(event.detail.value)
  })

/** fd-chip reports the press and nothing else, so the value it carries is the accent. */
document.querySelector<HTMLElement>('#accent-chips')?.addEventListener('fd-activate', (event) => {
  if (event.detail.value) applyAccent(event.detail.value)
})

/**
 * The tag reports the press; the selection belongs to whoever owns it. That is the
 * SwiftUI contract — `SettingsSelectableTag` takes `isSelected` and hands back an action.
 */
document.querySelector<HTMLElement>('#tag-group')?.addEventListener('fd-activate', (event) => {
  const pressed = event.target as FdSelectableTag
  for (const tag of document.querySelectorAll<FdSelectableTag>('#tag-group fd-selectable-tag')) {
    tag.selected = tag === pressed
  }
})

/** Pairs a disclosure row with the rows it reveals. */
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

/**
 * A reload rather than a token sweep: the controls hold the state that produced the
 * tokens, so clearing one without the other would leave the window and the rows
 * disagreeing. The inline `translate` the drag writes is not ours to clear either.
 */
document.querySelector<HTMLElement>('#restore')?.addEventListener('fd-activate', () => {
  location.reload()
})

settingsWindow?.addEventListener('fd-close', () => {
  // Nothing to close in an embed; the SwiftUI original calls through to NSPanel.close().
  settingsWindow.animate([{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }], { duration: 260 })
})
