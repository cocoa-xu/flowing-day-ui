import AppKit
import SwiftUI

struct FlowingSelectRepresentable<Value: Hashable>: NSViewRepresentable {
  @Binding var selection: Value
  let options: [FlowingSelectOption<Value>]
  let minimumWidth: CGFloat
  let accent: FlowingAccent
  let strings: FlowingStrings
  let controlRadius: CGFloat
  let textStyle: FlowingTextStyle
  let optionTextStyle: FlowingTextStyle
  let menuBackgroundColor: Color

  func makeCoordinator() -> Coordinator {
    Coordinator(self)
  }

  func makeNSView(context: Context) -> FlowingSelectButton {
    let button = FlowingSelectButton()
    update(button, coordinator: context.coordinator)
    return button
  }

  func updateNSView(_ button: FlowingSelectButton, context: Context) {
    context.coordinator.parent = self
    update(button, coordinator: context.coordinator)
  }

  static func dismantleNSView(_ button: FlowingSelectButton, coordinator: Coordinator) {
    button.prepareForRemoval()
  }

  private func update(_ button: FlowingSelectButton, coordinator: Coordinator) {
    button.configure(
      labels: options.map(\.label),
      optionAccents: options.map(\.accent),
      selectedIndex: options.firstIndex { $0.value == selection },
      minimumWidth: minimumWidth,
      accent: accent,
      strings: strings,
      controlRadius: controlRadius,
      textStyle: textStyle,
      optionTextStyle: optionTextStyle,
      menuBackgroundColor: menuBackgroundColor
    )
    button.onSelect = { coordinator.select(index: $0) }
  }

  final class Coordinator {
    var parent: FlowingSelectRepresentable

    init(_ parent: FlowingSelectRepresentable) {
      self.parent = parent
    }

    @MainActor
    func select(index: Int) {
      guard parent.options.indices.contains(index) else { return }
      parent.selection = parent.options[index].value
    }
  }
}

@MainActor
final class FlowingSelectButton: NSButton {
  private static let controlHeight: CGFloat = 30

  var onSelect: ((Int) -> Void)?
  var onToggle: ((Int) -> Set<Int>)?
  private var labels: [String] = []
  private var optionAccents: [FlowingAccent?] = []
  private var optionEnabledStates: [Bool] = []
  private var selectedIndex: Int?
  private var selectedIndices: Set<Int> = []
  private var displayTitle: String?
  private var allowsMultipleSelection = false
  private var minimumWidth: CGFloat = 0
  private var accent = FlowingAccent.celadon
  private var strings = FlowingStrings()
  private var controlRadius: CGFloat = 9
  private var textFont = FlowingTypography.standard.value.appKitFont
  private var optionFont = FlowingTypography.standard.selectionLabel.appKitFont
  private var menuBackgroundColor = NSColor(FlowingPalette.control)
  private var menuPanel: FlowingSelectPanel?
  private var localMonitor: Any?
  private var globalMonitor: Any?
  private var observers: [NSObjectProtocol] = []
  private var hoverArea: NSTrackingArea?
  private var isHovered = false
  private var highlightedIndex: Int?

  var presentedPanel: NSPanel? { menuPanel }
  var valueTextColor: NSColor { NSColor(accent.foreground) }

  override init(frame frameRect: NSRect) {
    super.init(frame: frameRect)
    isBordered = false
    focusRingType = .none
    title = ""
    target = self
    action = #selector(toggleMenu)
    setAccessibilityRole(.popUpButton)
  }

  convenience init() {
    self.init(frame: .zero)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError()
  }

  override var acceptsFirstResponder: Bool { true }

