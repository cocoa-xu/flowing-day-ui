import AppKit
import FlowingDayControls
import SwiftUI

enum PreferencesRoundedScrollGeometry {
  static func indicatorInset(cornerRadius: CGFloat) -> CGFloat {
    guard cornerRadius.isFinite else { return 0 }
    return max(cornerRadius, 0) / 2
  }
}

private struct PreferencesRoundedScrollIndicatorMargins: ViewModifier {
  let cornerRadius: CGFloat

  @ViewBuilder
  func body(content: Content) -> some View {
    let inset = PreferencesRoundedScrollGeometry.indicatorInset(cornerRadius: cornerRadius)
    if #available(macOS 14.0, *) {
      content.contentMargins(.vertical, inset, for: .scrollIndicators)
    } else {
      content.padding(.vertical, inset)
    }
  }
}

public enum PreferencesPageIcon {
  case system(String)
  case application
  case image(NSImage)
  case template(NSImage)
}

public struct PreferencesPage<ID: Hashable>: Identifiable {
  public let id: ID
  public let title: String
  public let subtitle: String?
  public let icon: PreferencesPageIcon
  public let headerIcon: PreferencesPageIcon
  public let navigationAccent: FlowingAccent?
  public let accent: FlowingAccent?
  public let isAvailable: Bool
  let content: AnyView

  public init<Content: View>(
    id: ID,
    title: String,
    subtitle: String? = nil,
    icon: PreferencesPageIcon,
    headerIcon: PreferencesPageIcon? = nil,
    navigationAccent: FlowingAccent? = nil,
    accent: FlowingAccent? = nil,
    isAvailable: Bool = true,
    @ViewBuilder content: () -> Content
  ) {
    self.id = id
    self.title = title
    self.subtitle = subtitle
    self.icon = icon
    self.headerIcon = headerIcon ?? icon
    self.navigationAccent = navigationAccent
    self.accent = accent
    self.isAvailable = isAvailable
    self.content = AnyView(content())
  }
}

public struct PreferencesPageGroup<ID: Hashable>: Identifiable {
  public let id: String
  public let title: String?
  public let pages: [PreferencesPage<ID>]
  public let isIndented: Bool

  public init(
    id: String,
    title: String? = nil,
    pages: [PreferencesPage<ID>],
    isIndented: Bool = false
  ) {
    self.id = id
    self.title = title
    self.pages = pages
    self.isIndented = isIndented
  }
}

