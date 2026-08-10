import SwiftUI

public struct FlowingCard<Content: View>: View {
  @Environment(\.preferencesMetrics) private var metrics
  @Environment(\.preferencesSurfaces) private var surfaces
  private let alignment: HorizontalAlignment
  private let content: Content
  private let contentInsets: EdgeInsets
  private let spacing: CGFloat

  public init(
    alignment: HorizontalAlignment = .leading,
    spacing: CGFloat = 0,
    contentInsets: EdgeInsets = EdgeInsets(),
    @ViewBuilder content: () -> Content
  ) {
    self.alignment = alignment
    self.spacing = spacing
    self.contentInsets = contentInsets
    self.content = content()
  }

  public var body: some View {
    VStack(alignment: alignment, spacing: spacing) {
      content
    }
    .padding(contentInsets)
    .frame(maxWidth: .infinity, alignment: Alignment(horizontal: alignment, vertical: .center))
    .background(surfaces.card)
    .clipShape(shape)
    .overlay {
      shape.strokeBorder(PreferencesPalette.edge)
    }
  }

  private var shape: RoundedRectangle {
    RoundedRectangle(cornerRadius: metrics.cardRadius, style: .continuous)
  }
}

public struct FlowingSection<Content: View>: View {
  @Environment(\.preferencesMetrics) private var metrics
  @Environment(\.preferencesTypography) private var typography
  private let content: Content
  private let contentInsets: EdgeInsets
  private let footer: String?
  private let title: String

  public init(
    _ title: String,
    footer: String? = nil,
    contentInsets: EdgeInsets = EdgeInsets(),
    @ViewBuilder content: () -> Content
  ) {
    self.title = title
    self.footer = footer
    self.contentInsets = contentInsets
    self.content = content()
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(title.uppercased())
        .font(typography.sectionHeader.font)
        .tracking(0.7)
        .foregroundStyle(PreferencesPalette.faint)
        .padding(.leading, 4)
        .padding(.bottom, 7)
      FlowingCard(contentInsets: contentInsets) {
        content
      }
      if let footer {
        Text(footer)
          .font(typography.rowCaption.font)
          .foregroundStyle(PreferencesPalette.faint)
          .fixedSize(horizontal: false, vertical: true)
          .padding(.horizontal, metrics.rowInset)
          .padding(.top, 7)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}
