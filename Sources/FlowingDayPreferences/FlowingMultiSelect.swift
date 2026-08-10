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
  public let isEnabled: Bool
  let isOn: Binding<Bool>

  public init(
    _ label: String,
    id: String? = nil,
    isOn: Binding<Bool>,
    isEnabled: Bool = true
  ) {
    self.id = id ?? label
    self.label = label
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
  let spacing: CGFloat
  let truncationMode: Text.TruncationMode
  private let options: [FlowingMultiSelectOption]

  public init(
    axis: Axis = .horizontal,
    itemWidthPolicy: FlowingMultiSelectItemWidthPolicy = .equal,
    contentAlignment: FlowingCheckboxContentAlignment = .center,
    spacing: CGFloat = 6,
    truncationMode: Text.TruncationMode = .tail,
    options: [FlowingMultiSelectOption]
  ) {
    self.axis = axis
    self.itemWidthPolicy = itemWidthPolicy
    self.contentAlignment = contentAlignment
    self.spacing = spacing
    self.truncationMode = truncationMode
    self.options = options
  }

  public var body: some View {
    layout {
      ForEach(options) { option in
        FlowingCheckbox(
          option.label,
          isOn: option.isOn,
          contentAlignment: contentAlignment,
          widthPolicy: itemWidthPolicy.checkboxWidthPolicy,
          truncationMode: truncationMode
        )
        .disabled(!option.isEnabled)
      }
    }
    .accessibilityElement(children: .contain)
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
