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

/** Paths keyed by SF Symbol name, drawn as strokes so weight can be varied. */
const PATHS: Record<string, string> = {
  paintbrush: '<path d="M14 3.5 20.5 10 12 18.5H5.5V12z"/><path d="M8.5 15.5 3.5 20.5"/>',
  ruler:
    '<rect x="2.5" y="7.5" width="19" height="9" rx="2"/><path d="M7 7.5v3M11 7.5v4.5M15 7.5v3M19 7.5v4.5"/>',
  textformat: '<path d="M4 19 10 5l6 14M6.4 14.5h7.2M18 19V9.5"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  sparkles:
    '<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><path d="M17.5 4.5 19 6M5 18l1.5-1.5M19 18l-1.5-1.5M6.5 4.5 5 6"/>',
  'list.bullet': '<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>',
  'info.circle': '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  swatchpalette:
    '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
  'circle.lefthalf.filled':
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 0 0 17Z" fill="currentColor" stroke="none"/>',
  'rectangle.center.inset.filled':
    '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><rect x="7" y="8" width="10" height="8" rx="1.5" fill="currentColor" stroke="none"/>',
  eyedropper: '<path d="m5 19 3.5-1 10-10-2.5-2.5-10 10Z"/><path d="m14.5 7 2.5 2.5M4 20h5"/>',
  'app.dashed':
    '<rect x="3.5" y="3.5" width="17" height="17" rx="4" stroke-dasharray="3 2"/><circle cx="12" cy="12" r="3"/>',
  number: '<path d="M9 3 7 21M17 3l-2 18M4 9h16M3 15h16"/>',
  shippingbox: '<path d="m4 7 8-4 8 4-8 4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/>',
  'chevron.left.forwardslash.chevron.right': '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  arrow: '<path d="M3.5 12h17M8 7.5 3.5 12 8 16.5M16 7.5 20.5 12 16 16.5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  circle: '<circle cx="12" cy="12" r="8.5"/>',
  hare: '<path d="M6 20h9a4 4 0 0 0 0-8H9.5"/><path d="M9 12 6.5 4.5M12 11.5 14.5 4"/>',
}

/** The stroke weights the Icons page switches between. */
export const ICON_STYLES = {
  hairline: 1.2,
  outline: 1.8,
  bold: 2.6,
} as const

export type IconStyle = keyof typeof ICON_STYLES

/**
 * SF Symbols cannot be redistributed, so the library ships the icon interface and no
 * icon data. These stand-ins are registered under the same SF Symbol names a real
 * application would use, and re-registering swaps every icon already on the page.
 */
export function registerIcons(style: IconStyle = 'outline'): void {
  const width = ICON_STYLES[style]
  const entries = Object.entries(PATHS).map(([name, path]) => [
    name,
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}"
          stroke-linecap="round" stroke-linejoin="round">${path}</svg>`,
  ])
  FdIcons.register(Object.fromEntries(entries))
}
