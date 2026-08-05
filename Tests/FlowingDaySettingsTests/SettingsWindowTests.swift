import AppKit
import SwiftUI
import XCTest

@testable import FlowingDaySettings

@MainActor
final class SettingsWindowTests: XCTestCase {
  func testPresenterBuildsIntegratedSettingsPanel() {
    let presenter = SettingsWindowPresenter(rootView: Color.clear)
    let window = presenter.window
    defer { window.close() }

    XCTAssertFalse(window.styleMask.contains(.titled))
    XCTAssertTrue(window.styleMask.contains(.resizable))
    XCTAssertFalse(window.styleMask.contains(.nonactivatingPanel))
    XCTAssertEqual(window.title, "Settings")
    XCTAssertFalse(window.isOpaque)
    XCTAssertTrue(window.hasShadow)
    XCTAssertTrue(window.isMovableByWindowBackground)
    XCTAssertTrue(window.canBecomeKey)
    XCTAssertTrue(window.canBecomeMain)
    XCTAssertEqual(window.level, .normal)
  }

  func testPresenterUsesConfiguredWindowTitle() {
    let presenter = SettingsWindowPresenter(
      configuration: SettingsWindowConfiguration(title: "App Preferences"),
      rootView: Color.clear
    )
    defer { presenter.window.close() }

    XCTAssertEqual(presenter.window.title, "App Preferences")
  }

  func testShowingPanelUsesNormalWindowLevel() {
    let presenter = SettingsWindowPresenter(rootView: Color.clear)
    defer { presenter.window.close() }

    presenter.show()

    XCTAssertTrue(presenter.window.isVisible)
    XCTAssertEqual(presenter.window.level, .normal)
  }

  func testCommandWClosesPanel() throws {
    let presenter = SettingsWindowPresenter(rootView: Color.clear)
    let window = presenter.window
    let event = try XCTUnwrap(
      NSEvent.keyEvent(
        with: .keyDown,
        location: .zero,
        modifierFlags: .command,
        timestamp: 0,
        windowNumber: window.windowNumber,
        context: nil,
        characters: "w",
        charactersIgnoringModifiers: "w",
        isARepeat: false,
        keyCode: 13
      ))
    window.orderFront(nil)

    XCTAssertTrue(window.performKeyEquivalent(with: event))
    XCTAssertFalse(window.isVisible)
  }

  func testPopupUsesClickableCustomPanel() throws {
    let window = NSWindow(
      contentRect: NSRect(x: 200, y: 200, width: 400, height: 300),
      styleMask: [.borderless],
      backing: .buffered,
      defer: false
    )
    window.isReleasedWhenClosed = false
    defer { window.close() }

    let button = SettingsPopupButton(
      frame: NSRect(x: 100, y: 100, width: 160, height: 30)
    )
    var selectedIndex: Int?
    button.configure(
      labels: ["Nearest Edge", "Left Edge", "Right Edge"],
      selectedIndex: 0,
      minimumWidth: 140,
      accent: .celadon,
      strings: SettingsStrings(),
      controlRadius: 9,
      textStyle: SettingsTypography.standard.value,
      optionTextStyle: SettingsTypography.standard.selectionLabel,
      menuBackgroundColor: SettingsPalette.control
    )
    button.onSelect = { selectedIndex = $0 }
    window.contentView?.addSubview(button)
    window.orderFront(nil)

    button.performClick(nil)

    let panel = try XCTUnwrap(button.presentedPanel)
    XCTAssertFalse(panel.isOpaque)
    XCTAssertEqual(panel.backgroundColor, .clear)
    XCTAssertTrue(panel.styleMask.contains(.borderless))
    XCTAssertTrue(panel.isVisible)
    XCTAssertTrue(window.childWindows?.contains(panel) == true)

    let optionButtons = try XCTUnwrap(panel.contentView?.subviews as? [NSButton])
    XCTAssertEqual(optionButtons.count, 3)
    optionButtons[1].performClick(nil)

    XCTAssertEqual(selectedIndex, 1)
    XCTAssertNil(button.presentedPanel)
  }

  func testPopupValueUsesTheConfiguredAccent() throws {
    let foreground = NSColor(calibratedRed: 0.22, green: 0.47, blue: 0.68, alpha: 1)
    let button = SettingsPopupButton()
    button.configure(
      labels: ["Selected"],
      selectedIndex: 0,
      minimumWidth: 120,
      accent: SettingsAccent(fill: .blue, foreground: Color(nsColor: foreground)),
      strings: SettingsStrings(),
      controlRadius: 9,
      textStyle: SettingsTypography.standard.value,
      optionTextStyle: SettingsTypography.standard.selectionLabel,
      menuBackgroundColor: SettingsPalette.control
    )

    let actual = try XCTUnwrap(button.valueTextColor.usingColorSpace(.deviceRGB))
    let expected = try XCTUnwrap(foreground.usingColorSpace(.deviceRGB))
    XCTAssertEqual(actual.redComponent, expected.redComponent, accuracy: 0.001)
    XCTAssertEqual(actual.greenComponent, expected.greenComponent, accuracy: 0.001)
    XCTAssertEqual(actual.blueComponent, expected.blueComponent, accuracy: 0.001)
  }
}
