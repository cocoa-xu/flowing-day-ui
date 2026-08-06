import CoreGraphics
import Foundation

public struct FlowingSpatialIndexConfiguration: Sendable, Equatable {
  public let bucketSize: CGFloat
  public let maximumCellsPerItem: Int
  public let maximumCellsPerQuery: Int
  public let maximumNearestCellsVisited: Int

  public init(
    bucketSize: CGFloat = 384,
    maximumCellsPerItem: Int = 4_096,
    maximumCellsPerQuery: Int = 65_536,
    maximumNearestCellsVisited: Int = 65_536
  ) {
    precondition(bucketSize > 0 && bucketSize.isFinite)
    precondition(maximumCellsPerItem > 0)
    precondition(maximumCellsPerQuery > 0)
    precondition(maximumNearestCellsVisited > 0)
    self.bucketSize = bucketSize
    self.maximumCellsPerItem = maximumCellsPerItem
    self.maximumCellsPerQuery = maximumCellsPerQuery
    self.maximumNearestCellsVisited = maximumNearestCellsVisited
  }
}

public struct FlowingSpatialIndexEntry<ItemID: Hashable & Sendable>: Sendable {
  public let id: ItemID
  public let frame: CGRect

  public init(id: ItemID, frame: CGRect) {
    self.id = id
    self.frame = frame
  }
}

public enum FlowingSpatialIndexIssue<ItemID: Hashable & Sendable>: Error {
  case duplicateItemID(ItemID)
  case unknownItemID(ItemID)
  case invalidFrame(ItemID)
  case coordinateOutOfRange(ItemID)
  case itemCellBudgetExceeded(ItemID)
}

extension FlowingSpatialIndexIssue: Equatable {}

public struct FlowingSpatialIndex<ItemID: Hashable & Sendable>: Sendable {
  private struct Cell: Hashable, Sendable {
    let column: Int
    let row: Int
  }

  public let configuration: FlowingSpatialIndexConfiguration
  public private(set) var orderedItemIDs: [ItemID]

  private var orderByID: [ItemID: Int]
  private var frameByID: [ItemID: CGRect]
  private var cellsByID: [ItemID: [Cell]]
  private var buckets: [Cell: Set<ItemID>]
  private var occupiedColumns: ClosedRange<Int>?
  private var occupiedRows: ClosedRange<Int>?

  public init(
    entries: [FlowingSpatialIndexEntry<ItemID>],
    configuration: FlowingSpatialIndexConfiguration = .init()
  ) throws {
    self.configuration = configuration
    orderedItemIDs = []
    orderByID = [:]
    frameByID = [:]
    cellsByID = [:]
    buckets = [:]
    occupiedColumns = nil
    occupiedRows = nil
    orderedItemIDs.reserveCapacity(entries.count)
    orderByID.reserveCapacity(entries.count)
    frameByID.reserveCapacity(entries.count)
    cellsByID.reserveCapacity(entries.count)

    for entry in entries {
      guard orderByID[entry.id] == nil else {
        throw FlowingSpatialIndexIssue.duplicateItemID(entry.id)
      }
      let cells = try cells(for: entry.frame, itemID: entry.id)
      orderByID[entry.id] = orderedItemIDs.count
      orderedItemIDs.append(entry.id)
      frameByID[entry.id] = entry.frame
      cellsByID[entry.id] = cells
      insert(entry.id, into: cells)
    }
  }

  public func frame(for itemID: ItemID) -> CGRect? {
    frameByID[itemID]
  }

  public func itemIDs(intersecting rect: CGRect) -> [ItemID] {
    itemIDsUnordered(intersecting: rect).sorted { orderByID[$0]! < orderByID[$1]! }
  }

  public func itemIDsUnordered(intersecting rect: CGRect) -> [ItemID] {
    guard rect.isUsable, !rect.isEmpty, !buckets.isEmpty else { return [] }
    guard let queryCells = queryCells(for: rect) else {
      return orderedItemIDs.filter { frameByID[$0]?.intersects(rect) == true }
    }
    var matches: Set<ItemID> = []
    for cell in queryCells {
      guard let itemIDs = buckets[cell] else { continue }
      for itemID in itemIDs
      where frameByID[itemID]?.intersects(rect) == true {
        matches.insert(itemID)
      }
    }
    return Array(matches)
  }

