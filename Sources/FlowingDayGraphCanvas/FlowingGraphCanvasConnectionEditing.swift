import CoreGraphics
import FlowingDayGraphComposition
import FlowingDayGraphLayout
import Foundation
import SwiftUI

public struct FlowingGraphCanvasConnectionEditingConfiguration: Equatable, Sendable {
  public let isEnabled: Bool
  public let allowsReconnection: Bool
  public let targetHitRadius: CGFloat
  public let sourceHitPadding: CGFloat
  public let minimumDragDistance: CGFloat
  public let rendersDefaultPreview: Bool

  public init(
    isEnabled: Bool,
    allowsReconnection: Bool = true,
    targetHitRadius: CGFloat = 18,
    sourceHitPadding: CGFloat = 6,
    minimumDragDistance: CGFloat = 2,
    rendersDefaultPreview: Bool = true
  ) {
    precondition(targetHitRadius > 0 && targetHitRadius.isFinite)
    precondition(sourceHitPadding >= 0 && sourceHitPadding.isFinite)
    precondition(minimumDragDistance >= 0 && minimumDragDistance.isFinite)
    self.isEnabled = isEnabled
    self.allowsReconnection = allowsReconnection
    self.targetHitRadius = targetHitRadius
    self.sourceHitPadding = sourceHitPadding
    self.minimumDragDistance = minimumDragDistance
    self.rendersDefaultPreview = rendersDefaultPreview
  }

  public static let disabled = Self(isEnabled: false)
  public static let standard = Self(isEnabled: true)
}

public enum FlowingGraphCanvasEdgeEndpoint: Hashable, Sendable {
  case first
  case second
}

public enum FlowingGraphCanvasConnectionOrigin<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  case new(sourcePortID: ElementID)
  case reconnect(
    edgeID: ElementID,
    endpoint: FlowingGraphCanvasEdgeEndpoint,
    originalEndpointID: ElementID,
    fixedEndpointID: ElementID
  )

  public var movingElementID: ElementID? {
    switch self {
    case .new:
      nil
    case .reconnect(_, _, let originalEndpointID, _):
      originalEndpointID
    }
  }

  public var fixedElementID: ElementID {
    switch self {
    case .new(let sourcePortID):
      sourcePortID
    case .reconnect(_, _, _, let fixedEndpointID):
      fixedEndpointID
    }
  }
}

public struct FlowingGraphCanvasConnectionFeedback: Equatable, Sendable {
  public let message: String?

  public init(message: String? = nil) {
    self.message = message
  }
}

public enum FlowingGraphCanvasConnectionValidation: Equatable, Sendable {
  case valid
  case invalid(FlowingGraphCanvasConnectionFeedback = .init())

  public var isValid: Bool {
    if case .valid = self { return true }
    return false
  }
}

public struct FlowingGraphCanvasConnectionValidationRequest<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  public let origin: FlowingGraphCanvasConnectionOrigin<Schema>
  public let targetPortID: ElementID
  public let basePresentationSnapshotID: FlowingGraphPresentationSnapshotID
  public let baseLayoutInputID: FlowingLayoutInputID

  public init(
    origin: FlowingGraphCanvasConnectionOrigin<Schema>,
    targetPortID: ElementID,
    basePresentationSnapshotID: FlowingGraphPresentationSnapshotID,
    baseLayoutInputID: FlowingLayoutInputID
  ) {
    self.origin = origin
    self.targetPortID = targetPortID
    self.basePresentationSnapshotID = basePresentationSnapshotID
    self.baseLayoutInputID = baseLayoutInputID
  }
}

public struct FlowingGraphCanvasConnectionPolicy<Schema: FlowingGraphCanvasSchema> {
  private let beginAdmission: @MainActor (FlowingGraphCanvasConnectionOrigin<Schema>) -> Bool
  private let validation:
    @MainActor (FlowingGraphCanvasConnectionValidationRequest<Schema>) ->
      FlowingGraphCanvasConnectionValidation

