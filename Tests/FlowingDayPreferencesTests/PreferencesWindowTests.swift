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

  func testShowingPanelClearsInitialControlFocusAndPreservesVisibleFocus() {
    let presenter = PreferencesWindowPresenter(rootView: Color.clear)
    let window = presenter.window
    let responder = TestFirstResponderView()
    window.contentView?.addSubview(responder)
    defer { window.close() }

    XCTAssertTrue(window.makeFirstResponder(responder))
    presenter.show()
    XCTAssertTrue(window.firstResponder === window)

    XCTAssertTrue(window.makeFirstResponder(responder))
    presenter.show()
    XCTAssertTrue(window.firstResponder === responder)
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

}

private final class TestFirstResponderView: NSView {
  override var acceptsFirstResponder: Bool { true }
}
