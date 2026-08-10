import AppKit
import SwiftUI
import XCTest

@testable import FlowingDayPreferences

@MainActor
final class PreferencesWindowTests: XCTestCase {
  func testPresenterBuildsIntegratedPreferencesPanel() {
    let presenter = PreferencesWindowPresenter(rootView: Color.clear)
    let window = presenter.window
    defer { window.close() }

    XCTAssertFalse(window.styleMask.contains(.titled))
    XCTAssertTrue(window.styleMask.contains(.resizable))
    XCTAssertFalse(window.styleMask.contains(.nonactivatingPanel))
    XCTAssertEqual(window.title, "Preferences")
    XCTAssertFalse(window.isOpaque)
    XCTAssertTrue(window.hasShadow)
    XCTAssertTrue(window.isMovableByWindowBackground)
    XCTAssertTrue(window.canBecomeKey)
    XCTAssertTrue(window.canBecomeMain)
    XCTAssertEqual(window.level, .normal)
    XCTAssertEqual(
      window.contentRect(forFrameRect: window.frame).size,
      CGSize(width: 900, height: 640)
    )
    XCTAssertEqual(window.minSize, CGSize(width: 900, height: 640))
    XCTAssertEqual(window.maxSize, CGSize(width: 1160, height: 860))
  }

  func testPresenterAppliesCustomWindowBounds() {
    let presenter = PreferencesWindowPresenter(
      configuration: PreferencesWindowConfiguration(
        size: CGSize(width: 980, height: 700),
        minimumSize: CGSize(width: 840, height: 600),
        maximumSize: CGSize(width: 1080, height: 760)
      ),
      rootView: Color.clear
    )
    defer { presenter.window.close() }

    let window = presenter.window
    XCTAssertEqual(
      window.contentRect(forFrameRect: window.frame).size,
      CGSize(width: 980, height: 700)
    )
    XCTAssertEqual(window.minSize, CGSize(width: 840, height: 600))
    XCTAssertEqual(window.maxSize, CGSize(width: 1080, height: 760))
  }

  func testPresenterNormalizesInvalidWindowBounds() {
    let presenter = PreferencesWindowPresenter(
      configuration: PreferencesWindowConfiguration(
        size: CGSize(width: 500, height: 400),
        minimumSize: CGSize(width: 900, height: 640),
        maximumSize: CGSize(width: 800, height: 500)
      ),
      rootView: Color.clear
    )
    defer { presenter.window.close() }

    let window = presenter.window
    XCTAssertEqual(
      window.contentRect(forFrameRect: window.frame).size,
      CGSize(width: 900, height: 640)
    )
    XCTAssertEqual(window.minSize, CGSize(width: 900, height: 640))
    XCTAssertEqual(window.maxSize, CGSize(width: 900, height: 640))
  }

  func testPresenterUsesConfiguredWindowTitle() {
    let presenter = PreferencesWindowPresenter(
      configuration: PreferencesWindowConfiguration(title: "App Preferences"),
      rootView: Color.clear
    )
    defer { presenter.window.close() }

    XCTAssertEqual(presenter.window.title, "App Preferences")
  }

  func testShowingPanelUsesNormalWindowLevel() {
    let presenter = PreferencesWindowPresenter(rootView: Color.clear)
    defer { presenter.window.close() }

    presenter.show()

    XCTAssertTrue(presenter.window.isVisible)
    XCTAssertEqual(presenter.window.level, .normal)
  }

  func testCommandWClosesPanel() throws {
    let presenter = PreferencesWindowPresenter(rootView: Color.clear)
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

    let button = FlowingSelectButton(
      frame: NSRect(x: 100, y: 100, width: 160, height: 30)
    )
    var selectedIndex: Int?
    button.configure(
      labels: ["Nearest Edge", "Left Edge", "Right Edge"],
      selectedIndex: 0,
      minimumWidth: 140,
      accent: .celadon,
      strings: PreferencesStrings(),
      controlRadius: 9,
      textStyle: PreferencesTypography.standard.value,
      optionTextStyle: PreferencesTypography.standard.selectionLabel,
      menuBackgroundColor: PreferencesPalette.control
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
    let button = FlowingSelectButton()
    button.configure(
      labels: ["Selected"],
      selectedIndex: 0,
      minimumWidth: 120,
      accent: PreferencesAccent(fill: .blue, foreground: Color(nsColor: foreground)),
      strings: PreferencesStrings(),
      controlRadius: 9,
      textStyle: PreferencesTypography.standard.value,
      optionTextStyle: PreferencesTypography.standard.selectionLabel,
      menuBackgroundColor: PreferencesPalette.control
    )

    let actual = try XCTUnwrap(button.valueTextColor.usingColorSpace(.deviceRGB))
    let expected = try XCTUnwrap(foreground.usingColorSpace(.deviceRGB))
    XCTAssertEqual(actual.redComponent, expected.redComponent, accuracy: 0.001)
    XCTAssertEqual(actual.greenComponent, expected.greenComponent, accuracy: 0.001)
    XCTAssertEqual(actual.blueComponent, expected.blueComponent, accuracy: 0.001)
  }
}
