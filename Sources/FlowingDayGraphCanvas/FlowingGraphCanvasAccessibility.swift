import CoreGraphics
import FlowingDayGraphComposition
import FlowingDayGraphCore
import Foundation

#if canImport(AppKit)
  import AppKit
  import FlowingDayCanvas
  import SwiftUI
#endif

public struct FlowingGraphCanvasAccessibilityCapabilities: OptionSet, Sendable {
  public let rawValue: UInt8

  public init(rawValue: UInt8) {
    self.rawValue = rawValue
  }

  public static let focusNavigation = Self(rawValue: 1 << 0)
  public static let selection = Self(rawValue: 1 << 1)
  public static let movement = Self(rawValue: 1 << 2)
  public static let connections = Self(rawValue: 1 << 3)
  public static let elementActions = Self(rawValue: 1 << 4)
  public static let standard: Self = [
    .focusNavigation,
    .selection,
    .movement,
    .connections,
    .elementActions,
  ]
}

public struct FlowingGraphCanvasAccessibilityActionLabels: Equatable, Sendable {
  public let nextElement: String
  public let previousElement: String
  public let nextRelatedElement: String
  public let moveUp: String
  public let moveDown: String
  public let moveLeft: String
  public let moveRight: String

  public init(
    nextElement: String = "Next Element",
    previousElement: String = "Previous Element",
    nextRelatedElement: String = "Next Connected Element",
    moveUp: String = "Move Up",
    moveDown: String = "Move Down",
    moveLeft: String = "Move Left",
    moveRight: String = "Move Right"
  ) {
    precondition(
      [
        nextElement,
        previousElement,
        nextRelatedElement,
        moveUp,
        moveDown,
        moveLeft,
        moveRight,
      ].allSatisfy { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    )
    self.nextElement = nextElement
    self.previousElement = previousElement
    self.nextRelatedElement = nextRelatedElement
    self.moveUp = moveUp
    self.moveDown = moveDown
    self.moveLeft = moveLeft
    self.moveRight = moveRight
  }

  public static let standard = Self()
}

public struct FlowingGraphCanvasAccessibilityConfiguration: Equatable, Sendable {
  public static let standardMaximumExposedElementCount = 64

  public let capabilities: FlowingGraphCanvasAccessibilityCapabilities
  public let maximumExposedElementCount: Int
  public let keepsFocusedElementVisible: Bool
  public let actionLabels: FlowingGraphCanvasAccessibilityActionLabels

  public init(
    capabilities: FlowingGraphCanvasAccessibilityCapabilities = .standard,
    maximumExposedElementCount: Int = standardMaximumExposedElementCount,
    keepsFocusedElementVisible: Bool = true,
    actionLabels: FlowingGraphCanvasAccessibilityActionLabels = .standard
  ) {
    precondition(maximumExposedElementCount > 0)
    self.capabilities = capabilities
    self.maximumExposedElementCount = maximumExposedElementCount
    self.keepsFocusedElementVisible = keepsFocusedElementVisible
    self.actionLabels = actionLabels
  }

  public var isEnabled: Bool {
    !capabilities.isEmpty
  }

  public static let standard = Self()
  public static let disabled = Self(capabilities: [])
}

public enum FlowingGraphCanvasAccessibilityElementKind: Hashable, Sendable {
  case node
  case port
  case edge
}

public struct FlowingGraphCanvasAccessibilityAction: Hashable, Sendable {
  public let action: FlowingGraphCanvasElementAction
  public let label: String

  public init(action: FlowingGraphCanvasElementAction, label: String) {
    precondition(!label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    self.action = action
    self.label = label
  }
}

public struct FlowingGraphCanvasAccessibilityDescription: Equatable, Sendable {
  public let label: String
  public let value: String?
  public let hint: String?
  public let roleDescription: String?
  public let identifier: String?
  public let actions: [FlowingGraphCanvasAccessibilityAction]

