import Foundation
import SwiftUI

public struct FlowingGraphCanvasSearchItem<ElementID: Hashable & Sendable>:
  Identifiable, Equatable, Sendable
{
  public let id: ElementID
  public let title: String
  public let subtitle: String?
  public let keywords: [String]
  public let category: String?

  public init(
    id: ElementID,
    title: String,
    subtitle: String? = nil,
    keywords: [String] = [],
    category: String? = nil
  ) {
    self.id = id
    self.title = title
    self.subtitle = subtitle
    self.keywords = keywords
    self.category = category
  }
}

public struct FlowingGraphCanvasSearchIndexLimits: Equatable, Sendable {
  public let maximumItems: Int
  public let maximumTextLength: Int
  public let maximumKeywordsPerItem: Int
  public let maximumIndexedCharacters: Int

  public init(
    maximumItems: Int = 1_000_000,
    maximumTextLength: Int = 4_096,
    maximumKeywordsPerItem: Int = 64,
    maximumIndexedCharacters: Int = 64_000_000
  ) {
    precondition(maximumItems > 0)
    precondition(maximumTextLength > 0)
    precondition(maximumKeywordsPerItem >= 0)
    precondition(maximumIndexedCharacters > 0)
    self.maximumItems = maximumItems
    self.maximumTextLength = maximumTextLength
    self.maximumKeywordsPerItem = maximumKeywordsPerItem
    self.maximumIndexedCharacters = maximumIndexedCharacters
  }

  public static let standard = Self()
}

public enum FlowingGraphCanvasSearchIndexIssue: Error, Equatable, Sendable {
  case itemBudgetExceeded
  case duplicateElementID
  case textBudgetExceeded
  case keywordBudgetExceeded
  case characterBudgetExceeded
}

public struct FlowingGraphCanvasSearchResult<ElementID: Hashable & Sendable>:
  Identifiable, Equatable, Sendable
{
  public let item: FlowingGraphCanvasSearchItem<ElementID>
  public let score: Int

  public var id: ElementID { item.id }

  public init(item: FlowingGraphCanvasSearchItem<ElementID>, score: Int) {
    self.item = item
    self.score = score
  }
}

public struct FlowingGraphCanvasSearchIndex<ElementID: Hashable & Sendable>: Sendable {
  private struct IndexedItem: Sendable {
    let item: FlowingGraphCanvasSearchItem<ElementID>
    let title: String
    let subtitle: String
    let keywords: String
    let category: String
    let tokens: Set<String>
    let order: Int
  }

  private struct RankedItem: Sendable {
    let result: FlowingGraphCanvasSearchResult<ElementID>
    let normalizedTitle: String
    let order: Int
  }

  private let items: [IndexedItem]
  private let prefixPostings: [String: [Int]]
  private let fragmentPostings: [String: [Int]]

  public init(
    items: [FlowingGraphCanvasSearchItem<ElementID>],
    limits: FlowingGraphCanvasSearchIndexLimits = .standard
  ) throws {
    guard items.count <= limits.maximumItems else {
      throw FlowingGraphCanvasSearchIndexIssue.itemBudgetExceeded
    }
    guard Set(items.map(\.id)).count == items.count else {
      throw FlowingGraphCanvasSearchIndexIssue.duplicateElementID
    }
    var indexedItems: [IndexedItem] = []
    var prefixPostings: [String: [Int]] = [:]
    var fragmentPostings: [String: [Int]] = [:]
    var indexedCharacterCount = 0
    indexedItems.reserveCapacity(items.count)

    for (index, item) in items.enumerated() {
      let strings = [item.title, item.subtitle, item.category].compactMap { $0 } + item.keywords
      guard strings.allSatisfy({ $0.count <= limits.maximumTextLength }) else {
        throw FlowingGraphCanvasSearchIndexIssue.textBudgetExceeded
      }
      guard item.keywords.count <= limits.maximumKeywordsPerItem else {
        throw FlowingGraphCanvasSearchIndexIssue.keywordBudgetExceeded
      }
      indexedCharacterCount += strings.reduce(into: 0) { $0 += $1.count }
      guard indexedCharacterCount <= limits.maximumIndexedCharacters else {
        throw FlowingGraphCanvasSearchIndexIssue.characterBudgetExceeded
      }
      let title = Self.normalize(item.title)
      let subtitle = Self.normalize(item.subtitle ?? "")
      let keywords = Self.normalize(item.keywords.joined(separator: " "))
      let category = Self.normalize(item.category ?? "")
      let tokens = Set(
        Self.tokens(in: [title, subtitle, keywords, category].joined(separator: " ")))
      indexedItems.append(
        IndexedItem(
          item: item,
          title: title,
          subtitle: subtitle,
          keywords: keywords,
          category: category,
          tokens: tokens,
          order: index
        )
      )
      for prefix in Set(tokens.flatMap(Self.prefixes)) {
        prefixPostings[prefix, default: []].append(index)
      }
      for fragment in Set(tokens.flatMap(Self.indexFragments)) {
        fragmentPostings[fragment, default: []].append(index)
      }
    }

    self.items = indexedItems
    self.prefixPostings = prefixPostings
    self.fragmentPostings = fragmentPostings
  }

