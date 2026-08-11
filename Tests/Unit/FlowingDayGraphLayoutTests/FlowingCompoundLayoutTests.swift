import CoreGraphics
import FlowingDayGraphLayout
import XCTest

final class FlowingCompoundLayoutTests: XCTestCase {
  func testLaysOutExpandedChildrenInsideTheirResolvedContainer() throws {
    let fixture = try makeBoundaryFixture()

    let result = try fixture.strategy.layout(fixture.input)
    let container = try XCTUnwrap(result.frame(for: "container"))
    let childSource = try XCTUnwrap(result.frame(for: "child-source"))
    let childTarget = try XCTUnwrap(result.frame(for: "child-target"))

    XCTAssertGreaterThan(container.width, resolvedSize.width)
    XCTAssertGreaterThan(container.height, resolvedSize.height)
    XCTAssertTrue(container.contains(childSource))
    XCTAssertTrue(container.contains(childTarget))
    XCTAssertEqual(result.inputID, fixture.input.id)
  }

  func testRoutesBoundaryEdgesAgainstFinalWorldPortAnchors() throws {
    let fixture = try makeBoundaryFixture()

    let result = try fixture.strategy.layout(fixture.input)
    let container = try XCTUnwrap(result.frame(for: "container"))
    let externalAnchor = try XCTUnwrap(
      result.resolvedPortAnchors.first { $0.key == fixture.externalPort }
    )
    let internalAnchor = try XCTUnwrap(
      result.resolvedPortAnchors.first { $0.key == fixture.internalPort }
    )
    let route = try XCTUnwrap(result.route(for: "boundary"))

    XCTAssertEqual(externalAnchor.position.x, container.maxX, accuracy: 0.000_001)
    XCTAssertEqual(routeEnd(route), internalAnchor.position)
  }

  func testNestedContainersResolveBottomUp() throws {
    let strategy = makeStrategy()
    let topology = try FlowingGraphLayoutTopology<CompoundSchema>(
      nodeIDs: ["outer", "middle", "wide", "tall"],
      ports: [],
      edges: [],
      containments: [
        FlowingGraphLayoutContainment(
          containerNodeID: "outer",
          memberNodeIDs: ["middle"]
        ),
        FlowingGraphLayoutContainment(
          containerNodeID: "middle",
          memberNodeIDs: ["wide", "tall"]
        ),
      ]
    )
    let input = try resolve(
      topology: topology,
      strategy: strategy,
      sizes: [
        "outer": CGSize(width: 80, height: 50),
        "middle": CGSize(width: 90, height: 60),
        "wide": CGSize(width: 220, height: 40),
        "tall": CGSize(width: 70, height: 140),
      ]
    )

    let result = try strategy.layout(input)
    let outer = try XCTUnwrap(result.frame(for: "outer"))
    let middle = try XCTUnwrap(result.frame(for: "middle"))
    let wide = try XCTUnwrap(result.frame(for: "wide"))
    let tall = try XCTUnwrap(result.frame(for: "tall"))

    XCTAssertTrue(outer.contains(middle))
    XCTAssertTrue(middle.contains(wide))
    XCTAssertTrue(middle.contains(tall))
    XCTAssertGreaterThan(middle.width, wide.width)
    XCTAssertGreaterThan(outer.width, middle.width)
  }

  func testIndependentInstancesReceiveIndependentWorldFrames() throws {
    let strategy = makeStrategy()
    let topology = try FlowingGraphLayoutTopology<CompoundSchema>(
      nodeIDs: ["first-container", "second-container", "first-child", "second-child"],
      ports: [],
      edges: [],
      containments: [
        FlowingGraphLayoutContainment(
          containerNodeID: "first-container",
          memberNodeIDs: ["first-child"]
        ),
        FlowingGraphLayoutContainment(
          containerNodeID: "second-container",
          memberNodeIDs: ["second-child"]
        ),
      ]
    )
    let input = try resolve(topology: topology, strategy: strategy)

    let result = try strategy.layout(input)
    let firstContainer = try XCTUnwrap(result.frame(for: "first-container"))
    let secondContainer = try XCTUnwrap(result.frame(for: "second-container"))
    let firstChild = try XCTUnwrap(result.frame(for: "first-child"))
    let secondChild = try XCTUnwrap(result.frame(for: "second-child"))

    XCTAssertFalse(firstContainer.intersects(secondContainer))
    XCTAssertTrue(firstContainer.contains(firstChild))
    XCTAssertTrue(secondContainer.contains(secondChild))
    XCTAssertNotEqual(firstChild.origin, secondChild.origin)
  }