  public init(
    label: String,
    value: String? = nil,
    hint: String? = nil,
    roleDescription: String? = nil,
    identifier: String? = nil,
    actions: [FlowingGraphCanvasAccessibilityAction] = []
  ) {
    precondition(!label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    precondition(Set(actions.map(\.action)).count == actions.count)
    self.label = label
    self.value = value
    self.hint = hint
    self.roleDescription = roleDescription
    self.identifier = identifier
    self.actions = actions
  }
}

public enum FlowingGraphCanvasAccessibilityRepresentation: Equatable, Sendable {
  case hidden
  case element(FlowingGraphCanvasAccessibilityDescription)
}

public struct FlowingGraphCanvasAccessibilityItem<ID: Hashable & Sendable>: Sendable {
  public let id: ID
  public let kind: FlowingGraphCanvasAccessibilityElementKind
  public let frame: CGRect
  public let description: FlowingGraphCanvasAccessibilityDescription
  public let relatedElementIDs: [ID]

  public init(
    id: ID,
    kind: FlowingGraphCanvasAccessibilityElementKind,
    frame: CGRect,
    description: FlowingGraphCanvasAccessibilityDescription,
    relatedElementIDs: [ID] = []
  ) {
    self.id = id
    self.kind = kind
    self.frame = frame
    self.description = description
    self.relatedElementIDs = relatedElementIDs
  }
}

extension FlowingGraphCanvasAccessibilityItem: Equatable where ID: Equatable {}

public enum FlowingGraphCanvasAccessibilitySnapshotIssue<ID: Hashable & Sendable>: Error {
  case duplicateElementID(ID)
  case invalidFrame(ID)
}

extension FlowingGraphCanvasAccessibilitySnapshotIssue: Equatable where ID: Equatable {}

public struct FlowingGraphCanvasAccessibilitySnapshotID: Hashable, Sendable {
  private let rawValue: UUID

  public init() {
    rawValue = UUID()
  }
}

public struct FlowingGraphCanvasAccessibilitySnapshot<ID: Hashable & Sendable>: Sendable {
  public let id: FlowingGraphCanvasAccessibilitySnapshotID
  public let canvasDescription: FlowingGraphCanvasAccessibilityDescription
  public let items: [FlowingGraphCanvasAccessibilityItem<ID>]

  private let indexByID: [ID: Int]
  private let relationshipGraph: [ID: [ID]]

  public init(
    id: FlowingGraphCanvasAccessibilitySnapshotID = .init(),
    canvasDescription: FlowingGraphCanvasAccessibilityDescription,
    items: [FlowingGraphCanvasAccessibilityItem<ID>],
    relationships: [ID: [ID]] = [:]
  ) throws {
    var indexByID: [ID: Int] = [:]
    indexByID.reserveCapacity(items.count)
    for (index, item) in items.enumerated() {
      guard indexByID.updateValue(index, forKey: item.id) == nil else {
        throw FlowingGraphCanvasAccessibilitySnapshotIssue.duplicateElementID(item.id)
      }
      guard item.frame.isFinite else {
        throw FlowingGraphCanvasAccessibilitySnapshotIssue.invalidFrame(item.id)
      }
    }
    let knownIDs = Set(indexByID.keys)
    var relationshipGraph = relationships
    for item in items
    where relationshipGraph[item.id] == nil && !item.relatedElementIDs.isEmpty {
      relationshipGraph[item.id] = item.relatedElementIDs
    }
    self.id = id
    self.canvasDescription = canvasDescription
    self.items = items.map { item in
      FlowingGraphCanvasAccessibilityItem(
        id: item.id,
        kind: item.kind,
        frame: item.frame,
        description: item.description,
        relatedElementIDs: item.relatedElementIDs.filter(knownIDs.contains)
      )
    }
    self.indexByID = indexByID
    self.relationshipGraph = relationshipGraph
  }

  private static func exposedRelationships(
    from sourceID: ID,
    indexByID: [ID: Int],
    graph: [ID: [ID]]
  ) -> [ID] {
    var result: [ID] = []
    var discovered = Set<ID>([sourceID])
    var queue = graph[sourceID] ?? []
    var nextIndex = 0
    while nextIndex < queue.count {
      let candidateID = queue[nextIndex]
      nextIndex += 1
      guard discovered.insert(candidateID).inserted else { continue }
      if indexByID[candidateID] != nil {
        result.append(candidateID)
      } else {
        queue.append(contentsOf: graph[candidateID] ?? [])
      }
    }
    return result
  }

