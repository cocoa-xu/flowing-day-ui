/**
 * Mirrors `NSPanel.isMovableByWindowBackground`, which `SettingsWindowPresenter` sets:
 * the window is dragged by any part of its background, and controls keep their own
 * pointer handling.
 *
 * This lives with the page rather than with `fd-settings-window` because it is the
 * presenter's job. The component is the view; how it is presented is the page's call.
 *
 * An open popup needs no special handling: `popover="auto"` light-dismisses on the
 * pointerdown that starts the drag, which is what `NSWindow.didMoveNotification` does
 * for the AppKit panel.
 */
const INTERACTIVE = [
  'button',
  'input',
  'select',
  'textarea',
  'a[href]',
  'fd-switch',
  'fd-popup',
  'fd-check-toggle',
].join(',')

/** Keeps this much of the window on screen, so it can always be grabbed again. */
const KEEP_VISIBLE = 96

const startsOnAControl = (event: PointerEvent) =>
  event.composedPath().some((node) => node instanceof Element && node.matches(INTERACTIVE))

export function makeMovableByBackground(element: HTMLElement): void {
  let activePointer: number | null = null
  let originX = 0
  let originY = 0
  let offsetX = 0
  let offsetY = 0

  const clamp = (rect: DOMRect) => {
    const minX = KEEP_VISIBLE - rect.width - (rect.left - offsetX)
    const maxX = window.innerWidth - KEEP_VISIBLE - (rect.left - offsetX)
    const minY = -(rect.top - offsetY)
    const maxY = window.innerHeight - KEEP_VISIBLE - (rect.top - offsetY)
    offsetX = Math.min(Math.max(offsetX, minX), maxX)
    offsetY = Math.min(Math.max(offsetY, minY), maxY)
  }

  element.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || startsOnAControl(event)) return
    activePointer = event.pointerId
    originX = event.clientX - offsetX
    originY = event.clientY - offsetY
    element.setPointerCapture(activePointer)
    element.dataset.dragging = ''
  })

  element.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointer) return
    offsetX = event.clientX - originX
    offsetY = event.clientY - originY
    clamp(element.getBoundingClientRect())
    element.style.translate = `${offsetX}px ${offsetY}px`
  })

  const end = (event: PointerEvent) => {
    if (event.pointerId !== activePointer) return
    element.releasePointerCapture(activePointer)
    activePointer = null
    delete element.dataset.dragging
  }

  element.addEventListener('pointerup', end)
  element.addEventListener('pointercancel', end)
}
