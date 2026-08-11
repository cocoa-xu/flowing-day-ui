import SwiftUI

enum FlowingConnectedSegmentedControlMetrics {
  static let horizontalInset: CGFloat = 9
  static let verticalInset: CGFloat = 6
  static let containerInset: CGFloat = 2
  static let dividerHeight: CGFloat = 14
  static let selectedBorderWidth: CGFloat = 1
  static let disabledOpacity = 0.42
}

public struct FlowingConnectedSegmentedControl<Value: Hashable>: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.layoutDirection) private var layoutDirection
  @Environment(\.flowingMetrics) private var metrics
  @Environment(\.flowingSurfaces) private var surfaces
  @FocusState private var hasKeyboardFocus: Bool
  @Namespace private var selectionNamespace
  private let label: String
  @Binding private var selection: Value
  private let options: [FlowingSegmentOption<Value>]

  public init(
    label: String,
    selection: Binding<Value>,
    options: [FlowingSegmentOption<Value>]
  ) {
    precondition(!options.isEmpty)
    precondition(Set(options.map(\.id)).count == options.count)
    self.label = label
    _selection = selection
    self.options = options
  }

  public var body: some View {
    HStack(spacing: 0) {
      ForEach(Array(options.enumerated()), id: \.element.id) { index, option in
        FlowingConnectedSegmentButton(
          option: option,
          isSelected: selection == option.value,
          selectionNamespace: selectionNamespace
        ) {
          selection = option.value
          hasKeyboardFocus = true
        }
        .overlay(alignment: .trailing) {
          if index < options.index(before: options.endIndex) {
            Rectangle()
              .fill(FlowingPalette.hairline)
              .frame(width: 1, height: FlowingConnectedSegmentedControlMetrics.dividerHeight)
              .opacity(showsDivider(after: index) ? 1 : 0)
          }
        }
      }
    }
    .frame(maxWidth: .infinity)
    .padding(FlowingConnectedSegmentedControlMetrics.containerInset)
    .background(surfaces.control, in: containerShape)
    .overlay {
      containerShape.strokeBorder(FlowingPalette.hairline)
    }
    .opacity(isEnabled ? 1 : FlowingConnectedSegmentedControlMetrics.disabledOpacity)
    .focusable()
    .modifier(FlowingFocusEffectDisabledModifier())
    .focused($hasKeyboardFocus)
    .onMoveCommand(perform: moveSelection)
    .accessibilityElement(children: .contain)
    .accessibilityLabel(label)
    .accessibilityAdjustableAction { direction in
      switch direction {
      case .increment:
        select(offset: 1)
      case .decrement:
        select(offset: -1)
      @unknown default:
        break
      }
    }
    .animation(
      reduceMotion ? nil : .easeOut(duration: FlowingMotion.selection),
      value: selection
    )
  }

  private var containerShape: RoundedRectangle {
    RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
  }

  private func showsDivider(after index: Int) -> Bool {
    selection != options[index].value && selection != options[index + 1].value
  }

  private func moveSelection(_ direction: MoveCommandDirection) {
    let forwardOffset = layoutDirection == .leftToRight ? 1 : -1
    switch direction {
    case .left:
      select(offset: -forwardOffset)
    case .right:
      select(offset: forwardOffset)
    case .up:
      select(offset: -1)
    case .down:
      select(offset: 1)
    default:
      break
    }
  }

  private func select(offset: Int) {
    guard isEnabled,
      let destination = FlowingSegmentedControlNavigation.destination(
        in: options.map(\.value),
        from: selection,
        offset: offset
      )
    else {
      return
    }
    selection = destination
  }
}

private struct FlowingConnectedSegmentButton<Value: Hashable>: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingMetrics) private var metrics
  @Environment(\.flowingStrings) private var strings
  @Environment(\.flowingTypography) private var typography
  @State private var isHovering = false
  let option: FlowingSegmentOption<Value>
  let isSelected: Bool
  let selectionNamespace: Namespace.ID
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      ZStack {
        if isSelected {
          selectionShape
            .fill(accent.wash)
            .overlay {
              selectionShape.strokeBorder(
                accent.foreground.opacity(0.22),
                lineWidth: FlowingConnectedSegmentedControlMetrics.selectedBorderWidth
              )
            }
            .matchedGeometryEffect(id: "selection", in: selectionNamespace)
        } else if isHovering && isEnabled {
          selectionShape.fill(accent.veil)
        }
        segmentLabel
          .foregroundStyle(isSelected ? accent.foreground : FlowingPalette.muted)
          .padding(.horizontal, FlowingConnectedSegmentedControlMetrics.horizontalInset)
          .padding(.vertical, FlowingConnectedSegmentedControlMetrics.verticalInset)
          .frame(maxWidth: .infinity)
      }
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .onHover { isHovering = $0 }
    .help(option.label)
    .accessibilityLabel(option.label)
    .accessibilityValue(isSelected ? strings.selected : strings.notSelected)
    .accessibilityAddTraits(isSelected ? .isSelected : [])
    .animation(
      reduceMotion ? nil : .easeOut(duration: FlowingMotion.hover),
      value: isHovering
    )
  }

  @ViewBuilder
  private var segmentLabel: some View {
    if let systemImage = option.systemImage {
      Image(systemName: systemImage)
        .font(.system(size: 12, weight: .semibold))
    } else {
      Text(option.label)
        .font(typography.selectionLabel.font)
        .lineLimit(1)
        .minimumScaleFactor(0.72)
    }
  }

  private var selectionShape: RoundedRectangle {
    RoundedRectangle(
      cornerRadius: max(
        0,
        metrics.controlRadius - FlowingConnectedSegmentedControlMetrics.containerInset
      ),
      style: .continuous
    )
  }
}