  public var firstElementID: ID? {
    items.first?.id
  }

  public func contains(_ id: ID) -> Bool {
    indexByID[id] != nil
  }

  public func item(for id: ID) -> FlowingGraphCanvasAccessibilityItem<ID>? {
    indexByID[id].map { items[$0] }
  }

  public func reconciledFocus(_ preferredID: ID?) -> ID? {
    preferredID.flatMap { contains($0) ? $0 : nil } ?? firstElementID
  }

  public func elementID(after id: ID) -> ID? {
    guard let index = indexByID[id], items.indices.contains(index + 1) else { return nil }
    return items[index + 1].id
  }

  public func elementID(before id: ID) -> ID? {
    guard let index = indexByID[id], index > items.startIndex else { return nil }
    return items[index - 1].id
  }

  public func nextRelatedElementID(after id: ID) -> ID? {
    relatedElementIDs(for: id).first
  }

  public func relatedElementIDs(for id: ID) -> [ID] {
    guard contains(id) else { return [] }
    return Self.exposedRelationships(
      from: id,
      indexByID: indexByID,
      graph: relationshipGraph
    )
  }

  public func exposedItems(
    centeredAt focusedID: ID?,
    maximumCount: Int
  ) -> ArraySlice<FlowingGraphCanvasAccessibilityItem<ID>> {
    precondition(maximumCount > 0)
    guard items.count > maximumCount else { return items[...] }
    let focusedIndex = focusedID.flatMap { indexByID[$0] } ?? items.startIndex
    let halfCount = maximumCount / 2
    let maximumStart = items.count - maximumCount
    let start = min(max(focusedIndex - halfCount, items.startIndex), maximumStart)
    return items[start..<(start + maximumCount)]
  }
}

public enum FlowingGraphCanvasAccessibilityRequest<ID: Hashable & Sendable>: Sendable {
  case focus(ID)
  case select(ID)
  case move(ID, direction: FlowingGraphCanvasNavigationDirection, largeStep: Bool)
  case perform(ID, action: FlowingGraphCanvasElementAction)
}

extension FlowingGraphCanvasAccessibilityRequest: Equatable where ID: Equatable {}

#if canImport(AppKit)
  @MainActor
  public final class FlowingGraphCanvasAccessibilityBridge<ID: Hashable & Sendable> {
    public typealias RequestHandler = (FlowingGraphCanvasAccessibilityRequest<ID>) -> Bool
    public typealias FrameResolver = (CGRect) -> CGRect

    public private(set) var focusedElementID: ID?

    private var snapshot: FlowingGraphCanvasAccessibilitySnapshot<ID>?
    private var configuration: FlowingGraphCanvasAccessibilityConfiguration = .disabled
    private var selectedElementIDs: Set<ID> = []
    fileprivate weak var parent: NSView?
    private var frameResolver: FrameResolver = { $0 }
    private var requestHandler: RequestHandler = { _ in false }
    private var elementsByID: [ID: FlowingGraphCanvasPlatformAccessibilityElement<ID>] = [:]

    public init() {}

    public func update(
      snapshot: FlowingGraphCanvasAccessibilitySnapshot<ID>?,
      configuration: FlowingGraphCanvasAccessibilityConfiguration,
      selectedElementIDs: Set<ID>,
      focusedElementID: ID?,
      parent: NSView,
      frameResolver: @escaping FrameResolver,
      onRequest: @escaping RequestHandler
    ) {
      let previousSnapshotID = self.snapshot?.id
      let previousSelection = self.selectedElementIDs
      let previousFocus = self.focusedElementID
      self.snapshot = snapshot
      self.configuration = configuration
      self.selectedElementIDs = selectedElementIDs
      self.parent = parent
      self.frameResolver = frameResolver
      requestHandler = onRequest
      self.focusedElementID = snapshot?.reconciledFocus(focusedElementID ?? previousFocus)
      rebuildExposedElements()

      if previousSnapshotID != snapshot?.id {
        NSAccessibility.post(element: parent, notification: .layoutChanged)
      }
      if previousSelection != selectedElementIDs {
        NSAccessibility.post(element: parent, notification: .selectedChildrenChanged)
      }
      if previousFocus != self.focusedElementID,
        let focusedElement = self.focusedElementID.flatMap({ elementsByID[$0] })
      {
        NSAccessibility.post(element: focusedElement, notification: .focusedUIElementChanged)
      }
    }