public struct PreferencesView<ID: Hashable>: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.preferencesWindowActions) private var windowActions
  @Binding private var selection: ID
  private let configuration: PreferencesViewConfiguration
  private let groups: [PreferencesPageGroup<ID>]

  public init(
    selection: Binding<ID>,
    configuration: PreferencesViewConfiguration,
    groups: [PreferencesPageGroup<ID>]
  ) {
    _selection = selection
    self.configuration = configuration
    self.groups = groups
  }

  private var pages: [PreferencesPage<ID>] {
    groups.flatMap(\.pages)
  }

  private var selectedPage: PreferencesPage<ID>? {
    pages.first { $0.id == selection && $0.isAvailable }
      ?? pages.first { $0.isAvailable }
  }

  private var accent: FlowingAccent {
    selectedPage?.accent ?? configuration.defaultAccent
  }

  public var body: some View {
    HStack(spacing: 0) {
      sidebar
      Rectangle()
        .fill(FlowingPalette.hairline)
        .frame(width: 1)
      content
    }
    .background(configuration.surfaces.controls.canvas)
    .clipShape(
      RoundedRectangle(cornerRadius: configuration.cornerRadius, style: .continuous)
    )
    .overlay {
      RoundedRectangle(cornerRadius: configuration.cornerRadius, style: .continuous)
        .strokeBorder(FlowingPalette.edge)
    }
    .tint(accent.fill)
    .environment(\.flowingAccent, accent)
    .environment(\.flowingStrings, configuration.strings.controls)
    .environment(\.flowingMetrics, configuration.metrics.controls)
    .environment(\.flowingTypography, configuration.typography.controls)
    .environment(\.flowingSurfaces, configuration.surfaces.controls)
    .environment(\.preferencesMetrics, configuration.metrics)
    .environment(\.preferencesTypography, configuration.typography)
    .animation(reduceMotion ? nil : .easeInOut(duration: FlowingMotion.page), value: selection)
    .onAppear(perform: reconcileSelection)
    .onChange(of: pages.map(\.id)) { _ in reconcileSelection() }
    .onChange(of: pages.map(\.isAvailable)) { _ in reconcileSelection() }
  }

  private var sidebar: some View {
    VStack(alignment: .leading, spacing: 0) {
      PreferencesCloseButton(
        accessibilityLabel: configuration.strings.closePreferences,
        action: windowActions.dismiss
      )
      .padding(.leading, 8)
      .padding(.top, 4)

      HStack(spacing: 11) {
        Image(nsImage: configuration.applicationIcon ?? NSApp.applicationIconImage)
          .resizable()
          .scaledToFit()
          .frame(width: 32, height: 32)
        VStack(alignment: .leading, spacing: 1) {
          Text(configuration.applicationName)
            .font(configuration.typography.brandTitle.font)
            .foregroundStyle(FlowingPalette.ink)
          Text(configuration.preferencesTitle)
            .font(configuration.typography.brandSubtitle.font)
            .foregroundStyle(FlowingPalette.faint)
        }
      }
      .padding(.horizontal, 20)
      .padding(.top, 5)
      .padding(.bottom, 22)

      ScrollView {
        VStack(alignment: .leading, spacing: 18) {
          ForEach(groups) { group in
            PreferencesSidebarGroup(
              group: group,
              selection: $selection,
              defaultAccent: configuration.defaultAccent
            )
          }
        }
        .padding(.horizontal, 12)
      }
      .scrollIndicators(.never)

      Spacer(minLength: 14)
      if let footer = configuration.sidebarFooter {
        Text(footer)
          .font(configuration.typography.brandSubtitle.font)
          .foregroundStyle(FlowingPalette.faint)
          .padding(.horizontal, 20)
          .padding(.bottom, 18)
      }
    }
    .frame(width: configuration.sidebarWidth)
    .background(configuration.surfaces.sidebar)
  }

  private var content: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 28) {
        if let selectedPage {
          PreferencesPageHeader(page: selectedPage, accent: accent)
          selectedPage.content
        }
      }
      .frame(maxWidth: contentMaximumWidth, alignment: .leading)
      .padding(.horizontal, 34)
      .padding(.top, 38)
      .padding(.bottom, 40)
      .frame(maxWidth: .infinity, alignment: .center)
    }
    .modifier(
      PreferencesRoundedScrollIndicatorMargins(cornerRadius: configuration.cornerRadius)
    )
    .background(configuration.surfaces.controls.canvas)
  }

  private var contentMaximumWidth: CGFloat {
    configuration.contentWidthPolicy.resolvedMaximumWidth(
      defaultWidth: configuration.metrics.contentWidth
    ) ?? .infinity
  }

  private func reconcileSelection() {
    guard !pages.contains(where: { $0.id == selection && $0.isAvailable }),
      let fallback = pages.first(where: \.isAvailable)
    else { return }
    selection = fallback.id
  }
}

private struct PreferencesCloseButton: View {
  let accessibilityLabel: String
  let action: () -> Void
  @Environment(\.flowingSurfaces) private var surfaces
  @State private var isHovering = false

  var body: some View {
    Button(action: action) {
      Image(systemName: "xmark")
        .font(.system(size: 8, weight: .bold))
        .foregroundStyle(isHovering ? Color.black.opacity(0.55) : FlowingPalette.muted)
        .frame(width: 16, height: 16)
        .background(isHovering ? closeColor : surfaces.field, in: Circle())
        .frame(width: 24, height: 32)
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .onHover { isHovering = $0 }
    .animation(.easeOut(duration: FlowingMotion.hover), value: isHovering)
    .accessibilityLabel(accessibilityLabel)
  }

  private var closeColor: Color {
    PreferencesPalette.closeHover
  }
}

private struct PreferencesSidebarGroup<ID: Hashable>: View {
  let group: PreferencesPageGroup<ID>
  @Binding var selection: ID
  let defaultAccent: FlowingAccent
  @Environment(\.preferencesTypography) private var typography

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      if let title = group.title {
        Text(title.uppercased())
          .font(typography.sidebarGroup.font)
          .tracking(0.8)
          .foregroundStyle(FlowingPalette.faint)
          .padding(.horizontal, 8)
          .padding(.bottom, 3)
      }
      ForEach(group.pages) { page in
        PreferencesSidebarRow(
          page: page,
          isSelected: page.id == selection,
          accent: PreferencesSidebarAccentResolver.resolve(
            navigationAccent: page.navigationAccent,
            pageAccent: page.accent,
            defaultAccent: defaultAccent
          ),
          isIndented: group.isIndented
        ) {
          selection = page.id
        }
      }
    }
  }
}

