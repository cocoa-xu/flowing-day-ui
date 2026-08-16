import AppKit
import SwiftUI

/// An optional state marker rendered before a context-menu item's label.
public enum FlowingContextMenuIndicator: Sendable {
  case checkmark
  case mixed
}

/// A command or separator displayed by ``FlowingContextMenu``.
///
/// Items inherit the menu's environment accent by default. Supply `accent` when an individual
/// command needs its own foreground and highlighted background colors.
@MainActor
public struct FlowingContextMenuItem: Identifiable {
  public let id: UUID
  let content: Content

  public init(
    _ title: String,
    systemImage: String? = nil,
    indicator: FlowingContextMenuIndicator? = nil,
    accent: FlowingAccent? = nil,
    isEnabled: Bool = true,
    action: @escaping @MainActor () -> Void
  ) {
    id = UUID()
    content = .action(
      Action(
        title: title,
        systemImage: systemImage,
        indicator: indicator,
        accent: accent,
        isEnabled: isEnabled,
        action: action
      )
    )
  }

  private init(content: Content) {
    id = UUID()
    self.content = content
  }

  /// Creates a visual separator between adjacent groups of commands.
  public static func separator() -> Self {
    Self(content: .separator)
  }

  enum Content {
    case action(Action)
    case separator
  }

  struct Action {
    let title: String
    let systemImage: String?
    let indicator: FlowingContextMenuIndicator?
    let accent: FlowingAccent?
    let isEnabled: Bool
    let action: @MainActor () -> Void
  }
}

enum FlowingContextMenuMetrics {
  static let width: CGFloat = 196
  static let actionHeight: CGFloat = 32
  static let separatorHeight: CGFloat = 9
  static let outerInset: CGFloat = 6
  static let screenInset: CGFloat = 8
  static let rowCornerRadius: CGFloat = 7
  static let horizontalInset: CGFloat = 10
  static let leadingColumnWidth: CGFloat = 16
  static let itemSpacing: CGFloat = 7
}

struct FlowingContextMenuSelection {
  private(set) var selectedIndex: Int?

  init(items: [FlowingContextMenuItem]) {
    selectedIndex = Self.actionableIndices(in: items).first
  }

  mutating func moveForward(in items: [FlowingContextMenuItem]) {
    move(by: 1, in: items)
  }

  mutating func moveBackward(in items: [FlowingContextMenuItem]) {
    move(by: -1, in: items)
  }

  mutating func select(_ index: Int, in items: [FlowingContextMenuItem]) {
    guard Self.actionableIndices(in: items).contains(index) else { return }
    selectedIndex = index
  }

  func selectedAction(in items: [FlowingContextMenuItem]) -> FlowingContextMenuItem.Action? {
    guard let selectedIndex, items.indices.contains(selectedIndex),
      case .action(let action) = items[selectedIndex].content,
      action.isEnabled
    else { return nil }
    return action
  }

  private mutating func move(by offset: Int, in items: [FlowingContextMenuItem]) {
    let indices = Self.actionableIndices(in: items)
    guard !indices.isEmpty else {
      selectedIndex = nil
      return
    }
    guard let selectedIndex, let position = indices.firstIndex(of: selectedIndex) else {
      self.selectedIndex = offset > 0 ? indices.first : indices.last
      return
    }
    let nextPosition = (position + offset + indices.count) % indices.count
    self.selectedIndex = indices[nextPosition]
  }

  private static func actionableIndices(in items: [FlowingContextMenuItem]) -> [Int] {
    items.indices.filter { index in
      guard case .action(let action) = items[index].content else { return false }
      return action.isEnabled
    }
  }
}

enum FlowingContextMenuPlacement {
  static func origin(
    anchor: CGPoint,
    menuSize: CGSize,
    containerSize: CGSize
  ) -> CGPoint {
    let minimumX = FlowingContextMenuMetrics.screenInset
    let maximumX = max(minimumX, containerSize.width - menuSize.width - minimumX)
    let minimumY = FlowingContextMenuMetrics.screenInset
    let maximumY = max(minimumY, containerSize.height - menuSize.height - minimumY)
    return CGPoint(
      x: min(max(anchor.x, minimumX), maximumX),
      y: min(max(anchor.y, minimumY), maximumY)
    )
  }
}

