import AppKit
import SwiftUI

public struct SettingsAccent: Equatable, Sendable {
  public let fill: Color
  public let foreground: Color
  public let wash: Color
  public let veil: Color

  public init(
    fill: Color,
    foreground: Color,
    wash: Color? = nil,
    veil: Color? = nil
  ) {
    self.fill = fill
    self.foreground = foreground
    self.wash = wash ?? fill.opacity(0.13)
    self.veil = veil ?? fill.opacity(0.08)
  }

  public static let celadon = SettingsAccent(
    fill: SettingsPalette.dynamic(light: 0x6D9EA5, dark: 0x93C8CF),
    foreground: SettingsPalette.dynamic(light: 0x4E7B82, dark: 0x9FD1D8)
  )
}

public struct SettingsStrings: Equatable, Sendable {
  public var closeSettings: String
  public var selected: String
  public var notSelected: String
  public var expanded: String
  public var collapsed: String
  public var on: String
  public var off: String

  public init(
    closeSettings: String = "Close Settings",
    selected: String = "Selected",
    notSelected: String = "Not Selected",
    expanded: String = "Expanded",
    collapsed: String = "Collapsed",
    on: String = "On",
    off: String = "Off"
  ) {
    self.closeSettings = closeSettings
    self.selected = selected
    self.notSelected = notSelected
    self.expanded = expanded
    self.collapsed = collapsed
    self.on = on
    self.off = off
  }
}

public struct SettingsMetrics: Equatable, Sendable {
  public var cardRadius: CGFloat
  public var controlRadius: CGFloat
  public var rowInset: CGFloat
  public var contentWidth: CGFloat
  public var sectionSpacing: CGFloat

  public init(
    cardRadius: CGFloat = 14,
    controlRadius: CGFloat = 9,
    rowInset: CGFloat = 18,
    contentWidth: CGFloat = 720,
    sectionSpacing: CGFloat = 20
  ) {
    self.cardRadius = cardRadius
    self.controlRadius = controlRadius
    self.rowInset = rowInset
    self.contentWidth = contentWidth
    self.sectionSpacing = sectionSpacing
  }

  public static let standard = SettingsMetrics()
}

public enum SettingsFontWeight: String, Sendable {
  case ultraLight
  case thin
  case light
  case regular
  case medium
  case semibold
  case bold
  case heavy
  case black

  var swiftUI: Font.Weight {
    switch self {
    case .ultraLight: .ultraLight
    case .thin: .thin
    case .light: .light
    case .regular: .regular
    case .medium: .medium
    case .semibold: .semibold
    case .bold: .bold
    case .heavy: .heavy
    case .black: .black
    }
  }

  var appKit: NSFont.Weight {
    switch self {
    case .ultraLight: .ultraLight
    case .thin: .thin
    case .light: .light
    case .regular: .regular
    case .medium: .medium
    case .semibold: .semibold
    case .bold: .bold
    case .heavy: .heavy
    case .black: .black
    }
  }
}

public enum SettingsFontDesign: String, Sendable {
  case standard
  case rounded
  case serif
  case monospaced

  var swiftUI: Font.Design {
    switch self {
    case .standard: .default
    case .rounded: .rounded
    case .serif: .serif
    case .monospaced: .monospaced
    }
  }
}

public struct SettingsTextStyle: Sendable {
  public var size: CGFloat
  public var weight: SettingsFontWeight
  public var design: SettingsFontDesign
  public var usesMonospacedDigits: Bool
  public var fontName: String?

  public init(
    size: CGFloat,
    weight: SettingsFontWeight = .regular,
    design: SettingsFontDesign = .standard,
    usesMonospacedDigits: Bool = false,
    fontName: String? = nil
  ) {
    self.size = size
    self.weight = weight
    self.design = design
    self.usesMonospacedDigits = usesMonospacedDigits
    self.fontName = fontName
  }

  public var font: Font {
    let font =
      fontName.map { Font.custom($0, size: size) }
      ?? Font.system(size: size, weight: weight.swiftUI, design: design.swiftUI)
    return usesMonospacedDigits ? font.monospacedDigit() : font
  }