    public var isEnabled: Bool {
      configuration.isEnabled && snapshot != nil
    }

    public var canvasDescription: FlowingGraphCanvasAccessibilityDescription? {
      snapshot?.canvasDescription
    }

    public func accessibilityChildren() -> [Any] {
      exposedElements()
    }

    public func accessibilityFocusedElement() -> NSAccessibilityElement? {
      focusedElementID.flatMap { elementsByID[$0] }
    }

    public func accessibilitySelectedChildren() -> [Any] {
      exposedElements().filter { selectedElementIDs.contains($0.id) }
    }

    fileprivate func item(for id: ID) -> FlowingGraphCanvasAccessibilityItem<ID>? {
      snapshot?.item(for: id)
    }

    fileprivate func isSelected(_ id: ID) -> Bool {
      selectedElementIDs.contains(id)
    }

    fileprivate func screenFrame(for id: ID) -> CGRect {
      guard let frame = snapshot?.item(for: id)?.frame else { return .zero }
      return frameResolver(frame.minimumAccessibilitySize)
    }

    fileprivate func request(_ request: FlowingGraphCanvasAccessibilityRequest<ID>) -> Bool {
      guard isEnabled else { return false }
      return requestHandler(request)
    }

    fileprivate func focus(_ id: ID) -> Bool {
      guard snapshot?.contains(id) == true, request(.focus(id)) else { return false }
      focusedElementID = id
      let exposedElementsChanged = rebuildExposedElements()
      if exposedElementsChanged, let parent {
        NSAccessibility.post(element: parent, notification: .layoutChanged)
      }
      guard let element = elementsByID[id] else { return false }
      NSAccessibility.post(element: element, notification: .focusedUIElementChanged)
      return true
    }

    fileprivate func focusNext(from id: ID) -> Bool {
      guard configuration.capabilities.contains(.focusNavigation),
        let nextID = snapshot?.elementID(after: id)
      else { return false }
      return focus(nextID)
    }

    fileprivate func focusPrevious(from id: ID) -> Bool {
      guard configuration.capabilities.contains(.focusNavigation),
        let previousID = snapshot?.elementID(before: id)
      else { return false }
      return focus(previousID)
    }

    fileprivate func focusNextRelated(from id: ID) -> Bool {
      guard configuration.capabilities.contains(.focusNavigation),
        let relatedID = snapshot?.nextRelatedElementID(after: id)
      else { return false }
      return focus(relatedID)
    }

    fileprivate func customActions(for id: ID) -> [NSAccessibilityCustomAction] {
      guard let item = snapshot?.item(for: id) else { return [] }
      var actions: [NSAccessibilityCustomAction] = []
      let labels = configuration.actionLabels
      if configuration.capabilities.contains(.focusNavigation) {
        if snapshot?.elementID(after: id) != nil {
          actions.append(
            action(named: labels.nextElement) { [weak self] in
              self?.focusNext(from: id) == true
            })
        }
        if snapshot?.elementID(before: id) != nil {
          actions.append(
            action(named: labels.previousElement) { [weak self] in
              self?.focusPrevious(from: id) == true
            })
        }
        if snapshot?.nextRelatedElementID(after: id) != nil {
          actions.append(
            action(named: labels.nextRelatedElement) { [weak self] in
              self?.focusNextRelated(from: id) == true
            })
        }
      }
      if item.kind == .node, configuration.capabilities.contains(.movement) {
        actions.append(contentsOf: movementActions(for: id))
      }
      for descriptor in item.description.actions
      where configuration.capabilities.contains(descriptor.action.accessibilityCapability) {
        actions.append(
          action(named: descriptor.label) { [weak self] in
            self?.request(.perform(id, action: descriptor.action)) == true
          })
      }
      return actions
    }

    fileprivate var providesSelectionAction: Bool {
      configuration.capabilities.contains(.selection)
    }

