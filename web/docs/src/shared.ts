import { FdIcons, globalThemeCss } from '@flowing-day/ui'

/**
 * Adopts the generated token sheet at runtime rather than importing the built
 * `theme.css`, so editing tokens.ts hot-reloads the page.
 */
export function installTheme(): void {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(globalThemeCss())
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
}

const stroke = (path: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round">${path}</svg>`

/**
 * Stand-in glyphs keyed by SF Symbol name. SF Symbols themselves cannot be
 * redistributed, so a real application registers its own set under the same keys.
 */
export function registerPlaceholderIcons(): void {
  FdIcons.register({
    power: stroke('<path d="M12 3v9"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>'),
    eye: stroke(
      '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    ),
    sparkles: stroke('<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>'),
    bolt: stroke('<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>'),
    gearshape: stroke(
      '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3"/>',
    ),
    paintbrush: stroke('<path d="M14 3.5 20.5 10 12 18.5H5.5V12z"/><path d="M8.5 15.5 3.5 20.5"/>'),
    'square.grid.2x2': stroke(
      '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    ),
    keyboard: stroke(
      '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M7 15h10M6.5 9.5h.01M10 9.5h.01M13.5 9.5h.01M17 9.5h.01"/>',
    ),
    network: stroke(
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/>',
    ),
    'cable.connector': stroke(
      '<path d="M7 3.5v5M17 3.5v5M4.5 8.5h15v4a7.5 7.5 0 0 1-15 0z"/><path d="M12 20v.5"/>',
    ),
    'arrow.triangle.2.circlepath': stroke(
      '<path d="M3.5 9.5A8.5 8.5 0 0 1 19 7"/><path d="M20.5 14.5A8.5 8.5 0 0 1 5 17"/><path d="M19 3v4h-4M5 21v-4h4"/>',
    ),
    'info.circle': stroke('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>'),
    'chart.bar': stroke('<path d="M5 20V11M12 20V4M19 20v-6"/>'),
    'chart.line': stroke('<path d="M3.5 16.5 9 10.5l4 4 7.5-8"/>'),
    'chart.area': stroke('<path d="M3.5 18.5 9 11l4 4 7.5-8v11.5h-17z"/>'),
    'lock.shield': stroke(
      '<path d="M12 2.5 20 6v6c0 4.6-3.3 8.4-8 9.5-4.7-1.1-8-4.9-8-9.5V6z"/><rect x="9" y="10.5" width="6" height="5" rx="1.2"/><path d="M10.5 10.5V9a1.5 1.5 0 0 1 3 0v1.5"/>',
    ),
  })
}
