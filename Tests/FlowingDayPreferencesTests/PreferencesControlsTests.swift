import SwiftUI
import XCTest

@testable import FlowingDayPreferences

final class PreferencesControlsTests: XCTestCase {
  func testPopupOptionCanCarryItsOwnAccent() {
    let option = PreferencesPopupOption(
      "petal",
      label: "Petal",
      accent: PreferencesAccent.petal
    )

    XCTAssertEqual(option.accent, .petal)
  }

  func testSectionSeparatorsFollowHomogeneousRowIconPresence() {
    XCTAssertEqual(
      PreferencesSectionSeparatorResolver.resolve(
        iconPresence: Set([true]),
        mixedRows: .content
      ),
      .iconText
    )
    XCTAssertEqual(
      PreferencesSectionSeparatorResolver.resolve(
        iconPresence: Set([false]),
        mixedRows: .iconText
      ),
      .content
    )
  }

  func testMixedSectionSeparatorsUseTheConfiguredLeadingEdge() {
    let mixedRows = Set([true, false])

    XCTAssertEqual(
      PreferencesSectionSeparatorResolver.resolve(
        iconPresence: mixedRows,
        mixedRows: .content
      ),
      .content
    )
    XCTAssertEqual(
      PreferencesSectionSeparatorResolver.resolve(
        iconPresence: mixedRows,
        mixedRows: .iconText
      ),
      .iconText
    )
  }

  func testDefaultThemeMatchesPreferencesVisualHierarchy() {
    let typography = PreferencesTypography.standard
    let surfaces = PreferencesSurfaces.standard

    XCTAssertEqual(typography.pageTitle.size, 25)
    XCTAssertEqual(typography.pageTitle.weight, .semibold)
    XCTAssertEqual(typography.pageTitle.design, .rounded)
    XCTAssertEqual(typography.contentTitle.size, 21)
    XCTAssertEqual(typography.body.size, 12)
    XCTAssertEqual(typography.rowTitle.size, 13)
    XCTAssertEqual(typography.sectionHeader.size, 10.5)
    XCTAssertEqual(surfaces.sidebar, PreferencesPalette.card)
    XCTAssertEqual(surfaces.card, PreferencesPalette.control)
  }

  func testThemeCanBeCustomizedPerApplication() {
    let typography = PreferencesTypography(
      rowTitle: PreferencesTextStyle(
        size: 15,
        weight: .medium,
        fontName: "Helvetica Neue"
      )
    )
    let surfaces = PreferencesSurfaces(card: .orange, field: .purple)

    XCTAssertEqual(typography.rowTitle.size, 15)
    XCTAssertEqual(typography.rowTitle.weight, .medium)
    XCTAssertEqual(typography.rowTitle.fontName, "Helvetica Neue")
    XCTAssertEqual(surfaces.card, .orange)
    XCTAssertEqual(surfaces.field, .purple)
  }

  func testSliderMathClampsFractions() {
    let range = 10.0...20.0

    XCTAssertEqual(PreferencesSliderMath.fraction(of: 5, in: range), 0)
    XCTAssertEqual(PreferencesSliderMath.fraction(of: 15, in: range), 0.5)
    XCTAssertEqual(PreferencesSliderMath.fraction(of: 25, in: range), 1)
    XCTAssertEqual(PreferencesSliderMath.value(atFraction: -1, in: range), 10)
    XCTAssertEqual(PreferencesSliderMath.value(atFraction: 0.25, in: range), 12.5)
    XCTAssertEqual(PreferencesSliderMath.value(atFraction: 2, in: range), 20)
  }

  func testCheckboxAlignmentUsesSemanticGuides() {
    XCTAssertEqual(FlowingCheckboxContentAlignment.leading.frameAlignment, .leading)
    XCTAssertEqual(FlowingCheckboxContentAlignment.center.frameAlignment, .center)
    XCTAssertEqual(FlowingCheckboxContentAlignment.trailing.frameAlignment, .trailing)
  }