  override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
    true
  }

  override var intrinsicContentSize: NSSize {
    let sizingLabels = displayTitle.map { [$0] } ?? labels
    let textWidth =
      sizingLabels.map {
        ($0 as NSString).size(withAttributes: [.font: textFont]).width
      }.max() ?? 0
    return NSSize(
      width: max(minimumWidth, ceil(textWidth) + 40),
      height: Self.controlHeight
    )
  }

  func configure(
    labels: [String],
    optionAccents: [FlowingAccent?] = [],
    selectedIndex: Int?,
    selectedIndices: Set<Int>? = nil,
    optionEnabledStates: [Bool] = [],
    displayTitle: String? = nil,
    allowsMultipleSelection: Bool = false,
    minimumWidth: CGFloat,
    accent: FlowingAccent,
    strings: FlowingStrings,
    controlRadius: CGFloat,
    textStyle: FlowingTextStyle,
    optionTextStyle: FlowingTextStyle,
    menuBackgroundColor: Color
  ) {
    let structureChanged =
      self.labels != labels
      || self.optionAccents != optionAccents
      || self.optionEnabledStates != optionEnabledStates
      || self.allowsMultipleSelection != allowsMultipleSelection
      || self.accent != accent
    self.labels = labels
    self.optionAccents = optionAccents
    self.optionEnabledStates = optionEnabledStates
    self.selectedIndex = selectedIndex
    self.selectedIndices = selectedIndices ?? selectedIndex.map { [$0] } ?? []
    self.displayTitle = displayTitle
    self.allowsMultipleSelection = allowsMultipleSelection
    self.minimumWidth = minimumWidth
    self.accent = accent
    self.strings = strings
    self.controlRadius = controlRadius
    textFont = textStyle.appKitFont
    optionFont = optionTextStyle.appKitFont
    self.menuBackgroundColor = NSColor(menuBackgroundColor)
    if structureChanged, menuPanel != nil {
      dismiss()
    }
    if let menu = menuPanel?.contentView as? FlowingSelectMenuView {
      menu.selectedIndices = self.selectedIndices
    }
    setAccessibilityValue(
      displayTitle ?? selectedIndex.flatMap { labels[safe: $0] } ?? ""
    )
    invalidateIntrinsicContentSize()
    needsDisplay = true
  }

  override func updateTrackingAreas() {
    super.updateTrackingAreas()
    if let hoverArea {
      removeTrackingArea(hoverArea)
    }
    let area = NSTrackingArea(
      rect: .zero,
      options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
      owner: self,
      userInfo: nil
    )
    addTrackingArea(area)
    hoverArea = area
  }

  override func mouseEntered(with event: NSEvent) {
    isHovered = true
    needsDisplay = true
  }

  override func mouseExited(with event: NSEvent) {
    isHovered = false
    needsDisplay = true
  }

  override func viewDidMoveToWindow() {
    super.viewDidMoveToWindow()
    if window == nil {
      dismiss(restoreKeyWindow: false)
    }
  }

  func prepareForRemoval() {
    dismiss(restoreKeyWindow: false)
    onSelect = nil
    onToggle = nil
  }

  override func viewDidChangeEffectiveAppearance() {
    super.viewDidChangeEffectiveAppearance()
    needsDisplay = true
    menuPanel?.appearance = effectiveAppearance
    menuPanel?.contentView?.needsDisplay = true
  }

  override func keyDown(with event: NSEvent) {
    switch event.keyCode {
    case 36, 49, 125:
      presentMenu()
    default:
      super.keyDown(with: event)
    }
  }

  override func draw(_ dirtyRect: NSRect) {
    let shape = NSBezierPath(
      roundedRect: bounds.insetBy(dx: 0.5, dy: 0.5),
      xRadius: controlRadius,
      yRadius: controlRadius
    )
    (isHovered || menuPanel != nil ? NSColor(accent.wash) : NSColor(accent.veil)).setFill()
    shape.fill()
    (menuPanel != nil
      ? NSColor(accent.foreground).withAlphaComponent(0.22)
      : NSColor(FlowingPalette.hairline)).setStroke()
    shape.lineWidth = 1
    shape.stroke()

    let chevronName = menuPanel == nil ? "chevron.down" : "chevron.up"
    let configuration = NSImage.SymbolConfiguration(pointSize: 9, weight: .semibold)
      .applying(.init(paletteColors: [NSColor(FlowingPalette.faint)]))
    let chevron = NSImage(
      systemSymbolName: chevronName,
      accessibilityDescription: nil
    )?.withSymbolConfiguration(configuration)
    chevron?.draw(
      in: NSRect(x: bounds.maxX - 21, y: bounds.midY - 4.5, width: 9, height: 9),
      from: .zero,
      operation: .sourceOver,
      fraction: 1,
      respectFlipped: true,
      hints: nil
    )

    let value = displayTitle ?? selectedIndex.flatMap { labels[safe: $0] } ?? "—"
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .right
    paragraph.lineBreakMode = .byTruncatingTail
    value.draw(
      in: NSRect(x: 10, y: bounds.midY - 8, width: bounds.width - 39, height: 17),
      withAttributes: [
        .font: textFont,
        .foregroundColor: valueTextColor,
        .paragraphStyle: paragraph,
      ]
    )
  }

  @objc private func toggleMenu() {
    menuPanel == nil ? presentMenu() : dismiss()
  }

  private func presentMenu() {
    guard menuPanel == nil, !labels.isEmpty, let window else { return }
    let anchorFrame = window.convertToScreen(convert(bounds, to: nil))
    let screen =
      NSScreen.screens.first { $0.frame.intersects(anchorFrame) }
      ?? window.screen
      ?? NSScreen.main
    let visibleFrame = screen?.visibleFrame ?? anchorFrame.insetBy(dx: -400, dy: -400)
    let menuWidth = min(
      max(
        bounds.width,
        FlowingSelectMenuView.preferredWidth(
          for: labels,
          font: optionFont,
          showsSwatches: optionAccents.contains { $0 != nil }
        )
      ),
      visibleFrame.width - 16
    )
    let menuSize = FlowingSelectMenuView.menuSize(
      width: menuWidth,
      itemCount: labels.count
    )
    let panel = FlowingSelectPanel(
      contentRect: NSRect(origin: .zero, size: menuSize),
      styleMask: [.borderless, .nonactivatingPanel],
      backing: .buffered,
      defer: false
    )
    panel.isOpaque = false
    panel.backgroundColor = .clear
    panel.hasShadow = true
    panel.level = .popUpMenu
    panel.hidesOnDeactivate = false
    panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient]
    panel.appearance = effectiveAppearance
    panel.contentView = FlowingSelectMenuView(
      frame: NSRect(origin: .zero, size: menuSize),
      labels: labels,
      optionAccents: optionAccents,
      optionEnabledStates: optionEnabledStates,
      selectedIndices: selectedIndices,
      allowsMultipleSelection: allowsMultipleSelection,
      accent: accent,
      strings: strings,
      font: optionFont,
      backgroundColor: menuBackgroundColor,
      controlRadius: controlRadius
    ) { [weak self] index in
      self?.select(index: index)
    }
    position(panel, anchorFrame: anchorFrame, visibleFrame: visibleFrame)
    menuPanel = panel
    highlightedIndex = selectedIndex ?? 0
    updateKeyboardHighlight()
    installEventMonitors(parentWindow: window)
    window.addChildWindow(panel, ordered: .above)
    panel.orderFrontRegardless()
    panel.makeKey()
    needsDisplay = true
  }

  private func position(
    _ panel: NSPanel,
    anchorFrame: NSRect,
    visibleFrame: NSRect
  ) {
    let margin: CGFloat = 8
    let gap: CGFloat = 6
    let size = panel.frame.size
    let x = min(
      max(anchorFrame.maxX - size.width, visibleFrame.minX + margin),
      visibleFrame.maxX - size.width - margin
    )
    let below = anchorFrame.minY - size.height - gap
    let above = anchorFrame.maxY + gap
    let y =
      below >= visibleFrame.minY + margin
      ? below
      : min(above, visibleFrame.maxY - size.height - margin)
    panel.setFrameOrigin(NSPoint(x: x, y: max(y, visibleFrame.minY + margin)))
  }

  private func select(index: Int) {
    guard labels.indices.contains(index), optionEnabledStates[safe: index] ?? true else {
      return
    }
    if allowsMultipleSelection {
      selectedIndices = onToggle?(index) ?? selectedIndices
      (menuPanel?.contentView as? FlowingSelectMenuView)?.selectedIndices = selectedIndices
      return
    }
    dismiss()
    onSelect?(index)
  }

  private func moveHighlight(by offset: Int) {
    guard !labels.isEmpty else { return }
    let current = highlightedIndex ?? selectedIndex ?? 0
    highlightedIndex = (current + offset + labels.count) % labels.count
    updateKeyboardHighlight()
  }

  private func updateKeyboardHighlight() {
    (menuPanel?.contentView as? FlowingSelectMenuView)?
      .keyboardHighlightedIndex = highlightedIndex
  }

  private func dismiss(restoreKeyWindow: Bool = true) {
    guard let panel = menuPanel else { return }
    let parentWindow = panel.parent ?? window
    panel.orderOut(nil)
    parentWindow?.removeChildWindow(panel)
    menuPanel = nil
    highlightedIndex = nil
    removeEventMonitors()
    observers.forEach(NotificationCenter.default.removeObserver)
    observers.removeAll()
    if restoreKeyWindow, NSApp.isActive {
      parentWindow?.makeKey()
    }
    needsDisplay = true
  }

  private func installEventMonitors(parentWindow: NSWindow) {
    localMonitor = NSEvent.addLocalMonitorForEvents(
      matching: [.leftMouseDown, .rightMouseDown, .otherMouseDown, .keyDown, .scrollWheel]
    ) { [weak self] event in
      guard let self, let panel = self.menuPanel else { return event }
      if event.type == .keyDown {
        if FlowingSelectPanelShortcut.isClose(event) {
          self.dismiss()
          _ = parentWindow.performKeyEquivalent(with: event)
          return nil
        }
        switch event.keyCode {
        case 53:
          self.dismiss()
          return nil
        case 125:
          self.moveHighlight(by: 1)
          return nil
        case 126:
          self.moveHighlight(by: -1)
          return nil
        case 36, 49, 76:
          if let index = self.highlightedIndex {
            self.select(index: index)
          }
          return nil
        default:
          return event
        }
      }
      if event.type == .scrollWheel {
        self.dismiss(restoreKeyWindow: event.windowNumber == parentWindow.windowNumber)
        return event
      }
      if event.windowNumber == panel.windowNumber {
        return event
      }
      if event.windowNumber == parentWindow.windowNumber,
        self.bounds.contains(self.convert(event.locationInWindow, from: nil))
      {
        return event
      }
      self.dismiss(restoreKeyWindow: event.windowNumber == parentWindow.windowNumber)
      return event
    }
    globalMonitor = NSEvent.addGlobalMonitorForEvents(
      matching: [.leftMouseDown, .rightMouseDown, .otherMouseDown]
    ) { [weak self] _ in
      Task { @MainActor in
        self?.dismiss(restoreKeyWindow: false)
      }
    }

    let center = NotificationCenter.default
    observers = [
      center.addObserver(
        forName: NSWindow.didMoveNotification,
        object: parentWindow,
        queue: .main
      ) { [weak self] _ in
        Task { @MainActor in self?.dismiss() }
      },
      center.addObserver(
        forName: NSWindow.didResizeNotification,
        object: parentWindow,
        queue: .main
      ) { [weak self] _ in
        Task { @MainActor in self?.dismiss() }
      },
      center.addObserver(
        forName: NSWindow.willCloseNotification,
        object: parentWindow,
        queue: .main
      ) { [weak self] _ in
        Task { @MainActor in self?.dismiss(restoreKeyWindow: false) }
      },
      center.addObserver(
        forName: NSApplication.didResignActiveNotification,
        object: NSApp,
        queue: .main
      ) { [weak self] _ in
        Task { @MainActor in self?.dismiss(restoreKeyWindow: false) }
      },
    ]
  }

  private func removeEventMonitors() {
    if let localMonitor {
      NSEvent.removeMonitor(localMonitor)
    }
    if let globalMonitor {
      NSEvent.removeMonitor(globalMonitor)
    }
    localMonitor = nil
    globalMonitor = nil
  }
}