  public init(
    canBegin: @escaping @MainActor (FlowingGraphCanvasConnectionOrigin<Schema>) -> Bool = {
      _ in true
    },
    validate:
      @escaping @MainActor (FlowingGraphCanvasConnectionValidationRequest<Schema>) ->
      FlowingGraphCanvasConnectionValidation = { _ in .valid }
  ) {
    beginAdmission = canBegin
    validation = validate
  }

  @MainActor
  public func canBegin(_ origin: FlowingGraphCanvasConnectionOrigin<Schema>) -> Bool {
    beginAdmission(origin)
  }

  @MainActor
  public func validate(
    _ request: FlowingGraphCanvasConnectionValidationRequest<Schema>
  ) -> FlowingGraphCanvasConnectionValidation {
    validation(request)
  }

  public static var standard: Self { Self() }
}

public struct FlowingGraphCanvasTransientConnection<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  public let origin: FlowingGraphCanvasConnectionOrigin<Schema>
  public let basePresentationSnapshotID: FlowingGraphPresentationSnapshotID
  public let baseLayoutInputID: FlowingLayoutInputID
  public let stationaryAnchor: FlowingGraphCanvasAnchor
  public let originalMovingAnchor: FlowingGraphCanvasAnchor
  public var movingAnchor: FlowingGraphCanvasAnchor
  public var candidatePortID: ElementID?
  public var validation: FlowingGraphCanvasConnectionValidation?

  public init(
    origin: FlowingGraphCanvasConnectionOrigin<Schema>,
    basePresentationSnapshotID: FlowingGraphPresentationSnapshotID,
    baseLayoutInputID: FlowingLayoutInputID,
    stationaryAnchor: FlowingGraphCanvasAnchor,
    originalMovingAnchor: FlowingGraphCanvasAnchor,
    movingAnchor: FlowingGraphCanvasAnchor? = nil,
    candidatePortID: ElementID? = nil,
    validation: FlowingGraphCanvasConnectionValidation? = nil
  ) {
    self.origin = origin
    self.basePresentationSnapshotID = basePresentationSnapshotID
    self.baseLayoutInputID = baseLayoutInputID
    self.stationaryAnchor = stationaryAnchor
    self.originalMovingAnchor = originalMovingAnchor
    self.movingAnchor = movingAnchor ?? originalMovingAnchor
    self.candidatePortID = candidatePortID
    self.validation = validation
  }
}

public struct FlowingGraphCanvasConnectionPreview<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  public let origin: FlowingGraphCanvasConnectionOrigin<Schema>
  public let first: FlowingGraphCanvasAnchor
  public let second: FlowingGraphCanvasAnchor
  public let candidatePortID: FlowingGraphCompositionElementID<Schema>?
  public let validation: FlowingGraphCanvasConnectionValidation?

  public init(connection: FlowingGraphCanvasTransientConnection<Schema>) {
    origin = connection.origin
    candidatePortID = connection.candidatePortID
    validation = connection.validation
    switch connection.origin {
    case .new, .reconnect(_, .second, _, _):
      first = connection.stationaryAnchor
      second = connection.movingAnchor
    case .reconnect(_, .first, _, _):
      first = connection.movingAnchor
      second = connection.stationaryAnchor
    }
  }
}

public enum FlowingGraphCanvasPortConnectionState: Equatable, Sendable {
  case idle
  case source
  case target(validation: FlowingGraphCanvasConnectionValidation, isCandidate: Bool)
}

@MainActor
public struct FlowingGraphCanvasEdgeReconnectionActions<
  Schema: FlowingGraphCanvasSchema