    private func movementActions(for id: ID) -> [NSAccessibilityCustomAction] {
      let labels = configuration.actionLabels
      return [
        movementAction(named: labels.moveUp, id: id, direction: .up),
        movementAction(named: labels.moveDown, id: id, direction: .down),
        movementAction(named: labels.moveLeft, id: id, direction: .left),
        movementAction(named: labels.moveRight, id: id, direction: .right),
      ]
    }

    private func movementAction(
      named label: String,
      id: ID,
      direction: FlowingGraphCanvasNavigationDirection
    ) -> NSAccessibilityCustomAction {
      action(named: label) { [weak self] in
        self?.request(.move(id, direction: direction, largeStep: false)) == true
      }
    }

    private func action(
      named label: String,
      handler: @escaping () -> Bool
    ) -> NSAccessibilityCustomAction {
      NSAccessibilityCustomAction(name: label, handler: handler)
    }

    private func exposedElements() -> [FlowingGraphCanvasPlatformAccessibilityElement<ID>] {
      guard isEnabled else { return [] }
      rebuildExposedElements()
      guard let snapshot else { return [] }
      return snapshot.exposedItems(
        centeredAt: focusedElementID,
        maximumCount: configuration.maximumExposedElementCount
      ).compactMap { elementsByID[$0.id] }
    }

    @discardableResult
    private func rebuildExposedElements() -> Bool {
      let previousIDs = Set(elementsByID.keys)
      guard isEnabled, let snapshot else {
        elementsByID.removeAll(keepingCapacity: true)
        return !previousIDs.isEmpty
      }
      let exposedItems = snapshot.exposedItems(
        centeredAt: focusedElementID,
        maximumCount: configuration.maximumExposedElementCount
      )
      let exposedIDs = Set(exposedItems.map(\.id))
      elementsByID = elementsByID.filter { exposedIDs.contains($0.key) }
      for item in exposedItems where elementsByID[item.id] == nil {
        elementsByID[item.id] = FlowingGraphCanvasPlatformAccessibilityElement(
          id: item.id,
          bridge: self
        )
      }
      return previousIDs != exposedIDs
    }
  }

  @MainActor
  private final class FlowingGraphCanvasPlatformAccessibilityElement<
    ID: Hashable & Sendable
  >: NSAccessibilityElement {
    nonisolated let id: ID
    nonisolated(unsafe) weak var bridge: FlowingGraphCanvasAccessibilityBridge<ID>?

    init(id: ID, bridge: FlowingGraphCanvasAccessibilityBridge<ID>) {
      self.id = id
      self.bridge = bridge
      super.init()
    }

    override func accessibilityParent() -> Any? {
      let bridge = bridge
      return MainActor.assumeIsolated { bridge?.parent }
    }

    override func accessibilityRole() -> NSAccessibility.Role? {
      let bridge = bridge
      let id = id
      return MainActor.assumeIsolated {
        switch bridge?.item(for: id)?.kind {
        case .port: .button
        case .node, .edge, .none: .group
        }
      }
    }

    override func accessibilityLabel() -> String? {
      let bridge = bridge
      let id = id
      return MainActor.assumeIsolated { bridge?.item(for: id)?.description.label }
    }

    override func accessibilityValue() -> Any? {
      let bridge = bridge
      let id = id
      return MainActor.assumeIsolated { bridge?.item(for: id)?.description.value }
    }

    override func accessibilityHelp() -> String? {
      let bridge = bridge
      let id = id
      return MainActor.assumeIsolated { bridge?.item(for: id)?.description.hint }
    }

    override func accessibilityRoleDescription() -> String? {
      let bridge = bridge
      let id = id
      return MainActor.assumeIsolated { bridge?.item(for: id)?.description.roleDescription }
    }

    override func accessibilityIdentifier() -> String? {
      let bridge = bridge
      let id = id
      return MainActor.assumeIsolated { bridge?.item(for: id)?.description.identifier }
    }

    override func accessibilityFrame() -> NSRect {
      let bridge = bridge
      let id = id
      return MainActor.assumeIsolated { bridge?.screenFrame(for: id) ?? .zero }
    }

    override func isAccessibilitySelected() -> Bool {
      let bridge = bridge
      let id = id
      return MainActor.assumeIsolated { bridge?.isSelected(id) == true }
    }

    override func isAccessibilityFocused() -> Bool {
      let bridge = bridge
      let id = id
      return MainActor.assumeIsolated { bridge?.focusedElementID == id }
    }

    override func setAccessibilityFocused(_ focused: Bool) {
      let bridge = bridge
      let id = id
      MainActor.assumeIsolated {
        guard focused else { return }
        _ = bridge?.focus(id)
      }
    }

    override func accessibilityPerformPress() -> Bool {
      let bridge = bridge
      let id = id
      return MainActor.assumeIsolated {
        guard bridge?.providesSelectionAction == true else { return false }
        return bridge?.request(.select(id)) == true
      }
    }

    override func accessibilityCustomActions() -> [NSAccessibilityCustomAction]? {
      let bridge = bridge
      let id = id
      return MainActor.assumeIsolated {
        FlowingUncheckedSendable(value: bridge?.customActions(for: id))
      }.value
    }
  }