private enum FlowingSelectPanelShortcut {
  static func isClose(_ event: NSEvent) -> Bool {
    let modifiers = event.modifierFlags.intersection([.command, .control, .option, .shift])
    return modifiers == .command
      && event.charactersIgnoringModifiers?.lowercased() == "w"
  }
}

private final class FlowingSelectPanel: NSPanel {
  override var canBecomeKey: Bool { true }
  override var canBecomeMain: Bool { false }
}

@MainActor
private final class FlowingSelectMenuView: NSView {
  static let rowHeight: CGFloat = 36
  static let verticalInset: CGFloat = 8

  var selectedIndices: Set<Int> {
    didSet { updateButtons() }
  }

  var keyboardHighlightedIndex: Int? {
    didSet { updateButtons() }
  }

  private let accent: FlowingAccent
  private let backgroundColor: NSColor
  private let controlRadius: CGFloat
  private var buttons: [FlowingSelectOptionButton] = []

  init(
    frame: NSRect,
    labels: [String],
    optionAccents: [FlowingAccent?],
    optionEnabledStates: [Bool],
    selectedIndices: Set<Int>,
    allowsMultipleSelection: Bool,
    accent: FlowingAccent,
    strings: FlowingStrings,
    font: NSFont,
    backgroundColor: NSColor,
    controlRadius: CGFloat,
    onSelect: @escaping (Int) -> Void
  ) {
    self.selectedIndices = selectedIndices
    self.accent = accent
    self.backgroundColor = backgroundColor
    self.controlRadius = controlRadius
    super.init(frame: frame)

    for (index, label) in labels.enumerated() {
      let y = bounds.height - Self.verticalInset - CGFloat(index + 1) * Self.rowHeight
      let itemAccent = optionAccents.indices.contains(index) ? optionAccents[index] : nil
      let button = FlowingSelectOptionButton(
        frame: NSRect(x: 8, y: y + 2, width: bounds.width - 16, height: 32),
        title: label,
        accent: itemAccent ?? accent,
        showsSwatch: itemAccent != nil,
        strings: strings,
        font: font,
        controlRadius: controlRadius,
        allowsMultipleSelection: allowsMultipleSelection
      ) {
        onSelect(index)
      }
      button.isEnabled = optionEnabledStates[safe: index] ?? true
      addSubview(button)
      buttons.append(button)
    }
    updateButtons()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError()
  }