  func testManualOffsetsRemainScopedToTheMovedNode() throws {
    let strategy = makeStrategy()
    let topology = try FlowingGraphLayoutTopology<CompoundSchema>(
      nodeIDs: ["container", "first", "second"],
      ports: [],
      edges: [],
      containments: [
        FlowingGraphLayoutContainment(
          containerNodeID: "container",
          memberNodeIDs: ["first", "second"]
        )
      ]
    )
    let baselineInput = try resolve(topology: topology, strategy: strategy)
    let baseline = try strategy.layout(baselineInput)
    let offset = CGSize(width: 35, height: 18)
    let movedInput = try resolve(
      topology: topology,
      strategy: strategy,
      placementState: [FlowingGraphNodePlacementState(nodeID: "second", offset: offset)]
    )
    let moved = try strategy.layout(movedInput)

    let baselineFirst = try XCTUnwrap(baseline.frame(for: "first"))
    let movedFirst = try XCTUnwrap(moved.frame(for: "first"))
    let baselineSecond = try XCTUnwrap(baseline.frame(for: "second"))
    let movedSecond = try XCTUnwrap(moved.frame(for: "second"))
    XCTAssertEqual(baselineFirst.origin, movedFirst.origin)
    XCTAssertEqual(movedSecond.minX, baselineSecond.minX + offset.width, accuracy: 0.000_001)
    XCTAssertEqual(movedSecond.minY, baselineSecond.minY + offset.height, accuracy: 0.000_001)
  }

  func testCustomContainerGeometryIsAReplaceableStage() throws {
    let levelLayout = makeLevelLayout()
    let geometry = FixedContainerGeometry()
    let strategy = FlowingCompoundLayout<CompoundSchema>(
      levelLayout: levelLayout,
      containerGeometry: geometry,
      edgeRouter: FlowingCubicEdgeRouter()
    )
    let topology = try FlowingGraphLayoutTopology<CompoundSchema>(
      nodeIDs: ["container", "child"],
      ports: [],
      edges: [],
      containments: [
        FlowingGraphLayoutContainment(
          containerNodeID: "container",
          memberNodeIDs: ["child"]
        )
      ]
    )
    let input = try resolve(topology: topology, strategy: strategy)

    let result = try strategy.layout(input)

    XCTAssertEqual(result.frame(for: "container")?.size, CGSize(width: 400, height: 300))
    XCTAssertEqual(result.frame(for: "child")?.origin, CGPoint(x: 50, y: 70))
  }

  func testInvalidCustomGeometryReturnsAStructuredFailure() throws {
    let strategy = FlowingCompoundLayout<CompoundSchema>(
      levelLayout: makeLevelLayout(),
      containerGeometry: InvalidContainerGeometry(),
      edgeRouter: FlowingCubicEdgeRouter()
    )
    let topology = try FlowingGraphLayoutTopology<CompoundSchema>(
      nodeIDs: ["container", "child"],
      ports: [],
      edges: [],
      containments: [
        FlowingGraphLayoutContainment(
          containerNodeID: "container",
          memberNodeIDs: ["child"]
        )
      ]
    )
    let input = try resolve(topology: topology, strategy: strategy)

    XCTAssertThrowsError(try strategy.layout(input)) { error in
      XCTAssertEqual(
        error as? FlowingCompoundLayoutIssue<CompoundSchema>,
        .contentExceedsContainer("container")
      )
    }
  }

  func testInvalidCustomPortAnchorReturnsAStructuredFailure() throws {
    let strategy = FlowingCompoundLayout<CompoundSchema>(
      levelLayout: makeLevelLayout(),
      containerGeometry: InvalidPortAnchorGeometry(),
      edgeRouter: FlowingCubicEdgeRouter()
    )
    let key = FlowingGraphLayoutPortKey<CompoundSchema>(
      nodeID: "container",
      portID: "external"
    )
    let topology = try FlowingGraphLayoutTopology<CompoundSchema>(
      nodeIDs: ["container", "child"],
      ports: [FlowingGraphLayoutPort(key: key)],
      edges: [],
      containments: [
        FlowingGraphLayoutContainment(
          containerNodeID: "container",
          memberNodeIDs: ["child"]
        )
      ]
    )
    let input = try resolve(topology: topology, strategy: strategy)

    XCTAssertThrowsError(try strategy.layout(input)) { error in
      XCTAssertEqual(
        error as? FlowingCompoundLayoutIssue<CompoundSchema>,
        .invalidPortAnchor(key)
      )
    }
  }