  private struct FlowingUncheckedSendable<Value>: @unchecked Sendable {
    let value: Value
  }

  struct FlowingGraphCanvasAccessibilityHost<ID: Hashable & Sendable>: NSViewRepresentable {
    let snapshot: FlowingGraphCanvasAccessibilitySnapshot<ID>
    let configuration: FlowingGraphCanvasAccessibilityConfiguration
    let selectedElementIDs: Set<ID>
    let focusedElementID: ID?
    let viewportTransform: FlowingCanvasTransform
    let onRequest: FlowingGraphCanvasAccessibilityBridge<ID>.RequestHandler

    func makeNSView(context: Context) -> HostView<ID> {
      HostView()
    }

    func updateNSView(_ view: HostView<ID>, context: Context) {
      view.bridge.update(
        snapshot: snapshot,
        configuration: configuration,
        selectedElementIDs: selectedElementIDs,
        focusedElementID: focusedElementID,
        parent: view,
        frameResolver: { [weak view] worldFrame in
          guard let view, let window = view.window else { return .zero }
          let viewportFrame = viewportTransform.applying(to: worldFrame)
          return window.convertToScreen(view.convert(viewportFrame, to: nil))
        },
        onRequest: onRequest
      )
    }

    @MainActor
    final class HostView<ElementID: Hashable & Sendable>: NSView {
      let bridge = FlowingGraphCanvasAccessibilityBridge<ElementID>()

      override var isFlipped: Bool { true }

      override func hitTest(_ point: NSPoint) -> NSView? {
        nil
      }

      override func isAccessibilityElement() -> Bool {
        bridge.isEnabled
      }

      override func accessibilityRole() -> NSAccessibility.Role? {
        .group
      }

      override func accessibilityLabel() -> String? {
        bridge.canvasDescription?.label
      }

      override func accessibilityValue() -> Any? {
        bridge.canvasDescription?.value
      }

      override func accessibilityHelp() -> String? {
        bridge.canvasDescription?.hint
      }

      override func accessibilityRoleDescription() -> String? {
        bridge.canvasDescription?.roleDescription
      }

      override func accessibilityIdentifier() -> String {
        bridge.canvasDescription?.identifier ?? ""
      }

      override func accessibilityChildren() -> [Any]? {
        bridge.accessibilityChildren()
      }

      override func accessibilityVisibleChildren() -> [Any]? {
        bridge.accessibilityChildren()
      }

