import Foundation

public struct FlowingCollaborationSequenceDiscriminator: Hashable, Comparable, Sendable {
  public let operationID: FlowingCollaborationOperationID
  public let commandIndex: UInt32

  public init(operationID: FlowingCollaborationOperationID, commandIndex: UInt32) {
    self.operationID = operationID
    self.commandIndex = commandIndex
  }

  public static func < (lhs: Self, rhs: Self) -> Bool {
    if lhs.operationID != rhs.operationID {
      return lhs.operationID < rhs.operationID
    }
    return lhs.commandIndex < rhs.commandIndex
  }
}

public struct FlowingCollaborationSequencePosition: Hashable, Comparable, Sendable {
  public let components: [UInt16]
  public let discriminator: FlowingCollaborationSequenceDiscriminator

  public var encodedByteCount: Int {
    components.count * MemoryLayout<UInt16>.size + MemoryLayout<UUID>.size
      + MemoryLayout<UInt64>.size + MemoryLayout<UInt32>.size
  }

  public init(
    components: [UInt16],
    discriminator: FlowingCollaborationSequenceDiscriminator
  ) throws {
    guard !components.isEmpty else {
      throw FlowingCollaborationSequenceIssue.emptyPosition
    }
    guard components.last != 0 else {
      throw FlowingCollaborationSequenceIssue.nonCanonicalPosition
    }
    self.components = components
    self.discriminator = discriminator
  }

  public static func < (lhs: Self, rhs: Self) -> Bool {
    if lhs.components != rhs.components {
      return lhs.components.lexicographicallyPrecedes(rhs.components)
    }
    return lhs.discriminator < rhs.discriminator
  }
}

public enum FlowingCollaborationSequenceIssue: Error, Equatable, Sendable {
  case emptyPosition
  case nonCanonicalPosition
  case invalidBounds
  case discriminatorDoesNotFit
  case keyLimitExceeded(maximumBytes: Int, requiredBytes: Int)
}

public enum FlowingCollaborationSequence {
  public static func position(
    between lower: FlowingCollaborationSequencePosition?,
    and upper: FlowingCollaborationSequencePosition?,
    discriminator: FlowingCollaborationSequenceDiscriminator,
    maximumBytes: Int = FlowingCollaborationLimits.standard.maximumSequenceKeyBytes
  ) throws -> FlowingCollaborationSequencePosition {
    guard lower == nil || upper == nil || lower! < upper! else {
      throw FlowingCollaborationSequenceIssue.invalidBounds
    }

    let components: [UInt16]
    if let lower, let upper, lower.components == upper.components {
      guard lower.discriminator < discriminator, discriminator < upper.discriminator else {
        throw FlowingCollaborationSequenceIssue.discriminatorDoesNotFit
      }
      components = lower.components
    } else {
      components = componentsBetween(lower?.components, upper?.components)
    }

    let position = try FlowingCollaborationSequencePosition(
      components: components,
      discriminator: discriminator
    )
    let requiredBytes = position.encodedByteCount
    guard requiredBytes <= maximumBytes else {
      throw FlowingCollaborationSequenceIssue.keyLimitExceeded(
        maximumBytes: maximumBytes,
        requiredBytes: requiredBytes
      )
    }
    return position
  }

  private static func componentsBetween(
    _ lower: [UInt16]?,
    _ upper: [UInt16]?
  ) -> [UInt16] {
    var result: [UInt16] = []
    var activeUpper = upper
    var index = 0
    while true {
      let lowerComponent = lowerComponent(at: index, in: lower)
      let upperComponent = upperComponent(at: index, in: activeUpper)
      if lowerComponent == upperComponent {
        result.append(lowerComponent)
        index += 1
        continue
      }
      if upperComponent > lowerComponent && upperComponent - lowerComponent > 1 {
        result.append(lowerComponent + (upperComponent - lowerComponent) / 2)
        return result
      }
      if upperComponent == lowerComponent {
        result.append(lowerComponent)
        index += 1
        continue
      }
      result.append(lowerComponent)
      activeUpper = nil
      index += 1
    }
  }

  private static func lowerComponent(at index: Int, in components: [UInt16]?) -> UInt16 {
    guard let components, index < components.count else { return .min }
    return components[index]
  }

  private static func upperComponent(at index: Int, in components: [UInt16]?) -> UInt16 {
    guard let components else { return .max }
    guard index < components.count else { return .min }
    return components[index]
  }
}
