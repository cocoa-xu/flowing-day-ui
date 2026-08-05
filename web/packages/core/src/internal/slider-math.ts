/**
 * Mirrors `SettingsSliderMath`, the value ↔ fraction conversion the slider draws and
 * drags with. Ported verbatim, including the degenerate-range guard, so the two
 * platforms cannot disagree about where a knob sits.
 */
export const FdSliderMath = {
  /** The clamped 0…1 position of `value` within the range. */
  fraction(value: number, min: number, max: number): number {
    const span = max - min
    if (!(span > 0)) return 0
    return Math.min(Math.max((value - min) / span, 0), 1)
  },

  /** The value at `fraction`, which is clamped before it is applied. */
  value(fraction: number, min: number, max: number): number {
    const clamped = Math.min(Math.max(fraction, 0), 1)
    return min + clamped * (max - min)
  },
} as const
