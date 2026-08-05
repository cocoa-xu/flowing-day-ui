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
  /** `fd-switch`, `fd-switch-group`, `fd-check-toggle`. */
  checked?: boolean
  /** `fd-popup`, `fd-popup-row`, the segmented rows, and `fd-multi-select-row`. */
  value?: string
  /** `fd-multi-select-row`: the new state of the option that was toggled. */
  selected?: boolean
  /** `fd-multi-select-row`: every value currently switched on. */
  values?: string[]
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
    'fd-page-change': CustomEvent<{ page: string }>
    'fd-close': CustomEvent<undefined>
  }
}
