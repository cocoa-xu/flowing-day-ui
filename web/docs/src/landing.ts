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
import { makeMovableByBackground } from './drag.js'
import { installTheme, registerIcons } from './shared.js'

installTheme()
registerIcons()

const preferencesWindow = document.querySelector<FdPreferencesWindow>('#window')

if (preferencesWindow) makeMovableByBackground(preferencesWindow)

/**
 * Every control in this window restyles the window it lives in. Each one writes design
 * tokens onto the window element, so the change reaches the shadow root of every
 * component below without any of them knowing about it — the same propagation
 * `.preferencesAccent(_:)` and its siblings give a SwiftUI subtree.
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

function populateNamedAccents(): void {
  const popup = document.querySelector<FdPopupRow>('#accent')
  const grid = document.querySelector<HTMLElement>('#accent-chips')

  for (const names of Object.values(namedAccentFamilies)) {
    for (const name of names) {
      const value = namedAccents[name]
      const title = accentTitle(name)

      if (popup) {
        const option = document.createElement('fd-option')
        option.value = name
        option.label = title
        popup.append(option)
      }

      if (grid) {
        const chip = document.createElement('fd-chip')
        chip.value = name
        chip.textContent = title
        chip.style.setProperty('--fd-accent', value)
        grid.append(chip)
      }
    }
  }

  if (popup) {
    const custom = document.createElement('fd-option')
    custom.value = 'custom'
    custom.label = 'Custom'
    popup.append(custom)
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

onSegment('scheme', (value) => {
  if (!preferencesWindow) return
  const scheme =
    value === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : value
  preferencesWindow.dataset.fdScheme = scheme
  preferencesWindow.style.colorScheme = scheme
})

function applyAccent(hex: string): void {
  set('--fd-accent', hex)
  const well = document.querySelector<FdColorPickerRow>('#custom-accent')
  if (well) well.value = hex.toLowerCase()
}

const accentPopup = document.querySelector<FdPopupRow>('#accent')
accentPopup?.addEventListener('fd-change', (event) => {
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
    if (!event.detail.value) return
    applyAccent(event.detail.value)
    if (accentPopup) accentPopup.value = 'custom'
  })

document.querySelector<HTMLElement>('#accent-chips')?.addEventListener('fd-activate', (event) => {
  if (!event.detail.value || !isNamedAccent(event.detail.value)) return
  applyAccent(namedAccents[event.detail.value])
  if (accentPopup) accentPopup.value = event.detail.value
})

document.querySelector<HTMLElement>('#tag-group')?.addEventListener('fd-activate', (event) => {
  const pressed = event.target as FdSelectableTag
  for (const tag of document.querySelectorAll<FdSelectableTag>('#tag-group fd-selectable-tag')) {
    tag.selected = tag === pressed
  }
})

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

let pressCount = 0
document.querySelector<HTMLElement>('#press')?.addEventListener('fd-activate', () => {
  pressCount += 1
  const readout = document.querySelector<FdValueRow>('#press-readout')
  if (readout) readout.value = `Pressed ${pressCount} ${pressCount === 1 ? 'time' : 'times'}`
})

for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-page]')) {
  link.addEventListener('click', () => {
    if (preferencesWindow && link.dataset.page) preferencesWindow.page = link.dataset.page
  })
}

preferencesWindow?.addEventListener('fd-close', () => {
  preferencesWindow.animate([{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }], { duration: 260 })
})
