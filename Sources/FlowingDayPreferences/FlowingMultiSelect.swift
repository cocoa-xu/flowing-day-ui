import SwiftUI

public enum FlowingMultiSelectItemWidthPolicy: Equatable, Sendable {
  case equal
  case fitContent(maximumWidth: CGFloat? = nil)

  var checkboxWidthPolicy: FlowingCheckboxWidthPolicy {
    switch self {
    case .equal:
      .fill
    case .fitContent(let maximumWidth):
      .fitContent(maximumWidth: maximumWidth)
    }
  }
}

public struct FlowingMultiSelectOption: Identifiable {
  public let id: String
  public let label: String
  public let systemImage: String?
  public let accent: PreferencesAccent?
  public let isEnabled: Bool
  let isOn: Binding<Bool>

  public init(
    _ label: String,
    systemImage: String? = nil,
    accent: PreferencesAccent? = nil,
    id: String? = nil,
    isOn: Binding<Bool>,
    isEnabled: Bool = true
  ) {
    self.id = id ?? label
    self.label = label
    self.systemImage = systemImage
    self.accent = accent
    self.isOn = isOn
    self.isEnabled = isEnabled
  }

  var isSelected: Bool {
    isOn.wrappedValue
  }

  func toggle() {
    guard isEnabled else { return }
    isOn.wrappedValue.toggle()
  }
}

public struct FlowingMultiSelect: View {
  let axis: Axis
  let itemWidthPolicy: FlowingMultiSelectItemWidthPolicy
  let contentAlignment: FlowingCheckboxContentAlignment
  let indicatorPlacement: FlowingCheckboxIndicatorPlacement
  let spacing: CGFloat
  let truncationMode: Text.TruncationMode
  private let options: [FlowingMultiSelectOption]

  public init(
    axis: Axis = .horizontal,
    itemWidthPolicy: FlowingMultiSelectItemWidthPolicy = .equal,
    contentAlignment: FlowingCheckboxContentAlignment = .center,
    indicatorPlacement: FlowingCheckboxIndicatorPlacement = .leading,
    spacing: CGFloat = 6,
    truncationMode: Text.TruncationMode = .tail,
    options: [FlowingMultiSelectOption]
  ) {
    self.axis = axis
    self.itemWidthPolicy = itemWidthPolicy
    self.contentAlignment = contentAlignment
    self.indicatorPlacement = indicatorPlacement
    self.spacing = spacing
    self.truncationMode = truncationMode
    self.options = options
  }

  public var body: some View {
    layout {
      ForEach(options) { option in
        checkbox(for: option)
      }
    }
    .accessibilityElement(children: .contain)
  }

  @ViewBuilder
  private func checkbox(for option: FlowingMultiSelectOption) -> some View {
    if let systemImage = option.systemImage {
      FlowingCheckbox(
        option.label,
        systemImage: systemImage,
        isOn: option.isOn,
        accent: option.accent,
        contentAlignment: contentAlignment,
        indicatorPlacement: indicatorPlacement,
        widthPolicy: itemWidthPolicy.checkboxWidthPolicy,
        truncationMode: truncationMode
      )
      .disabled(!option.isEnabled)
    } else {
      FlowingCheckbox(
        option.label,
        isOn: option.isOn,
        accent: option.accent,
        contentAlignment: contentAlignment,
        indicatorPlacement: indicatorPlacement,
        widthPolicy: itemWidthPolicy.checkboxWidthPolicy,
        truncationMode: truncationMode
      )
      .disabled(!option.isEnabled)
    }
  }

  private var layout: AnyLayout {
    switch axis {
    case .horizontal:
      AnyLayout(HStackLayout(spacing: spacing))
    case .vertical:
      AnyLayout(
        VStackLayout(
          alignment: contentAlignment.horizontalAlignment,
          spacing: spacing
        )
      )
    }
  }
}
