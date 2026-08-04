import AppKit
import SwiftUI

struct SettingsPopupControl<Value: Hashable>: NSViewRepresentable {
  @Binding var selection: Value
  let options: [SettingsPopupOption<Value>]
  let minimumWidth: CGFloat
  let accent: SettingsAccent
  let strings: SettingsStrings
  let controlRadius: CGFloat
  let textStyle: SettingsTextStyle
  let optionTextStyle: SettingsTextStyle
  let menuBackgroundColor: Color

  func makeCoordinator() -> Coordinator {
    Coordinator(self)
  }

  func makeNSView(context: Context) -> SettingsPopupButton {
    let button = SettingsPopupButton()
    update(button, coordinator: context.coordinator)
    return button
  }

  func updateNSView(_ button: SettingsPopupButton, context: Context) {
    context.coordinator.parent = self
    update(button, coordinator: context.coordinator)
  }

  private func update(_ button: SettingsPopupButton, coordinator: Coordinator) {
    button.configure(
      labels: options.map(\.label),
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
    var parent: SettingsPopupControl

    init(_ parent: SettingsPopupControl) {
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
final class SettingsPopupButton: NSButton {
  private static let controlHeight: CGFloat = 30

  var onSelect: ((Int) -> Void)?
  private var labels: [String] = []
  private var selectedIndex: Int?
  private var minimumWidth: CGFloat = 0
  private var accent = SettingsAccent.celadon
  private var strings = SettingsStrings()
  private var controlRadius: CGFloat = 9
  private var textFont = SettingsTypography.standard.value.appKitFont
  private var optionFont = SettingsTypography.standard.selectionLabel.appKitFont
  private var menuBackgroundColor = NSColor(SettingsPalette.control)
  private var menuPanel: SettingsPopupPanel?
  private var localMonitor: Any?
  private var globalMonitor: Any?
  private var observers: [NSObjectProtocol] = []
  private var hoverArea: NSTrackingArea?
  private var isHovered = false
  private var highlightedIndex: Int?

  var presentedPanel: NSPanel? { menuPanel }

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
    let textWidth =
      labels.map {
        ($0 as NSString).size(withAttributes: [.font: textFont]).width
      }.max() ?? 0
    return NSSize(
      width: max(minimumWidth, ceil(textWidth) + 40),
      height: Self.controlHeight
    )
  }

  func configure(
    labels: [String],
    selectedIndex: Int?,
    minimumWidth: CGFloat,
    accent: SettingsAccent,
    strings: SettingsStrings,
    controlRadius: CGFloat,
    textStyle: SettingsTextStyle,
    optionTextStyle: SettingsTextStyle,
    menuBackgroundColor: Color
  ) {
    let structureChanged = self.labels != labels || self.accent != accent
    self.labels = labels
    self.selectedIndex = selectedIndex
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
    if let menu = menuPanel?.contentView as? SettingsPopupMenuView {
      menu.selectedIndex = selectedIndex
    }
    setAccessibilityValue(selectedIndex.flatMap { labels[safe: $0] } ?? "")
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
      : NSColor(SettingsPalette.hairline)).setStroke()
    shape.lineWidth = 1
    shape.stroke()

    let chevronName = menuPanel == nil ? "chevron.down" : "chevron.up"
    let configuration = NSImage.SymbolConfiguration(pointSize: 9, weight: .semibold)
      .applying(.init(paletteColors: [NSColor(SettingsPalette.faint)]))
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

    let value = selectedIndex.flatMap { labels[safe: $0] } ?? "—"
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .right
    paragraph.lineBreakMode = .byTruncatingTail
    value.draw(
      in: NSRect(x: 10, y: bounds.midY - 8, width: bounds.width - 39, height: 17),
      withAttributes: [
        .font: textFont,
        .foregroundColor: NSColor(SettingsPalette.ink),
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
      max(bounds.width, SettingsPopupMenuView.preferredWidth(for: labels, font: optionFont)),
      visibleFrame.width - 16
    )
    let menuSize = SettingsPopupMenuView.menuSize(
      width: menuWidth,
      itemCount: labels.count
    )
    let panel = SettingsPopupPanel(
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
    panel.contentView = SettingsPopupMenuView(
      frame: NSRect(origin: .zero, size: menuSize),
      labels: labels,
      selectedIndex: selectedIndex,
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
    guard labels.indices.contains(index) else { return }
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
    (menuPanel?.contentView as? SettingsPopupMenuView)?
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
        if SettingsPanelShortcut.isClose(event) {
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

private enum SettingsPanelShortcut {
  static func isClose(_ event: NSEvent) -> Bool {
    let modifiers = event.modifierFlags.intersection([.command, .control, .option, .shift])
    return modifiers == .command
      && event.charactersIgnoringModifiers?.lowercased() == "w"
  }
}

private final class SettingsPopupPanel: NSPanel {
  override var canBecomeKey: Bool { true }
  override var canBecomeMain: Bool { false }
}

@MainActor
private final class SettingsPopupMenuView: NSView {
  static let rowHeight: CGFloat = 36
  static let verticalInset: CGFloat = 8

  var selectedIndex: Int? {
    didSet { updateButtons() }
  }

  var keyboardHighlightedIndex: Int? {
    didSet { updateButtons() }
  }

  private let accent: SettingsAccent
  private let backgroundColor: NSColor
  private let controlRadius: CGFloat
  private var buttons: [SettingsPopupOptionButton] = []

  init(
    frame: NSRect,
    labels: [String],
    selectedIndex: Int?,
    accent: SettingsAccent,
    strings: SettingsStrings,
    font: NSFont,
    backgroundColor: NSColor,
    controlRadius: CGFloat,
    onSelect: @escaping (Int) -> Void
  ) {
    self.selectedIndex = selectedIndex
    self.accent = accent
    self.backgroundColor = backgroundColor
    self.controlRadius = controlRadius
    super.init(frame: frame)

    for (index, label) in labels.enumerated() {
      let y = bounds.height - Self.verticalInset - CGFloat(index + 1) * Self.rowHeight
      let button = SettingsPopupOptionButton(
        frame: NSRect(x: 8, y: y + 2, width: bounds.width - 16, height: 32),
        title: label,
        accent: accent,
        strings: strings,
        font: font,
        controlRadius: controlRadius
      ) {
        onSelect(index)
      }
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

  static func preferredWidth(for labels: [String], font: NSFont) -> CGFloat {
    let textWidth =
      labels.map {
        ($0 as NSString).size(withAttributes: [.font: font]).width
      }.max() ?? 0
    return ceil(textWidth) + 68
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
      button.isSelected = index == selectedIndex
      button.isKeyboardHighlighted = index == keyboardHighlightedIndex
    }
  }
}

private final class SettingsPopupOptionButton: NSButton {
  private let optionTitle: String
  private let accent: SettingsAccent
  private let strings: SettingsStrings
  private let optionFont: NSFont
  private let controlRadius: CGFloat
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
    accent: SettingsAccent,
    strings: SettingsStrings,
    font: NSFont,
    controlRadius: CGFloat,
    perform: @escaping () -> Void
  ) {
    optionTitle = title
    self.accent = accent
    self.strings = strings
    optionFont = font
    self.controlRadius = controlRadius
    self.perform = perform
    super.init(frame: frame)
    isBordered = false
    focusRingType = .none
    self.title = ""
    target = self
    action = #selector(invoke)
    setAccessibilityLabel(title)
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
    optionTitle.draw(
      in: NSRect(x: 40, y: bounds.midY - 8, width: bounds.width - 50, height: 17),
      withAttributes: [
        .font: optionFont,
        .foregroundColor: isSelected
          ? NSColor(accent.foreground)
          : NSColor(SettingsPalette.ink),
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