  @MainActor
  func testCheckboxDefaultsMatchPrimitiveAndPreferencesContexts() {
    let primitive = FlowingCheckbox("Primitive", isOn: .constant(false))
    let preferences = PreferencesCheckToggle("Preferences", isOn: .constant(false))
    let trailing = PreferencesCheckToggle(
      "Trailing",
      isOn: .constant(false),
      contentAlignment: .trailing
    )

    XCTAssertEqual(primitive.contentAlignment, .leading)
    XCTAssertNil(primitive.accent)
    XCTAssertEqual(primitive.indicatorPlacement, .leading)
    XCTAssertEqual(primitive.widthPolicy, .fill)
    XCTAssertEqual(preferences.contentAlignment, .center)
    XCTAssertEqual(preferences.indicatorPlacement, .leading)
    XCTAssertEqual(preferences.widthPolicy, .fill)
    XCTAssertEqual(trailing.contentAlignment, .trailing)
  }

  func testCheckboxWidthPolicyValidatesItsMaximumWidth() {
    XCTAssertNil(FlowingCheckboxWidthPolicy.fitContent().maximumWidth)
    XCTAssertNil(
      FlowingCheckboxWidthPolicy.fitContent(maximumWidth: -.infinity).maximumWidth
    )
    XCTAssertNil(FlowingCheckboxWidthPolicy.fitContent(maximumWidth: 0).maximumWidth)
    XCTAssertEqual(
      FlowingCheckboxWidthPolicy.fitContent(maximumWidth: 120).maximumWidth,
      120
    )
  }

  @MainActor
  func testContentSizedCheckboxHonorsItsMaximumWidth() {
    let intrinsicWidth = fittingWidth(
      FlowingCheckbox(
        "Short",
        isOn: .constant(false),
        widthPolicy: .fitContent()
      )
    )
    let cappedShortWidth = fittingWidth(
      FlowingCheckbox(
        "Short",
        isOn: .constant(false),
        widthPolicy: .fitContent(maximumWidth: 108)
      )
    )
    let constrainedWidth = fittingWidth(
      FlowingCheckbox(
        "A deliberately long checkbox label",
        isOn: .constant(false),
        widthPolicy: .fitContent(maximumWidth: 108),
        truncationMode: .middle
      )
    )

    XCTAssertLessThan(intrinsicWidth, 108)
    XCTAssertEqual(cappedShortWidth, intrinsicWidth, accuracy: 0.5)
    XCTAssertEqual(constrainedWidth, 108, accuracy: 0.5)
  }

  func testMultiSelectItemWidthMapsToCheckboxWidth() {
    XCTAssertEqual(
      FlowingMultiSelectItemWidthPolicy.equal.checkboxWidthPolicy,
      .fill
    )
    XCTAssertEqual(
      FlowingMultiSelectItemWidthPolicy.fitContent(maximumWidth: 104)
        .checkboxWidthPolicy,
      .fitContent(maximumWidth: 104)
    )
  }

  @MainActor
  func testMultiSelectDefaultsToHorizontalEqualWidthItems() {
    let multiSelect = FlowingMultiSelect(options: [])

    XCTAssertEqual(multiSelect.axis, .horizontal)
    XCTAssertEqual(multiSelect.itemWidthPolicy, .equal)
    XCTAssertEqual(multiSelect.contentAlignment, .center)
    XCTAssertEqual(multiSelect.indicatorPlacement, .leading)
    XCTAssertEqual(multiSelect.spacing, 6)
  }

  @MainActor
  func testMultiSelectSupportsVerticalContentSizedItems() {
    let multiSelect = FlowingMultiSelect(
      axis: .vertical,
      itemWidthPolicy: .fitContent(maximumWidth: 96),
      contentAlignment: .trailing,
      indicatorPlacement: .trailing,
      spacing: 8,
      truncationMode: .middle,
      options: []
    )

    XCTAssertEqual(multiSelect.axis, .vertical)
    XCTAssertEqual(
      multiSelect.itemWidthPolicy,
      .fitContent(maximumWidth: 96)
    )
    XCTAssertEqual(multiSelect.contentAlignment, .trailing)
    XCTAssertEqual(multiSelect.indicatorPlacement, .trailing)
    XCTAssertEqual(multiSelect.spacing, 8)
  }

