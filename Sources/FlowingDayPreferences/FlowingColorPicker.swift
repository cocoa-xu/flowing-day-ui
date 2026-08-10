import SwiftUI

public struct FlowingColorPicker<Label: View>: View {
  @Binding private var selection: Color
  let supportsOpacity: Bool
  private let label: Label

  public init(
    selection: Binding<Color>,
    supportsOpacity: Bool = false,
    @ViewBuilder label: () -> Label
  ) {
    _selection = selection
    self.supportsOpacity = supportsOpacity
    self.label = label()
  }

  public var body: some View {
    ColorPicker(
      selection: $selection,
      supportsOpacity: supportsOpacity
    ) {
      label
    }
    .controlSize(.small)
  }
}

extension FlowingColorPicker where Label == Text {
  public init(
    _ title: String,
    selection: Binding<Color>,
    supportsOpacity: Bool = false
  ) {
    self.init(
      selection: selection,
      supportsOpacity: supportsOpacity
    ) {
      Text(title)
    }
  }
}

extension FlowingColorPicker where Label == EmptyView {
  public init(
    selection: Binding<Color>,
    supportsOpacity: Bool = false
  ) {
    self.init(
      selection: selection,
      supportsOpacity: supportsOpacity
    ) {
      EmptyView()
    }
  }
}
