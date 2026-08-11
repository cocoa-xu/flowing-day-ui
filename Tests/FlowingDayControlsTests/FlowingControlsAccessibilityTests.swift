import AppKit
import SwiftUI
import XCTest

@testable import FlowingDayControls

@MainActor
final class FlowingControlsAccessibilityTests: XCTestCase {
  func testSliderExposesNativeAccessibilitySemantics() {
    let slider = FlowingSliderControl()
    slider.accessibilityLabelText = "Zoom"
    slider.formatValue = { "\(Int($0 * 100)) percent" }
    slider.range = 0...1
    slider.step = 0.1
    slider.value = 0.5

    XCTAssertEqual(slider.accessibilityRole(), .slider)
    XCTAssertEqual(slider.accessibilityLabel(), "Zoom")
    XCTAssertEqual(slider.accessibilityValue() as? Double, 0.5)
    XCTAssertEqual(slider.accessibilityValueDescription(), "50 percent")
    XCTAssertEqual(slider.accessibilityMinValue() as? Double, 0)
    XCTAssertEqual(slider.accessibilityMaxValue() as? Double, 1)
    XCTAssertTrue(slider.accessibilityPerformIncrement())
    XCTAssertEqual(slider.value, 0.6, accuracy: 0.001)
    XCTAssertTrue(slider.accessibilityPerformDecrement())
    XCTAssertEqual(slider.value, 0.5, accuracy: 0.001)
  }

  func testDisabledSliderRejectsAccessibilityAdjustment() {
    let slider = FlowingSliderControl()
    slider.range = 0...1
    slider.value = 0.5
    slider.isEnabled = false

    XCTAssertFalse(slider.accessibilityPerformIncrement())
    XCTAssertEqual(slider.value, 0.5)
  }

  func testDecorativeSeparatorIsAbsentFromTheAccessibilityTree() {
    let entriesWithSeparator = accessibilityEntries(
      for: VStack {
        Text("Before")
        FlowingSeparator()
        Text("After")
      }
    )
    let entriesWithoutSeparator = accessibilityEntries(
      for: VStack {
        Text("Before")
        Text("After")
      }
    )

    XCTAssertEqual(
      entriesWithSeparator.map(\.description), entriesWithoutSeparator.map(\.description))
  }

  private func accessibilityEntries<Content: View>(for content: Content) -> [AccessibilityEntry] {
    let hostingView = NSHostingView(rootView: content)
    hostingView.frame = CGRect(x: 0, y: 0, width: 520, height: 360)
    hostingView.layoutSubtreeIfNeeded()
    hostingView.displayIfNeeded()

    var visited: Set<ObjectIdentifier> = []
    return collectAccessibilityEntries(from: hostingView, visited: &visited)
  }
}

private struct AccessibilityEntry: CustomStringConvertible {
  let role: NSAccessibility.Role?
  let label: String?
  let value: String?
  let isEnabled: Bool

  var description: String {
    "\(role?.rawValue ?? "nil") label=\(label ?? "nil") value=\(value ?? "nil") "
      + "enabled=\(isEnabled)"
  }
}

@MainActor
private func collectAccessibilityEntries(
  from object: AnyObject,
  visited: inout Set<ObjectIdentifier>
) -> [AccessibilityEntry] {
  let identifier = ObjectIdentifier(object)
  guard visited.insert(identifier).inserted else { return [] }

  let properties:
    (
      role: NSAccessibility.Role?,
      label: String?,
      value: Any?,
      isEnabled: Bool,
      children: [Any]
    )
  if let view = object as? NSView {
    properties = (
      view.accessibilityRole(),
      view.accessibilityLabel(),
      view.accessibilityValue(),
      view.isAccessibilityEnabled(),
      view.accessibilityChildren() ?? []
    )
  } else if let element = object as? NSAccessibilityElement {
    properties = (
      element.accessibilityRole(),
      element.accessibilityLabel(),
      element.accessibilityValue(),
      element.isAccessibilityEnabled(),
      element.accessibilityChildren() ?? []
    )
  } else {
    return []
  }

  let entry = AccessibilityEntry(
    role: properties.role,
    label: properties.label,
    value: properties.value.map(String.init(describing:)),
    isEnabled: properties.isEnabled
  )
  return [entry]
    + properties.children.flatMap {
      collectAccessibilityEntries(from: $0 as AnyObject, visited: &visited)
    }
}
