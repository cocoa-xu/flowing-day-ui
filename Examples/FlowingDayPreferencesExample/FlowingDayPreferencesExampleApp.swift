import AppKit
import FlowingDayControls
import FlowingDayPreferences
import SwiftUI

@main
@MainActor
final class FlowingDayPreferencesExampleApp: NSObject, NSApplicationDelegate {
  private var presenter: PreferencesWindowPresenter<ExamplePreferencesView>?

  static func main() {
    let application = NSApplication.shared
    let delegate = FlowingDayPreferencesExampleApp()
    application.delegate = delegate
    application.setActivationPolicy(.regular)
    application.run()
  }

  func applicationDidFinishLaunching(_ notification: Notification) {
    presenter = PreferencesWindowPresenter(rootView: ExamplePreferencesView())
    presenter?.show()
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    false
  }

  func applicationShouldHandleReopen(
    _ sender: NSApplication,
    hasVisibleWindows flag: Bool
  ) -> Bool {
    presenter?.show()
    return true
  }
}
