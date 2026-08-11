import AppKit
import SwiftUI

public struct PreferencesWindowActions: Sendable {
  private let dismissAction: @MainActor @Sendable () -> Void

  public init(dismiss: @escaping @MainActor @Sendable () -> Void = {}) {
    dismissAction = dismiss
  }

  @MainActor
  public func dismiss() {
    dismissAction()
  }
}

private struct PreferencesWindowActionsKey: EnvironmentKey {
  static let defaultValue = PreferencesWindowActions()
}

extension EnvironmentValues {
  public var preferencesWindowActions: PreferencesWindowActions {
    get { self[PreferencesWindowActionsKey.self] }
    set { self[PreferencesWindowActionsKey.self] = newValue }
  }
}

public struct PreferencesWindowConfiguration: Equatable {
  public static let defaultSize = CGSize(width: 900, height: 640)
  public static let defaultMaximumSize = CGSize(width: 1160, height: 860)

  public var title: String
  public var size: CGSize
  public var minimumSize: CGSize
  public var maximumSize: CGSize
  public var activatesApplication: Bool

  public init(
    title: String = "Preferences",
    size: CGSize = PreferencesWindowConfiguration.defaultSize,
    minimumSize: CGSize = PreferencesWindowConfiguration.defaultSize,
    maximumSize: CGSize = PreferencesWindowConfiguration.defaultMaximumSize,
    activatesApplication: Bool = true
  ) {
    self.title = title
    self.size = size
    self.minimumSize = minimumSize
    self.maximumSize = maximumSize
    self.activatesApplication = activatesApplication
  }
}

@MainActor
public final class PreferencesWindowPresenter<Content: View> {
  public let window: NSPanel

  private let configuration: PreferencesWindowConfiguration
  private let onShow: () -> Void

  public init(
    configuration: PreferencesWindowConfiguration = PreferencesWindowConfiguration(),
    rootView: Content,
    onShow: @escaping () -> Void = {}
  ) {
    self.configuration = configuration
    self.onShow = onShow
    let bounds = PreferencesWindowBounds(configuration: configuration)

    let panel = PreferencesPanel(
      contentRect: NSRect(origin: .zero, size: bounds.initialSize),
      styleMask: [.borderless, .resizable],
      backing: .buffered,
      defer: false
    )
    panel.title = configuration.title
    panel.becomesKeyOnlyIfNeeded = false
    panel.isFloatingPanel = false
    panel.hidesOnDeactivate = false
    panel.isOpaque = false
    panel.backgroundColor = .clear
    panel.hasShadow = true
    panel.isMovableByWindowBackground = true
    panel.isReleasedWhenClosed = false
    panel.minSize = bounds.minimumSize
    panel.maxSize = bounds.maximumSize
    panel.level = .normal
    panel.contentView = NSHostingView(
      rootView: rootView.environment(
        \.preferencesWindowActions,
        PreferencesWindowActions { [weak panel] in panel?.close() }
      )
    )
    window = panel
  }

  public func show() {
    onShow()
    let wasVisible = window.isVisible
    if !wasVisible {
      window.center()
    }
    if configuration.activatesApplication {
      if #available(macOS 14, *) {
        NSApp.activate()
      } else {
        NSApp.activate(ignoringOtherApps: true)
      }
    }
    window.makeKeyAndOrderFront(nil)
    if !wasVisible {
      window.makeFirstResponder(nil)
    }
  }
}

private struct PreferencesWindowBounds {
  let initialSize: CGSize
  let minimumSize: CGSize
  let maximumSize: CGSize

  init(configuration: PreferencesWindowConfiguration) {
    minimumSize = CGSize(
      width: max(configuration.minimumSize.width, 0),
      height: max(configuration.minimumSize.height, 0)
    )
    maximumSize = CGSize(
      width: max(configuration.maximumSize.width, minimumSize.width),
      height: max(configuration.maximumSize.height, minimumSize.height)
    )
    initialSize = CGSize(
      width: min(max(configuration.size.width, minimumSize.width), maximumSize.width),
      height: min(max(configuration.size.height, minimumSize.height), maximumSize.height)
    )
  }
}

@MainActor
private final class PreferencesPanel: NSPanel {
  override var canBecomeKey: Bool { true }
  override var canBecomeMain: Bool { true }

  override func performKeyEquivalent(with event: NSEvent) -> Bool {
    if Self.isCloseShortcut(event) {
      close()
      return true
    }
    return super.performKeyEquivalent(with: event)
  }

  static func isCloseShortcut(_ event: NSEvent) -> Bool {
    let modifiers = event.modifierFlags.intersection([.command, .control, .option, .shift])
    return modifiers == .command
      && event.charactersIgnoringModifiers?.lowercased() == "w"
  }
}
