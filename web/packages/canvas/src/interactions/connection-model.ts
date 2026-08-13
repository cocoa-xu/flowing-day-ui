import type { FdCanvasPoint, FdCanvasSize } from '../geometry.js'
import { FdGraphCanvasAnchor } from '../graph/content.js'
import type { FdGraphElementID } from '../graph/model.js'
import type { FdLayoutInputID } from '../layout/model.js'

export type FdGraphCanvasEdgeEndpoint = 'first' | 'second'

export type FdGraphCanvasConnectionOrigin<ElementID extends FdGraphElementID = FdGraphElementID> =
  | { readonly kind: 'new'; readonly sourcePortID: ElementID }
  | {
      readonly kind: 'reconnect'
      readonly edgeID: ElementID
      readonly endpoint: FdGraphCanvasEdgeEndpoint
      readonly originalEndpointID: ElementID
      readonly fixedEndpointID: ElementID
    }

export const graphCanvasConnectionMovingElementID = <ElementID extends FdGraphElementID>(
  origin: FdGraphCanvasConnectionOrigin<ElementID>,
): ElementID | undefined => (origin.kind === 'reconnect' ? origin.originalEndpointID : undefined)

export const graphCanvasConnectionFixedElementID = <ElementID extends FdGraphElementID>(
  origin: FdGraphCanvasConnectionOrigin<ElementID>,
): ElementID => (origin.kind === 'new' ? origin.sourcePortID : origin.fixedEndpointID)

export class FdGraphCanvasConnectionFeedback {
  readonly message: string | undefined

  constructor(message?: string) {
    this.message = message
  }
}

export type FdGraphCanvasConnectionValidation =
  | { readonly kind: 'valid' }
  | { readonly kind: 'invalid'; readonly feedback: FdGraphCanvasConnectionFeedback }

export const graphCanvasConnectionValidationIsValid = (
  validation: FdGraphCanvasConnectionValidation,
): boolean => validation.kind === 'valid'

export class FdGraphCanvasConnectionValidationRequest<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly origin: FdGraphCanvasConnectionOrigin<ElementID>
  readonly targetPortID: ElementID
  readonly basePresentationSnapshotID: string | number
  readonly baseLayoutInputID: FdLayoutInputID

  constructor(options: {
    readonly origin: FdGraphCanvasConnectionOrigin<ElementID>
    readonly targetPortID: ElementID
    readonly basePresentationSnapshotID: string | number
    readonly baseLayoutInputID: FdLayoutInputID
  }) {
    this.origin = options.origin
    this.targetPortID = options.targetPortID
    this.basePresentationSnapshotID = options.basePresentationSnapshotID
    this.baseLayoutInputID = options.baseLayoutInputID
  }
}

export class FdGraphCanvasConnectionPolicy<ElementID extends FdGraphElementID = FdGraphElementID> {
  readonly #beginAdmission: (origin: FdGraphCanvasConnectionOrigin<ElementID>) => boolean
  readonly #validation: (
    request: FdGraphCanvasConnectionValidationRequest<ElementID>,
  ) => FdGraphCanvasConnectionValidation

  constructor(
    options: {
      readonly canBegin?: (origin: FdGraphCanvasConnectionOrigin<ElementID>) => boolean
      readonly validate?: (
        request: FdGraphCanvasConnectionValidationRequest<ElementID>,
      ) => FdGraphCanvasConnectionValidation
    } = {},
  ) {
    this.#beginAdmission = options.canBegin ?? (() => true)
    this.#validation = options.validate ?? (() => ({ kind: 'valid' }))
  }

  canBegin(origin: FdGraphCanvasConnectionOrigin<ElementID>): boolean {
    return this.#beginAdmission(origin)
  }

  validate(
    request: FdGraphCanvasConnectionValidationRequest<ElementID>,
  ): FdGraphCanvasConnectionValidation {
    return this.#validation(request)
  }

  static get standard(): FdGraphCanvasConnectionPolicy {
    return new FdGraphCanvasConnectionPolicy()
  }
}

