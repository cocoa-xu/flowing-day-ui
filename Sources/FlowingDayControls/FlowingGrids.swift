import SwiftUI

public struct FlowingWrappingGrid<Item: Identifiable, Label: View>: View {
  private let items: [Item]
  private let spacing: CGFloat
  private let label: (Item) -> Label

  public init(
    items: [Item],
    spacing: CGFloat = 7,
    @ViewBuilder label: @escaping (Item) -> Label
  ) {
    precondition(spacing >= 0 && spacing.isFinite)
    self.items = items
    self.spacing = spacing
    self.label = label
  }

  public var body: some View {
    FlowingWrappingLayout(spacing: spacing) {
      ForEach(items) { label($0) }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

public struct FlowingAdaptiveGrid<Item: Identifiable, Label: View>: View {
  private let items: [Item]
  private let minimumWidth: CGFloat
  private let spacing: CGFloat
  private let label: (Item) -> Label

  public init(
    items: [Item],
    minimumWidth: CGFloat = 96,
    spacing: CGFloat = 7,
    @ViewBuilder label: @escaping (Item) -> Label
  ) {
    precondition(minimumWidth > 0 && minimumWidth.isFinite)
    precondition(spacing >= 0 && spacing.isFinite)
    self.items = items
    self.minimumWidth = minimumWidth
    self.spacing = spacing
    self.label = label
  }

  public var body: some View {
    LazyVGrid(
      columns: [GridItem(.adaptive(minimum: minimumWidth), spacing: spacing)],
      spacing: spacing
    ) {
      ForEach(items) { label($0) }
    }
  }
}

private struct FlowingWrappingLayout: Layout {
  let spacing: CGFloat

  func sizeThatFits(
    proposal: ProposedViewSize,
    subviews: Subviews,
    cache: inout ()
  ) -> CGSize {
    layout(
      subviews: subviews,
      width: proposal.width ?? .greatestFiniteMagnitude
    ).size
  }

  func placeSubviews(
    in bounds: CGRect,
    proposal: ProposedViewSize,
    subviews: Subviews,
    cache: inout ()
  ) {
    let result = layout(subviews: subviews, width: bounds.width)
    for (index, origin) in result.origins.enumerated() {
      subviews[index].place(
        at: CGPoint(x: bounds.minX + origin.x, y: bounds.minY + origin.y),
        proposal: .unspecified
      )
    }
  }

  private func layout(
    subviews: Subviews,
    width: CGFloat
  ) -> (size: CGSize, origins: [CGPoint]) {
    var origins: [CGPoint] = []
    var x: CGFloat = 0
    var y: CGFloat = 0
    var rowHeight: CGFloat = 0
    var usedWidth: CGFloat = 0

    for subview in subviews {
      let size = subview.sizeThatFits(.unspecified)
      if x > 0, x + size.width > width {
        x = 0
        y += rowHeight + spacing
        rowHeight = 0
      }
      origins.append(CGPoint(x: x, y: y))
      x += size.width + spacing
      rowHeight = max(rowHeight, size.height)
      usedWidth = max(usedWidth, x - spacing)
    }

    return (
      CGSize(width: min(usedWidth, width), height: y + rowHeight),
      origins
    )
  }
}