  public func nearestItemID(
    to point: CGPoint,
    excluding excludedIDs: Set<ItemID> = []
  ) -> ItemID? {
    guard point.x.isFinite, point.y.isFinite,
      let occupiedColumns,
      let occupiedRows,
      let origin = cell(containing: point)
    else { return nil }
    let maximumRadius = max(
      abs(origin.column - occupiedColumns.lowerBound),
      abs(origin.column - occupiedColumns.upperBound),
      abs(origin.row - occupiedRows.lowerBound),
      abs(origin.row - occupiedRows.upperBound)
    )
    guard occupiedColumns.contains(origin.column),
      occupiedRows.contains(origin.row)
    else {
      return nearestItemIDByScanning(to: point, excluding: excludedIDs)
    }
    var visited: Set<ItemID> = []
    var nearestID: ItemID?
    var nearestDistance = CGFloat.greatestFiniteMagnitude

    for radius in 0...maximumRadius {
      guard cellsVisited(through: radius) <= configuration.maximumNearestCellsVisited else {
        return nearestItemIDByScanning(to: point, excluding: excludedIDs)
      }
      for cell in perimeter(around: origin, radius: radius) {
        guard let itemIDs = buckets[cell] else { continue }
        for itemID in itemIDs where visited.insert(itemID).inserted {
          guard !excludedIDs.contains(itemID), let frame = frameByID[itemID] else { continue }
          let distance = Self.distanceSquared(from: point, to: frame)
          if distance < nearestDistance ||
            (distance == nearestDistance && isOrdered(itemID, before: nearestID))
          {
            nearestID = itemID
            nearestDistance = distance
          }
        }
      }
      let boundaryDistance = distanceToOutside(
        point: point,
        origin: origin,
        radius: radius
      )
      if nearestDistance <= boundaryDistance * boundaryDistance {
        break
      }
    }
    return nearestID
  }

  private func cellsVisited(through radius: Int) -> Int {
    let width = radius.multipliedReportingOverflow(by: 2)
    guard !width.overflow else { return .max }
    let side = width.partialValue.addingReportingOverflow(1)
    guard !side.overflow else { return .max }
    let area = side.partialValue.multipliedReportingOverflow(by: side.partialValue)
    return area.overflow ? .max : area.partialValue
  }

  public mutating func updateFrame(
    _ frame: CGRect,
    for itemID: ItemID
  ) throws {
    guard let oldCells = cellsByID[itemID] else {
      throw FlowingSpatialIndexIssue.unknownItemID(itemID)
    }
    let newCells = try cells(for: frame, itemID: itemID)
    let oldCellSet = Set(oldCells)
    let newCellSet = Set(newCells)
    for cell in oldCellSet.subtracting(newCellSet) {
      buckets[cell]?.remove(itemID)
      if buckets[cell]?.isEmpty == true {
        buckets.removeValue(forKey: cell)
      }
    }
    insert(itemID, into: newCellSet.subtracting(oldCellSet))
    frameByID[itemID] = frame
    cellsByID[itemID] = newCells
  }

  private mutating func insert(_ itemID: ItemID, into cells: some Sequence<Cell>) {
    for cell in cells {
      buckets[cell, default: []].insert(itemID)
      occupiedColumns = Self.expanding(occupiedColumns, toInclude: cell.column)
      occupiedRows = Self.expanding(occupiedRows, toInclude: cell.row)
    }
  }

  private func cells(
    for frame: CGRect,
    itemID: ItemID
  ) throws -> [Cell] {
    guard frame.isUsable else {
      throw FlowingSpatialIndexIssue.invalidFrame(itemID)
    }
    guard let columns = cellRange(frame.minX, frame.maxX),
      let rows = cellRange(frame.minY, frame.maxY)
    else {
      throw FlowingSpatialIndexIssue.coordinateOutOfRange(itemID)
    }
    let (columnCount, columnOverflow) = columns.count.multipliedReportingOverflow(by: rows.count)
    guard !columnOverflow, columnCount <= configuration.maximumCellsPerItem else {
      throw FlowingSpatialIndexIssue.itemCellBudgetExceeded(itemID)
    }
    var result: [Cell] = []
    result.reserveCapacity(columnCount)
    for column in columns {
      for row in rows {
        result.append(Cell(column: column, row: row))
      }
    }
    return result
  }

