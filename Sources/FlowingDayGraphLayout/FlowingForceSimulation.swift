import CoreGraphics
import Foundation

struct FlowingForceSimulation {
  let configuration: FlowingForceSimulationConfiguration
  let radii: [CGFloat]
  let edges: [FlowingForceIndexedPair]

  func run(positions: inout [CGPoint]) throws {
    precondition(positions.count == radii.count)
    guard positions.count > 1, configuration.iterationLimit > 0 else { return }
    var velocities = Array(repeating: CGVector.zero, count: positions.count)

    for _ in 0..<configuration.iterationLimit {
      try Task.checkCancellation()
      let tree = FlowingForceQuadTree(
        positions: positions,
        radii: radii,
        minimumExtent: configuration.idealEdgeLength,
        maximumDepth: configuration.maximumTreeDepth
      )
      var forces = try tree.repulsiveForces(configuration: configuration)
      try applyAttraction(positions: positions, forces: &forces)
      applyCentering(positions: positions, forces: &forces)
      let maximumMovement = integrate(
        positions: &positions,
        velocities: &velocities,
        forces: forces
      )
      recenter(positions: &positions)
      if maximumMovement <= configuration.convergenceTolerance {
        break
      }
    }
  }

  private func applyAttraction(
    positions: [CGPoint],
    forces: inout [CGVector]
  ) throws {
    for (index, edge) in edges.enumerated() {
      if index.isMultiple(of: FlowingForceCancellation.stride) {
        try Task.checkCancellation()
      }
      let delta = FlowingForceVector.between(
        positions[edge.first],
        positions[edge.second],
        firstIndex: edge.first,
        secondIndex: edge.second
      )
      let extensionLength = delta.length - configuration.idealEdgeLength
      let magnitude = configuration.attractionStrength * extensionLength
      let force = delta.unit.scaled(by: magnitude)
      forces[edge.first] = forces[edge.first].adding(force)
      forces[edge.second] = forces[edge.second].subtracting(force)
    }
  }

  private func applyCentering(
    positions: [CGPoint],
    forces: inout [CGVector]
  ) {
    for index in positions.indices {
      forces[index].dx -= positions[index].x * configuration.centeringStrength
      forces[index].dy -= positions[index].y * configuration.centeringStrength
    }
  }

  private func integrate(
    positions: inout [CGPoint],
    velocities: inout [CGVector],
    forces: [CGVector]
  ) -> CGFloat {
    var maximumMovement: CGFloat = 0
    for index in positions.indices {
      var velocity = velocities[index].adding(
        forces[index].scaled(by: configuration.timeStep)
      ).scaled(by: configuration.damping)
      var movement = velocity.scaled(by: configuration.timeStep)
      let distance = movement.length
      if distance > configuration.maximumDisplacement {
        movement = movement.scaled(by: configuration.maximumDisplacement / distance)
        velocity = movement.scaled(by: 1 / configuration.timeStep)
      }
      positions[index].x += movement.dx
      positions[index].y += movement.dy
      velocities[index] = velocity
      maximumMovement = max(maximumMovement, movement.length)
    }
    return maximumMovement
  }

  private func recenter(positions: inout [CGPoint]) {
    let center = positions.reduce(CGPoint.zero) {
      CGPoint(x: $0.x + $1.x, y: $0.y + $1.y)
    }
    let scale = 1 / CGFloat(positions.count)
    let average = CGPoint(x: center.x * scale, y: center.y * scale)
    for index in positions.indices {
      positions[index].x -= average.x
      positions[index].y -= average.y
    }
  }
}

struct FlowingForceIndexedPair: Hashable {
  let first: Int
  let second: Int
}

private struct FlowingForceQuadTree {
  private var cells: [Cell]
  private var nextBody: [Int]
  private let positions: [CGPoint]
  private let radii: [CGFloat]
  private let maximumDepth: Int

  init(
    positions: [CGPoint],
    radii: [CGFloat],
    minimumExtent: CGFloat,
    maximumDepth: Int
  ) {
    precondition(!positions.isEmpty && positions.count == radii.count)
    self.positions = positions
    self.radii = radii
    self.maximumDepth = maximumDepth
    nextBody = Array(repeating: -1, count: positions.count)
    cells = [Cell(bounds: Self.rootBounds(positions: positions, minimumExtent: minimumExtent))]
    for bodyIndex in positions.indices {
      insert(bodyIndex: bodyIndex, cellIndex: 0, depth: 0)
    }
  }