  public func search(
    _ query: String,
    limit: Int = 20
  ) -> [FlowingGraphCanvasSearchResult<ElementID>] {
    precondition(limit >= 0)
    guard limit > 0 else { return [] }
    let terms = Self.tokens(in: Self.normalize(query))
    guard !terms.isEmpty else { return [] }
    var candidates: [Int]?
    for term in terms {
      let termCandidates = candidateIndices(for: term)
      candidates = candidates.map { Self.intersection($0, termCandidates) } ?? termCandidates
      if candidates?.isEmpty == true { return [] }
    }
    var ranked: [RankedItem] = []
    ranked.reserveCapacity(min(limit, candidates?.count ?? 0))
    for index in candidates ?? [] {
      let indexed = items[index]
      guard terms.allSatisfy({ Self.matches($0, item: indexed) }) else { continue }
      let candidate = RankedItem(
        result: FlowingGraphCanvasSearchResult(
          item: indexed.item,
          score: Self.score(terms: terms, item: indexed)
        ),
        normalizedTitle: indexed.title,
        order: indexed.order
      )
      let insertionIndex = Self.insertionIndex(of: candidate, in: ranked)
      guard insertionIndex < limit else { continue }
      ranked.insert(candidate, at: insertionIndex)
      if ranked.count > limit {
        ranked.removeLast()
      }
    }
    return ranked.map(\.result)
  }

  private func candidateIndices(for term: String) -> [Int] {
    let prefixCandidates = prefixPostings[term] ?? []
    let fragments = Self.queryFragments(term)
    guard let first = fragments.first,
      var candidates = fragmentPostings[first]
    else {
      return prefixCandidates
    }
    for fragment in fragments.dropFirst() {
      guard let posting = fragmentPostings[fragment] else { return prefixCandidates }
      candidates = Self.intersection(candidates, posting)
      if candidates.isEmpty { return prefixCandidates }
    }
    return Self.union(prefixCandidates, candidates)
  }

  private static func insertionIndex(
    of candidate: RankedItem,
    in ranked: [RankedItem]
  ) -> Int {
    var lowerBound = 0
    var upperBound = ranked.count
    while lowerBound < upperBound {
      let middle = lowerBound + (upperBound - lowerBound) / 2
      if ranksBefore(candidate, ranked[middle]) {
        upperBound = middle
      } else {
        lowerBound = middle + 1
      }
    }
    return lowerBound
  }

  private static func ranksBefore(_ lhs: RankedItem, _ rhs: RankedItem) -> Bool {
    if lhs.result.score != rhs.result.score {
      return lhs.result.score > rhs.result.score
    }
    if lhs.normalizedTitle != rhs.normalizedTitle {
      return lhs.normalizedTitle < rhs.normalizedTitle
    }
    return lhs.order < rhs.order
  }

  private static func intersection(_ lhs: [Int], _ rhs: [Int]) -> [Int] {
    var result: [Int] = []
    result.reserveCapacity(min(lhs.count, rhs.count))
    var left = 0
    var right = 0
    while left < lhs.count, right < rhs.count {
      if lhs[left] == rhs[right] {
        result.append(lhs[left])
        left += 1
        right += 1
      } else if lhs[left] < rhs[right] {
        left += 1
      } else {
        right += 1
      }
    }
    return result
  }

