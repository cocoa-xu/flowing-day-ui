import FlowingDayGraphComposition
import FlowingDayGraphCore
import XCTest

final class FlowingGraphDocumentValidationTests: XCTestCase {
  func testNestedOwnedDefinitionsValidate() throws {
    let document = makeDocument(
      definitions: [
        makeDefinition("root", nodes: ["child"]),
        makeDefinition("middle", nodes: ["child"]),
        makeDefinition("leaf", nodes: ["value"]),
      ],
      links: [
        makeLink("root-middle", from: "root", nodeID: "child", to: "middle", ownership: .owned),
        makeLink("middle-leaf", from: "middle", nodeID: "child", to: "leaf", ownership: .owned),
      ]
    )

    let validated = try FlowingGraphDocumentValidator.validate(document)

    XCTAssertEqual(validated.definition(id: "leaf")?.graph.nodeIDs, ["value"])
  }

  func testRecursiveReferenceIsValidDocumentStructure() throws {
    let document = makeDocument(
      definitions: [makeDefinition("root", nodes: ["recursive-site"])],
      links: [
        makeLink(
          "recursive",
          from: "root",
          nodeID: "recursive-site",
          to: "root"
        )
      ]
    )

    XCTAssertNoThrow(try FlowingGraphDocumentValidator.validate(document))
  }

  func testDanglingLinkReportsSourceAndTargetIssues() {
    let document = makeDocument(
      definitions: [makeDefinition("root", nodes: ["present"])],
      links: [
        makeLink("missing-node", from: "root", nodeID: "missing", to: "missing-target"),
        makeLink("missing-source", from: "missing-source", nodeID: "value", to: "root"),
      ]
    )

    let issues = FlowingGraphDocumentValidator.issues(in: document)

    XCTAssertTrue(
      issues.contains(
        .unknownLinkSourceNode(
          linkID: "missing-node",
          site: FlowingGraphDefinitionNodeAddress(graphID: "root", nodeID: "missing")
        )
      )
    )
    XCTAssertTrue(
      issues.contains(
        .unknownLinkTargetDefinition(linkID: "missing-node", graphID: "missing-target")
      )
    )
    XCTAssertTrue(
      issues.contains(
        .unknownLinkSourceDefinition(linkID: "missing-source", graphID: "missing-source")
      )
    )
  }

  func testContainmentCycleIsRejectedWithoutRejectingReferenceCycles() {
    let document = makeDocument(
      definitions: [
        makeDefinition("first", nodes: ["child"]),
        makeDefinition("second", nodes: ["child"]),
      ],
      links: [
        makeLink("first-second", from: "first", nodeID: "child", to: "second", ownership: .owned),
        makeLink("second-first", from: "second", nodeID: "child", to: "first", ownership: .owned),
      ]
    )

    let issues = FlowingGraphDocumentValidator.issues(in: document)

    XCTAssertTrue(issues.contains(.containmentCycle(linkID: "second-first")))
  }

  func testOwnedDefinitionCannotHaveTwoOwners() {
    let document = makeDocument(
      definitions: [
        makeDefinition("root", nodes: ["first-owner", "second-owner"]),
        makeDefinition("owned", nodes: ["value"]),
      ],
      links: [
        makeLink(
          "first",
          from: "root",
          nodeID: "first-owner",
          to: "owned",
          ownership: .owned
        ),
        makeLink(
          "second",
          from: "root",
          nodeID: "second-owner",
          to: "owned",
          ownership: .owned
        ),
      ]
    )

    XCTAssertTrue(
      FlowingGraphDocumentValidator.issues(in: document).contains(
        .multipleOwners(
          graphID: "owned",
          firstLinkID: "first",
          secondLinkID: "second"
        )
      )
    )
  }

  func testOwnedDefinitionCannotBeReferencedOutsideItsOwnerSubtree() {
    let document = makeDocument(
      definitions: [
        makeDefinition("root", nodes: ["owner", "external-reference"]),
        makeDefinition("owned", nodes: ["value"]),
      ],
      links: [
        makeLink("owner", from: "root", nodeID: "owner", to: "owned", ownership: .owned),
        makeLink(
          "external",
          from: "root",
          nodeID: "external-reference",
          to: "owned"
        ),
      ]
    )

    XCTAssertTrue(
      FlowingGraphDocumentValidator.issues(in: document).contains(
        .ownedDefinitionExternallyReferenced(linkID: "external", graphID: "owned")
      )
    )
  }

  func testOwnedDefinitionCanBeReferencedInsideItsOwnerSubtree() throws {
    let document = makeDocument(
      definitions: [
        makeDefinition("root", nodes: ["owner"]),
        makeDefinition("owned", nodes: ["child", "recursive-reference"]),
        makeDefinition("nested", nodes: ["reference"]),
      ],
      links: [
        makeLink("owner", from: "root", nodeID: "owner", to: "owned", ownership: .owned),
        makeLink("nested", from: "owned", nodeID: "child", to: "nested", ownership: .owned),
        makeLink("self", from: "owned", nodeID: "recursive-reference", to: "owned"),
        makeLink("descendant", from: "nested", nodeID: "reference", to: "owned"),
      ]
    )

    XCTAssertNoThrow(try FlowingGraphDocumentValidator.validate(document))
  }