  func repulsiveForces(
    configuration: FlowingForceSimulationConfiguration
  ) throws -> [CGVector] {
    var result = Array(repeating: CGVector.zero, count: positions.count)
    var stack: [Int] = []
    stack.reserveCapacity(configuration.maximumTreeDepth * 3)

    for bodyIndex in positions.indices {
      if bodyIndex.isMultiple(of: FlowingForceCancellation.stride) {
        try Task.checkCancellation()
      }
      stack.removeAll(keepingCapacity: true)
      stack.append(0)
      var force = CGVector.zero
      while let cellIndex = stack.popLast() {
        let cell = cells[cellIndex]
        guard cell.mass > 0 else { continue }
        if let childrenStart = cell.childrenStart {
          let delta = FlowingForceVector.between(
            cell.centerOfMass,
            positions[bodyIndex],
            firstIndex: bodyIndex,
            secondIndex: bodyIndex + 1
          )
          let containsBody = cell.contains(positions[bodyIndex])
          let clearance =
            delta.length - cell.halfDiagonal - radii[bodyIndex]
            - cell.maximumRadius - configuration.collisionPadding
          if !containsBody && clearance > 0
            && cell.maximumDimension / delta.length < configuration.barnesHutTheta
          {
            force = force.adding(
              repulsion(
                delta: delta,
                sourceMass: cell.mass,
                strength: configuration.repulsionStrength
              )
            )
          } else {
            stack.append(contentsOf: (childrenStart..<(childrenStart + 4)).reversed())
          }
        } else {
          var otherIndex = cell.bodyHead
          while otherIndex >= 0 {
            if otherIndex != bodyIndex {
              let delta = FlowingForceVector.between(
                positions[otherIndex],
                positions[bodyIndex],
                firstIndex: bodyIndex,
                secondIndex: otherIndex
              )
              force = force.adding(
                directRepulsion(
                  delta: delta,
                  requiredDistance: radii[bodyIndex] + radii[otherIndex]
                    + configuration.collisionPadding,
                  configuration: configuration
                )
              )
            }
            otherIndex = nextBody[otherIndex]
          }
        }
      }
      result[bodyIndex] = force
    }
    return result
  }

  private mutating func insert(bodyIndex: Int, cellIndex: Int, depth: Int) {
    var currentCellIndex = cellIndex
    var currentDepth = depth
    while true {
      cells[currentCellIndex].add(
        position: positions[bodyIndex],
        radius: radii[bodyIndex]
      )
      if let childrenStart = cells[currentCellIndex].childrenStart {
        currentCellIndex = childIndex(
          for: positions[bodyIndex],
          parentIndex: currentCellIndex,
          childrenStart: childrenStart
        )
        currentDepth += 1
        continue
      }
      guard cells[currentCellIndex].bodyHead >= 0 else {
        cells[currentCellIndex].bodyHead = bodyIndex
        return
      }
      guard currentDepth < maximumDepth else {
        nextBody[bodyIndex] = cells[currentCellIndex].bodyHead
        cells[currentCellIndex].bodyHead = bodyIndex
        return
      }

      let existingHead = cells[currentCellIndex].bodyHead
      let childrenStart = subdivide(cellIndex: currentCellIndex)
      cells[currentCellIndex].bodyHead = -1
      var existingIndex = existingHead
      while existingIndex >= 0 {
        let nextIndex = nextBody[existingIndex]
        nextBody[existingIndex] = -1
        let destination = childIndex(
          for: positions[existingIndex],
          parentIndex: currentCellIndex,
          childrenStart: childrenStart
        )
        insert(bodyIndex: existingIndex, cellIndex: destination, depth: currentDepth + 1)
        existingIndex = nextIndex
      }
      currentCellIndex = childIndex(
        for: positions[bodyIndex],
        parentIndex: currentCellIndex,
        childrenStart: childrenStart
      )
      currentDepth += 1
    }
  }

  private mutating func subdivide(cellIndex: Int) -> Int {
    let bounds = cells[cellIndex].bounds
    let halfWidth = bounds.width / 2
    let halfHeight = bounds.height / 2
    let start = cells.count
    cells.append(contentsOf: [
      Cell(bounds: CGRect(x: bounds.minX, y: bounds.minY, width: halfWidth, height: halfHeight)),
      Cell(bounds: CGRect(x: bounds.midX, y: bounds.minY, width: halfWidth, height: halfHeight)),
      Cell(bounds: CGRect(x: bounds.minX, y: bounds.midY, width: halfWidth, height: halfHeight)),
      Cell(bounds: CGRect(x: bounds.midX, y: bounds.midY, width: halfWidth, height: halfHeight)),
    ])
    cells[cellIndex].childrenStart = start
    return start
  }

