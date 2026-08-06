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

public struct FlowingCollaborationSequenceSegment: Hashable, Comparable, Sendable {
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

public struct FlowingCollaborationSequencePosition: Hashable, Comparable, Sendable {
  public let segments: [FlowingCollaborationSequenceSegment]

  public var components: [UInt16] {
    segments.last!.components
  }

  public var discriminator: FlowingCollaborationSequenceDiscriminator {
    segments.last!.discriminator
  }

  public var encodedByteCount: Int {
    segments.reduce(0) { $0 + $1.encodedByteCount }
  }

  public init(
    components: [UInt16],
    discriminator: FlowingCollaborationSequenceDiscriminator
  ) throws {
    segments = [
      try FlowingCollaborationSequenceSegment(
        components: components,
        discriminator: discriminator
      )
    ]
  }

  public init(segments: [FlowingCollaborationSequenceSegment]) throws {
    guard !segments.isEmpty else {
      throw FlowingCollaborationSequenceIssue.emptyPosition
    }
    self.segments = segments
  }

  public static func < (lhs: Self, rhs: Self) -> Bool {
    lhs.segments.lexicographicallyPrecedes(rhs.segments)
  }
}

public enum FlowingCollaborationSequenceIssue: Error, Equatable, Sendable {
  case emptyPosition
  case nonCanonicalPosition
  case invalidBounds
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

    let segments = try segmentsBetween(
      lower?.segments,
      upper?.segments,
      discriminator: discriminator
    )
    let position = try FlowingCollaborationSequencePosition(segments: segments)
    let requiredBytes = position.encodedByteCount
    guard requiredBytes <= maximumBytes else {
      throw FlowingCollaborationSequenceIssue.keyLimitExceeded(
        maximumBytes: maximumBytes,
        requiredBytes: requiredBytes
      )
    }
    return position
  }

  private static func segmentsBetween(
    _ lower: [FlowingCollaborationSequenceSegment]?,
    _ upper: [FlowingCollaborationSequenceSegment]?,
    discriminator: FlowingCollaborationSequenceDiscriminator
  ) throws -> [FlowingCollaborationSequenceSegment] {
    var common: [FlowingCollaborationSequenceSegment] = []
    var index = 0
    while let lowerSegment = segment(at: index, in: lower),
      let upperSegment = segment(at: index, in: upper),
      lowerSegment == upperSegment
    {
      common.append(lowerSegment)
      index += 1
    }

    let lowerSegment = segment(at: index, in: lower)
    let upperSegment = segment(at: index, in: upper)
    guard let lowerSegment else {
      let components = uniqueComponents(
        between: nil,
        and: upperSegment?.components,
        discriminator: discriminator
      )
      return common + [
        try FlowingCollaborationSequenceSegment(
          components: components,
          discriminator: discriminator
        )
      ]
    }
    guard let upperSegment else {
      let components = uniqueComponents(
        between: lowerSegment.components,
        and: nil,
        discriminator: discriminator
      )
      return common + [
        try FlowingCollaborationSequenceSegment(
          components: components,
          discriminator: discriminator
        )
      ]
    }
    if lowerSegment.components != upperSegment.components {
      return common + [
        try FlowingCollaborationSequenceSegment(
          components: uniqueComponents(
            between: lowerSegment.components,
            and: upperSegment.components,
            discriminator: discriminator
          ),
          discriminator: discriminator
        )
      ]
    }
    if lowerSegment.discriminator < discriminator,
      discriminator < upperSegment.discriminator
    {
      return common + [
        try FlowingCollaborationSequenceSegment(
          components: lowerSegment.components,
          discriminator: discriminator
        )
      ]
    }
    let nested = try FlowingCollaborationSequenceSegment(
      components: uniqueComponents(
        between: nil,
        and: nil,
        discriminator: discriminator
      ),
      discriminator: discriminator
    )
    return (lower ?? []) + [nested]
  }

  private static func uniqueComponents(
    between lower: [UInt16]?,
    and upper: [UInt16]?,
    discriminator: FlowingCollaborationSequenceDiscriminator
  ) -> [UInt16] {
    componentsBetween(lower, upper) + encoded(discriminator)
  }

  private static func encoded(
    _ discriminator: FlowingCollaborationSequenceDiscriminator
  ) -> [UInt16] {
    var uuid = discriminator.operationID.replicaID.rawValue.uuid
    var result = withUnsafeBytes(of: &uuid) { bytes in
      stride(from: 0, to: bytes.count, by: 2).map { index in
        UInt16(bytes[index]) << 8 | UInt16(bytes[index + 1])
      }
    }
    result.append(contentsOf: words(discriminator.operationID.counter))
    result.append(contentsOf: words(discriminator.commandIndex))
    result.append(1)
    return result
  }

  private static func words<T: FixedWidthInteger>(_ value: T) -> [UInt16] {
    stride(from: T.bitWidth - 16, through: 0, by: -16).map { shift in
      UInt16(truncatingIfNeeded: value >> T(shift))
    }
  }

  private static func segment(
    at index: Int,
    in segments: [FlowingCollaborationSequenceSegment]?
  ) -> FlowingCollaborationSequenceSegment? {
    guard let segments, index < segments.count else { return nil }
    return segments[index]
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
