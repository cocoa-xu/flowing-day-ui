import CoreGraphics
import Foundation

struct FlowingBoundsIndex<ItemID: Hashable & Sendable>: Sendable {
  private struct Entry: Sendable {
    let id: ItemID
    let frame: CGRect
    let order: Int
  }

  private struct Node: Sendable {
    let bounds: CGRect
    let entryRange: Range<Int>?
    let firstChildIndex: Int?
    let secondChildIndex: Int?
  }

  private var entries: [Entry]
  private var nodes: [Node]
  private let rootIndex: Int?

  init(
    entries sourceEntries: [FlowingSpatialIndexEntry<ItemID>],
    leafCapacity: Int
  ) throws {
    precondition(leafCapacity > 0)
    var seenIDs: Set<ItemID> = []
    seenIDs.reserveCapacity(sourceEntries.count)
    entries = []
    entries.reserveCapacity(sourceEntries.count)
    for (order, entry) in sourceEntries.enumerated() {
      guard seenIDs.insert(entry.id).inserted else {
        throw FlowingSpatialIndexIssue.duplicateItemID(entry.id)
      }
      guard entry.frame.isFlowingBoundsIndexUsable else {
        throw FlowingSpatialIndexIssue.invalidFrame(entry.id)
      }
      entries.append(Entry(id: entry.id, frame: entry.frame, order: order))
    }

    nodes = []
    nodes.reserveCapacity(sourceEntries.count)
    rootIndex =
      entries.isEmpty
      ? nil
      : Self.build(
        entries: &entries,
        nodes: &nodes,
        range: entries.indices,
        leafCapacity: leafCapacity
      )
  }

  func itemIDs(intersecting rect: CGRect) -> [ItemID] {
    guard rect.isFlowingBoundsIndexUsable, !rect.isEmpty, let rootIndex else {
      return []
    }

    var matches: [(order: Int, id: ItemID)] = []
    var pending = [rootIndex]
    while let nodeIndex = pending.popLast() {
      let node = nodes[nodeIndex]
      guard node.bounds.intersectsIncludingBoundary(rect) else { continue }
      if let range = node.entryRange {
        for entry in entries[range] where entry.frame.intersectsIncludingBoundary(rect) {
          matches.append((entry.order, entry.id))
        }
      } else {
        if let firstChildIndex = node.firstChildIndex {
          pending.append(firstChildIndex)
        }
        if let secondChildIndex = node.secondChildIndex {
          pending.append(secondChildIndex)
        }
      }
    }
    matches.sort { $0.order < $1.order }
    return matches.map(\.id)
  }

  private static func build(
    entries: inout [Entry],
    nodes: inout [Node],
    range: Range<Int>,
    leafCapacity: Int
  ) -> Int {
    let nodeIndex = nodes.count
    let bounds = entries[range].dropFirst().reduce(entries[range.lowerBound].frame) {
      $0.union($1.frame)
    }
    nodes.append(
      Node(
        bounds: bounds,
        entryRange: range,
        firstChildIndex: nil,
        secondChildIndex: nil
      )
    )
    guard range.count > leafCapacity else { return nodeIndex }

    let firstCenter = CGPoint(
      x: entries[range.lowerBound].frame.midX,
      y: entries[range.lowerBound].frame.midY
    )
    let centerBounds = entries[range].dropFirst().reduce(
      CGRect(origin: firstCenter, size: .zero)
    ) { bounds, entry in
      bounds.union(
        CGRect(
          origin: CGPoint(x: entry.frame.midX, y: entry.frame.midY),
          size: .zero
        )
      )
    }
    if centerBounds.width >= centerBounds.height {
      entries[range].sort { $0.frame.midX < $1.frame.midX }
    } else {
      entries[range].sort { $0.frame.midY < $1.frame.midY }
    }
    let middle = range.lowerBound + range.count / 2
    let firstChildIndex = build(
      entries: &entries,
      nodes: &nodes,
      range: range.lowerBound..<middle,
      leafCapacity: leafCapacity
    )
    let secondChildIndex = build(
      entries: &entries,
      nodes: &nodes,
      range: middle..<range.upperBound,
      leafCapacity: leafCapacity
    )
    nodes[nodeIndex] = Node(
      bounds: bounds,
      entryRange: nil,
      firstChildIndex: firstChildIndex,
      secondChildIndex: secondChildIndex
    )
    return nodeIndex
  }
}

extension CGRect {
  fileprivate var isFlowingBoundsIndexUsable: Bool {
    !isNull && !isInfinite && origin.x.isFinite && origin.y.isFinite && width.isFinite
      && height.isFinite && width >= 0 && height >= 0
  }

  fileprivate func intersectsIncludingBoundary(_ other: CGRect) -> Bool {
    minX <= other.maxX && maxX >= other.minX && minY <= other.maxY && maxY >= other.minY
  }
}