  private func childIndex(
    for position: CGPoint,
    parentIndex: Int,
    childrenStart: Int
  ) -> Int {
    let bounds = cells[parentIndex].bounds
    let horizontal = position.x >= bounds.midX ? 1 : 0
    let vertical = position.y >= bounds.midY ? 2 : 0
    return childrenStart + horizontal + vertical
  }

  private func directRepulsion(
    delta: FlowingForceVector,
    requiredDistance: CGFloat,
    configuration: FlowingForceSimulationConfiguration
  ) -> CGVector {
    var force = repulsion(
      delta: delta,
      sourceMass: 1,
      strength: configuration.repulsionStrength
    )
    if delta.length < requiredDistance {
      force = force.adding(
        delta.unit.scaled(
          by: configuration.collisionStrength * (requiredDistance - delta.length)
        )
      )
    }
    return force
  }

  private func repulsion(
    delta: FlowingForceVector,
    sourceMass: CGFloat,
    strength: CGFloat
  ) -> CGVector {
    delta.unit.scaled(by: strength * sourceMass / max(delta.lengthSquared, .leastNormalMagnitude))
  }

  private static func rootBounds(
    positions: [CGPoint],
    minimumExtent: CGFloat
  ) -> CGRect {
    let first = positions[0]
    var minimumX = first.x
    var maximumX = first.x
    var minimumY = first.y
    var maximumY = first.y
    for position in positions.dropFirst() {
      minimumX = min(minimumX, position.x)
      maximumX = max(maximumX, position.x)
      minimumY = min(minimumY, position.y)
      maximumY = max(maximumY, position.y)
    }
    let extent = max(maximumX - minimumX, maximumY - minimumY, minimumExtent)
    let center = CGPoint(x: (minimumX + maximumX) / 2, y: (minimumY + maximumY) / 2)
    return CGRect(
      x: center.x - extent / 2,
      y: center.y - extent / 2,
      width: extent,
      height: extent
    )
  }

  private struct Cell {
    let bounds: CGRect
    var mass: CGFloat = 0
    var weightedX: CGFloat = 0
    var weightedY: CGFloat = 0
    var maximumRadius: CGFloat = 0
    var childrenStart: Int?
    var bodyHead = -1

    var centerOfMass: CGPoint {
      CGPoint(x: weightedX / mass, y: weightedY / mass)
    }

    var maximumDimension: CGFloat {
      max(bounds.width, bounds.height)
    }

    var halfDiagonal: CGFloat {
      hypot(bounds.width, bounds.height) / 2
    }

    mutating func add(position: CGPoint, radius: CGFloat) {
      mass += 1
      weightedX += position.x
      weightedY += position.y
      maximumRadius = max(maximumRadius, radius)
    }

    func contains(_ position: CGPoint) -> Bool {
      position.x >= bounds.minX && position.x <= bounds.maxX && position.y >= bounds.minY
        && position.y <= bounds.maxY
    }
  }
}

private struct FlowingForceVector {
  let value: CGVector

  var lengthSquared: CGFloat {
    value.dx * value.dx + value.dy * value.dy
  }

  var length: CGFloat {
    sqrt(lengthSquared)
  }

  var unit: CGVector {
    let divisor = max(length, .leastNormalMagnitude)
    return value.scaled(by: 1 / divisor)
  }

  static func between(
    _ source: CGPoint,
    _ target: CGPoint,
    firstIndex: Int,
    secondIndex: Int
  ) -> Self {
    let value = CGVector(dx: target.x - source.x, dy: target.y - source.y)
    guard value != .zero else {
      return Self(value: CGVector(dx: firstIndex < secondIndex ? -1 : 1, dy: 0))
    }
    return Self(value: value)
  }
}

enum FlowingForceCancellation {
  static let stride = 256
}

extension CGVector {
  fileprivate var length: CGFloat {
    hypot(dx, dy)
  }

  fileprivate func adding(_ other: CGVector) -> CGVector {
    CGVector(dx: dx + other.dx, dy: dy + other.dy)
  }

  fileprivate func subtracting(_ other: CGVector) -> CGVector {
    CGVector(dx: dx - other.dx, dy: dy - other.dy)
  }

  fileprivate func scaled(by scale: CGFloat) -> CGVector {
    CGVector(dx: dx * scale, dy: dy * scale)
  }
}