  func testDeepContainmentUsesNoRecursiveCallStack() throws {
    let nodeCount = 2_000
    let nodeIDs = (0..<nodeCount).map(String.init)
    let containments = (0..<(nodeCount - 1)).map { index in
      FlowingGraphLayoutContainment<CompoundSchema>(
        containerNodeID: String(index),
        memberNodeIDs: [String(index + 1)]
      )
    }
    let strategy = makeZeroPaddingStrategy()
    let topology = try FlowingGraphLayoutTopology<CompoundSchema>(
      nodeIDs: nodeIDs,
      ports: [],
      edges: [],
      containments: containments
    )
    let input = try resolve(
      topology: topology,
      strategy: strategy,
      sizes: Dictionary(uniqueKeysWithValues: nodeIDs.map { ($0, CGSize(width: 10, height: 10)) })
    )

    let result = try strategy.layout(input)

    XCTAssertEqual(result.nodeFrames.count, nodeCount)
    XCTAssertTrue(
      try XCTUnwrap(result.frame(for: "0")).contains(
        try XCTUnwrap(result.frame(for: String(nodeCount - 1)))
      )
    )
  }

  func testRejectsAnInputForAnotherPipeline() throws {
    let strategy = makeStrategy()
    let topology = try FlowingGraphLayoutTopology<CompoundSchema>(
      nodeIDs: ["node"],
      ports: [],
      edges: []
    )
    let input = try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: CompoundSizeResolver(sizes: [:]),
      portAnchorResolver: CompoundAnchorResolver(),
      pipelineIdentity: FlowingLayoutPipelineIdentity(
        component: FlowingLayoutComponentIdentity()
      )
    )

    XCTAssertThrowsError(try strategy.layout(input)) { error in
      XCTAssertEqual(error as? FlowingGraphLayoutPipelineError, .inputIdentityMismatch)
    }
  }

  private let resolvedSize = CGSize(width: 100, height: 60)

  private func makeBoundaryFixture() throws -> (
    strategy: FlowingCompoundLayout<CompoundSchema>,
    input: FlowingGraphLayoutInput<CompoundSchema>,
    externalPort: FlowingGraphLayoutPortKey<CompoundSchema>,
    internalPort: FlowingGraphLayoutPortKey<CompoundSchema>
  ) {
    let externalPort = FlowingGraphLayoutPortKey<CompoundSchema>(
      nodeID: "container",
      portID: "external"
    )
    let internalPort = FlowingGraphLayoutPortKey<CompoundSchema>(
      nodeID: "child-source",
      portID: "internal"
    )
    let topology = try FlowingGraphLayoutTopology<CompoundSchema>(
      nodeIDs: ["source", "container", "child-source", "child-target"],
      ports: [
        FlowingGraphLayoutPort(key: externalPort),
        FlowingGraphLayoutPort(key: internalPort),
      ],
      edges: [
        FlowingGraphLayoutEdge(
          id: "boundary",
          endpoints: .directed(source: .node("source"), target: .port(internalPort))
        ),
        FlowingGraphLayoutEdge(
          id: "internal",
          endpoints: .directed(source: .port(internalPort), target: .node("child-target"))
        ),
      ],
      containments: [
        FlowingGraphLayoutContainment(
          containerNodeID: "container",
          memberNodeIDs: ["child-source", "child-target"]
        )
      ]
    )
    let strategy = makeStrategy()
    return (
      strategy,
      try resolve(topology: topology, strategy: strategy),
      externalPort,
      internalPort
    )
  }

  private func makeStrategy() -> FlowingCompoundLayout<CompoundSchema> {
    FlowingCompoundLayout(
      levelLayout: makeLevelLayout(),
      containerGeometry: FlowingPaddedCompoundContainerGeometry(
        configuration: FlowingPaddedCompoundContainerConfiguration(
          contentInsets: FlowingLayoutInsets(horizontal: 20, vertical: 16),
          headerHeight: 28
        )
      ),
      edgeRouter: FlowingCubicEdgeRouter()
    )
  }

  private func makeZeroPaddingStrategy() -> FlowingCompoundLayout<CompoundSchema> {
    FlowingCompoundLayout(
      levelLayout: FlowingLayeredDAGLayout(
        configuration: FlowingLayeredLayoutConfiguration(
          horizontalNodeSpacing: 0,
          verticalNodeSpacing: 0,
          componentSpacing: 0,
          canvasInsets: FlowingLayoutInsets(horizontal: 0, vertical: 0),
          minimumCanvasSize: .zero
        )
      ),
      containerGeometry: FlowingPaddedCompoundContainerGeometry(
        configuration: FlowingPaddedCompoundContainerConfiguration(
          contentInsets: FlowingLayoutInsets(horizontal: 0, vertical: 0),
          headerHeight: 0
        )
      ),
      edgeRouter: FlowingCubicEdgeRouter()
    )
  }

  private func makeLevelLayout() -> FlowingLayeredDAGLayout<CompoundSchema> {
    FlowingLayeredDAGLayout(
      configuration: FlowingLayeredLayoutConfiguration(
        horizontalNodeSpacing: 24,
        verticalNodeSpacing: 48,
        componentSpacing: 64,
        canvasInsets: FlowingLayoutInsets(horizontal: 0, vertical: 0),
        minimumCanvasSize: .zero
      )
    )
  }

  private func resolve<Strategy: FlowingGraphLayoutStrategy<CompoundSchema>>(
    topology: FlowingGraphLayoutTopology<CompoundSchema>,
    strategy: Strategy,
    sizes: [String: CGSize] = [:],
    placementState: [FlowingGraphNodePlacementState<CompoundSchema>] = []
  ) throws -> FlowingGraphLayoutInput<CompoundSchema> {
    try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: CompoundSizeResolver(sizes: sizes),
      portAnchorResolver: CompoundAnchorResolver(),
      pipelineIdentity: strategy.identity,
      placementState: placementState
    )
  }

  private func routeEnd(_ route: FlowingGraphEdgeRoute) -> CGPoint? {
    guard let segment = route.segments.last else { return route.start }
    switch segment {
    case .line(let end), .quadratic(_, let end), .cubic(_, _, let end):
      return end
    }
  }
}

