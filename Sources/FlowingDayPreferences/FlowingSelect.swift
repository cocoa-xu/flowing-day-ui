import SwiftUI

public struct FlowingSelectOption<Value: Hashable>: Identifiable {
  public let value: Value
  public let label: String
  public let accent: PreferencesAccent?
  public var id: Value { value }

  public init(_ value: Value, label: String, accent: PreferencesAccent? = nil) {
    self.value = value
    self.label = label
    self.accent = accent
  }
}

public struct FlowingSelect<Value: Hashable>: View {
  @Environment(\.preferencesAccent) private var accent
  @Environment(\.preferencesMetrics) private var metrics
  @Environment(\.preferencesStrings) private var strings
  @Environment(\.preferencesSurfaces) private var surfaces
  @Environment(\.preferencesTypography) private var typography
  @Binding private var selection: Value
  private let label: String
  private let minimumWidth: CGFloat
  private let options: [FlowingSelectOption<Value>]

  public init(
    label: String,
    selection: Binding<Value>,
    options: [FlowingSelectOption<Value>],
    minimumWidth: CGFloat = 0
  ) {
    precondition(minimumWidth >= 0 && minimumWidth.isFinite)
    precondition(Set(options.map(\.id)).count == options.count)
    self.label = label
    _selection = selection
    self.options = options
    self.minimumWidth = minimumWidth
  }

  public var body: some View {
    FlowingSelectRepresentable(
      selection: $selection,
      options: options,
      minimumWidth: minimumWidth,
      accent: accent,
      strings: strings,
      controlRadius: metrics.controlRadius,
      textStyle: typography.value,
      optionTextStyle: typography.selectionLabel,
      menuBackgroundColor: surfaces.control
    )
    .accessibilityLabel(label)
  }
}
