import AppKit
import SwiftUI

public struct SettingsWindowActions: Sendable {
  private let dismissAction: @MainActor @Sendable () -> Void

  public init(dismiss: @escaping @MainActor @Sendable () -> Void = {}) {
    dismissAction = dismiss
  }

  @MainActor
  public func dismiss() {
    dismissAction()
  }
}

private struct SettingsWindowActionsKey: EnvironmentKey {
  static let defaultValue = SettingsWindowActions()
}

extension EnvironmentValues {
  public var settingsWindowActions: SettingsWindowActions {
    get { self[SettingsWindowActionsKey.self] }
    set { self[SettingsWindowActionsKey.self] = newValue }
  }
}

public struct SettingsWindowConfiguration: Equatable {
  public var size: CGSize
  public var minimumSize: CGSize
  public var activatesApplication: Bool

  public init(
    size: CGSize = CGSize(width: 900, height: 640),
    minimumSize: CGSize = CGSize(width: 820, height: 560),
    activatesApplication: Bool = true
  ) {
    self.size = size
    self.minimumSize = minimumSize
    self.activatesApplication = activatesApplication
  }
}

@MainActor
public final class SettingsWindowPresenter<Content: View> {
  public let window: NSPanel

  private let configuration: SettingsWindowConfiguration
  private let onShow: () -> Void

  public init(
    configuration: SettingsWindowConfiguration = SettingsWindowConfiguration(),
    rootView: Content,
    onShow: @escaping () -> Void = {}
  ) {
    self.configuration = configuration
    self.onShow = onShow

    let panel = SettingsPanel(
      contentRect: NSRect(origin: .zero, size: configuration.size),
      styleMask: [.borderless, .resizable, .nonactivatingPanel],
      backing: .buffered,
      defer: false
    )
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
        \.settingsWindowActions,
        SettingsWindowActions { [weak panel] in panel?.close() }
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
    window.level = .floating
    window.orderFrontRegardless()
    window.makeKey()
    window.level = .normal
  }
}

@MainActor
private final class SettingsPanel: NSPanel {
  override var canBecomeKey: Bool { true }
  override var canBecomeMain: Bool { false }

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
