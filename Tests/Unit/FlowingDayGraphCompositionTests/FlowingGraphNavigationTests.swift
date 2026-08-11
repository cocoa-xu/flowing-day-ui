import FlowingDayGraphComposition
import FlowingDayGraphCore
import XCTest

final class FlowingGraphNavigationTests: XCTestCase {
  func testBreadcrumbPreservesEveryCanonicalDestination() throws {
    let document = makeNavigationDocument()
    let navigator = try FlowingGraphNavigator(document: document)
    let path = FlowingGraphInstancePath(
      components: [
        FlowingGraphDefinitionNodeAddress(graphID: "root", nodeID: "child-site"),
        FlowingGraphDefinitionNodeAddress(graphID: "child", nodeID: "leaf-site"),
      ]
    )

    let breadcrumb = try navigator.breadcrumb(
      for: FlowingGraphProjectionState(entryPointID: "main", focusPath: path)
    )

    XCTAssertEqual(breadcrumb.map(\.graphID), ["root", "child", "leaf"])
    XCTAssertEqual(breadcrumb[0].focusPath, .root)
    XCTAssertEqual(breadcrumb[1].focusPath.components, Array(path.components.prefix(1)))
    XCTAssertEqual(breadcrumb[2].focusPath, path)
    XCTAssertEqual(breadcrumb[0].source, .entryPoint(id: "main", name: "Main"))
    XCTAssertEqual(
      breadcrumb[2].source,
      .subgraph(linkID: "leaf-link", site: path.components[1])
    )
  }

  func testDrillInCanTargetAVisibleNestedInstance() throws {
    let navigator = try FlowingGraphNavigator(document: makeNavigationDocument())
    let expandedSite = site(graphID: "root", nodeID: "child-site")
    let state = FlowingGraphProjectionState<TestCompositionSchema>(
      entryPointID: "main",
      expandedSites: [expandedSite]
    )
    let nestedSite = site(
      graphID: "child",
      nodeID: "leaf-site",
      components: [(graphID: "root", nodeID: "child-site")]
    )

    let drilled = try navigator.drillIn(from: state, at: nestedSite)

    XCTAssertEqual(
      drilled.focusPath.components,
      [
        FlowingGraphDefinitionNodeAddress(graphID: "root", nodeID: "child-site"),
        FlowingGraphDefinitionNodeAddress(graphID: "child", nodeID: "leaf-site"),
      ]
    )
    XCTAssertEqual(drilled.expandedSites, state.expandedSites)
  }

  func testDrillOutAndBreadcrumbNavigationPreserveExpansionState() throws {
    let navigator = try FlowingGraphNavigator(document: makeNavigationDocument())
    let expandedSite = site(graphID: "root", nodeID: "child-site")
    let path = FlowingGraphInstancePath(
      components: [
        FlowingGraphDefinitionNodeAddress(graphID: "root", nodeID: "child-site"),
        FlowingGraphDefinitionNodeAddress(graphID: "child", nodeID: "leaf-site"),
      ]
    )
    let state = FlowingGraphProjectionState<TestCompositionSchema>(
      entryPointID: "main",
      focusPath: path,
      expandedSites: [expandedSite]
    )

    let parent = try XCTUnwrap(navigator.drillOut(from: state))
    let root = try navigator.navigate(from: state, to: .root)

    XCTAssertEqual(parent.focusPath.components, Array(path.components.dropLast()))
    XCTAssertEqual(parent.expandedSites, state.expandedSites)
    XCTAssertEqual(root.focusPath, .root)
    XCTAssertEqual(root.expandedSites, state.expandedSites)
    XCTAssertNil(try navigator.drillOut(from: root))
  }

  func testDrillInRejectsASiteOutsideTheFocusedSubtree() throws {
    let navigator = try FlowingGraphNavigator(document: makeNavigationDocument())
    let focusedPath = FlowingGraphInstancePath(
      components: [
        FlowingGraphDefinitionNodeAddress(graphID: "root", nodeID: "child-site")
      ]
    )
    let state = FlowingGraphProjectionState<TestCompositionSchema>(
      entryPointID: "main",
      focusPath: focusedPath
    )
    let rootSite = site(graphID: "root", nodeID: "child-site")

    XCTAssertThrowsError(try navigator.drillIn(from: state, at: rootSite)) { error in
      XCTAssertEqual(
        error as? FlowingGraphNavigationError<TestCompositionSchema>,
        .siteOutsideFocus(rootSite)
      )
    }
  }

  private func makeNavigationDocument() -> TestDocument {
    makeDocument(
      definitions: [
        makeDefinition("root", nodes: ["child-site"]),
        makeDefinition("child", nodes: ["leaf-site"]),
        makeDefinition("leaf", nodes: ["value"]),
      ],
      links: [
        makeLink("child-link", from: "root", nodeID: "child-site", to: "child"),
        makeLink("leaf-link", from: "child", nodeID: "leaf-site", to: "leaf"),
      ]
    )
  }
}