export class FdGraphCanvasTransientConnection<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly origin: FdGraphCanvasConnectionOrigin<ElementID>
  readonly basePresentationSnapshotID: string | number
  readonly baseLayoutInputID: FdLayoutInputID
  readonly stationaryAnchor: FdGraphCanvasAnchor
  readonly originalMovingAnchor: FdGraphCanvasAnchor
  movingAnchor: FdGraphCanvasAnchor
  candidatePortID: ElementID | undefined
  validation: FdGraphCanvasConnectionValidation | undefined

  constructor(options: {
    readonly origin: FdGraphCanvasConnectionOrigin<ElementID>
    readonly basePresentationSnapshotID: string | number
    readonly baseLayoutInputID: FdLayoutInputID
    readonly stationaryAnchor: FdGraphCanvasAnchor
    readonly originalMovingAnchor: FdGraphCanvasAnchor
    readonly movingAnchor?: FdGraphCanvasAnchor
    readonly candidatePortID?: ElementID
    readonly validation?: FdGraphCanvasConnectionValidation
  }) {
    this.origin = options.origin
    this.basePresentationSnapshotID = options.basePresentationSnapshotID
    this.baseLayoutInputID = options.baseLayoutInputID
    this.stationaryAnchor = options.stationaryAnchor
    this.originalMovingAnchor = options.originalMovingAnchor
    this.movingAnchor = options.movingAnchor ?? options.originalMovingAnchor
    this.candidatePortID = options.candidatePortID
    this.validation = options.validation
  }
}

export class FdGraphCanvasConnectionPreview<ElementID extends FdGraphElementID = FdGraphElementID> {
  readonly origin: FdGraphCanvasConnectionOrigin<ElementID>
  readonly first: FdGraphCanvasAnchor
  readonly second: FdGraphCanvasAnchor
  readonly candidatePortID: ElementID | undefined
  readonly validation: FdGraphCanvasConnectionValidation | undefined

  constructor(connection: FdGraphCanvasTransientConnection<ElementID>) {
    this.origin = connection.origin
    this.candidatePortID = connection.candidatePortID
    this.validation = connection.validation
    if (connection.origin.kind === 'reconnect' && connection.origin.endpoint === 'first') {
      this.first = connection.movingAnchor
      this.second = connection.stationaryAnchor
    } else {
      this.first = connection.stationaryAnchor
      this.second = connection.movingAnchor
    }
  }
}

export type FdGraphCanvasPortConnectionState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'source' }
  | {
      readonly kind: 'target'
      readonly validation: FdGraphCanvasConnectionValidation
      readonly isCandidate: boolean
    }