/// A themed, keyboard-operable context menu positioned inside its containing view.
///
/// `anchor` uses the containing SwiftUI view's local coordinate space, with its origin at the
/// top-leading corner. The menu keeps itself within that container and dismisses after executing
/// a command or when the user clicks outside it.
public struct FlowingContextMenu: View {
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingSurfaces) private var surfaces
  @Environment(\.flowingTypography) private var typography
  @State private var selection: FlowingContextMenuSelection

  private let anchor: CGPoint
  private let items: [FlowingContextMenuItem]
  private let onDismiss: @MainActor () -> Void

  public init(
    anchor: CGPoint,
    items: [FlowingContextMenuItem],
    onDismiss: @escaping @MainActor () -> Void
  ) {
    self.anchor = anchor
    self.items = items
    self.onDismiss = onDismiss
    _selection = State(initialValue: FlowingContextMenuSelection(items: items))
  }

  public var body: some View {
    GeometryReader { proxy in
      ZStack(alignment: .topLeading) {
        Color.black.opacity(0.001)
          .contentShape(Rectangle())
          .onTapGesture(perform: onDismiss)

        menuSurface
          .offset(x: menuOrigin(in: proxy.size).x, y: menuOrigin(in: proxy.size).y)
      }
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel("Context menu")
  }

  private var menuSurface: some View {
    VStack(spacing: 0) {
      ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
        switch item.content {
        case .action(let action):
          actionRow(action, index: index)
        case .separator:
          Rectangle()
            .fill(FlowingPalette.hairline)
            .frame(height: 1)
            .padding(.horizontal, FlowingContextMenuMetrics.horizontalInset)
            .frame(height: FlowingContextMenuMetrics.separatorHeight)
            .accessibilityHidden(true)
        }
      }
    }
    .padding(FlowingContextMenuMetrics.outerInset)
    .frame(width: FlowingContextMenuMetrics.width)
    .background(surfaces.card)
    .clipShape(menuShape)
    .overlay {
      menuShape.strokeBorder(FlowingPalette.edge)
    }
    .shadow(color: .black.opacity(0.13), radius: 14, y: 7)
    .background {
      GeometryReader { proxy in
        FlowingContextMenuKeyCapture(
          moveForward: { selection.moveForward(in: items) },
          moveBackward: { selection.moveBackward(in: items) },
          performSelection: performSelection,
          dismiss: onDismiss
        )
        .frame(width: proxy.size.width, height: proxy.size.height)
        .allowsHitTesting(false)
      }
    }
  }

  private func actionRow(
    _ action: FlowingContextMenuItem.Action,
    index: Int
  ) -> some View {
    Button {
      perform(action)
    } label: {
      HStack(spacing: FlowingContextMenuMetrics.itemSpacing) {
        if reservesLeadingColumn {
          leadingIndicator(for: action)
            .frame(width: FlowingContextMenuMetrics.leadingColumnWidth)
        }
        Text(action.title)
          .font(typography.buttonLabel.font)
          .lineLimit(1)
        Spacer(minLength: 8)
      }
      .foregroundStyle(foreground(for: action))
      .padding(.horizontal, FlowingContextMenuMetrics.horizontalInset)
      .frame(height: FlowingContextMenuMetrics.actionHeight)
      .background(
        selection.selectedIndex == index && action.isEnabled
          ? effectiveAccent(for: action).veil
          : Color.clear,
        in: RoundedRectangle(
          cornerRadius: FlowingContextMenuMetrics.rowCornerRadius,
          style: .continuous
        )
      )
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .disabled(!action.isEnabled)
    .opacity(action.isEnabled ? 1 : 0.42)
    .onHover { isHovering in
      if isHovering {
        selection.select(index, in: items)
      }
    }
    .accessibilityValue(accessibilityValue(for: action))
  }

  @ViewBuilder
  private func leadingIndicator(for action: FlowingContextMenuItem.Action) -> some View {
    if let systemImage = action.systemImage {
      Image(systemName: systemImage)
        .font(.system(size: 11, weight: .semibold))
    } else if let indicator = action.indicator {
      Image(systemName: indicator == .checkmark ? "checkmark" : "minus")
        .font(.system(size: 10, weight: .bold))
    } else {
      Color.clear
    }
  }

  private var reservesLeadingColumn: Bool {
    items.contains { item in
      guard case .action(let action) = item.content else { return false }
      return action.systemImage != nil || action.indicator != nil
    }
  }

  private var menuShape: RoundedRectangle {
    RoundedRectangle(cornerRadius: 11, style: .continuous)
  }

  private func foreground(for action: FlowingContextMenuItem.Action) -> Color {
    effectiveAccent(for: action).foreground
  }

  private func effectiveAccent(for action: FlowingContextMenuItem.Action) -> FlowingAccent {
    action.accent ?? accent
  }

  private func accessibilityValue(for action: FlowingContextMenuItem.Action) -> String {
    switch action.indicator {
    case .checkmark:
      "Selected"
    case .mixed:
      "Mixed"
    case nil:
      ""
    }
  }

  private func performSelection() {
    guard let action = selection.selectedAction(in: items) else { return }
    perform(action)
  }

  private func perform(_ action: FlowingContextMenuItem.Action) {
    action.action()
    onDismiss()
  }

  private func menuOrigin(in containerSize: CGSize) -> CGPoint {
    FlowingContextMenuPlacement.origin(
      anchor: anchor,
      menuSize: CGSize(width: FlowingContextMenuMetrics.width, height: menuHeight),
      containerSize: containerSize
    )
  }

  private var menuHeight: CGFloat {
    let contentHeight = items.reduce(CGFloat.zero) { partialResult, item in
      switch item.content {
      case .action:
        partialResult + FlowingContextMenuMetrics.actionHeight
      case .separator:
        partialResult + FlowingContextMenuMetrics.separatorHeight
      }
    }
    return contentHeight + FlowingContextMenuMetrics.outerInset * 2
  }
}