  private static func union(_ lhs: [Int], _ rhs: [Int]) -> [Int] {
    var result: [Int] = []
    result.reserveCapacity(lhs.count + rhs.count)
    var left = 0
    var right = 0
    while left < lhs.count || right < rhs.count {
      if right >= rhs.count || (left < lhs.count && lhs[left] < rhs[right]) {
        result.append(lhs[left])
        left += 1
      } else if left >= lhs.count || rhs[right] < lhs[left] {
        result.append(rhs[right])
        right += 1
      } else {
        result.append(lhs[left])
        left += 1
        right += 1
      }
    }
    return result
  }

  private static func score(terms: [String], item: IndexedItem) -> Int {
    terms.reduce(0) { score, term in
      if item.title == term { return score + 1_000 }
      if item.title.hasPrefix(term) { return score + 800 }
      if tokens(in: item.title).contains(where: { $0.hasPrefix(term) }) {
        return score + 650
      }
      if item.title.contains(term) { return score + 500 }
      if item.keywords.contains(term) { return score + 350 }
      if item.subtitle.contains(term) { return score + 250 }
      if item.category.contains(term) { return score + 150 }
      return score
    }
  }

  private static func matches(_ term: String, item: IndexedItem) -> Bool {
    item.tokens.contains(where: { $0.hasPrefix(term) || $0.contains(term) })
  }

  private static func normalize(_ value: String) -> String {
    value.folding(
      options: [.caseInsensitive, .diacriticInsensitive],
      locale: Locale(identifier: "en_US_POSIX")
    )
    .lowercased()
  }

  private static func tokens(in value: String) -> [String] {
    value.split { !$0.isLetter && !$0.isNumber }.map(String.init)
  }

  private static func prefixes(_ token: String) -> [String] {
    guard !token.isEmpty else { return [] }
    var result: [String] = []
    result.reserveCapacity(min(token.count, 32))
    var prefix = ""
    for character in token.prefix(32) {
      prefix.append(character)
      result.append(prefix)
    }
    return result
  }

  private static func indexFragments(_ value: String) -> [String] {
    fragments(value, width: 1) + fragments(value, width: 2) + fragments(value, width: 3)
  }

  private static func queryFragments(_ value: String) -> [String] {
    fragments(value, width: min(value.count, 3))
  }

  private static func fragments(_ value: String, width: Int) -> [String] {
    let characters = Array(value)
    guard width > 0, characters.count >= width else { return [] }
    return (0...(characters.count - width)).map {
      String(characters[$0...($0 + width - 1)])
    }
  }
}

public struct FlowingGraphCanvasSearchPanel<
  ElementID: Hashable & Sendable,
  RowContent: View