export class FdGraphCanvasEdgeReconnectionActions {
  readonly canReconnectFirst: boolean
  readonly canReconnectSecond: boolean
  readonly firstRenderedPosition: FdCanvasPoint
  readonly secondRenderedPosition: FdCanvasPoint
  readonly #updateAction: (
    endpoint: FdGraphCanvasEdgeEndpoint,
    renderedTranslation: FdCanvasSize,
  ) => void
  readonly #endAction: (endpoint: FdGraphCanvasEdgeEndpoint) => void
  readonly #cancelAction: () => void

  constructor(options: {
    readonly canReconnectFirst: boolean
    readonly canReconnectSecond: boolean
    readonly firstRenderedPosition: FdCanvasPoint
    readonly secondRenderedPosition: FdCanvasPoint
    readonly update: (
      endpoint: FdGraphCanvasEdgeEndpoint,
      renderedTranslation: FdCanvasSize,
    ) => void
    readonly end: (endpoint: FdGraphCanvasEdgeEndpoint) => void
    readonly cancel: () => void
  }) {
    this.canReconnectFirst = options.canReconnectFirst
    this.canReconnectSecond = options.canReconnectSecond
    this.firstRenderedPosition = options.firstRenderedPosition
    this.secondRenderedPosition = options.secondRenderedPosition
    this.#updateAction = options.update
    this.#endAction = options.end
    this.#cancelAction = options.cancel
  }

  renderedPosition(endpoint: FdGraphCanvasEdgeEndpoint): FdCanvasPoint {
    return endpoint === 'first' ? this.firstRenderedPosition : this.secondRenderedPosition
  }

  get isEnabled(): boolean {
    return this.canReconnectFirst || this.canReconnectSecond
  }

  isEnabledFor(endpoint: FdGraphCanvasEdgeEndpoint): boolean {
    return endpoint === 'first' ? this.canReconnectFirst : this.canReconnectSecond
  }

  update(endpoint: FdGraphCanvasEdgeEndpoint, renderedTranslation: FdCanvasSize): void {
    if (this.isEnabledFor(endpoint)) this.#updateAction(endpoint, renderedTranslation)
  }

  end(endpoint: FdGraphCanvasEdgeEndpoint): void {
    if (this.isEnabledFor(endpoint)) this.#endAction(endpoint)
  }

  cancel(): void {
    if (this.isEnabled) this.#cancelAction()
  }

  static get disabled(): FdGraphCanvasEdgeReconnectionActions {
    return new FdGraphCanvasEdgeReconnectionActions({
      canReconnectFirst: false,
      canReconnectSecond: false,
      firstRenderedPosition: { x: 0, y: 0 },
      secondRenderedPosition: { x: 0, y: 0 },
      update: () => {},
      end: () => {},
      cancel: () => {},
    })
  }
}

export type FdGraphCanvasConnectionOperation<
  ElementID extends FdGraphElementID = FdGraphElementID,
> =
  | {
      readonly kind: 'create'
      readonly sourcePortID: ElementID
      readonly targetPortID: ElementID
    }
  | {
      readonly kind: 'reconnect'
      readonly edgeID: ElementID
      readonly endpoint: FdGraphCanvasEdgeEndpoint
      readonly targetPortID: ElementID
    }

export type FdGraphCanvasConnectionCancellationReason =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'noTarget' }
  | { readonly kind: 'invalidTarget'; readonly feedback: FdGraphCanvasConnectionFeedback }

export class FdGraphCanvasConnectionCompletionIntent<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly operation: FdGraphCanvasConnectionOperation<ElementID>
  readonly basePresentationSnapshotID: string | number
  readonly baseLayoutInputID: FdLayoutInputID

  constructor(options: {
    readonly operation: FdGraphCanvasConnectionOperation<ElementID>
    readonly basePresentationSnapshotID: string | number
    readonly baseLayoutInputID: FdLayoutInputID
  }) {
    this.operation = options.operation
    this.basePresentationSnapshotID = options.basePresentationSnapshotID
    this.baseLayoutInputID = options.baseLayoutInputID
  }
}

export class FdGraphCanvasConnectionCancellationIntent<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly origin: FdGraphCanvasConnectionOrigin<ElementID>
  readonly reason: FdGraphCanvasConnectionCancellationReason
  readonly basePresentationSnapshotID: string | number
  readonly baseLayoutInputID: FdLayoutInputID

  constructor(options: {
    readonly origin: FdGraphCanvasConnectionOrigin<ElementID>
    readonly reason: FdGraphCanvasConnectionCancellationReason
    readonly basePresentationSnapshotID: string | number
    readonly baseLayoutInputID: FdLayoutInputID
  }) {
    this.origin = options.origin
    this.reason = options.reason
    this.basePresentationSnapshotID = options.basePresentationSnapshotID
    this.baseLayoutInputID = options.baseLayoutInputID
  }
}

export type FdGraphCanvasConnectionResolution<
  ElementID extends FdGraphElementID = FdGraphElementID,
> =
  | {
      readonly kind: 'completed'
      readonly intent: FdGraphCanvasConnectionCompletionIntent<ElementID>
    }
  | {
      readonly kind: 'cancelled'
      readonly intent: FdGraphCanvasConnectionCancellationIntent<ElementID>
    }