enum PreferencesSidebarAccentResolver {
  static func resolve(
    navigationAccent: FlowingAccent?,
    pageAccent: FlowingAccent?,
    defaultAccent: FlowingAccent
  ) -> FlowingAccent {
    navigationAccent ?? pageAccent ?? defaultAccent
  }
}

private struct PreferencesSidebarRow<ID: Hashable>: View {
  let page: PreferencesPage<ID>
  let isSelected: Bool
  let accent: FlowingAccent
  let isIndented: Bool
  let action: () -> Void
  @Environment(\.preferencesTypography) private var typography
  @Environment(\.flowingSurfaces) private var surfaces

  var body: some View {
    Button(action: action) {
      HStack(spacing: 9) {
        icon
        Text(page.title)
          .font(isSelected ? typography.sidebarItemSelected.font : typography.sidebarItem.font)
          .foregroundStyle(isSelected ? FlowingPalette.ink : FlowingPalette.muted)
        Spacer(minLength: 0)
      }
      .padding(.leading, isIndented ? 10 : 0)
      .padding(.horizontal, 10)
      .padding(.vertical, 8)
      .background {
        if isSelected {
          ZStack {
            surfaces.control
            accent.wash
          }
          .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
      }
      .opacity(page.isAvailable ? 1 : 0.45)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .disabled(!page.isAvailable)
  }

  @ViewBuilder
  private var icon: some View {
    switch page.icon {
    case .system(let symbol):
      Image(systemName: symbol)
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(isSelected ? accent.foreground : FlowingPalette.muted)
        .frame(width: 18)
    case .application:
      Image(nsImage: NSApp.applicationIconImage)
        .resizable()
        .scaledToFit()
        .frame(width: 18, height: 18)
    case .image(let image):
      Image(nsImage: image)
        .resizable()
        .scaledToFit()
        .frame(width: 18, height: 18)
    case .template(let image):
      Image(nsImage: image)
        .renderingMode(.template)
        .resizable()
        .scaledToFit()
        .foregroundStyle(accent.foreground)
        .frame(width: 18, height: 18)
    }
  }
}

private struct PreferencesPageHeader<ID: Hashable>: View {
  let page: PreferencesPage<ID>
  let accent: FlowingAccent
  @Environment(\.preferencesTypography) private var typography

  var body: some View {
    HStack(spacing: 14) {
      icon
      VStack(alignment: .leading, spacing: 3) {
        Text(page.title)
          .font(typography.pageTitle.font)
          .foregroundStyle(FlowingPalette.ink)
        if let subtitle = page.subtitle {
          Text(subtitle)
            .font(typography.pageSubtitle.font)
            .foregroundStyle(FlowingPalette.muted)
            .lineLimit(2)
        }
      }
    }
  }

  @ViewBuilder
  private var icon: some View {
    switch page.headerIcon {
    case .system(let symbol):
      Image(systemName: symbol)
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(accent.foreground)
        .frame(width: 38, height: 38)
        .background(
          accent.wash,
          in: RoundedRectangle(cornerRadius: 11, style: .continuous)
        )
    case .application:
      Image(nsImage: NSApp.applicationIconImage)
        .resizable()
        .interpolation(.high)
        .frame(width: 38, height: 38)
    case .image(let image):
      Image(nsImage: image)
        .resizable()
        .scaledToFit()
        .frame(width: 38, height: 38)
    case .template(let image):
      Image(nsImage: image)
        .renderingMode(.template)
        .resizable()
        .scaledToFit()
        .foregroundStyle(accent.foreground)
        .frame(width: 18, height: 18)
        .frame(width: 38, height: 38)
        .background(
          accent.wash,
          in: RoundedRectangle(cornerRadius: 11, style: .continuous)
        )
    }
  }
}