  func testOwnedDefinitionCannotBeAnIndependentEntryPoint() {
    let entryPoints = [
      FlowingGraphEntryPoint<TestCompositionSchema>(
        id: "main",
        name: "Main",
        graphID: "root"
      ),
      FlowingGraphEntryPoint<TestCompositionSchema>(
        id: "child",
        name: "Child",
        graphID: "owned"
      ),
    ]
    let document = makeDocument(
      entryPoints: entryPoints,
      definitions: [
        makeDefinition("root", nodes: ["owner"]),
        makeDefinition("owned", nodes: ["value"]),
      ],
      links: [
        makeLink("owner", from: "root", nodeID: "owner", to: "owned", ownership: .owned)
      ]
    )

    XCTAssertTrue(
      FlowingGraphDocumentValidator.issues(in: document).contains(
        .ownedDefinitionUsedAsEntryPoint(entryPointID: "child", graphID: "owned")
      )
    )
  }

  func testMultipleNamedEntryPointsAndUnreachableLibraryDefinitionsValidate() throws {
    let entryPoints = [
      FlowingGraphEntryPoint<TestCompositionSchema>(
        id: "main",
        name: "Main",
        graphID: "root"
      ),
      FlowingGraphEntryPoint<TestCompositionSchema>(
        id: "alternate",
        name: "Alternate",
        graphID: "alternate"
      ),
    ]
    let document = makeDocument(
      entryPoints: entryPoints,
      definitions: [
        makeDefinition("root", nodes: ["root-value"]),
        makeDefinition("alternate", nodes: ["alternate-value"]),
        makeDefinition("unreachable-library", nodes: ["library-value"]),
      ]
    )

    let validated = try FlowingGraphDocumentValidator.validate(document)

    XCTAssertEqual(validated.defaultEntryPoint.id, "main")
    XCTAssertEqual(validated.entryPoint(id: "alternate")?.graphID, "alternate")
    XCTAssertNotNil(validated.definition(id: "unreachable-library"))
  }

  func testDuplicateIdentitiesSitesAndEmptyNamesAreRejected() {
    let duplicateEntryPoints = [
      FlowingGraphEntryPoint<TestCompositionSchema>(id: "main", name: "Main", graphID: "root"),
      FlowingGraphEntryPoint<TestCompositionSchema>(id: "main", name: " ", graphID: "root"),
    ]
    let document = makeDocument(
      entryPoints: duplicateEntryPoints,
      definitions: [
        makeDefinition("root", nodes: ["site"]),
        makeDefinition("root", nodes: ["duplicate"]),
        makeDefinition("target", nodes: ["value"]),
      ],
      links: [
        makeLink("link", from: "root", nodeID: "site", to: "target"),
        makeLink("link", from: "root", nodeID: "site", to: "target"),
      ]
    )

    let issues = FlowingGraphDocumentValidator.issues(in: document)

    XCTAssertTrue(issues.contains(.duplicateDefinitionID("root")))
    XCTAssertTrue(issues.contains(.duplicateEntryPointID("main")))
    XCTAssertTrue(issues.contains(.emptyEntryPointName("main")))
    XCTAssertTrue(issues.contains(.duplicateLinkID("link")))
    XCTAssertTrue(
      issues.contains(
        .duplicateSubgraphSite(
          FlowingGraphDefinitionNodeAddress(graphID: "root", nodeID: "site")
        )
      )
    )
  }

  func testDeepContainmentValidationUsesNoRecursiveCallStack() throws {
    let count = 10_000
    var definitions: [FlowingGraphDefinition<TestCompositionSchema>] = []
    var links: [TestLink] = []
    definitions.reserveCapacity(count)
    links.reserveCapacity(count - 1)
    for index in 0..<count {
      definitions.append(makeDefinition("graph-\(index)", nodes: ["child"]))
      if index + 1 < count {
        links.append(
          makeLink(
            "link-\(index)",
            from: "graph-\(index)",
            nodeID: "child",
            to: "graph-\(index + 1)",
            ownership: .owned
          )
        )
      }
    }

    XCTAssertNoThrow(
      try FlowingGraphDocumentValidator.validate(
        makeDocument(definitions: definitions, links: links)
      )
    )
  }

  func testValidatedDocumentIsConditionallySendable() throws {
    let validated = try FlowingGraphDocumentValidator.validate(
      makeDocument(definitions: [makeDefinition("root", nodes: ["value"])])
    )

    requireSendable(validated)
  }

  private func requireSendable<Value: Sendable>(_: Value) {}
}