      override func accessibilitySelectedChildren() -> [Any]? {
        bridge.accessibilitySelectedChildren()
      }
    }
  }
#endif

extension FlowingGraphCanvasContent {
  @MainActor
  public func accessibilitySnapshot(
    canvasDescription: FlowingGraphCanvasAccessibilityDescription = .init(
      label: "Graph Canvas"
    ),
    node: (FlowingGraphPresentationNode<Schema>) ->
      FlowingGraphCanvasAccessibilityRepresentation = { _ in
        .element(.init(label: "Graph Node", roleDescription: "node"))
      },
    port: (FlowingGraphPresentationPort<Schema>) ->
      FlowingGraphCanvasAccessibilityRepresentation = { _ in
        .element(.init(label: "Port", roleDescription: "port"))
      },
    edge: (FlowingGraphPresentationEdge<Schema>) ->
      FlowingGraphCanvasAccessibilityRepresentation = { _ in
        .element(.init(label: "Connection", roleDescription: "connection"))
      }
  ) throws -> FlowingGraphCanvasAccessibilitySnapshot<ElementID> {
    var relatedElementIDs: [ElementID: [ElementID]] = [:]
    for presentationEdge in presentation.edges {
      let endpointIDs = presentationEdge.endpoints.elementIDs
      relatedElementIDs[presentationEdge.id] = endpointIDs
      for endpointID in endpointIDs {
        relatedElementIDs[endpointID, default: []].append(presentationEdge.id)
      }
    }
    for presentationPort in presentation.ports {
      guard let nodeLocalID = nodeLocalID(for: presentationPort.localID),
        let nodeID = elementID(for: nodeLocalID)
      else { continue }
      relatedElementIDs[presentationPort.id, default: []].append(nodeID)
      relatedElementIDs[nodeID, default: []].append(presentationPort.id)
    }

    var items: [FlowingGraphCanvasAccessibilityItem<ElementID>] = []
    items.reserveCapacity(
      presentation.nodes.count + presentation.ports.count + presentation.edges.count
    )
    for presentationNode in presentation.nodes {
      guard case .element(let description) = node(presentationNode),
        let frame = frame(for: presentationNode.localID)
      else { continue }
      items.append(
        FlowingGraphCanvasAccessibilityItem(
          id: presentationNode.id,
          kind: .node,
          frame: frame,
          description: description,
          relatedElementIDs: relatedElementIDs[presentationNode.id] ?? []
        )
      )
    }
    for presentationPort in presentation.ports {
      guard case .element(let description) = port(presentationPort),
        let anchor = anchor(for: presentationPort.localID)
      else { continue }
      items.append(
        FlowingGraphCanvasAccessibilityItem(
          id: presentationPort.id,
          kind: .port,
          frame: CGRect(origin: anchor.position, size: .zero).minimumAccessibilitySize,
          description: description,
          relatedElementIDs: relatedElementIDs[presentationPort.id] ?? []
        )
      )
    }
    for presentationEdge in presentation.edges {
      guard case .element(let description) = edge(presentationEdge),
        let route = route(for: presentationEdge.localID)
      else { continue }
      items.append(
        FlowingGraphCanvasAccessibilityItem(
          id: presentationEdge.id,
          kind: .edge,
          frame: route.conservativeBounds.minimumAccessibilitySize,
          description: description,
          relatedElementIDs: relatedElementIDs[presentationEdge.id] ?? []
        )
      )
    }
    return try FlowingGraphCanvasAccessibilitySnapshot(
      canvasDescription: canvasDescription,
      items: items,
      relationships: relatedElementIDs
    )
  }
}

extension FlowingGraphPresentationEdgeEndpoints {
  fileprivate var elementIDs: [FlowingGraphCompositionElementID<Schema>] {
    switch self {
    case .directed(let source, let target):
      [source.elementID, target.elementID]
    case .undirected(let first, let second):
      [first.elementID, second.elementID]
    }
  }
}

extension FlowingGraphPresentationEndpoint {
  fileprivate var elementID: FlowingGraphCompositionElementID<Schema> {
    switch self {
    case .node(let id), .port(let id): id
    }
  }
}

extension FlowingGraphCanvasElementAction {
  fileprivate var accessibilityCapability: FlowingGraphCanvasAccessibilityCapabilities {
    switch self {
    case .beginConnection, .completeConnection, .cancelConnection:
      .connections
    case .collapse, .expand, .drillIn, .inspect:
      .elementActions
    }
  }
}

extension CGRect {
  fileprivate var isFinite: Bool {
    minX.isFinite && minY.isFinite && width.isFinite && height.isFinite
  }

  fileprivate var minimumAccessibilitySize: CGRect {
    let minimumDimension: CGFloat = 1
    return insetBy(
      dx: width < minimumDimension ? -(minimumDimension - width) / 2 : 0,
      dy: height < minimumDimension ? -(minimumDimension - height) / 2 : 0
    )
  }
}
