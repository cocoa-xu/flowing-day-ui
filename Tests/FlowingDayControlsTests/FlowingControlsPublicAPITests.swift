import FlowingDayControls
import SwiftUI
import XCTest

@MainActor
final class FlowingControlsPublicAPITests: XCTestCase {
  func testPrimaryControlsComposeUsingOnlyThePublicModule() {
    let enabled = Binding.constant(true)
    let text = Binding.constant("Flowing Day")
    let selection = Binding.constant("general")
    let options = [
      FlowingSegmentOption("general", label: "General", systemImage: "gearshape"),
      FlowingSegmentOption("advanced", label: "Advanced", systemImage: "slider.horizontal.3"),
    ]

    let view = VStack {
      FlowingCheckbox("Enabled", isOn: enabled)
      FlowingSwitch("Enabled", isOn: enabled)
      FlowingTextField("Name", text: text)
      FlowingSegmentedControl(label: "Section", selection: selection, options: options)
      FlowingSlider(value: .constant(0.5), in: 0...1)
    }
    .flowingAccent(.petal)
    .flowingMetrics(.standard)
    .flowingTypography(.standard)
    .flowingSurfaces(.standard)

    XCTAssertNotNil(AnyView(view))
  }

  func testPublicThemeContainsOnlyReusableSemantics() {
    let metrics = FlowingMetrics(cardRadius: 12, controlRadius: 8, rowInset: 16)
    let typography = FlowingTypography(
      rowTitle: FlowingTextStyle(size: 14, weight: .medium)
    )
    let surfaces = FlowingSurfaces(card: .white, control: .gray, field: .white)

    XCTAssertEqual(metrics.cardRadius, 12)
    XCTAssertEqual(typography.rowTitle.size, 14)
    XCTAssertEqual(surfaces.control, .gray)
  }
}