  @MainActor
  func testCheckboxTogglesItsBinding() {
    let state = BooleanState(false)
    let checkbox = FlowingCheckbox(
      "Quiet Motion",
      isOn: Binding(
        get: { state.value },
        set: { state.value = $0 }
      )
    )

    checkbox.toggle()

    XCTAssertTrue(state.value)
  }

  func testConnectedSegmentNavigationWrapsInBothDirections() {
    let values = ["first", "second", "third"]

    XCTAssertEqual(
      PreferencesConnectedSegmentedControlNavigation.destination(
        in: values,
        from: "third",
        offset: 1
      ),
      "first"
    )
    XCTAssertEqual(
      PreferencesConnectedSegmentedControlNavigation.destination(
        in: values,
        from: "first",
        offset: -1
      ),
      "third"
    )
  }

  func testConnectedSegmentNavigationStartsAtTheNearestBoundaryForAnUnknownSelection() {
    XCTAssertEqual(
      PreferencesConnectedSegmentedControlNavigation.destination(
        in: ["first", "second", "third"],
        from: "unknown",
        offset: 1
      ),
      "first"
    )
    XCTAssertEqual(
      PreferencesConnectedSegmentedControlNavigation.destination(
        in: ["first", "second", "third"],
        from: "unknown",
        offset: -1
      ),
      "third"
    )
  }

  @MainActor
  func testConnectedSegmentedRowUsesCompactRowHeight() {
    let height = fittingHeight(
      PreferencesConnectedSegmentedRow(
        title: "Layout",
        selection: .constant("first"),
        options: [
          PreferencesPopupOption("first", label: "First"),
          PreferencesPopupOption("second", label: "Second"),
        ]
      )
    )

    XCTAssertEqual(height, PreferencesRowLayout.minimumHeight)
  }

  @MainActor
  func testMultiSelectOptionTogglesItsBinding() {
    let state = BooleanState(false)
    let option = FlowingMultiSelectOption(
      "Activity",
      systemImage: "waveform.path.ecg",
      accent: .seafoam,
      isOn: Binding(
        get: { state.value },
        set: { state.value = $0 }
      )
    )

    XCTAssertEqual(option.id, "Activity")
    XCTAssertEqual(option.systemImage, "waveform.path.ecg")
    XCTAssertEqual(option.accent, .seafoam)
    XCTAssertFalse(option.isSelected)

    option.toggle()

    XCTAssertTrue(option.isSelected)
    XCTAssertTrue(state.value)
  }

  @MainActor
  func testDisabledMultiSelectOptionDoesNotToggle() {
    let state = BooleanState(true)
    let option = FlowingMultiSelectOption(
      "Chart",
      id: "network-chart",
      isOn: Binding(
        get: { state.value },
        set: { state.value = $0 }
      ),
      isEnabled: false
    )

    option.toggle()

    XCTAssertEqual(option.id, "network-chart")
    XCTAssertTrue(option.isSelected)
    XCTAssertTrue(state.value)
  }

  func testOptionSearchIgnoresCaseAndSurroundingWhitespace() {
    XCTAssertTrue(PreferencesOptionSearch.matches("Asia/Tokyo", query: "  TOKYO "))
    XCTAssertTrue(PreferencesOptionSearch.matches("Europe/London", query: ""))
    XCTAssertFalse(PreferencesOptionSearch.matches("Europe/London", query: "Tokyo"))
  }

