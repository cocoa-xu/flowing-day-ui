import FlowingDayGraphLayout
import XCTest

final class FlowingGraphContainmentTests: XCTestCase {
  func testTopologyPreservesOrderedContainmentForest() throws {
    let topology = try makeTopology(
      nodeIDs: ["root", "container", "first", "second", "nested"],
      containments: [
        containment("container", members: ["first", "second"]),
        containment("first", members: ["nested"]),
      ]
    )

    XCTAssertEqual(topology.rootNodeIDs, ["root", "container"])
    XCTAssertEqual(topology.memberNodeIDs(of: "container"), ["first", "second"])
    XCTAssertEqual(topology.memberNodeIDs(of: "first"), ["nested"])
    XCTAssertEqual(topology.containerNodeID(of: "nested"), "first")
    XCTAssertNil(topology.containerNodeID(of: "container"))
  }

  func testTopologyRejectsUnknownContainmentNodes() {
    XCTAssertThrowsError(
      try makeTopology(
        nodeIDs: ["known"],
        containments: [containment("missing", members: [])]
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphLayoutTopologyIssue<ContainmentSchema>,
        .unknownContainmentContainer("missing")
      )
    }
    XCTAssertThrowsError(
      try makeTopology(
        nodeIDs: ["container"],
        containments: [containment("container", members: ["missing"])]
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphLayoutTopologyIssue<ContainmentSchema>,
        .unknownContainmentMember(container: "container", member: "missing")
      )
    }
  }

  func testTopologyRejectsDuplicateContainmentDeclarations() {
    XCTAssertThrowsError(
      try makeTopology(
        nodeIDs: ["container", "member"],
        containments: [
          containment("container", members: []),
          containment("container", members: ["member"]),
        ]
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphLayoutTopologyIssue<ContainmentSchema>,
        .duplicateContainmentContainer("container")
      )
    }
    XCTAssertThrowsError(
      try makeTopology(
        nodeIDs: ["container", "member"],
        containments: [containment("container", members: ["member", "member"])]
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphLayoutTopologyIssue<ContainmentSchema>,
        .duplicateContainmentMember(container: "container", member: "member")
      )
    }
  }

  func testTopologyRejectsMultipleParentsAndSelfContainment() {
    XCTAssertThrowsError(
      try makeTopology(
        nodeIDs: ["first", "second", "member"],
        containments: [
          containment("first", members: ["member"]),
          containment("second", members: ["member"]),
        ]
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphLayoutTopologyIssue<ContainmentSchema>,
        .multipleContainmentParents(
          member: "member",
          firstContainer: "first",
          secondContainer: "second"
        )
      )
    }
    XCTAssertThrowsError(
      try makeTopology(
        nodeIDs: ["node"],
        containments: [containment("node", members: ["node"])]
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphLayoutTopologyIssue<ContainmentSchema>,
        .selfContainment("node")
      )
    }
  }

  func testTopologyRejectsContainmentCyclesWithStableEvidence() {
    XCTAssertThrowsError(
      try makeTopology(
        nodeIDs: ["a", "b", "c"],
        containments: [
          containment("a", members: ["b"]),
          containment("b", members: ["c"]),
          containment("c", members: ["a"]),
        ]
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphLayoutTopologyIssue<ContainmentSchema>,
        .containmentCycle(["a", "c", "b", "a"])
      )
    }
  }

  private func makeTopology(
    nodeIDs: [String],
    containments: [FlowingGraphLayoutContainment<ContainmentSchema>]
  ) throws -> FlowingGraphLayoutTopology<ContainmentSchema> {
    try FlowingGraphLayoutTopology(
      nodeIDs: nodeIDs,
      ports: [],
      edges: [],
      containments: containments
    )
  }

  private func containment(
    _ container: String,
    members: [String]
  ) -> FlowingGraphLayoutContainment<ContainmentSchema> {
    FlowingGraphLayoutContainment(
      containerNodeID: container,
      memberNodeIDs: members
    )
  }
}

private enum ContainmentSchema: FlowingGraphLayoutSchema {
  typealias NodeID = String
  typealias PortID = String
  typealias EdgeID = String
}