  @MainActor
  public var appKitFont: NSFont {
    if let fontName, let font = NSFont(name: fontName, size: size) {
      return font
    }
    if usesMonospacedDigits {
      return NSFont.monospacedDigitSystemFont(ofSize: size, weight: weight.appKit)
    }
    let font = NSFont.systemFont(ofSize: size, weight: weight.appKit)
    let systemDesign: NSFontDescriptor.SystemDesign? =
      switch design {
      case .standard: nil
      case .rounded: .rounded
      case .serif: .serif
      case .monospaced: .monospaced
      }
    guard let systemDesign,
      let descriptor = font.fontDescriptor.withDesign(systemDesign)
    else { return font }
    return NSFont(descriptor: descriptor, size: size) ?? font
  }
}

public struct SettingsTypography: Sendable {
  public var brandTitle: SettingsTextStyle
  public var brandSubtitle: SettingsTextStyle
  public var sidebarGroup: SettingsTextStyle
  public var sidebarItem: SettingsTextStyle
  public var sidebarItemSelected: SettingsTextStyle
  public var pageTitle: SettingsTextStyle
  public var pageSubtitle: SettingsTextStyle
  public var contentTitle: SettingsTextStyle
  public var body: SettingsTextStyle
  public var sectionHeader: SettingsTextStyle
  public var rowTitle: SettingsTextStyle
  public var rowCaption: SettingsTextStyle
  public var value: SettingsTextStyle
  public var sliderValue: SettingsTextStyle
  public var selectionLabel: SettingsTextStyle
  public var buttonLabel: SettingsTextStyle
  public var tag: SettingsTextStyle

  public init(
    brandTitle: SettingsTextStyle = SettingsTextStyle(
      size: 16,
      weight: .bold,
      design: .rounded
    ),
    brandSubtitle: SettingsTextStyle = SettingsTextStyle(size: 10.5, weight: .medium),
    sidebarGroup: SettingsTextStyle = SettingsTextStyle(size: 9, weight: .semibold),
    sidebarItem: SettingsTextStyle = SettingsTextStyle(size: 12.5),
    sidebarItemSelected: SettingsTextStyle = SettingsTextStyle(size: 12.5, weight: .semibold),
    pageTitle: SettingsTextStyle = SettingsTextStyle(
      size: 25,
      weight: .semibold,
      design: .rounded
    ),
    pageSubtitle: SettingsTextStyle = SettingsTextStyle(size: 11.5),
    contentTitle: SettingsTextStyle = SettingsTextStyle(size: 21, weight: .semibold),
    body: SettingsTextStyle = SettingsTextStyle(size: 12),
    sectionHeader: SettingsTextStyle = SettingsTextStyle(size: 10.5, weight: .semibold),
    rowTitle: SettingsTextStyle = SettingsTextStyle(size: 13),
    rowCaption: SettingsTextStyle = SettingsTextStyle(size: 11),
    value: SettingsTextStyle = SettingsTextStyle(size: 12.5),
    sliderValue: SettingsTextStyle = SettingsTextStyle(
      size: 11.5,
      usesMonospacedDigits: true
    ),
    selectionLabel: SettingsTextStyle = SettingsTextStyle(size: 11.5, weight: .medium),
    buttonLabel: SettingsTextStyle = SettingsTextStyle(size: 12.5, weight: .medium),
    tag: SettingsTextStyle = SettingsTextStyle(size: 11, design: .monospaced)
  ) {
    self.brandTitle = brandTitle
    self.brandSubtitle = brandSubtitle
    self.sidebarGroup = sidebarGroup
    self.sidebarItem = sidebarItem
    self.sidebarItemSelected = sidebarItemSelected
    self.pageTitle = pageTitle
    self.pageSubtitle = pageSubtitle
    self.contentTitle = contentTitle
    self.body = body
    self.sectionHeader = sectionHeader
    self.rowTitle = rowTitle
    self.rowCaption = rowCaption
    self.value = value
    self.sliderValue = sliderValue
    self.selectionLabel = selectionLabel
    self.buttonLabel = buttonLabel
    self.tag = tag
  }

  public static let standard = SettingsTypography()
}

public struct SettingsSurfaces: Equatable, Sendable {
  public var canvas: Color
  public var sidebar: Color
  public var card: Color
  public var control: Color
  public var field: Color

  public init(
    canvas: Color = SettingsPalette.canvas,
    sidebar: Color = SettingsPalette.card,
    card: Color = SettingsPalette.control,
    control: Color = SettingsPalette.control,
    field: Color = SettingsPalette.field
  ) {
    self.canvas = canvas
    self.sidebar = sidebar
    self.card = card
    self.control = control
    self.field = field
  }

