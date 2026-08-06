import FlowingDayGraphCollaboration
import Foundation
import XCTest

final class FlowingCollaborationSequenceTests: XCTestCase {
  func testPositionsCanBeInsertedAtEitherBoundaryAndBetweenNeighbors() throws {
    let middle = try position(between: nil, and: nil, operation: 1)
    let first = try position(between: nil, and: middle, operation: 2)
    let last = try position(between: middle, and: nil, operation: 3)
    let inner = try position(between: first, and: middle, operation: 4)

    XCTAssertEqual([middle, first, last, inner].sorted(), [first, inner, middle, last])
  }

  func testConcurrentPositionsInTheSameGapAreUniqueAndDeterministic() throws {
    let lower = try position(between: nil, and: nil, operation: 1)
    let upper = try position(between: lower, and: nil, operation: 2)
    let first = try position(between: lower, and: upper, operation: 3)
    let second = try position(between: lower, and: upper, operation: 4)

    XCTAssertEqual(first.components, second.components)
    XCTAssertNotEqual(first, second)
    XCTAssertEqual([second, upper, first, lower].sorted(), [lower, first, second, upper])
  }

  func testPositionBetweenConcurrentKeysUsesAThirdDiscriminator() throws {
    let lower = try position(between: nil, and: nil, operation: 1)
    let upper = try position(between: lower, and: nil, operation: 2)
    let first = try position(between: lower, and: upper, operation: 3)
    let second = try position(between: lower, and: upper, operation: 5)
    let inner = try position(between: first, and: second, operation: 4)

    XCTAssertTrue(first < inner)
    XCTAssertTrue(inner < second)
  }

  func testInvalidBoundsAndKeyBudgetAreRejected() throws {
    let position = try position(between: nil, and: nil, operation: 1)

    XCTAssertThrowsError(
      try self.position(between: position, and: position, operation: 2)
    ) { error in
      XCTAssertEqual(error as? FlowingCollaborationSequenceIssue, .invalidBounds)
    }
    XCTAssertThrowsError(
      try self.position(between: nil, and: nil, operation: 2, maximumBytes: 1)
    ) { error in
      XCTAssertEqual(
        error as? FlowingCollaborationSequenceIssue,
        .keyLimitExceeded(maximumBytes: 1, requiredBytes: 30)
      )
    }
  }

  func testRepeatedFrontInsertionExtendsWithoutRecursion() throws {
    var upper: FlowingCollaborationSequencePosition?
    for operation in 1...1_000 {
      let next = try position(between: nil, and: upper, operation: operation)
      if let upper {
        XCTAssertTrue(next < upper)
      }
      upper = next
    }
  }

  func testRepeatedBackInsertionExtendsWithoutRecursion() throws {
    var lower: FlowingCollaborationSequencePosition?
    for operation in 1...1_000 {
      let next = try position(between: lower, and: nil, operation: operation)
      if let lower {
        XCTAssertTrue(lower < next)
      }
      lower = next
    }
  }

  private func position(
    between lower: FlowingCollaborationSequencePosition?,
    and upper: FlowingCollaborationSequencePosition?,
    operation: Int,
    maximumBytes: Int = FlowingCollaborationLimits.standard.maximumSequenceKeyBytes
  ) throws -> FlowingCollaborationSequencePosition {
    try FlowingCollaborationSequence.position(
      between: lower,
      and: upper,
      discriminator: .init(
        operationID: .init(replicaID: replicaID(operation), counter: 1),
        commandIndex: 0
      ),
      maximumBytes: maximumBytes
    )
  }

  private func replicaID(_ value: Int) -> FlowingReplicaID {
    FlowingReplicaID(
      UUID(uuidString: String(format: "00000000-0000-0000-0000-%012X", value))!
    )
  }
}
