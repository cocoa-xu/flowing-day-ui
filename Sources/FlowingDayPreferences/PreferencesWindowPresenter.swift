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
  public var title: String
  public var size: CGSize
  public var minimumSize: CGSize
  public var activatesApplication: Bool

  public init(
    title: String = "Preferences",
    size: CGSize = CGSize(width: 900, height: 640),
    minimumSize: CGSize = CGSize(width: 820, height: 560),
    activatesApplication: Bool = true
  ) {
    self.title = title
    self.size = size
    self.minimumSize = minimumSize
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

    let panel = PreferencesPanel(
      contentRect: NSRect(origin: .zero, size: configuration.size),
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
    panel.minSize = configuration.minimumSize
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
    if !window.isVisible {
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
