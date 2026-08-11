import FlowingDayGraphLayout
import Foundation
import XCTest

final class FlowingGraphLayoutDriverTests: XCTestCase {
  func testNewRequestSupersedesAnInFlightRequest() async throws {
    let gate = TestLayoutGate()
    let driver = FlowingGraphLayoutDriver<DriverSchema>()
    let firstTopology = try topology(snapshotID: .init())
    let firstSizeResolver = sizeResolver
    let firstAnchorResolver = anchorResolver
    let first = Task {
      try await driver.layout(
        topology: firstTopology,
        nodeSizeResolver: firstSizeResolver,
        portAnchorResolver: firstAnchorResolver,
        strategy: GatedLayoutStrategy(gate: gate)
      )
    }
    gate.waitUntilStarted()

    let second = try await driver.layout(
      topology: try topology(snapshotID: .init()),
      nodeSizeResolver: sizeResolver,
      portAnchorResolver: anchorResolver,
      strategy: ImmediateLayoutStrategy()
    )
    gate.release()
    let firstOutcome = try await first.value

    guard case .completed = second else {
      return XCTFail("Expected the newest request to complete")
    }
    guard case .superseded = firstOutcome else {
      return XCTFail("Expected the older request to be superseded")
    }
  }

  func testExplicitCancellationSupersedesTheInFlightRequest() async throws {
    let gate = TestLayoutGate()
    let driver = FlowingGraphLayoutDriver<DriverSchema>()
    let requestTopology = try topology(snapshotID: .init())
    let requestSizeResolver = sizeResolver
    let requestAnchorResolver = anchorResolver
    let request = Task {
      try await driver.layout(
        topology: requestTopology,
        nodeSizeResolver: requestSizeResolver,
        portAnchorResolver: requestAnchorResolver,
        strategy: GatedLayoutStrategy(gate: gate)
      )
    }
    gate.waitUntilStarted()

    await driver.cancel()
    gate.release()

    guard case .superseded = try await request.value else {
      return XCTFail("Expected the cancelled request to be superseded")
    }
  }

  func testCallerCancellationPropagatesToTheLayoutTask() async throws {
    let gate = TestLayoutGate()
    let driver = FlowingGraphLayoutDriver<DriverSchema>()
    let requestTopology = try topology(snapshotID: .init())
    let requestSizeResolver = sizeResolver
    let requestAnchorResolver = anchorResolver
    let request = Task {
      try await driver.layout(
        topology: requestTopology,
        nodeSizeResolver: requestSizeResolver,
        portAnchorResolver: requestAnchorResolver,
        strategy: GatedLayoutStrategy(gate: gate)
      )
    }
    gate.waitUntilStarted()

    request.cancel()

    do {
      _ = try await request.value
      XCTFail("Expected cancellation to propagate")
    } catch is CancellationError {
    } catch {
      XCTFail("Expected CancellationError, received \(error)")
    }
  }

  func testDriverRejectsAResultProducedForAnotherInput() async throws {
    let strategyIdentity = FlowingLayoutPipelineIdentity(
      component: FlowingLayoutComponentIdentity()
    )
    let foreignInput = try FlowingGraphLayoutResolution.input(
      topology: try topology(snapshotID: .init()),
      nodeSizeResolver: sizeResolver,
      portAnchorResolver: anchorResolver,
      pipelineIdentity: strategyIdentity
    )
    let foreignResult = try makeResult(input: foreignInput)
    let driver = FlowingGraphLayoutDriver<DriverSchema>()

    do {
      _ = try await driver.layout(
        topology: try topology(snapshotID: .init()),
        nodeSizeResolver: sizeResolver,
        portAnchorResolver: anchorResolver,
        strategy: ForeignResultStrategy(
          identity: strategyIdentity,
          result: foreignResult
        )
      )
      XCTFail("Expected the foreign result to be rejected")
    } catch {
      XCTAssertEqual(error as? FlowingGraphLayoutDriverError, .resultIdentityMismatch)
    }
  }

  private var sizeResolver: FlowingFixedNodeSizeResolver<DriverSchema> {
    FlowingFixedNodeSizeResolver(size: CGSize(width: 100, height: 60))
  }

  private var anchorResolver: FlowingCenteredPortAnchorResolver<DriverSchema> {
    FlowingCenteredPortAnchorResolver()
  }

  private func topology(
    snapshotID: FlowingGraphPresentationSnapshotID
  ) throws -> FlowingGraphLayoutTopology<DriverSchema> {
    try FlowingGraphLayoutTopology(
      snapshotID: snapshotID,
      nodeIDs: ["node"],
      ports: [],
      edges: []
    )
  }
}

private enum DriverSchema: FlowingGraphLayoutSchema {
  typealias NodeID = String
  typealias PortID = String
  typealias EdgeID = String
}

private struct ImmediateLayoutStrategy: FlowingGraphLayoutStrategy {
  typealias Schema = DriverSchema

  let identity = FlowingLayoutPipelineIdentity(
    component: FlowingLayoutComponentIdentity()
  )

  func layout(
    _ input: FlowingGraphLayoutInput<DriverSchema>
  ) throws -> FlowingGraphLayoutResult<DriverSchema> {
    try makeResult(input: input)
  }
}

private struct GatedLayoutStrategy: FlowingGraphLayoutStrategy {
  typealias Schema = DriverSchema

  let identity = FlowingLayoutPipelineIdentity(
    component: FlowingLayoutComponentIdentity()
  )
  let gate: TestLayoutGate

  func layout(
    _ input: FlowingGraphLayoutInput<DriverSchema>
  ) throws -> FlowingGraphLayoutResult<DriverSchema> {
    try gate.waitUntilReleased()
    return try makeResult(input: input)
  }
}

private struct ForeignResultStrategy: FlowingGraphLayoutStrategy {
  typealias Schema = DriverSchema

  let identity: FlowingLayoutPipelineIdentity
  let result: FlowingGraphLayoutResult<DriverSchema>

  func layout(
    _ input: FlowingGraphLayoutInput<DriverSchema>
  ) throws -> FlowingGraphLayoutResult<DriverSchema> {
    result
  }
}

private final class TestLayoutGate: @unchecked Sendable {
  private let condition = NSCondition()
  private var isReleased = false
  private var isStarted = false

  func waitUntilStarted() {
    condition.lock()
    while !isStarted {
      condition.wait()
    }
    condition.unlock()
  }

  func waitUntilReleased() throws {
    condition.lock()
    isStarted = true
    condition.broadcast()
    while !isReleased && !Task.isCancelled {
      condition.wait(until: Date(timeIntervalSinceNow: 0.01))
    }
    let wasCancelled = Task.isCancelled
    condition.unlock()
    if wasCancelled {
      throw CancellationError()
    }
  }

  func release() {
    condition.lock()
    isReleased = true
    condition.broadcast()
    condition.unlock()
  }
}

private func makeResult(
  input: FlowingGraphLayoutInput<DriverSchema>
) throws -> FlowingGraphLayoutResult<DriverSchema> {
  let frame = CGRect(
    origin: .zero,
    size: try XCTUnwrap(input.size(for: "node"))
  )
  let placement = try FlowingGraphNodePlacement(
    input: input,
    nodeFrames: [FlowingGraphNodeFrame(nodeID: "node", frame: frame)],
    contentBounds: frame
  )
  return try FlowingGraphLayoutResult(
    input: input,
    placement: placement,
    edgeRoutes: []
  )
}
