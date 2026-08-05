import type { FdOption } from '../components/option/fd-option.js'

/** A snapshot of one `fd-option`, keeping the element so its state can be written back. */
export interface CollectedOption {
  value: string
  label: string
  symbol: string | null
  selected: boolean
  disabled: boolean
  element: FdOption
}

/** Flattened, because a row component forwards its own slot into the control's. */
export function collectOptions(slot: HTMLSlotElement): CollectedOption[] {
  return slot
    .assignedElements({ flatten: true })
    .filter((element): element is FdOption => element.localName === 'fd-option')
    .map((element) => ({
      value: element.value,
      label: element.optionLabel,
      symbol: element.symbol,
      selected: element.selected,
      disabled: element.disabled,
      element,
    }))
}
