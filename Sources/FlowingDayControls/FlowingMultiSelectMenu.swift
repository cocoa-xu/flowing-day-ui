import SwiftUI

public struct FlowingMultiSelectMenu: View {
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingMetrics) private var metrics
  @Environment(\.flowingStrings) private var strings
  @Environment(\.flowingSurfaces) private var surfaces
  @Environment(\.flowingTypography) private var typography
  private let title: String
  private let label: String
  private let minimumWidth: CGFloat
  private let options: [FlowingMultiSelectOption]

  public init(
    _ title: String,
    label: String,
    minimumWidth: CGFloat = 0,
    options: [FlowingMultiSelectOption]
  ) {
    precondition(minimumWidth.isFinite && minimumWidth >= 0)
    precondition(Set(options.map(\.id)).count == options.count)
    self.title = title
    self.label = label
    self.minimumWidth = minimumWidth
    self.options = options
  }

  public var body: some View {
    FlowingMultiSelectMenuRepresentable(
      title: title,
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

private struct FlowingMultiSelectMenuRepresentable: NSViewRepresentable {
  let title: String
  let options: [FlowingMultiSelectOption]
  let minimumWidth: CGFloat
  let accent: FlowingAccent
  let strings: FlowingStrings
  let controlRadius: CGFloat
  let textStyle: FlowingTextStyle
  let optionTextStyle: FlowingTextStyle
  let menuBackgroundColor: Color

  func makeCoordinator() -> Coordinator {
    Coordinator(self)
  }

  func makeNSView(context: Context) -> FlowingSelectButton {
    let button = FlowingSelectButton()
    update(button, coordinator: context.coordinator)
    return button
  }

  func updateNSView(_ button: FlowingSelectButton, context: Context) {
    context.coordinator.parent = self
    update(button, coordinator: context.coordinator)
  }

  static func dismantleNSView(_ button: FlowingSelectButton, coordinator: Coordinator) {
    button.prepareForRemoval()
  }

  private func update(_ button: FlowingSelectButton, coordinator: Coordinator) {
    button.configure(
      labels: options.map(\.label),
      optionAccents: options.map(\.accent),
      selectedIndex: nil,
      selectedIndices: selectedIndices,
      optionEnabledStates: options.map(\.isEnabled),
      displayTitle: title,
      allowsMultipleSelection: true,
      minimumWidth: minimumWidth,
      accent: accent,
      strings: strings,
      controlRadius: controlRadius,
      textStyle: textStyle,
      optionTextStyle: optionTextStyle,
      menuBackgroundColor: menuBackgroundColor
    )
    button.onToggle = { coordinator.toggle(index: $0) }
  }

  private var selectedIndices: Set<Int> {
    Set(options.indices.filter { options[$0].isSelected })
  }

  final class Coordinator {
    var parent: FlowingMultiSelectMenuRepresentable

    init(_ parent: FlowingMultiSelectMenuRepresentable) {
      self.parent = parent
    }

    @MainActor
    func toggle(index: Int) -> Set<Int> {
      guard parent.options.indices.contains(index) else { return [] }
      parent.options[index].toggle()
      return Set(parent.options.indices.filter { parent.options[$0].isSelected })
    }
  }
}
