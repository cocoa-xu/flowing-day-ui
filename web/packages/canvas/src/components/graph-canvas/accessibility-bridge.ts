import type { FdResolvedGraphCanvasAccessibilityConfiguration } from '../../accessibility/configuration.js'
import type {
  FdGraphAccessibilityItem,
  FdGraphAccessibilitySnapshot,
} from '../../accessibility/snapshot.js'
import type { FdGraphElementID } from '../../graph/model.js'

export interface FdGraphCanvasAccessibilityBridgeUpdate {
  readonly snapshot: FdGraphAccessibilitySnapshot
  readonly configuration: FdResolvedGraphCanvasAccessibilityConfiguration
  readonly selectedNodeIDs: ReadonlySet<FdGraphElementID>
  readonly allowsMultipleSelection: boolean
  readonly focusedElementKey?: string
}

let bridgeSequence = 0

export class FdGraphCanvasAccessibilityBridge {
  private readonly prefix = `fd-graph-accessibility-${++bridgeSequence}`
  private readonly elements = new Map<string, HTMLElement>()

  constructor(
    private readonly surface: HTMLElement,
    private readonly rowGroup: HTMLElement,
  ) {}

  update(update: FdGraphCanvasAccessibilityBridgeUpdate): void {
    const { configuration, snapshot } = update
    this.surface.tabIndex = configuration.enabled ? 0 : -1
    this.surface.setAttribute('aria-label', configuration.canvasLabel)
    this.surface.setAttribute('aria-rowcount', String(snapshot.items.length))
    this.surface.setAttribute('aria-multiselectable', String(update.allowsMultipleSelection))
    this.surface.setAttribute('aria-readonly', String(!configuration.capabilities.movement))
    const items = configuration.enabled
      ? snapshot.exposedItems(update.focusedElementKey, configuration.maximumExposedElementCount)
      : []
    const visibleKeys = new Set(items.map(({ key }) => key))
    const fragment = document.createDocumentFragment()
    for (const item of items) {
      const element = this.elements.get(item.key) ?? this.createElement(item.key)
      this.updateElement(element, item, snapshot, update.selectedNodeIDs)
      fragment.append(element)
    }
    for (const [key, element] of this.elements) {
      if (visibleKeys.has(key)) continue
      element.remove()
      this.elements.delete(key)
    }
    this.rowGroup.replaceChildren(fragment)
    const activeID = update.focusedElementKey
      ? this.elements.get(update.focusedElementKey)?.id
      : undefined
    if (activeID) this.surface.setAttribute('aria-activedescendant', activeID)
    else this.surface.removeAttribute('aria-activedescendant')
  }

  private createElement(key: string): HTMLElement {
    const element = document.createElement('div')
    element.id = `${this.prefix}-${encodeURIComponent(key)}`
    element.className = 'accessibility-item'
    element.setAttribute('role', 'row')
    this.elements.set(key, element)
    return element
  }

  private updateElement(
    element: HTMLElement,
    item: FdGraphAccessibilityItem,
    snapshot: FdGraphAccessibilitySnapshot,
    selectedNodeIDs: ReadonlySet<FdGraphElementID>,
  ): void {
    element.dataset.fdGraphAccessibilityKey = item.key
    element.setAttribute('aria-label', item.description.label)
    element.setAttribute('aria-rowindex', String((snapshot.indexOf(item.key) ?? 0) + 1))
    this.setOptionalAttribute(element, 'aria-description', this.description(item))
    this.setOptionalAttribute(element, 'aria-roledescription', item.description.roleDescription)
    if (item.kind === 'node' && item.reference.nodeID !== undefined) {
      element.setAttribute('aria-selected', String(selectedNodeIDs.has(item.reference.nodeID)))
    } else {
      element.removeAttribute('aria-selected')
    }
  }

  private description(item: FdGraphAccessibilityItem): string | undefined {
    const values = [item.description.value, item.description.hint].filter(
      (value): value is string => Boolean(value),
    )
    return values.length > 0 ? values.join('. ') : undefined
  }

  private setOptionalAttribute(
    element: HTMLElement,
    name: string,
    value: string | undefined,
  ): void {
    if (value) element.setAttribute(name, value)
    else element.removeAttribute(name)
  }
}
