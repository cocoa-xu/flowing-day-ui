import AppKit
import SwiftUI

public enum SettingsPageIcon {
  case system(String)
  case application
  case image(NSImage)
  case template(NSImage)
}

public struct SettingsPage<ID: Hashable>: Identifiable {
  public let id: ID
  public let title: String
  public let subtitle: String?
  public let icon: SettingsPageIcon
  public let headerIcon: SettingsPageIcon
  public let accent: SettingsAccent?
  public let isAvailable: Bool
  let content: AnyView

  public init<Content: View>(
    id: ID,
    title: String,
    subtitle: String? = nil,
    icon: SettingsPageIcon,
    headerIcon: SettingsPageIcon? = nil,
    accent: SettingsAccent? = nil,
    isAvailable: Bool = true,
    @ViewBuilder content: () -> Content
  ) {
    self.id = id
    self.title = title
    self.subtitle = subtitle
    self.icon = icon
    self.headerIcon = headerIcon ?? icon
    self.accent = accent
    self.isAvailable = isAvailable
    self.content = AnyView(content())
  }
}

public struct SettingsPageGroup<ID: Hashable>: Identifiable {
  public let id: String
  public let title: String?
  public let pages: [SettingsPage<ID>]
  public let isIndented: Bool

  public init(
    id: String,
    title: String? = nil,
    pages: [SettingsPage<ID>],
    isIndented: Bool = false
  ) {
    self.id = id
    self.title = title
    self.pages = pages
    self.isIndented = isIndented
  }
}

public struct SettingsView<ID: Hashable>: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.settingsWindowActions) private var windowActions
  @Binding private var selection: ID
  private let configuration: SettingsViewConfiguration
  private let groups: [SettingsPageGroup<ID>]

  public init(
    selection: Binding<ID>,
    configuration: SettingsViewConfiguration,
    groups: [SettingsPageGroup<ID>]
  ) {
    _selection = selection
    self.configuration = configuration
    self.groups = groups
  }

  private var pages: [SettingsPage<ID>] {
    groups.flatMap(\.pages)
  }

  private var selectedPage: SettingsPage<ID>? {
    pages.first { $0.id == selection && $0.isAvailable }
      ?? pages.first { $0.isAvailable }
  }

  private var accent: SettingsAccent {
    selectedPage?.accent ?? configuration.defaultAccent
  }

  public var body: some View {
    HStack(spacing: 0) {
      sidebar
      Rectangle()
        .fill(SettingsPalette.hairline)
        .frame(width: 1)
      content
    }
    .background(configuration.surfaces.canvas)
    .clipShape(
      RoundedRectangle(cornerRadius: configuration.cornerRadius, style: .continuous)
    )
    .overlay {
      RoundedRectangle(cornerRadius: configuration.cornerRadius, style: .continuous)
        .strokeBorder(SettingsPalette.edge)
    }
    .tint(accent.fill)
    .environment(\.settingsAccent, accent)
    .environment(\.settingsStrings, configuration.strings)
    .environment(\.settingsMetrics, configuration.metrics)
    .environment(\.settingsTypography, configuration.typography)
    .environment(\.settingsSurfaces, configuration.surfaces)
    .animation(reduceMotion ? nil : .easeInOut(duration: SettingsMotion.page), value: selection)
    .onAppear(perform: reconcileSelection)
    .onChange(of: pages.map(\.id)) { _ in reconcileSelection() }
    .onChange(of: pages.map(\.isAvailable)) { _ in reconcileSelection() }
  }

  private var sidebar: some View {
    VStack(alignment: .leading, spacing: 0) {
      SettingsCloseButton(action: windowActions.dismiss)
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
            .foregroundStyle(SettingsPalette.ink)
          Text(configuration.settingsTitle)
            .font(configuration.typography.brandSubtitle.font)
            .foregroundStyle(SettingsPalette.faint)
        }
      }
      .padding(.horizontal, 20)
      .padding(.top, 5)
      .padding(.bottom, 22)

      ScrollView {
        VStack(alignment: .leading, spacing: 18) {
          ForEach(groups) { group in
            SettingsSidebarGroup(
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
          .foregroundStyle(SettingsPalette.faint)
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
          SettingsPageHeader(page: selectedPage, accent: accent)
          selectedPage.content
        }
      }
      .frame(maxWidth: configuration.metrics.contentWidth, alignment: .leading)
      .padding(.horizontal, 34)
      .padding(.top, 38)
      .padding(.bottom, 40)
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .background(configuration.surfaces.canvas)
  }

  private func reconcileSelection() {
    guard !pages.contains(where: { $0.id == selection && $0.isAvailable }),
      let fallback = pages.first(where: \.isAvailable)
    else { return }
    selection = fallback.id
  }
}

private struct SettingsCloseButton: View {
  let action: () -> Void
  @Environment(\.settingsStrings) private var strings
  @Environment(\.settingsSurfaces) private var surfaces
  @State private var isHovering = false

  var body: some View {
    Button(action: action) {
      Image(systemName: "xmark")
        .font(.system(size: 8, weight: .bold))
        .foregroundStyle(isHovering ? Color.black.opacity(0.55) : SettingsPalette.muted)
        .frame(width: 16, height: 16)
        .background(isHovering ? closeColor : surfaces.field, in: Circle())
        .frame(width: 24, height: 32)
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .onHover { isHovering = $0 }
    .animation(.easeOut(duration: SettingsMotion.hover), value: isHovering)
    .accessibilityLabel(strings.closeSettings)
  }

  private var closeColor: Color {
    SettingsPalette.closeHover
  }
}

private struct SettingsSidebarGroup<ID: Hashable>: View {
  let group: SettingsPageGroup<ID>
  @Binding var selection: ID
  let defaultAccent: SettingsAccent
  @Environment(\.settingsTypography) private var typography

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      if let title = group.title {
        Text(title.uppercased())
          .font(typography.sidebarGroup.font)
          .tracking(0.8)
          .foregroundStyle(SettingsPalette.faint)
          .padding(.horizontal, 8)
          .padding(.bottom, 3)
      }
      ForEach(group.pages) { page in
        SettingsSidebarRow(
          page: page,
          isSelected: page.id == selection,
          accent: page.accent ?? defaultAccent,
          isIndented: group.isIndented
        ) {
          selection = page.id
        }
      }
    }
  }
}

private struct SettingsSidebarRow<ID: Hashable>: View {
  let page: SettingsPage<ID>
  let isSelected: Bool
  let accent: SettingsAccent
  let isIndented: Bool
  let action: () -> Void
  @Environment(\.settingsTypography) private var typography
  @Environment(\.settingsSurfaces) private var surfaces

  var body: some View {
    Button(action: action) {
      HStack(spacing: 9) {
        icon
        Text(page.title)
          .font(isSelected ? typography.sidebarItemSelected.font : typography.sidebarItem.font)
          .foregroundStyle(isSelected ? SettingsPalette.ink : SettingsPalette.muted)
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
        .foregroundStyle(isSelected ? accent.foreground : SettingsPalette.muted)
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

private struct SettingsPageHeader<ID: Hashable>: View {
  let page: SettingsPage<ID>
  let accent: SettingsAccent
  @Environment(\.settingsTypography) private var typography

  var body: some View {
    HStack(spacing: 14) {
      icon
      VStack(alignment: .leading, spacing: 3) {
        Text(page.title)
          .font(typography.pageTitle.font)
          .foregroundStyle(SettingsPalette.ink)
        if let subtitle = page.subtitle {
          Text(subtitle)
            .font(typography.pageSubtitle.font)
            .foregroundStyle(SettingsPalette.muted)
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