  private func queryCells(for rect: CGRect) -> [Cell]? {
    guard let columns = cellRange(rect.minX, rect.maxX),
      let rows = cellRange(rect.minY, rect.maxY)
    else { return nil }
    let (cellCount, overflow) = columns.count.multipliedReportingOverflow(by: rows.count)
    guard !overflow, cellCount <= configuration.maximumCellsPerQuery else { return nil }
    var cells: [Cell] = []
    cells.reserveCapacity(cellCount)
    for column in columns {
      for row in rows {
        cells.append(Cell(column: column, row: row))
      }
    }
    return cells
  }

  private func cellRange(
    _ minimum: CGFloat,
    _ maximum: CGFloat
  ) -> ClosedRange<Int>? {
    let lower = floor(minimum / configuration.bucketSize)
    let upper = floor(maximum / configuration.bucketSize)
    guard lower >= CGFloat(Self.minimumSafeCellCoordinate),
      lower <= CGFloat(Self.maximumSafeCellCoordinate),
      upper >= CGFloat(Self.minimumSafeCellCoordinate),
      upper <= CGFloat(Self.maximumSafeCellCoordinate)
    else { return nil }
    return Int(lower)...Int(upper)
  }

  private func cell(containing point: CGPoint) -> Cell? {
    guard let columns = cellRange(point.x, point.x),
      let rows = cellRange(point.y, point.y)
    else { return nil }
    return Cell(column: columns.lowerBound, row: rows.lowerBound)
  }

  private func perimeter(around origin: Cell, radius: Int) -> [Cell] {
    guard radius > 0 else { return [origin] }
    let minimumColumn = origin.column - radius
    let maximumColumn = origin.column + radius
    let minimumRow = origin.row - radius
    let maximumRow = origin.row + radius
    var cells: [Cell] = []
    cells.reserveCapacity(radius * 8)
    for column in minimumColumn...maximumColumn {
      cells.append(Cell(column: column, row: minimumRow))
      cells.append(Cell(column: column, row: maximumRow))
    }
    if minimumRow + 1 < maximumRow {
      for row in (minimumRow + 1)..<maximumRow {
        cells.append(Cell(column: minimumColumn, row: row))
        cells.append(Cell(column: maximumColumn, row: row))
      }
    }
    return cells
  }

  private func distanceToOutside(
    point: CGPoint,
    origin: Cell,
    radius: Int
  ) -> CGFloat {
    let minimumX = CGFloat(origin.column - radius) * configuration.bucketSize
    let maximumX = CGFloat(origin.column + radius + 1) * configuration.bucketSize
    let minimumY = CGFloat(origin.row - radius) * configuration.bucketSize
    let maximumY = CGFloat(origin.row + radius + 1) * configuration.bucketSize
    return min(
      point.x - minimumX,
      maximumX - point.x,
      point.y - minimumY,
      maximumY - point.y
    )
  }

  private func isOrdered(_ itemID: ItemID, before otherID: ItemID?) -> Bool {
    guard let otherID else { return true }
    return orderByID[itemID]! < orderByID[otherID]!
  }

  private func nearestItemIDByScanning(
    to point: CGPoint,
    excluding excludedIDs: Set<ItemID>
  ) -> ItemID? {
    var nearestID: ItemID?
    var nearestDistance = CGFloat.greatestFiniteMagnitude
    for itemID in orderedItemIDs where !excludedIDs.contains(itemID) {
      guard let frame = frameByID[itemID] else { continue }
      let distance = Self.distanceSquared(from: point, to: frame)
      if distance < nearestDistance {
        nearestID = itemID
        nearestDistance = distance
      }
    }
    return nearestID
  }

  private static func expanding(
    _ range: ClosedRange<Int>?,
    toInclude value: Int
  ) -> ClosedRange<Int> {
    guard let range else { return value...value }
    return min(range.lowerBound, value)...max(range.upperBound, value)
  }

  private static func distanceSquared(from point: CGPoint, to rect: CGRect) -> CGFloat {
    let dx = max(max(rect.minX - point.x, 0), point.x - rect.maxX)
    let dy = max(max(rect.minY - point.y, 0), point.y - rect.maxY)
    return dx * dx + dy * dy
  }

  private static var minimumSafeCellCoordinate: Int {
    Int.min / cellCoordinateSafetyDivisor
  }

  private static var maximumSafeCellCoordinate: Int {
    Int.max / cellCoordinateSafetyDivisor
  }

  private static var cellCoordinateSafetyDivisor: Int {
    4
  }
}

private extension CGRect {
  var isUsable: Bool {
    !isNull && !isInfinite && origin.x.isFinite && origin.y.isFinite &&
      width.isFinite && height.isFinite && width >= 0 && height >= 0
  }
}