> {
  public let canReconnectFirst: Bool
  public let canReconnectSecond: Bool
  public let firstRenderedPosition: CGPoint
  public let secondRenderedPosition: CGPoint
  private let updateAction: (FlowingGraphCanvasEdgeEndpoint, CGSize) -> Void
  private let endAction: (FlowingGraphCanvasEdgeEndpoint) -> Void
  private let cancelAction: () -> Void

  init(
    canReconnectFirst: Bool,
    canReconnectSecond: Bool,
    firstRenderedPosition: CGPoint,
    secondRenderedPosition: CGPoint,
    update: @escaping (FlowingGraphCanvasEdgeEndpoint, CGSize) -> Void,
    end: @escaping (FlowingGraphCanvasEdgeEndpoint) -> Void,
    cancel: @escaping () -> Void
  ) {
    self.canReconnectFirst = canReconnectFirst
    self.canReconnectSecond = canReconnectSecond
    self.firstRenderedPosition = firstRenderedPosition
    self.secondRenderedPosition = secondRenderedPosition
    updateAction = update
    endAction = end
    cancelAction = cancel
  }

  public func renderedPosition(for endpoint: FlowingGraphCanvasEdgeEndpoint) -> CGPoint {
    switch endpoint {
    case .first: firstRenderedPosition
    case .second: secondRenderedPosition
    }
  }

  public var isEnabled: Bool {
    canReconnectFirst || canReconnectSecond
  }

  public func isEnabled(for endpoint: FlowingGraphCanvasEdgeEndpoint) -> Bool {
    switch endpoint {
    case .first: canReconnectFirst
    case .second: canReconnectSecond
    }
  }

  public func update(
    endpoint: FlowingGraphCanvasEdgeEndpoint,
    renderedTranslation: CGSize
  ) {
    guard isEnabled(for: endpoint) else { return }
    updateAction(endpoint, renderedTranslation)
  }

  public func end(endpoint: FlowingGraphCanvasEdgeEndpoint) {
    guard isEnabled(for: endpoint) else { return }
    endAction(endpoint)
  }

  public func cancel() {
    guard isEnabled else { return }
    cancelAction()
  }

  public static var disabled: Self {
    Self(
      canReconnectFirst: false,
      canReconnectSecond: false,
      firstRenderedPosition: .zero,
      secondRenderedPosition: .zero,
      update: { _, _ in },
      end: { _ in },
      cancel: {}
    )
  }
}

public struct FlowingGraphCanvasEdgeReconnectHandle<
  Schema: FlowingGraphCanvasSchema,
  Content: View
>: View {
  private let endpoint: FlowingGraphCanvasEdgeEndpoint
  private let actions: FlowingGraphCanvasEdgeReconnectionActions<Schema>
  private let content: () -> Content

  public init(
    endpoint: FlowingGraphCanvasEdgeEndpoint,
    actions: FlowingGraphCanvasEdgeReconnectionActions<Schema>,
    @ViewBuilder content: @escaping () -> Content
  ) {
    self.endpoint = endpoint
    self.actions = actions
    self.content = content
  }

  public var body: some View {
    content()
      .contentShape(Rectangle())
      .position(actions.renderedPosition(for: endpoint))
      .gesture(
        DragGesture(minimumDistance: 0)
          .onChanged { value in
            actions.update(
              endpoint: endpoint,
              renderedTranslation: value.translation
            )
          }
          .onEnded { _ in
            actions.end(endpoint: endpoint)
          }
      )
      .allowsHitTesting(actions.isEnabled(for: endpoint))
  }
}

public enum FlowingGraphCanvasConnectionOperation<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  case create(sourcePortID: ElementID, targetPortID: ElementID)
  case reconnect(
    edgeID: ElementID,
    endpoint: FlowingGraphCanvasEdgeEndpoint,
    targetPortID: ElementID
  )
}

public struct FlowingGraphCanvasConnectionCompletionIntent<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  public let operation: FlowingGraphCanvasConnectionOperation<Schema>
  public let basePresentationSnapshotID: FlowingGraphPresentationSnapshotID
  public let baseLayoutInputID: FlowingLayoutInputID

  public init(
    operation: FlowingGraphCanvasConnectionOperation<Schema>,
    basePresentationSnapshotID: FlowingGraphPresentationSnapshotID,
    baseLayoutInputID: FlowingLayoutInputID
  ) {
    self.operation = operation
    self.basePresentationSnapshotID = basePresentationSnapshotID
    self.baseLayoutInputID = baseLayoutInputID
  }
}

public enum FlowingGraphCanvasConnectionCancellationReason: Equatable, Sendable {
  case cancelled
  case noTarget
  case invalidTarget(FlowingGraphCanvasConnectionFeedback)
}