  func testDependentRowsMotionRespectsReduceMotion() {
    XCTAssertEqual(
      PreferencesDependentRowsMotion.duration(reduceMotion: false),
      0.18
    )
    XCTAssertEqual(
      PreferencesDependentRowsMotion.duration(reduceMotion: true),
      0.12
    )
    XCTAssertEqual(PreferencesDependentRowsMotion.offset(reduceMotion: false), -5)
    XCTAssertEqual(PreferencesDependentRowsMotion.offset(reduceMotion: true), 0)
  }

  @MainActor
  func testIconCheckboxTogglesItsBinding() {
    let state = BooleanState(false)
    let checkbox = FlowingCheckbox(
      "Network",
      systemImage: "network",
      isOn: Binding(
        get: { state.value },
        set: { state.value = $0 }
      ),
      accent: .brook,
      indicatorPlacement: .trailing
    )

    checkbox.toggle()

    XCTAssertTrue(state.value)
    XCTAssertEqual(checkbox.accent, .brook)
  }

  @MainActor
  func testIconCheckboxUsesTheStandardCheckboxHeight() {
    let standardHeight = fittingHeight(
      FlowingCheckbox(
        "Displays",
        isOn: .constant(true),
        widthPolicy: .fitContent()
      )
    )
    let iconHeight = fittingHeight(
      FlowingCheckbox(
        "Displays",
        systemImage: "display",
        isOn: .constant(true),
        indicatorPlacement: .trailing,
        widthPolicy: .fitContent()
      )
    )

    XCTAssertEqual(iconHeight, standardHeight)
  }

  @MainActor
  func testRowsWithoutCaptionsUseCompactHeight() {
    let compactHeight = fittingHeight(
      PreferencesPopupRow(
        title: "Background",
        selection: .constant("Canvas"),
        options: [PreferencesPopupOption("Canvas", label: "Canvas")]
      )
    )
    let detailedHeight = fittingHeight(
      PreferencesPopupRow(
        title: "Background",
        caption: "Choose how the exported canvas is rendered.",
        selection: .constant("Canvas"),
        options: [PreferencesPopupOption("Canvas", label: "Canvas")]
      )
    )

    XCTAssertEqual(compactHeight, PreferencesRowLayout.minimumHeight)
    XCTAssertLessThan(compactHeight, detailedHeight)
  }

  @MainActor
  func testDependentRowsOnlyOccupySpaceWhenVisible() {
    let hiddenHeight = fittingHeight(
      PreferencesDependentRows(isVisible: false) {
        PreferencesRow(title: "Dependent setting")
      }
    )
    let visibleHeight = fittingHeight(
      PreferencesDependentRows(isVisible: true) {
        PreferencesRow(title: "Dependent setting")
      }
    )

    XCTAssertLessThan(hiddenHeight, 1)
    XCTAssertGreaterThan(visibleHeight, 40)
  }

  @MainActor
  func testSwitchGroupIncludesDependentRowsWhenEnabled() {
    let disabledHeight = fittingHeight(
      PreferencesSwitchGroup(title: "Master setting", isOn: .constant(false)) {
        PreferencesRow(title: "Dependent setting")
      }
    )
    let enabledHeight = fittingHeight(
      PreferencesSwitchGroup(title: "Master setting", isOn: .constant(true)) {
        PreferencesRow(title: "Dependent setting")
      }
    )

    XCTAssertGreaterThan(enabledHeight - disabledHeight, 40)
  }

  @MainActor
  private func fittingHeight<Content: View>(_ content: Content) -> CGFloat {
    let hostingView = NSHostingView(rootView: content.frame(width: 600))
    hostingView.layoutSubtreeIfNeeded()
    return hostingView.fittingSize.height
  }

  @MainActor
  private func fittingWidth<Content: View>(_ content: Content) -> CGFloat {
    let hostingView = NSHostingView(rootView: content)
    hostingView.layoutSubtreeIfNeeded()
    return hostingView.fittingSize.width
  }
}

private final class BooleanState {
  var value: Bool

  init(_ value: Bool) {
    self.value = value
  }
}
