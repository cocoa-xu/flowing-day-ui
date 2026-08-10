import SwiftUI

public struct FlowingSeparator: View {
  private let axis: Axis
  private let color: Color
  private let thickness: CGFloat

  public init(
    axis: Axis = .horizontal,
    color: Color = PreferencesPalette.hairline,
    thickness: CGFloat = 1
  ) {
    precondition(thickness.isFinite && thickness > 0)
    self.axis = axis
    self.color = color
    self.thickness = thickness
  }

  public var body: some View {
    Rectangle()
      .fill(color)
      .frame(
        width: axis == .vertical ? thickness : nil,
        height: axis == .horizontal ? thickness : nil
      )
      .accessibilityHidden(true)
  }
}
