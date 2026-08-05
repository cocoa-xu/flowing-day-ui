import type { FdSegmentedRow, FdSettingsWindow, FdSwitchRow } from '@flowing-day/ui'
import '@flowing-day/ui'
import { makeMovableByBackground } from './drag.js'
import { installTheme, registerPlaceholderIcons } from './shared.js'

installTheme()
registerPlaceholderIcons()

const root = document.documentElement
const settingsWindow = document.querySelector<FdSettingsWindow>('#window')

if (settingsWindow) makeMovableByBackground(settingsWindow)

/**
 * The Appearance page restyles the window it lives in. Every control writes design
 * tokens onto the window element, so the change reaches the shadow root of every
 * component below without any of them knowing about it — the same propagation
 * `.settingsAccent(_:)` and its siblings give a SwiftUI subtree.
 */
const set = (token: string, value: string) => settingsWindow?.style.setProperty(token, value)

const ACCENTS: Record<string, { fill: string; foreground: string }> = {
  celadon: { fill: '#6D9EA5', foreground: '#9FD1D8' },
  copper: { fill: '#B4795E', foreground: '#C99372' },
  iris: { fill: '#8286C4', foreground: '#A3A6DA' },
  moss: { fill: '#7E9B6B', foreground: '#9FB98C' },
}

const DENSITY: Record<string, { inset: string; section: string }> = {
  comfortable: { inset: '18px', section: '20px' },
  compact: { inset: '12px', section: '14px' },
}

const CORNERS: Record<string, { window: string; card: string; control: string }> = {
  soft: { window: '18px', card: '14px', control: '9px' },
  sharp: { window: '6px', card: '5px', control: '4px' },
}

const TEXT_SIZE: Record<string, { title: string; caption: string; page: string }> = {
  small: { title: '12px', caption: '10px', page: '22px' },
  default: { title: '13px', caption: '11px', page: '25px' },
  large: { title: '14.5px', caption: '12px', page: '28px' },
}

/** Wires one segmented row and applies its initial value, so markup and page agree. */
function onSegment(id: string, apply: (value: string) => void): void {
  const row = document.querySelector<FdSegmentedRow>(`#${id}`)
  if (!row) return
  row.addEventListener('fd-change', (event) => {
    if (event.detail.value) apply(event.detail.value)
  })
  if (row.value) apply(row.value)
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

onSegment('accent', (value) => {
  const accent = ACCENTS[value]
  if (!accent) return
  set('--fd-accent-fill', accent.fill)
  set('--fd-accent-foreground', accent.foreground)
})

onSegment('density', (value) => {
  const density = DENSITY[value]
  if (!density) return
  set('--fd-metric-row-inset', density.inset)
  set('--fd-metric-section-spacing', density.section)
})

onSegment('corners', (value) => {
  const corners = CORNERS[value]
  if (!corners) return
  set('--fd-window-radius', corners.window)
  set('--fd-metric-card-radius', corners.card)
  set('--fd-metric-control-radius', corners.control)
})

onSegment('text-size', (value) => {
  const size = TEXT_SIZE[value]
  if (!size) return
  set('--fd-text-row-title-size', size.title)
  set('--fd-text-row-caption-size', size.caption)
  set('--fd-text-page-title-size', size.page)
})

document.querySelector<FdSwitchRow>('#separators')?.addEventListener('fd-change', (event) => {
  if (settingsWindow) settingsWindow.dataset.separators = event.detail.checked ? 'on' : 'off'
})

settingsWindow?.addEventListener('fd-close', () => {
  // Nothing to close in an embed; the SwiftUI original calls through to NSPanel.close().
  settingsWindow.animate([{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }], { duration: 260 })
})