  static func menuSize(width: CGFloat, itemCount: Int) -> NSSize {
    NSSize(
      width: width,
      height: CGFloat(itemCount) * rowHeight + verticalInset * 2
    )
  }

  static func preferredWidth(
    for labels: [String],
    font: NSFont,
    showsSwatches: Bool = false
  ) -> CGFloat {
    let textWidth =
      labels.map {
        ($0 as NSString).size(withAttributes: [.font: font]).width
      }.max() ?? 0
    return ceil(textWidth) + (showsSwatches ? 85 : 68)
  }

  override func draw(_ dirtyRect: NSRect) {
    let card = NSBezierPath(
      roundedRect: bounds.insetBy(dx: 1, dy: 1),
      xRadius: 13,
      yRadius: 13
    )
    backgroundColor.setFill()
    card.fill()
    NSColor(accent.fill).withAlphaComponent(0.045).setFill()
    card.fill()
    NSColor(accent.foreground).withAlphaComponent(0.22).setStroke()
    card.lineWidth = 1
    card.stroke()
  }

  private func updateButtons() {
    for (index, button) in buttons.enumerated() {
      button.isSelected = selectedIndices.contains(index)
      button.isKeyboardHighlighted = index == keyboardHighlightedIndex
    }
  }
}

private final class FlowingSelectOptionButton: NSButton {
  private let optionTitle: String
  private let accent: FlowingAccent
  private let strings: FlowingStrings
  private let optionFont: NSFont
  private let controlRadius: CGFloat
  private let showsSwatch: Bool
  private let perform: () -> Void
  private var hoverArea: NSTrackingArea?
  private var isHovered = false