private struct FlowingContextMenuKeyCapture: NSViewRepresentable {
  let moveForward: @MainActor () -> Void
  let moveBackward: @MainActor () -> Void
  let performSelection: @MainActor () -> Void
  let dismiss: @MainActor () -> Void

  func makeNSView(context: Context) -> FlowingContextMenuKeyCaptureView {
    let view = FlowingContextMenuKeyCaptureView()
    configure(view)
    return view
  }

  func updateNSView(_ nsView: FlowingContextMenuKeyCaptureView, context: Context) {
    configure(nsView)
    nsView.claimFocusIfNeeded()
  }

  static func dismantleNSView(_ nsView: FlowingContextMenuKeyCaptureView, coordinator: Void) {
    nsView.restorePreviousResponder()
  }

  private func configure(_ view: FlowingContextMenuKeyCaptureView) {
    view.moveForward = moveForward
    view.moveBackward = moveBackward
    view.performSelection = performSelection
    view.dismiss = dismiss
  }
}

enum FlowingContextMenuReplacementPolicy {
  static func shouldReplay(
    eventType: NSEvent.EventType,
    modifierFlags: NSEvent.ModifierFlags,
    eventWindowNumber: Int,
    hostWindowNumber: Int,
    isInsideMenu: Bool
  ) -> Bool {
    let isContextualClick =
      eventType == .rightMouseDown
      || (eventType == .leftMouseDown && modifierFlags.contains(.control))
    return isContextualClick
      && eventWindowNumber == hostWindowNumber
      && !isInsideMenu
  }
}

@MainActor
private final class FlowingContextMenuKeyCaptureView: NSView {
  var moveForward: (() -> Void)?
  var moveBackward: (() -> Void)?
  var performSelection: (() -> Void)?
  var dismiss: (() -> Void)?

  private weak var hostWindow: NSWindow?
  private weak var previousResponder: NSResponder?
  private var mouseMonitor: Any?

  override var acceptsFirstResponder: Bool { true }

  override func hitTest(_ point: NSPoint) -> NSView? {
    nil
  }

  override func viewDidMoveToWindow() {
    super.viewDidMoveToWindow()
    if window == nil {
      restorePreviousResponder()
    } else {
      claimFocusIfNeeded()
    }
  }

  func claimFocusIfNeeded() {
    guard let window else { return }
    hostWindow = window
    installMouseMonitorIfNeeded()
    guard window.firstResponder !== self else { return }
    previousResponder = window.firstResponder
    window.makeFirstResponder(self)
  }

  func restorePreviousResponder() {
    removeMouseMonitor()
    if let window = hostWindow, window.firstResponder === self {
      window.makeFirstResponder(previousResponder)
    }
    hostWindow = nil
    previousResponder = nil
  }

  private func installMouseMonitorIfNeeded() {
    guard mouseMonitor == nil else { return }
    mouseMonitor = NSEvent.addLocalMonitorForEvents(
      matching: [.leftMouseDown, .rightMouseDown]
    ) { [weak self] event in
      self?.handleContextualMouseDown(event) ?? event
    }
  }

  private func removeMouseMonitor() {
    guard let mouseMonitor else { return }
    NSEvent.removeMonitor(mouseMonitor)
    self.mouseMonitor = nil
  }

  private func handleContextualMouseDown(_ event: NSEvent) -> NSEvent? {
    guard let hostWindow else { return event }
    let point = convert(event.locationInWindow, from: nil)
    guard
      FlowingContextMenuReplacementPolicy.shouldReplay(
        eventType: event.type,
        modifierFlags: event.modifierFlags,
        eventWindowNumber: event.windowNumber,
        hostWindowNumber: hostWindow.windowNumber,
        isInsideMenu: bounds.contains(point)
      ),
      let replayedEvent = event.copy() as? NSEvent
    else {
      return event
    }

    removeMouseMonitor()
    dismiss?()
    DispatchQueue.main.async {
      NSApp.postEvent(replayedEvent, atStart: false)
    }
    return nil
  }

  override func keyDown(with event: NSEvent) {
    switch event.keyCode {
    case 36, 49, 76:
      performSelection?()
    case 48:
      event.modifierFlags.contains(.shift) ? moveBackward?() : moveForward?()
    case 53:
      dismiss?()
    case 125:
      moveForward?()
    case 126:
      moveBackward?()
    default:
      super.keyDown(with: event)
    }
  }
}