>: View {
  @Binding private var query: String
  private let results: [FlowingGraphCanvasSearchResult<ElementID>]
  private let prompt: String
  private let focusesOnAppear: Bool
  private let onSelect: (FlowingGraphCanvasSearchResult<ElementID>) -> Void
  private let rowContent: (FlowingGraphCanvasSearchResult<ElementID>, Bool) -> RowContent
  @State private var highlightedID: ElementID?
  @FocusState private var fieldIsFocused: Bool

  public init(
    query: Binding<String>,
    results: [FlowingGraphCanvasSearchResult<ElementID>],
    prompt: String = "Search elements",
    focusesOnAppear: Bool = true,
    onSelect: @escaping (FlowingGraphCanvasSearchResult<ElementID>) -> Void,
    @ViewBuilder row:
      @escaping (FlowingGraphCanvasSearchResult<ElementID>, Bool) -> RowContent
  ) {
    _query = query
    self.results = results
    self.prompt = prompt
    self.focusesOnAppear = focusesOnAppear
    self.onSelect = onSelect
    rowContent = row
  }

  public var body: some View {
    VStack(spacing: 6) {
      HStack(spacing: 8) {
        Image(systemName: "magnifyingglass")
          .foregroundStyle(.secondary)
        TextField(prompt, text: $query)
          .textFieldStyle(.plain)
          .focused($fieldIsFocused)
          .accessibilityIdentifier("graph-canvas-search-field")
          .onSubmit(selectHighlighted)
      }
      .padding(.horizontal, 10)
      .frame(height: 34)
      .background(.background, in: RoundedRectangle(cornerRadius: 9, style: .continuous))

      if !query.isEmpty {
        ScrollView {
          LazyVStack(spacing: 2) {
            ForEach(results) { result in
              rowContent(result, highlightedID == result.id)
                .contentShape(Rectangle())
                .onTapGesture { select(result) }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isButton)
                .accessibilityAction { select(result) }
                .accessibilityLabel(result.item.title)
                .accessibilityIdentifier(
                  "graph-canvas-search-result-\(String(describing: result.id))"
                )
            }
          }
        }
        .frame(maxHeight: 280)
      }
    }
    .padding(6)
    .frame(width: 300)
    .background(.background, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    .overlay {
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .strokeBorder(Color.secondary.opacity(0.22))
    }
    .shadow(color: .black.opacity(0.12), radius: 14, y: 6)
    .onAppear {
      fieldIsFocused = focusesOnAppear
      reconcileHighlight()
    }
    .onChange(of: results.map(\.id)) { _ in
      reconcileHighlight()
    }
    .onMoveCommand { direction in
      moveHighlight(direction)
    }
  }

  private func reconcileHighlight() {
    guard !results.isEmpty else {
      highlightedID = nil
      return
    }
    if let highlightedID, results.contains(where: { $0.id == highlightedID }) {
      return
    }
    highlightedID = results[0].id
  }

  private func moveHighlight(_ direction: MoveCommandDirection) {
    guard direction == .up || direction == .down, !results.isEmpty else { return }
    let index =
      highlightedID.flatMap { id in
        results.firstIndex(where: { $0.id == id })
      } ?? 0
    let delta = direction == .up ? -1 : 1
    highlightedID = results[min(max(index + delta, 0), results.count - 1)].id
  }

  private func selectHighlighted() {
    guard let highlightedID,
      let result = results.first(where: { $0.id == highlightedID })
    else {
      return
    }
    onSelect(result)
  }

  private func select(_ result: FlowingGraphCanvasSearchResult<ElementID>) {
    highlightedID = result.id
    onSelect(result)
  }
}

public struct FlowingGraphCanvasDefaultSearchRow<ElementID: Hashable & Sendable>: View {
  public let result: FlowingGraphCanvasSearchResult<ElementID>
  public let isHighlighted: Bool

  public init(
    result: FlowingGraphCanvasSearchResult<ElementID>,
    isHighlighted: Bool
  ) {
    self.result = result
    self.isHighlighted = isHighlighted
  }

  public var body: some View {
    HStack(spacing: 9) {
      VStack(alignment: .leading, spacing: 2) {
        Text(result.item.title)
          .font(.system(size: 12, weight: .medium))
          .foregroundStyle(.primary)
        if let subtitle = result.item.subtitle, !subtitle.isEmpty {
          Text(subtitle)
            .font(.system(size: 10.5))
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
      }
      Spacer(minLength: 8)
      if let category = result.item.category, !category.isEmpty {
        Text(category)
          .font(.system(size: 9.5, weight: .medium))
          .foregroundStyle(.secondary)
      }
    }
    .padding(.horizontal, 9)
    .padding(.vertical, 7)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(
      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .fill(isHighlighted ? Color.accentColor.opacity(0.14) : Color.clear)
    )
  }
}

extension FlowingGraphCanvasSearchPanel
where RowContent == FlowingGraphCanvasDefaultSearchRow<ElementID> {
  public init(
    query: Binding<String>,
    results: [FlowingGraphCanvasSearchResult<ElementID>],
    prompt: String = "Search elements",
    focusesOnAppear: Bool = true,
    onSelect: @escaping (FlowingGraphCanvasSearchResult<ElementID>) -> Void
  ) {
    self.init(
      query: query,
      results: results,
      prompt: prompt,
      focusesOnAppear: focusesOnAppear,
      onSelect: onSelect
    ) { result, isHighlighted in
      FlowingGraphCanvasDefaultSearchRow(
        result: result,
        isHighlighted: isHighlighted
      )
    }
  }
}