  var isSelected = false {
    didSet {
      setAccessibilityValue(isSelected ? strings.selected : strings.notSelected)
      needsDisplay = true
    }
  }

  var isKeyboardHighlighted = false {
    didSet { needsDisplay = true }
  }

  init(
    frame: NSRect,
    title: String,
    accent: FlowingAccent,
    showsSwatch: Bool,
    strings: FlowingStrings,
    font: NSFont,
    controlRadius: CGFloat,
    allowsMultipleSelection: Bool,
    perform: @escaping () -> Void
  ) {
    optionTitle = title
    self.accent = accent
    self.strings = strings
    optionFont = font
    self.controlRadius = controlRadius
    self.showsSwatch = showsSwatch
    self.perform = perform
    super.init(frame: frame)
    isBordered = false
    focusRingType = .none
    self.title = ""
    target = self
    action = #selector(invoke)
    setAccessibilityLabel(title)
    if allowsMultipleSelection {
      setAccessibilityRole(.checkBox)
    }
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError()
  }

  override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
    true
  }

  override func updateTrackingAreas() {
    super.updateTrackingAreas()
    if let hoverArea {
      removeTrackingArea(hoverArea)
    }
    let area = NSTrackingArea(
      rect: .zero,
      options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
      owner: self,
      userInfo: nil
    )
    addTrackingArea(area)
    hoverArea = area
  }

  override func mouseEntered(with event: NSEvent) {
    isHovered = true
    needsDisplay = true
  }

  override func mouseExited(with event: NSEvent) {
    isHovered = false
    needsDisplay = true
  }

  override func draw(_ dirtyRect: NSRect) {
    let shape = NSBezierPath(
      roundedRect: bounds,
      xRadius: controlRadius,
      yRadius: controlRadius
    )
    let isHighlighted = isHovered || isKeyboardHighlighted
    if isSelected || isHighlighted {
      (isSelected ? NSColor(accent.wash) : NSColor(accent.veil)).setFill()
      shape.fill()
    }
    if isSelected {
      NSColor(accent.veil).setFill()
      NSBezierPath(ovalIn: NSRect(x: 8, y: 5, width: 22, height: 22)).fill()
      let configuration = NSImage.SymbolConfiguration(pointSize: 10, weight: .bold)
        .applying(.init(paletteColors: [NSColor(accent.foreground)]))
      let symbol = NSImage(
        systemSymbolName: "checkmark",
        accessibilityDescription: nil
      )?.withSymbolConfiguration(configuration)
      symbol?.draw(
        in: NSRect(x: 14, y: 11, width: 10, height: 10),
        from: .zero,
        operation: .sourceOver,
        fraction: 1,
        respectFlipped: true,
        hints: nil
      )
    }
    if showsSwatch {
      let swatchRect = NSRect(x: 37, y: bounds.midY - 6, width: 12, height: 12)
      let swatch = NSBezierPath(ovalIn: swatchRect)
      NSColor(accent.fill).setFill()
      swatch.fill()
      NSColor(accent.foreground).withAlphaComponent(0.2).setStroke()
      swatch.lineWidth = 1
      swatch.stroke()
    }
    optionTitle.draw(
      in: NSRect(
        x: showsSwatch ? 57 : 40,
        y: bounds.midY - 8,
        width: bounds.width - (showsSwatch ? 67 : 50),
        height: 17
      ),
      withAttributes: [
        .font: optionFont,
        .foregroundColor: isEnabled
          ? (isSelected || isHighlighted
            ? NSColor(accent.foreground)
            : NSColor(FlowingPalette.ink))
          : NSColor(FlowingPalette.faint),
      ]
    )
  }

  @objc private func invoke() {
    perform()
  }
}

extension Array {
  fileprivate subscript(safe index: Int) -> Element? {
    indices.contains(index) ? self[index] : nil
  }
}
