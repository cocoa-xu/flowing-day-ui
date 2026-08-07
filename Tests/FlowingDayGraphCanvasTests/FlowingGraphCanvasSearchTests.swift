import XCTest

@testable import FlowingDayGraphCanvas

final class FlowingGraphCanvasSearchTests: XCTestCase {
  func testSearchRanksExactTitleBeforePrefixAndMetadataMatches() throws {
    let index = try FlowingGraphCanvasSearchIndex(
      items: [
        item("keyword", "Adapter", keywords: ["USB"]),
        item("prefix", "USB Hub"),
        item("exact", "USB"),
        item("subtitle", "Dock", subtitle: "USB accessory"),
      ]
    )

    XCTAssertEqual(index.search("usb").map(\.id), ["exact", "prefix", "keyword", "subtitle"])
  }

  func testSearchNormalizesCaseAndDiacriticsAndSupportsMultipleTerms() throws {
    let index = try FlowingGraphCanvasSearchIndex(
      items: [
        item("dock", "Café Thunderbolt Dock"),
        item("display", "Thunderbolt Display"),
      ]
    )

    XCTAssertEqual(index.search("CAFE dock").map(\.id), ["dock"])
  }

  func testSearchSupportsShortAndInteriorSubstrings() throws {
    let index = try FlowingGraphCanvasSearchIndex(
      items: [
        item("usb", "USB Controller"),
        item("thunderbolt", "Thunderbolt Bridge"),
      ]
    )

    XCTAssertEqual(index.search("us").map(\.id), ["usb"])
    XCTAssertEqual(index.search("derb").map(\.id), ["thunderbolt"])
  }

  func testSearchUsesPresentationOrderForOtherwiseEquivalentItems() throws {
    let index = try FlowingGraphCanvasSearchIndex(
      items: [
        item("second-id", "Port"),
        item("first-id", "Port"),
      ]
    )

    XCTAssertEqual(index.search("port").map(\.id), ["second-id", "first-id"])
  }

  func testIndexRejectsDuplicateIdentifiersAndIndependentBudgets() {
    XCTAssertThrowsError(
      try FlowingGraphCanvasSearchIndex(
        items: [item("duplicate", "First"), item("duplicate", "Second")]
      )
    ) { error in
      XCTAssertEqual(error as? FlowingGraphCanvasSearchIndexIssue, .duplicateElementID)
    }
    XCTAssertThrowsError(
      try FlowingGraphCanvasSearchIndex(
        items: [item("one", "One"), item("two", "Two")],
        limits: .init(maximumItems: 1)
      )
    ) { error in
      XCTAssertEqual(error as? FlowingGraphCanvasSearchIndexIssue, .itemBudgetExceeded)
    }
    XCTAssertThrowsError(
      try FlowingGraphCanvasSearchIndex(
        items: [item("text", "Length")],
        limits: .init(maximumTextLength: 3)
      )
    ) { error in
      XCTAssertEqual(error as? FlowingGraphCanvasSearchIndexIssue, .textBudgetExceeded)
    }
    XCTAssertThrowsError(
      try FlowingGraphCanvasSearchIndex(
        items: [item("keywords", "Node", keywords: ["one", "two"])],
        limits: .init(maximumKeywordsPerItem: 1)
      )
    ) { error in
      XCTAssertEqual(error as? FlowingGraphCanvasSearchIndexIssue, .keywordBudgetExceeded)
    }
    XCTAssertThrowsError(
      try FlowingGraphCanvasSearchIndex(
        items: [item("characters", "Node", subtitle: "Subtitle")],
        limits: .init(maximumIndexedCharacters: 4)
      )
    ) { error in
      XCTAssertEqual(error as? FlowingGraphCanvasSearchIndexIssue, .characterBudgetExceeded)
    }
  }

  func testSearchHandlesOneHundredThousandItemsWithoutScanningViews() throws {
    let items = (0..<100_000).map { index in
      item(index, "Element \(index)", keywords: index == 87_654 ? ["needle"] : [])
    }
    let index = try FlowingGraphCanvasSearchIndex(items: items)

    XCTAssertEqual(index.search("needle").map(\.id), [87_654])
    XCTAssertEqual(index.search("87654").map(\.id), [87_654])
    XCTAssertEqual(index.search("element", limit: 20).count, 20)
  }

  private func item<ID: Hashable & Sendable>(
    _ id: ID,
    _ title: String,
    subtitle: String? = nil,
    keywords: [String] = []
  ) -> FlowingGraphCanvasSearchItem<ID> {
    FlowingGraphCanvasSearchItem(
      id: id,
      title: title,
      subtitle: subtitle,
      keywords: keywords
    )
  }
}