public struct FlowingGraphCanvasConnectionCancellationIntent<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  public let origin: FlowingGraphCanvasConnectionOrigin<Schema>
  public let reason: FlowingGraphCanvasConnectionCancellationReason
  public let basePresentationSnapshotID: FlowingGraphPresentationSnapshotID
  public let baseLayoutInputID: FlowingLayoutInputID

  public init(
    origin: FlowingGraphCanvasConnectionOrigin<Schema>,
    reason: FlowingGraphCanvasConnectionCancellationReason,
    basePresentationSnapshotID: FlowingGraphPresentationSnapshotID,
    baseLayoutInputID: FlowingLayoutInputID
  ) {
    self.origin = origin
    self.reason = reason
    self.basePresentationSnapshotID = basePresentationSnapshotID
    self.baseLayoutInputID = baseLayoutInputID
  }
}

public enum FlowingGraphCanvasConnectionResolution<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  case completed(FlowingGraphCanvasConnectionCompletionIntent<Schema>)
  case cancelled(FlowingGraphCanvasConnectionCancellationIntent<Schema>)
}

public struct FlowingGraphCanvasConnectionTarget<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  public let elementID: FlowingGraphCompositionElementID<Schema>
  public let anchor: FlowingGraphCanvasAnchor

  public init(
    elementID: FlowingGraphCompositionElementID<Schema>,
    anchor: FlowingGraphCanvasAnchor
  ) {
    self.elementID = elementID
    self.anchor = anchor
  }
}

extension FlowingGraphCanvasContent {
  public func connectionAnchor(for elementID: ElementID) -> FlowingGraphCanvasAnchor? {
    guard let localID = localID(for: elementID) else { return nil }
    if let anchor = anchor(for: localID) {
      return anchor
    }
    guard let frame = frame(for: localID) else { return nil }
    return FlowingGraphCanvasAnchor(
      position: CGPoint(x: frame.midX, y: frame.midY)
    )
  }

  public func nearestPort(
    to point: CGPoint,
    maximumDistance: CGFloat
  ) -> FlowingGraphCanvasConnectionTarget<Schema>? {
    precondition(maximumDistance > 0 && maximumDistance.isFinite)
    let searchRect = CGRect(
      x: point.x - maximumDistance,
      y: point.y - maximumDistance,
      width: maximumDistance * 2,
      height: maximumDistance * 2
    )
    let maximumSquaredDistance = maximumDistance * maximumDistance
    let portLocalIDs = renderElementIDs(intersecting: searchRect).nodeIDs.flatMap {
      self.portLocalIDs(of: $0)
    }
    let result: (target: FlowingGraphCanvasConnectionTarget<Schema>, distance: CGFloat)? =
      portLocalIDs.reduce(nil) { best, localID in
        guard let elementID = elementID(for: localID),
          let anchor = anchor(for: localID)
        else {
          return best
        }
        let dx = anchor.position.x - point.x
        let dy = anchor.position.y - point.y
        let distance = dx * dx + dy * dy
        guard distance <= maximumSquaredDistance else { return best }
        guard let best else {
          return (
            FlowingGraphCanvasConnectionTarget<Schema>(elementID: elementID, anchor: anchor),
            distance
          )
        }
        return distance < best.1
          ? (
            FlowingGraphCanvasConnectionTarget<Schema>(elementID: elementID, anchor: anchor),
            distance
          )
          : best
      }
    return result?.target
  }
}

@MainActor
public enum FlowingGraphCanvasConnectionInteractionResolver {
  public static func begin<Schema: FlowingGraphCanvasSchema>(
    origin: FlowingGraphCanvasConnectionOrigin<Schema>,
    content: FlowingGraphCanvasContent<Schema>,
    policy: FlowingGraphCanvasConnectionPolicy<Schema>
  ) -> FlowingGraphCanvasTransientConnection<Schema>? {
    guard policy.canBegin(origin) else { return nil }
    let stationaryElementID: FlowingGraphCompositionElementID<Schema>
    let movingElementID: FlowingGraphCompositionElementID<Schema>
    switch origin {
    case .new(let sourcePortID):
      stationaryElementID = sourcePortID
      movingElementID = sourcePortID
    case .reconnect(_, _, let originalEndpointID, let fixedEndpointID):
      stationaryElementID = fixedEndpointID
      movingElementID = originalEndpointID
    }
    guard let stationaryAnchor = content.connectionAnchor(for: stationaryElementID),
      let movingAnchor = content.connectionAnchor(for: movingElementID)
    else {
      return nil
    }
    return FlowingGraphCanvasTransientConnection(
      origin: origin,
      basePresentationSnapshotID: content.presentation.snapshotID,
      baseLayoutInputID: content.id,
      stationaryAnchor: stationaryAnchor,
      originalMovingAnchor: movingAnchor
    )
  }