private enum CompoundSchema: FlowingGraphLayoutSchema {
  typealias NodeID = String
  typealias PortID = String
  typealias EdgeID = String
}

private struct CompoundSizeResolver: FlowingGraphNodeSizeResolver {
  typealias Schema = CompoundSchema

  let identity = FlowingLayoutComponentIdentity()
  let sizes: [String: CGSize]

  func size(for nodeID: String) throws -> CGSize {
    sizes[nodeID] ?? CGSize(width: 100, height: 60)
  }
}

private struct CompoundAnchorResolver: FlowingGraphPortAnchorResolver {
  typealias Schema = CompoundSchema

  let identity = FlowingLayoutComponentIdentity()

  func anchor(
    for port: FlowingGraphLayoutPort<CompoundSchema>,
    nodeSize: CGSize
  ) throws -> FlowingGraphPortAnchor<CompoundSchema> {
    let isExternal = port.id == "external"
    return FlowingGraphPortAnchor(
      key: port.key,
      position: CGPoint(
        x: isExternal ? nodeSize.width : 0,
        y: nodeSize.height / 2
      ),
      normal: CGVector(dx: isExternal ? 1 : -1, dy: 0)
    )
  }
}

private struct FixedContainerGeometry: FlowingCompoundContainerGeometryResolver {
  typealias Schema = CompoundSchema

  let identity = FlowingLayoutComponentIdentity()

  func geometry(
    for context: FlowingCompoundContainerGeometryContext<CompoundSchema>
  ) throws -> FlowingCompoundContainerGeometry<CompoundSchema> {
    FlowingCompoundContainerGeometry(
      size: CGSize(width: 400, height: 300),
      contentOrigin: CGPoint(x: 50, y: 70),
      portAnchors: context.portAnchors
    )
  }
}

private struct InvalidContainerGeometry: FlowingCompoundContainerGeometryResolver {
  typealias Schema = CompoundSchema

  let identity = FlowingLayoutComponentIdentity()

  func geometry(
    for context: FlowingCompoundContainerGeometryContext<CompoundSchema>
  ) throws -> FlowingCompoundContainerGeometry<CompoundSchema> {
    FlowingCompoundContainerGeometry(
      size: CGSize(width: 20, height: 20),
      contentOrigin: CGPoint(x: 10, y: 10),
      portAnchors: context.portAnchors
    )
  }
}

private struct InvalidPortAnchorGeometry: FlowingCompoundContainerGeometryResolver {
  typealias Schema = CompoundSchema

  let identity = FlowingLayoutComponentIdentity()

  func geometry(
    for context: FlowingCompoundContainerGeometryContext<CompoundSchema>
  ) throws -> FlowingCompoundContainerGeometry<CompoundSchema> {
    FlowingCompoundContainerGeometry(
      size: CGSize(width: 400, height: 300),
      contentOrigin: CGPoint(x: 50, y: 70),
      portAnchors: context.portAnchors.map {
        FlowingGraphPortAnchor(
          key: $0.key,
          position: CGPoint(x: CGFloat.nan, y: 0),
          normal: $0.normal
        )
      }
    )
  }
}
