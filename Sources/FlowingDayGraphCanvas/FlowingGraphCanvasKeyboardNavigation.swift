import CoreGraphics

public enum FlowingGraphCanvasNavigationDirection: Hashable, Sendable {
  case up
  case down
  case left
  case right
}

public enum FlowingGraphCanvasKeyboardSelectionBehavior: Hashable, Sendable {
  case preserve
  case replace
}

public struct FlowingGraphCanvasKeyboardNavigationConfiguration: Equatable, Sendable {
  public let isEnabled: Bool
  public let selectionBehavior: FlowingGraphCanvasKeyboardSelectionBehavior
  public let keepsFocusedNodeVisible: Bool

  public init(
    isEnabled: Bool = true,
    selectionBehavior: FlowingGraphCanvasKeyboardSelectionBehavior = .replace,
    keepsFocusedNodeVisible: Bool = true
  ) {
    self.isEnabled = isEnabled
    self.selectionBehavior = selectionBehavior
    self.keepsFocusedNodeVisible = keepsFocusedNodeVisible
  }

  public static let disabled = Self(isEnabled: false)
  public static let standard = Self()
}

public struct FlowingGraphCanvasKeyboardNudgingConfiguration: Equatable, Sendable {
  public static let standardStep: CGFloat = 1
  public static let standardLargeStep: CGFloat = 10

  public let isEnabled: Bool
  public let step: CGFloat
  public let largeStep: CGFloat

  public init(
    isEnabled: Bool = true,
    step: CGFloat = standardStep,
    largeStep: CGFloat = standardLargeStep
  ) {
    precondition(step > 0 && step.isFinite)
    precondition(largeStep >= step && largeStep.isFinite)
    self.isEnabled = isEnabled
    self.step = step
    self.largeStep = largeStep
  }

  public static let disabled = Self(isEnabled: false)
  public static let standard = Self()
}

public enum FlowingGraphCanvasKeyboardNudger {
  public static func translation(
    direction: FlowingGraphCanvasNavigationDirection,
    configuration: FlowingGraphCanvasKeyboardNudgingConfiguration,
    modifiers: FlowingGraphCanvasInteractionModifiers = []
  ) -> CGSize? {
    guard configuration.isEnabled else { return nil }
    let distance =
      modifiers.contains(.largeKeyboardNudge)
      ? configuration.largeStep
      : configuration.step
    switch direction {
    case .up:
      return CGSize(width: 0, height: -distance)
    case .down:
      return CGSize(width: 0, height: distance)
    case .left:
      return CGSize(width: -distance, height: 0)
    case .right:
      return CGSize(width: distance, height: 0)
    }
  }
}

public struct FlowingGraphCanvasNavigationCandidate<ID: Hashable & Sendable>: Sendable {
  public let id: ID
  public let frame: CGRect
  public let presentationOrder: Int

  public init(id: ID, frame: CGRect, presentationOrder: Int) {
    self.id = id
    self.frame = frame
    self.presentationOrder = presentationOrder
  }
}

extension FlowingGraphCanvasNavigationCandidate: Equatable where ID: Equatable {}

public enum FlowingGraphCanvasKeyboardNavigator {
  public static func nextNodeID<ID: Hashable & Sendable>(
    from current: FlowingGraphCanvasNavigationCandidate<ID>,
    direction: FlowingGraphCanvasNavigationDirection,
    candidates: [FlowingGraphCanvasNavigationCandidate<ID>]
  ) -> ID? {
    candidates.lazy
      .filter { $0.id != current.id && isInDirection($0, from: current, direction: direction) }
      .min { first, second in
        score(first, from: current, direction: direction)
          < score(second, from: current, direction: direction)
      }?.id
  }

  private static func isInDirection<ID>(
    _ candidate: FlowingGraphCanvasNavigationCandidate<ID>,
    from current: FlowingGraphCanvasNavigationCandidate<ID>,
    direction: FlowingGraphCanvasNavigationDirection
  ) -> Bool {
    switch direction {
    case .up:
      candidate.frame.midY < current.frame.midY
    case .down:
      candidate.frame.midY > current.frame.midY
    case .left:
      candidate.frame.midX < current.frame.midX
    case .right:
      candidate.frame.midX > current.frame.midX
    }
  }

  private static func score<ID>(
    _ candidate: FlowingGraphCanvasNavigationCandidate<ID>,
    from current: FlowingGraphCanvasNavigationCandidate<ID>,
    direction: FlowingGraphCanvasNavigationDirection
  ) -> Score {
    let dx = candidate.frame.midX - current.frame.midX
    let dy = candidate.frame.midY - current.frame.midY
    let orthogonalDistance = direction == .left || direction == .right ? abs(dy) : abs(dx)
    return Score(
      distanceSquared: dx * dx + dy * dy,
      orthogonalDistance: orthogonalDistance,
      presentationOrder: candidate.presentationOrder
    )
  }

  private struct Score: Comparable {
    let distanceSquared: CGFloat
    let orthogonalDistance: CGFloat
    let presentationOrder: Int

    static func < (first: Self, second: Self) -> Bool {
      if first.distanceSquared != second.distanceSquared {
        return first.distanceSquared < second.distanceSquared
      }
      if first.orthogonalDistance != second.orthogonalDistance {
        return first.orthogonalDistance < second.orthogonalDistance
      }
      return first.presentationOrder < second.presentationOrder
    }
  }
}
