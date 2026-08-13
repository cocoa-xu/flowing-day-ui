import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { FdSliderMath } from '../../internal/slider-math.js'

/** `FlowingSliderControl.knobDiameter`. */
const KNOB = 13
/** `FlowingSliderControl.trackHeight`. */
const TRACK = 3

/**
 * Mirrors `PreferencesSlider` and the `NSControl` behind it, which draws its own chrome
 * rather than taking AppKit's. Every rect the Swift `draw(_:)` builds has a counterpart
 * here: a track inset by half a knob at each end, a progress fill from the track's
 * leading edge to the knob, and a 13pt knob whose 0.5pt border is stroked inside its
 * own bounds so the diameter stays 13.
 *
 * Form-associated: works inside `<form>` and participates in reset and state restore.
 *
 * @fires fd-change - `{ valueAsNumber }` as the value moves.
 * @csspart track - The unfilled track.
 * @csspart progress - The filled portion.
 * @csspart knob - The draggable knob.
 */
@customElement('fd-slider')
export class FdSlider extends FdElement {
  static formAssociated = true

  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        /* .frame(height: 16) */
        height: 16px;
        cursor: pointer;
        touch-action: none;
      }

      :host([disabled]) {
        cursor: default;
        opacity: 0.4;
      }

      :host(:focus-visible) {
        outline: 0;
      }

      .rail {
        position: relative;
        height: 100%;
      }

      .track,
      .progress {
        position: absolute;
        top: 50%;
        translate: 0 -50%;
        height: ${TRACK}px;
        border-radius: ${TRACK / 2}px;
      }

      /* NSRect(x: knobDiameter / 2, width: bounds.width - knobDiameter) */
      .track {
        inset-inline: ${KNOB / 2}px;
        background: var(--_fd-palette-hairline);
      }

      /* Logical, so the fill grows from the trailing edge when the layout is RTL. */
      .progress {
        inset-inline-start: ${KNOB / 2}px;
        width: calc(var(--_fraction) * (100% - ${KNOB}px));
        background: var(--_fd-accent-fill);
      }

      .knob {
        position: absolute;
        top: 50%;
        translate: 0 -50%;
        inset-inline-start: calc(var(--_fraction) * (100% - ${KNOB}px));
        width: ${KNOB}px;
        height: ${KNOB}px;
        border-radius: 50%;
        background: var(--_fd-knob-fill);
        /*
         * Inset, because Swift strokes a path inset by 0.25 at a width of 0.5: the whole
         * border falls inside the knob and the drawn diameter stays 13.
         */
        box-shadow:
          inset 0 0 0 0.5px var(--_fd-knob-border),
          var(--_fd-knob-shadow);
      }

      :host(:focus-visible) .knob {
        box-shadow:
          inset 0 0 0 0.5px var(--_fd-knob-border),
          var(--_fd-knob-shadow),
          0 0 0 1px color-mix(in srgb, var(--_fd-accent-fill) 42%, transparent);
      }
    `,
  ]

  @property({ type: Number }) value = 0

  @property({ reflect: true }) label = ''

  /** `range.lowerBound`. */
  @property({ type: Number }) min = 0

  /** `range.upperBound`. */
  @property({ type: Number }) max = 1

  /** Quantises the value. Unset means continuous, as `step: nil` does. */
  @property({ type: Number }) step: number | null = null

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  @property({ attribute: false }) formatValue: (value: number) => string = (value) =>
    value.toFixed(2)

  readonly #internals: ElementInternals

  #defaultValue = 0

  /** `mouseDragged` only arrives while the button is down; nothing here guarantees that. */
  #dragging = false

  constructor() {
    super()
    this.#internals = this.attachInternals()
    this.addEventListener('pointerdown', this.#onPointerDown)
    this.addEventListener('pointermove', this.#onPointerMove)
    this.addEventListener('pointerup', this.#endDrag)
    this.addEventListener('pointercancel', this.#endDrag)
    // An ancestor may capture the same pointer for itself — a draggable window does
    // exactly that. Capture then transfers away and every later event, pointerup
    // included, goes there instead, so this is the only signal the drag has ended.
    this.addEventListener('lostpointercapture', this.#endDrag)
    this.addEventListener('keydown', this.#onKeydown)
  }

  get form(): HTMLFormElement | null {
    return this.#internals.form
  }

  get labels(): NodeList {
    return this.#internals.labels
  }

  /** The knob's clamped 0…1 position, as `PreferencesSliderMath.fraction(of:in:)` gives it. */
  get fraction(): number {
    return FdSliderMath.fraction(this.value, this.min, this.max)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#defaultValue = this.value
    if (!this.hasAttribute('role')) this.setAttribute('role', 'slider')
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0
  }

  override willUpdate(): void {
    if (!Number.isFinite(this.min) || !Number.isFinite(this.max) || this.min > this.max) {
      throw new RangeError('Slider bounds must be finite and ordered.')
    }
    if (this.step !== null && (!Number.isFinite(this.step) || this.step <= 0)) {
      throw new RangeError('Slider step must be finite and greater than zero.')
    }
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.setAttribute('aria-valuenow', String(this.value))
    this.setAttribute('aria-valuemin', String(this.min))
    this.setAttribute('aria-valuemax', String(this.max))
    this.setAttribute('aria-valuetext', this.formatValue(this.value))
    if (this.label) this.setAttribute('aria-label', this.label)
    else this.removeAttribute('aria-label')
    this.setAttribute('aria-disabled', String(this.disabled))
    this.#internals.setFormValue(this.disabled ? null : String(this.value))
    if (changed.has('disabled')) this.tabIndex = this.disabled ? -1 : 0
  }

  formResetCallback(): void {
    this.value = this.#defaultValue
  }

  formStateRestoreCallback(state: string | null): void {
    const restored = Number(state)
    // A non-numeric state would otherwise land as NaN and take the knob with it.
    if (state !== null && Number.isFinite(restored)) this.value = restored
  }

  /** True while the control is laid out right to left, which flips the whole axis. */
  get #isRtl(): boolean {
    return getComputedStyle(this).direction === 'rtl'
  }

  /** `FlowingSliderControl.updateValue(with:)`, measured from the inline start. */
  #commit(clientX: number): void {
    const bounds = this.getBoundingClientRect()
    const usableWidth = Math.max(bounds.width - KNOB, 1)
    const fromStart = this.#isRtl ? bounds.right - clientX : clientX - bounds.left
    const fraction = (fromStart - KNOB / 2) / usableWidth
    const proposed = FdSliderMath.value(fraction, this.min, this.max)

    const next =
      this.step !== null && this.step > 0
        ? Math.min(
            Math.max(
              this.min + Math.round((proposed - this.min) / this.step) * this.step,
              this.min,
            ),
            this.max,
          )
        : proposed

    this.#apply(next)
  }

  #apply(next: number): void {
    if (next === this.value) return
    this.value = next
    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: { valueAsNumber: this.value },
        bubbles: true,
        composed: true,
      }),
    )
  }

  #onPointerDown = (event: PointerEvent): void => {
    if (this.disabled) return
    event.preventDefault()
    this.#dragging = true
    if (event.isTrusted) this.setPointerCapture(event.pointerId)
    this.#commit(event.clientX)
  }

  #onPointerMove = (event: PointerEvent): void => {
    if (this.disabled || !this.#dragging) return
    // Ground truth, whatever became of the capture: no button down, no drag. Without
    // this a press whose pointerup was delivered elsewhere leaves the knob following
    // the pointer for good, with no gesture left that could stop it.
    if (event.buttons === 0) {
      this.#endDrag()
      return
    }
    this.#commit(event.clientX)
  }

  #endDrag = (): void => {
    this.#dragging = false
  }

  /** accessibilityAdjustableAction, whose delta is the step or a twentieth of the range. */
  #onKeydown = (event: KeyboardEvent): void => {
    if (this.disabled) return

    // Up and down have no inline direction; left and right follow the layout, so the
    // knob always travels the way the key points.
    const inline = this.#isRtl ? -1 : 1
    const direction =
      event.key === 'ArrowUp'
        ? 1
        : event.key === 'ArrowDown'
          ? -1
          : event.key === 'ArrowRight'
            ? inline
            : event.key === 'ArrowLeft'
              ? -inline
              : 0
    if (direction === 0) return

    event.preventDefault()
    const delta = this.step ?? (this.max - this.min) / 20
    this.#apply(Math.min(Math.max(this.value + direction * delta, this.min), this.max))
  }

  override render() {
    return html`
      <div class="rail" style="--_fraction: ${this.fraction}">
        <div class="track" part="track"></div>
        <div class="progress" part="progress"></div>
        <div class="knob" part="knob"></div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-slider': FdSlider
  }
}