  public static let standard = SettingsSurfaces()
}

private struct SettingsAccentKey: EnvironmentKey {
  static let defaultValue = SettingsAccent.celadon
}

private struct SettingsStringsKey: EnvironmentKey {
  static let defaultValue = SettingsStrings()
}

private struct SettingsMetricsKey: EnvironmentKey {
  static let defaultValue = SettingsMetrics.standard
}

private struct SettingsTypographyKey: EnvironmentKey {
  static let defaultValue = SettingsTypography.standard
}

private struct SettingsSurfacesKey: EnvironmentKey {
  static let defaultValue = SettingsSurfaces.standard
}

extension EnvironmentValues {
  public var settingsAccent: SettingsAccent {
    get { self[SettingsAccentKey.self] }
    set { self[SettingsAccentKey.self] = newValue }
  }

  public var settingsStrings: SettingsStrings {
    get { self[SettingsStringsKey.self] }
    set { self[SettingsStringsKey.self] = newValue }
  }

  public var settingsMetrics: SettingsMetrics {
    get { self[SettingsMetricsKey.self] }
    set { self[SettingsMetricsKey.self] = newValue }
  }

  public var settingsTypography: SettingsTypography {
    get { self[SettingsTypographyKey.self] }
    set { self[SettingsTypographyKey.self] = newValue }
  }

  public var settingsSurfaces: SettingsSurfaces {
    get { self[SettingsSurfacesKey.self] }
    set { self[SettingsSurfacesKey.self] = newValue }
  }
}

extension View {
  public func settingsAccent(_ accent: SettingsAccent) -> some View {
    environment(\.settingsAccent, accent)
  }

  public func settingsStrings(_ strings: SettingsStrings) -> some View {
    environment(\.settingsStrings, strings)
  }

  public func settingsMetrics(_ metrics: SettingsMetrics) -> some View {
    environment(\.settingsMetrics, metrics)
  }

  public func settingsTypography(_ typography: SettingsTypography) -> some View {
    environment(\.settingsTypography, typography)
  }

  public func settingsSurfaces(_ surfaces: SettingsSurfaces) -> some View {
    environment(\.settingsSurfaces, surfaces)
  }
}

public enum SettingsPalette {
  public static let canvas = dynamic(light: 0xFCFCFB, dark: 0x161617)
  public static let card = dynamic(light: 0xF2F2EF, dark: 0x232326)
  public static let control = dynamic(light: 0xFFFFFF, dark: 0x2E2E31)
  public static let field = dynamic(light: 0xE9E9E5, dark: 0x2A2A2D)
  public static let ink = dynamic(light: 0x1D1D1B, dark: 0xF1F1EF)
  public static let muted = dynamic(light: 0x6C6C66, dark: 0x9B9B96)
  public static let faint = dynamic(light: 0x91918A, dark: 0x8A8A84)
  public static let hairline = translucent(
    light: 0x000000,
    lightAlpha: 0.07,
    dark: 0xFFFFFF,
    darkAlpha: 0.09
  )
  public static let edge = translucent(
    light: 0x000000,
    lightAlpha: 0.05,
    dark: 0xFFFFFF,
    darkAlpha: 0.07
  )

  static let sliderKnobColor = NSColor(name: nil) { appearance in
    appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
      ? srgb(0xE2E2DE, 1)
      : srgb(0xFFFFFF, 1)
  }

  static let sliderKnobBorderColor = NSColor(name: nil) { appearance in
    appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
      ? srgb(0x000000, 0.42)
      : srgb(0x000000, 0.12)
  }

  public static func dynamic(light: UInt32, dark: UInt32) -> Color {
    translucent(light: light, lightAlpha: 1, dark: dark, darkAlpha: 1)
  }

  public static func translucent(
    light: UInt32,
    lightAlpha: CGFloat,
    dark: UInt32,
    darkAlpha: CGFloat
  ) -> Color {
    Color(
      nsColor: NSColor(name: nil) { appearance in
        appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
          ? srgb(dark, darkAlpha)
          : srgb(light, lightAlpha)
      })
  }

  private static func srgb(_ hex: UInt32, _ alpha: CGFloat) -> NSColor {
    NSColor(
      srgbRed: CGFloat((hex >> 16) & 0xFF) / 255,
      green: CGFloat((hex >> 8) & 0xFF) / 255,
      blue: CGFloat(hex & 0xFF) / 255,
      alpha: alpha
    )
  }
}
