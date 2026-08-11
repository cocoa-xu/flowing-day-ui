import SwiftUI

public struct FlowingValueText: View {
  @Environment(\.flowingTypography) private var typography
  private let selectionEnabled: Bool
  private let truncationMode: Text.TruncationMode
  private let value: String

  public init(
    _ value: String,
    selectionEnabled: Bool = true,
    truncationMode: Text.TruncationMode = .middle
  ) {
    self.value = value
    self.selectionEnabled = selectionEnabled
    self.truncationMode = truncationMode
  }

  public var body: some View {
    selectableText
      .font(typography.value.font)
      .foregroundStyle(FlowingPalette.muted)
      .lineLimit(1)
      .truncationMode(truncationMode)
  }

  @ViewBuilder
  private var selectableText: some View {
    if selectionEnabled {
      Text(value).textSelection(.enabled)
    } else {
      Text(value).textSelection(.disabled)
    }
  }
}
