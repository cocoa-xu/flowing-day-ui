import SwiftUI
import XCTest

@testable import FlowingDayPreferences

final class FlowingControlsTests: XCTestCase {
  func testDisclosureMotionRespectsReduceMotion() {
    XCTAssertEqual(FlowingDisclosureMotion.duration(reduceMotion: false), 0.18)
    XCTAssertEqual(FlowingDisclosureMotion.duration(reduceMotion: true), 0.12)
    XCTAssertEqual(FlowingDisclosureMotion.offset(reduceMotion: false), -5)
    XCTAssertEqual(FlowingDisclosureMotion.offset(reduceMotion: true), 0)
  }

  @MainActor
  func testDisclosureContentOnlyOccupiesSpaceWhenExpanded() {
    let collapsed = fittingHeight(
      FlowingDisclosureContent(isExpanded: false) {
        Text("Details").frame(height: 24)
      }
    )
    let expanded = fittingHeight(
      FlowingDisclosureContent(isExpanded: true) {
        Text("Details").frame(height: 24)
      }
    )

    XCTAssertEqual(collapsed, 0)
    XCTAssertEqual(expanded, 24)
  }

  @MainActor
  func testDisclosureComposesOutsidePreferencesRows() {
    let collapsed = fittingHeight(
      FlowingDisclosure("Details", isExpanded: .constant(false)) {
        Text("Expanded content").frame(height: 30)
      }
      .frame(width: 240)
    )
    let expanded = fittingHeight(
      FlowingDisclosure("Details", isExpanded: .constant(true)) {
        Text("Expanded content").frame(height: 30)
      }
      .frame(width: 240)
    )

    XCTAssertGreaterThan(expanded, collapsed)
  }

  func testSelectOptionCanCarryItsOwnAccent() {
    let option = FlowingSelectOption(
      "petal",
      label: "Petal",
      accent: PreferencesAccent.petal
    )

    XCTAssertEqual(option.id, "petal")
    XCTAssertEqual(option.accent, .petal)
  }

  func testOptionSearchIgnoresCaseAndSurroundingWhitespace() {
    XCTAssertTrue(FlowingOptionSearch.matches("Asia/Tokyo", query: "  TOKYO "))
    XCTAssertTrue(FlowingOptionSearch.matches("Europe/London", query: ""))
    XCTAssertFalse(FlowingOptionSearch.matches("Europe/London", query: "Tokyo"))
  }

  @MainActor
  func testSelectAndSearchPickerComposeOutsidePreferencesRows() {
    let options = [
      FlowingSelectOption("one", label: "One"),
      FlowingSelectOption("two", label: "Two"),
      FlowingSelectOption("three", label: "Three"),
    ]
    let content = VStack {
      FlowingSelect(
        label: "Value",
        selection: .constant("two"),
        options: options
      )
      .fixedSize()
      FlowingSearchPicker(
        label: "Value",
        selection: .constant("two"),
        options: options,
        maximumVisibleOptions: 2
      )
    }
    .frame(width: 240)

    XCTAssertGreaterThan(fittingHeight(content), 100)
  }