  public static func update<Schema: FlowingGraphCanvasSchema>(
    _ connection: inout FlowingGraphCanvasTransientConnection<Schema>,
    worldLocation: CGPoint,
    targetHitRadius: CGFloat,
    content: FlowingGraphCanvasContent<Schema>,
    policy: FlowingGraphCanvasConnectionPolicy<Schema>
  ) {
    precondition(targetHitRadius > 0 && targetHitRadius.isFinite)
    guard connection.basePresentationSnapshotID == content.presentation.snapshotID,
      connection.baseLayoutInputID == content.id
    else {
      return
    }
    let candidate = content.nearestPort(
      to: worldLocation,
      maximumDistance: targetHitRadius
    )
    guard let candidate else {
      connection.movingAnchor = FlowingGraphCanvasAnchor(position: worldLocation)
      connection.candidatePortID = nil
      connection.validation = nil
      return
    }
    let request = FlowingGraphCanvasConnectionValidationRequest(
      origin: connection.origin,
      targetPortID: candidate.elementID,
      basePresentationSnapshotID: connection.basePresentationSnapshotID,
      baseLayoutInputID: connection.baseLayoutInputID
    )
    connection.movingAnchor = candidate.anchor
    connection.candidatePortID = candidate.elementID
    connection.validation = policy.validate(request)
  }

  public static func resolve<Schema: FlowingGraphCanvasSchema>(
    _ connection: FlowingGraphCanvasTransientConnection<Schema>
  ) -> FlowingGraphCanvasConnectionResolution<Schema> {
    guard let targetPortID = connection.candidatePortID else {
      return .cancelled(
        cancellation(connection, reason: .noTarget)
      )
    }
    switch connection.validation {
    case .valid:
      let operation: FlowingGraphCanvasConnectionOperation<Schema>
      switch connection.origin {
      case .new(let sourcePortID):
        operation = .create(sourcePortID: sourcePortID, targetPortID: targetPortID)
      case .reconnect(let edgeID, let endpoint, _, _):
        operation = .reconnect(
          edgeID: edgeID,
          endpoint: endpoint,
          targetPortID: targetPortID
        )
      }
      return .completed(
        FlowingGraphCanvasConnectionCompletionIntent(
          operation: operation,
          basePresentationSnapshotID: connection.basePresentationSnapshotID,
          baseLayoutInputID: connection.baseLayoutInputID
        )
      )
    case .invalid(let feedback):
      return .cancelled(cancellation(connection, reason: .invalidTarget(feedback)))
    case nil:
      return .cancelled(cancellation(connection, reason: .noTarget))
    }
  }

  public static func cancel<Schema: FlowingGraphCanvasSchema>(
    _ connection: FlowingGraphCanvasTransientConnection<Schema>
  ) -> FlowingGraphCanvasConnectionCancellationIntent<Schema> {
    cancellation(connection, reason: .cancelled)
  }

  private static func cancellation<Schema: FlowingGraphCanvasSchema>(
    _ connection: FlowingGraphCanvasTransientConnection<Schema>,
    reason: FlowingGraphCanvasConnectionCancellationReason
  ) -> FlowingGraphCanvasConnectionCancellationIntent<Schema> {
    FlowingGraphCanvasConnectionCancellationIntent(
      origin: connection.origin,
      reason: reason,
      basePresentationSnapshotID: connection.basePresentationSnapshotID,
      baseLayoutInputID: connection.baseLayoutInputID
    )
  }
}
