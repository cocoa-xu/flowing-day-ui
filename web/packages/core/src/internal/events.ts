/**
 * `fd-change` is emitted by every control, but its payload depends on what changed:
 * a switch reports `checked`, a single-select reports `value`, and a multi-select
 * reports which option moved plus the resulting set.
 *
 * `HTMLElementEventMap` allows one type per event name, so the fields are declared
 * together and optionally. Read the one your control emits — the per-element
 * documentation says which that is.
 */
export interface FdChangeDetail {
  /** `fd-switch`, `fd-switch-group`, `fd-checkbox`, `fd-check-toggle`, `fd-disclosure`. */
  checked?: boolean
  /** Popup, search picker, segmented, text input, colour picker and multi-select controls. */
  value?: string
  /** `fd-multi-select` and `fd-multi-select-row`: the toggled option's new state. */
  selected?: boolean
  /** `fd-multi-select` and `fd-multi-select-row`: every value currently switched on. */
  values?: string[]
  /** `fd-slider`, `fd-slider-row`. Named as `HTMLInputElement.valueAsNumber` is. */
  valueAsNumber?: number
}

/**
 * The SwiftUI `action` closure, for controls that report a press rather than a new value.
 *
 * A plain `click` listener on the host would not do: a click anywhere in the row bubbles
 * out of the shadow root, including from the label, which never ran the closure.
 */
export interface FdActivateDetail {
  /** The activated element's `value`, where it carries one. */
  value?: string
}

declare global {
  interface HTMLElementEventMap {
    'fd-change': CustomEvent<FdChangeDetail>
    'fd-activate': CustomEvent<FdActivateDetail>
    'fd-submit': CustomEvent<undefined>
    'fd-query-change': CustomEvent<{ query: string }>
    'fd-page-change': CustomEvent<{ page: string }>
    'fd-open': CustomEvent<undefined>
    'fd-confirm': CustomEvent<undefined>
    'fd-cancel': CustomEvent<undefined>
    'fd-close': CustomEvent<{ returnValue?: string } | undefined>
  }
}