  @MainActor
  func testSearchFocusDismissesOnlyForClicksOutsideItsBoundary() throws {
    final class FocusState {
      var isFocused = true
    }

    let focusState = FocusState()
    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 240, height: 120),
      styleMask: .borderless,
      backing: .buffered,
      defer: false
    )
    let contentView = try XCTUnwrap(window.contentView)
    let boundary = FlowingFocusDismissalBoundary.BoundaryView(
      frame: NSRect(x: 20, y: 20, width: 180, height: 30)
    )
    let coordinator = FlowingFocusDismissalBoundary.Coordinator(
      isFocused: Binding(
        get: { focusState.isFocused },
        set: { focusState.isFocused = $0 }
      )
    )
    boundary.coordinator = coordinator
    contentView.addSubview(boundary)
    coordinator.attach(to: boundary)
    defer { coordinator.detach() }

    let insideEvent = try XCTUnwrap(
      mouseDownEvent(in: window, location: NSPoint(x: 30, y: 30))
    )
    let outsideEvent = try XCTUnwrap(
      mouseDownEvent(in: window, location: NSPoint(x: 10, y: 10))
    )

    XCTAssertFalse(coordinator.shouldDismiss(for: insideEvent))
    XCTAssertTrue(coordinator.shouldDismiss(for: outsideEvent))
    focusState.isFocused = false
    XCTAssertFalse(coordinator.shouldDismiss(for: outsideEvent))
  }

  func testSliderMathClampsValuesAndFractions() {
    let range = 10.0...20.0

    XCTAssertEqual(FlowingSliderMath.fraction(of: 5, in: range), 0)
    XCTAssertEqual(FlowingSliderMath.fraction(of: 15, in: range), 0.5)
    XCTAssertEqual(FlowingSliderMath.fraction(of: 25, in: range), 1)
    XCTAssertEqual(FlowingSliderMath.value(atFraction: -1, in: range), 10)
    XCTAssertEqual(FlowingSliderMath.value(atFraction: 0.25, in: range), 12.5)
    XCTAssertEqual(FlowingSliderMath.value(atFraction: 2, in: range), 20)
  }

  @MainActor
  func testSwitchAndSliderComposeOutsidePreferencesRows() {
    let content = VStack {
      FlowingSwitch("Updates", isOn: .constant(true))
      FlowingSlider(value: .constant(0.5), in: 0...1)
    }
    .frame(width: 240)

    XCTAssertGreaterThan(fittingHeight(content), 30)
  }

  @MainActor
  func testFieldAndValueControlsComposeOutsidePreferencesRows() {
    let content = VStack {
      FlowingTextField(
        "Project name",
        text: .constant("Flowing Day"),
        systemImage: "text.cursor"
      )
      FlowingTextField(
        "Search",
        text: .constant("Petal"),
        systemImage: "magnifyingglass",
        emphasis: .accented
      )
      FlowingColorPicker("Color", selection: .constant(.pink))
      FlowingValueText("cocoa@flowing.day")
    }
    .frame(width: 240)

    XCTAssertGreaterThan(fittingHeight(content), 90)
  }

  @MainActor
  func testTextFieldHasCompactIntrinsicHeight() {
    let height = fittingHeight(
      FlowingTextField("Name", text: .constant("Flowing Day"))
        .frame(width: 240)
    )

    XCTAssertEqual(height, FlowingTextFieldMetrics.height, accuracy: 0.5)
  }

  @MainActor
  func testInputFamilySharesCompactSingleLineMetrics() {
    let textHeight = fittingHeight(
      FlowingTextField("Name", text: .constant("Flowing Day"))
        .frame(width: 240)
    )
    let secureHeight = fittingHeight(
      FlowingSecureField("Password", text: .constant("secret"))
        .frame(width: 240)
    )

    XCTAssertEqual(textHeight, FlowingTextFieldMetrics.height, accuracy: 0.5)
    XCTAssertEqual(secureHeight, textHeight, accuracy: 0.5)
  }

  @MainActor
  func testTextAreaHonorsItsMinimumHeight() {
    let height = fittingHeight(
      FlowingTextArea(
        "Notes",
        text: .constant("A multiline value"),
        minimumHeight: 100
      )
      .frame(width: 240)
    )

    XCTAssertGreaterThanOrEqual(height, 100)
    XCTAssertEqual(FlowingTextArea.standardMinimumHeight, 84)
  }

  func testDatePickerComponentsMapToNativeComponents() {
    XCTAssertEqual(FlowingDatePickerComponents.date.displayedComponents, [.date])
    XCTAssertEqual(FlowingDatePickerComponents.time.displayedComponents, [.hourAndMinute])
    XCTAssertEqual(
      FlowingDatePickerComponents.dateAndTime.displayedComponents,
      [.date, .hourAndMinute]
    )
  }

  @MainActor
  func testDatePickerComposesWithEveryComponentSet() {
    let content = VStack {
      ForEach(FlowingDatePickerComponents.allCases, id: \.self) { components in
        FlowingDatePicker(
          "Schedule",
          selection: .constant(Date(timeIntervalSinceReferenceDate: 800_000_000)),
          components: components
        )
      }
    }
    .frame(width: 300)

    XCTAssertGreaterThan(fittingHeight(content), 60)
  }

  func testValidationPreservesItsMessageSemantics() {
    XCTAssertNil(FlowingFieldValidation.none.message)
    XCTAssertNil(FlowingFieldValidation.success(nil).message)
    XCTAssertEqual(FlowingFieldValidation.success("Ready").message, "Ready")
    XCTAssertEqual(FlowingFieldValidation.warning("Check this").message, "Check this")
    XCTAssertEqual(FlowingFieldValidation.error("Required").message, "Required")
  }

  @MainActor
  func testValidationFeedbackOnlyAddsHeightWhenVisible() {
    let standardHeight = fittingHeight(
      FlowingTextField("Name", text: .constant("Flowing Day"))
        .frame(width: 240)
    )
    let helperHeight = fittingHeight(
      FlowingTextField(
        "Name",
        text: .constant("Flowing Day"),
        supportingText: "Use a memorable name."
      )
      .frame(width: 240)
    )
    let errorHeight = fittingHeight(
      FlowingTextField(
        "Name",
        text: .constant(""),
        validation: .error("A name is required.")
      )
      .frame(width: 240)
    )

    XCTAssertEqual(standardHeight, FlowingTextFieldMetrics.height, accuracy: 0.5)
    XCTAssertGreaterThan(helperHeight, standardHeight)
    XCTAssertGreaterThan(errorHeight, standardHeight)
  }

  @MainActor
  func testGenericCardsAndSectionsComposeWithoutPreferencesRows() {
    let cardHeight = fittingHeight(
      FlowingCard(
        contentInsets: EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12)
      ) {
        Text("Card content").frame(height: 20)
      }
      .frame(width: 240)
    )
    let sectionHeight = fittingHeight(
      FlowingSection(
        "Section",
        footer: "Supporting copy",
        contentInsets: EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12)
      ) {
        Text("Section content").frame(height: 20)
      }
      .frame(width: 240)
    )

    XCTAssertEqual(cardHeight, 40, accuracy: 0.5)
    XCTAssertGreaterThan(sectionHeight, cardHeight)
  }

  @MainActor
  func testIconButtonEmphasesComposeAtOneControlSize() {
    let height = fittingHeight(
      HStack {
        FlowingIconButton("Quiet", systemImage: "ellipsis") {}
        FlowingIconButton(
          "Standard",
          systemImage: "slider.horizontal.3",
          emphasis: .standard,
          isSelected: true
        ) {}
        FlowingIconButton(
          "Prominent",
          systemImage: "plus",
          emphasis: .prominent
        ) {}
      }
    )

    XCTAssertEqual(height, FlowingIconButtonMetrics.size, accuracy: 0.5)
  }

  func testProgressMathClampsAndRejectsInvalidInputs() {
    XCTAssertEqual(FlowingProgressMath.fraction(value: -1, total: 4), 0)
    XCTAssertEqual(FlowingProgressMath.fraction(value: 1, total: 4), 0.25)
    XCTAssertEqual(FlowingProgressMath.fraction(value: 8, total: 4), 1)
    XCTAssertEqual(FlowingProgressMath.fraction(value: .nan, total: 4), 0)
    XCTAssertEqual(FlowingProgressMath.fraction(value: 1, total: 0), 0)
  }

  @MainActor
  func testProgressSupportsDeterminateAndIndeterminatePresentations() {
    let content = VStack {
      FlowingProgress("Loading", value: 0.4)
      FlowingProgress("Waiting")
    }
    .frame(width: 240)

    XCTAssertGreaterThan(fittingHeight(content), 40)
  }

  @MainActor
  func testColorPickerPreservesOpacityConfiguration() {
    let opaque = FlowingColorPicker("Color", selection: .constant(.pink))
    let translucent = FlowingColorPicker(
      "Color",
      selection: .constant(.pink),
      supportsOpacity: true
    )

    XCTAssertFalse(opaque.supportsOpacity)
    XCTAssertTrue(translucent.supportsOpacity)
  }

  @MainActor
  func testEmptyStateSupportsInlineAndStackedLayouts() {
    let inline = fittingHeight(
      FlowingEmptyState(
        "No recent items",
        systemImage: "tray",
        layout: .inline
      )
      .frame(width: 240)
    )
    let stacked = fittingHeight(
      FlowingEmptyState(
        "No recent items",
        systemImage: "tray",
        layout: .stacked
      )
      .frame(width: 240)
    )

    XCTAssertGreaterThan(inline, 0)
    XCTAssertGreaterThan(stacked, inline)
  }

  @MainActor
  func testInlineEmptyStateKeepsWrappedContentVisible() {
    let short = fittingHeight(
      FlowingEmptyState("No items", layout: .inline)
        .frame(width: 120)
    )
    let wrapped = fittingHeight(
      FlowingEmptyState(
        "No items match the current set of filters",
        layout: .inline
      )
      .frame(width: 120)
    )

    XCTAssertGreaterThan(wrapped, short)
  }

  func testConnectedSegmentedControlUsesAHairlineSelectionBorder() {
    XCTAssertEqual(FlowingConnectedSegmentedControlMetrics.selectedBorderWidth, 1)
  }

  func testSegmentOptionUsesItsValueAsStableIdentity() {
    let option = FlowingSegmentOption(
      "medium",
      label: "Medium",
      systemImage: "circle"
    )

    XCTAssertEqual(option.id, "medium")
    XCTAssertEqual(option.value, "medium")
    XCTAssertEqual(option.label, "Medium")
    XCTAssertEqual(option.systemImage, "circle")
  }

  @MainActor
  func testTextAndSymbolSegmentedControlsComposeOutsidePreferencesRows() {
    let text = FlowingSegmentedControl(
      label: "Size",
      selection: .constant("medium"),
      options: [
        FlowingSegmentOption("small", label: "Small"),
        FlowingSegmentOption("medium", label: "Medium"),
      ]
    )
    let symbols = FlowingSegmentedControl(
      label: "Mode",
      selection: .constant("list"),
      options: [
        FlowingSegmentOption("list", label: "List", systemImage: "list.bullet"),
        FlowingSegmentOption("grid", label: "Grid", systemImage: "square.grid.2x2"),
      ]
    )

    XCTAssertGreaterThan(fittingHeight(text.frame(width: 220)), 20)
    XCTAssertGreaterThan(fittingHeight(symbols.frame(width: 220)), 20)
  }

  func testSegmentNavigationWrapsInBothDirections() {
    let values = ["first", "second", "third"]

    XCTAssertEqual(
      FlowingSegmentedControlNavigation.destination(
        in: values,
        from: "third",
        offset: 1
      ),
      "first"
    )
    XCTAssertEqual(
      FlowingSegmentedControlNavigation.destination(
        in: values,
        from: "first",
        offset: -1
      ),
      "third"
    )
  }

  func testSegmentNavigationStartsAtBoundaryForUnknownSelection() {
    XCTAssertEqual(
      FlowingSegmentedControlNavigation.destination(
        in: ["first", "second", "third"],
        from: "unknown",
        offset: 1
      ),
      "first"
    )
    XCTAssertEqual(
      FlowingSegmentedControlNavigation.destination(
        in: ["first", "second", "third"],
        from: "unknown",
        offset: -1
      ),
      "third"
    )
  }

  func testTabOptionUsesItsValueAsStableIdentity() {
    let option = FlowingTabOption(
      "components",
      label: "Components",
      systemImage: "square.grid.2x2",
      isEnabled: false
    )

    XCTAssertEqual(option.id, "components")
    XCTAssertEqual(option.value, "components")
    XCTAssertEqual(option.label, "Components")
    XCTAssertEqual(option.systemImage, "square.grid.2x2")
    XCTAssertFalse(option.isEnabled)
  }

  func testTabNavigationSkipsDisabledOptionsAndWraps() {
    let options = [
      FlowingTabOption("overview", label: "Overview"),
      FlowingTabOption("components", label: "Components", isEnabled: false),
      FlowingTabOption("accessibility", label: "Accessibility"),
    ]

    XCTAssertEqual(
      FlowingTabsNavigation.destination(in: options, from: "overview", offset: 1),
      "accessibility"
    )
    XCTAssertEqual(
      FlowingTabsNavigation.destination(in: options, from: "accessibility", offset: 1),
      "overview"
    )
    XCTAssertEqual(
      FlowingTabsNavigation.destination(in: options, from: "overview", offset: -1),
      "accessibility"
    )
  }

  func testTabNavigationReturnsNilWhenNoOptionIsEnabled() {
    let options = [
      FlowingTabOption("overview", label: "Overview", isEnabled: false),
      FlowingTabOption("components", label: "Components", isEnabled: false),
    ]

    XCTAssertNil(
      FlowingTabsNavigation.destination(in: options, from: "overview", offset: 1)
    )
  }

  func testTabLayoutResolvesEqualAndContentSizedWidths() {
    XCTAssertEqual(
      FlowingTabsLayoutMetrics.widths(
        idealWidths: [40, 60],
        spacing: 4,
        sizing: .equal,
        availableWidth: nil
      ),
      [60, 60]
    )
    XCTAssertEqual(
      FlowingTabsLayoutMetrics.widths(
        idealWidths: [40, 60],
        spacing: 4,
        sizing: .equal,
        availableWidth: 100
      ),
      [48, 48]
    )
    XCTAssertEqual(
      FlowingTabsLayoutMetrics.widths(
        idealWidths: [40, 60],
        spacing: 4,
        sizing: .fitContent,
        availableWidth: 200
      ),
      [40, 60]
    )
    XCTAssertEqual(
      FlowingTabsLayoutMetrics.widths(
        idealWidths: [40, 60],
        spacing: 4,
        sizing: .fitContent,
        availableWidth: 54
      ),
      [20, 30]
    )
  }

  func testTabLayoutNormalizesInvalidIdealWidths() {
    XCTAssertEqual(
      FlowingTabsLayoutMetrics.widths(
        idealWidths: [.nan, -20, 40],
        spacing: 4,
        sizing: .equal,
        availableWidth: nil
      ),
      [40, 40, 40]
    )
  }

  func testTabAlignmentsUseSemanticFrameGuides() {
    XCTAssertEqual(FlowingTabsAlignment.leading.frameAlignment, .leading)
    XCTAssertEqual(FlowingTabsAlignment.center.frameAlignment, .center)
    XCTAssertEqual(FlowingTabsAlignment.trailing.frameAlignment, .trailing)
  }

  func testConfirmationKindsPreserveSystemSemantics() {
    XCTAssertNil(FlowingConfirmationKind.confirmation.buttonRole)
    XCTAssertEqual(FlowingConfirmationKind.confirmation.severity, .automatic)
    XCTAssertNil(FlowingConfirmationKind.confirmation.systemImage)

    XCTAssertNil(FlowingConfirmationKind.warning.buttonRole)
    XCTAssertEqual(FlowingConfirmationKind.warning.severity, .critical)
    XCTAssertEqual(FlowingConfirmationKind.warning.systemImage, "exclamationmark.triangle")

    XCTAssertEqual(FlowingConfirmationKind.destructive.buttonRole, .destructive)
    XCTAssertEqual(FlowingConfirmationKind.destructive.severity, .critical)
    XCTAssertEqual(FlowingConfirmationKind.destructive.systemImage, "trash")
  }

  @MainActor
  func testDialogComposesWithEveryToneAndActionEmphasis() {
    let content = VStack {
      ForEach(FlowingStatusTone.allCases, id: \.self) { tone in
        FlowingDialog(
          "Review Changes",
          message: "Confirm the values before continuing.",
          tone: tone
        ) {
          Text("Dialog content")
            .frame(height: 32)
        } actions: {
          FlowingDialogAction("Cancel", role: .cancel) {}
          ForEach(FlowingDialogActionEmphasis.allCases, id: \.self) { emphasis in
            FlowingDialogAction(
              emphasis.rawValue.capitalized,
              role: tone == .critical ? .destructive : nil,
              emphasis: emphasis
            ) {}
          }
        }
      }
    }

    XCTAssertGreaterThan(fittingHeight(content), 900)
  }

  @MainActor
  func testDialogUsesAComfortableIntrinsicWidth() {
    let width = fittingWidth(
      FlowingDialog("Edit Details") {
        Text("Content")
      } actions: {
        FlowingDialogAction("Done", emphasis: .prominent) {}
      }
    )

    XCTAssertGreaterThanOrEqual(width, 380)
    XCTAssertLessThanOrEqual(width, 560)
  }

  @MainActor
  func testConfirmationModifierComposesWithoutReplacingItsHost() {
    let height = fittingHeight(
      Button("Remove") {}
        .flowingConfirmationDialog(
          "Remove this item?",
          message: "This action cannot be undone.",
          isPresented: .constant(false),
          confirmationTitle: "Remove",
          kind: .destructive
        ) {}
    )

    XCTAssertGreaterThan(height, 0)
  }

  func testTooltipUsesADeliberateDefaultDelay() {
    XCTAssertEqual(FlowingTooltipDefaults.delay, 0.65)
  }

  @MainActor
  func testTooltipAndPopoverComposeAroundArbitraryContent() {
    let tooltipHeight = fittingHeight(
      FlowingTooltipContent(
        "Keeps this item visible in the sidebar.",
        title: "Pin",
        systemImage: "pin"
      )
      .frame(width: 240)
    )
    let triggerHeight = fittingHeight(
      FlowingPopover(
        isPresented: .constant(false),
        accessibilityLabel: "Show details"
      ) {
        Label("Details", systemImage: "info.circle")
      } content: {
        VStack(alignment: .leading) {
          Text("Details")
          FlowingSwitch("Enabled", isOn: .constant(true))
        }
      }
      .buttonStyle(FlowingSoftButtonStyle())
      .flowingTooltip("Shows more information") {
        FlowingTooltipContent("Shows more information")
      }
    )

    XCTAssertGreaterThan(tooltipHeight, 30)
    XCTAssertGreaterThan(triggerHeight, 20)
  }

  @MainActor
  func testTabsComposeAcrossEveryPublicPresentationAxis() {
    let options = [
      FlowingTabOption("overview", label: "Overview", systemImage: "sparkles"),
      FlowingTabOption("components", label: "Components", systemImage: "square.grid.2x2"),
      FlowingTabOption("accessibility", label: "Accessibility", systemImage: "accessibility"),
    ]

    for style in FlowingTabsStyle.allCases {
      for sizing in FlowingTabsSizing.allCases {
        for overflow in FlowingTabsOverflowBehavior.allCases {
          for labelContent in FlowingTabLabelContent.allCases {
            for stripAlignment in FlowingTabsAlignment.allCases {
              for itemAlignment in FlowingTabsAlignment.allCases {
                let height = fittingHeight(
                  FlowingTabs(
                    label: "Library areas",
                    selection: .constant("overview"),
                    options: options,
                    style: style,
                    sizing: sizing,
                    overflowBehavior: overflow,
                    labelContent: labelContent,
                    stripAlignment: stripAlignment,
                    itemAlignment: itemAlignment
                  )
                  .frame(width: 320)
                )
                XCTAssertGreaterThan(height, 20)
                XCTAssertLessThan(height, 60)
              }
            }
          }
        }
      }
    }
  }

  func testRadioOptionUsesItsValueAsStableIdentity() {
    let option = FlowingRadioOption(
      "balanced",
      label: "Balanced",
      systemImage: "circle.lefthalf.filled",
      isEnabled: false
    )

    XCTAssertEqual(option.id, "balanced")
    XCTAssertEqual(option.value, "balanced")
    XCTAssertEqual(option.label, "Balanced")
    XCTAssertEqual(option.systemImage, "circle.lefthalf.filled")
    XCTAssertFalse(option.isEnabled)
  }

  func testRadioNavigationWrapsAcrossAvailableValues() {
    let values = ["quiet", "balanced", "vivid"]

    XCTAssertEqual(
      FlowingRadioNavigation.destination(in: values, from: "vivid", offset: 1),
      "quiet"
    )
    XCTAssertEqual(
      FlowingRadioNavigation.destination(in: values, from: "quiet", offset: -1),
      "vivid"
    )
    XCTAssertEqual(
      FlowingRadioNavigation.destination(in: values, from: "missing", offset: 1),
      "quiet"
    )
  }

  @MainActor
  func testRadioAndRadioGroupComposeOnBothAxes() {
    let options = [
      FlowingRadioOption("quiet", label: "Quiet", systemImage: "moon"),
      FlowingRadioOption("balanced", label: "Balanced"),
      FlowingRadioOption("vivid", label: "Vivid", isEnabled: false),
    ]
    let content = VStack {
      FlowingRadio("Standalone", isSelected: true) {}
      FlowingRadioGroup(
        label: "Horizontal",
        selection: .constant("balanced"),
        options: options,
        axis: .horizontal
      )
      FlowingRadioGroup(
        label: "Vertical",
        selection: .constant("quiet"),
        options: options,
        axis: .vertical
      )
    }
    .frame(width: 320)

    XCTAssertGreaterThan(fittingHeight(content), 100)
  }

  func testStepperMathClampsIntegersAtBothBounds() {
    XCTAssertEqual(FlowingStepperMath.increment(3, in: 1...8, step: 2), 5)
    XCTAssertEqual(FlowingStepperMath.increment(7, in: 1...8, step: 2), 8)
    XCTAssertEqual(FlowingStepperMath.increment(8, in: 1...8, step: 2), 8)
    XCTAssertEqual(FlowingStepperMath.decrement(4, in: 1...8, step: 2), 2)
    XCTAssertEqual(FlowingStepperMath.decrement(2, in: 1...8, step: 2), 1)
    XCTAssertEqual(FlowingStepperMath.decrement(1, in: 1...8, step: 2), 1)
  }

  func testStepperMathSupportsFractionalValues() {
    XCTAssertEqual(
      FlowingStepperMath.increment(0.75, in: 0.0...1.0, step: 0.5),
      1,
      accuracy: 0.000_1
    )
    XCTAssertEqual(
      FlowingStepperMath.decrement(0.25, in: 0.0...1.0, step: 0.5),
      0,
      accuracy: 0.000_1
    )
  }

  @MainActor
  func testStepperComposesWithFormattedValue() {
    let height = fittingHeight(
      FlowingStepper(
        "Preview count",
        value: .constant(3),
        in: 1...8,
        step: 1
      ) { "\($0) previews" }
    )

    XCTAssertEqual(height, FlowingStepperMetrics.controlHeight, accuracy: 0.5)
  }

  @MainActor
  func testSeparatorsPreserveTheirRequestedThickness() {
    let horizontal = fittingHeight(
      FlowingSeparator(thickness: 2)
        .frame(width: 120)
    )
    let vertical = fittingWidth(
      FlowingSeparator(axis: .vertical, thickness: 3)
        .frame(height: 40)
    )

    XCTAssertEqual(horizontal, 2, accuracy: 0.5)
    XCTAssertEqual(vertical, 3, accuracy: 0.5)
  }

  @MainActor
  func testBadgesComposeForEveryToneAndEmphasis() {
    let content = VStack {
      ForEach(FlowingStatusTone.allCases, id: \.self) { tone in
        HStack {
          FlowingBadge("Status", tone: tone)
          FlowingBadge(
            "Status",
            systemImage: "circle.fill",
            tone: tone,
            emphasis: .strong
          )
        }
      }
    }

    XCTAssertGreaterThan(fittingHeight(content), 120)
  }

  @MainActor
  func testCalloutSupportsInlineAndCardPresentations() {
    let inline = fittingHeight(
      FlowingCallout(
        "A short message",
        title: "Status",
        tone: .success,
        presentation: .inline
      )
      .frame(width: 280)
    )
    let card = fittingHeight(
      FlowingCallout(
        "A short message",
        title: "Status",
        tone: .success,
        presentation: .card
      )
      .frame(width: 280)
    )

    XCTAssertGreaterThan(inline, 0)
    XCTAssertGreaterThan(card, inline)
  }

  @MainActor
  func testCalloutAcceptsCustomContent() {
    let height = fittingHeight(
      FlowingCallout(title: "Custom", tone: .accent) {
        HStack {
          Text("Message")
          FlowingBadge("New", tone: .accent)
        }
      }
      .frame(width: 280)
    )

    XCTAssertGreaterThan(height, 40)
  }

  @MainActor
  func testActionMenuHonorsItsMinimumWidth() {
    let width = fittingWidth(
      FlowingMenu("Actions", systemImage: "ellipsis", minimumWidth: 160) {
        Button("Duplicate") {}
        Divider()
        Button("Remove", role: .destructive) {}
      }
    )

    XCTAssertGreaterThanOrEqual(width, 160)
  }

  @MainActor
  func testConnectedSegmentedControlFitsWithoutPreferencesRow() {
    let height = fittingHeight(
      FlowingConnectedSegmentedControl(
        label: "Size",
        selection: .constant("medium"),
        options: [
          FlowingSegmentOption("small", label: "Small"),
          FlowingSegmentOption("medium", label: "Medium"),
          FlowingSegmentOption("large", label: "Large"),
        ]
      )
      .frame(width: 240)
    )

    XCTAssertGreaterThan(height, 20)
    XCTAssertLessThan(height, 40)
  }

  @MainActor
  func testWrappingGridMovesOverflowingItemsToTheNextLine() {
    let height = fittingHeight(
      FlowingWrappingGrid(items: testItems, spacing: 7) { item in
        Text(item.id)
          .frame(width: 80, height: 20)
      }
      .frame(width: 170)
    )

    XCTAssertEqual(height, 47, accuracy: 0.5)
  }

  @MainActor
  func testExtractedPillsGridAndButtonStyleComposeOutsidePreferencesRows() {
    let content = VStack {
      FlowingTag("Static")
      FlowingSelectableTag("Selected", isSelected: true) {}
      FlowingAdaptiveGrid(items: testItems, minimumWidth: 80) { item in
        FlowingChip(item.id) {}
      }
      Button("Continue") {}
        .buttonStyle(FlowingSoftButtonStyle(isProminent: true))
    }

    XCTAssertGreaterThan(fittingHeight(content.frame(width: 260)), 80)
  }

  private var testItems: [TestItem] {
    [TestItem("One"), TestItem("Two"), TestItem("Three")]
  }

  @MainActor
  private func fittingHeight<Content: View>(_ content: Content) -> CGFloat {
    let hostingView = NSHostingView(rootView: content)
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

@MainActor
private func mouseDownEvent(in window: NSWindow, location: NSPoint) -> NSEvent? {
  NSEvent.mouseEvent(
    with: .leftMouseDown,
    location: location,
    modifierFlags: [],
    timestamp: 0,
    windowNumber: window.windowNumber,
    context: nil,
    eventNumber: 0,
    clickCount: 1,
    pressure: 1
  )
}

private struct TestItem: Identifiable {
  let id: String

  init(_ id: String) {
    self.id = id
  }
}
