import AppKit
import SwiftUI

public struct FlowingAccent: Equatable, Sendable {
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
}

struct FlowingAppearanceValue<Value: Sendable>: Sendable {
  let light: Value
  let dark: Value
}

struct FlowingAccentHexValues: Equatable {
  let fillLight: UInt32
  let fillDark: UInt32
  let foregroundLight: UInt32
  let foregroundDark: UInt32
}

extension FlowingAccent {
  static func derived(
    base: UInt32,
    fillLightness: FlowingAppearanceValue<CGFloat>,
    foregroundContrast: FlowingAppearanceValue<CGFloat>
  ) -> FlowingAccent {
    let values = FlowingAccentDerivation.values(
      base: base,
      fillLightness: fillLightness,
      foregroundContrast: foregroundContrast
    )
    return FlowingAccent(
      fill: FlowingPalette.dynamic(light: values.fillLight, dark: values.fillDark),
      foreground: FlowingPalette.dynamic(
        light: values.foregroundLight,
        dark: values.foregroundDark
      )
    )
  }
}

enum FlowingAccentDerivation {
  static func values(
    base: UInt32,
    fillLightness: FlowingAppearanceValue<CGFloat>,
    foregroundContrast: FlowingAppearanceValue<CGFloat>
  ) -> FlowingAccentHexValues {
    let baseColor = FlowingOKLabColor(sRGB: base)
    let fillLight = baseColor.sRGB(adjustingLightnessBy: fillLightness.light)
    let fillDark = baseColor.sRGB(adjustingLightnessBy: fillLightness.dark)
    return FlowingAccentHexValues(
      fillLight: fillLight,
      fillDark: fillDark,
      foregroundLight: FlowingOKLabColor(sRGB: fillLight)
        .sRGB(adjustingLightnessBy: foregroundContrast.light),
      foregroundDark: FlowingOKLabColor(sRGB: fillDark)
        .sRGB(adjustingLightnessBy: foregroundContrast.dark)
    )
  }
}

private struct FlowingOKLabColor {
  let lightness: Double
  let a: Double
  let b: Double

  init(sRGB: UInt32) {
    let red = Self.linear(Double((sRGB >> 16) & 0xFF) / 255)
    let green = Self.linear(Double((sRGB >> 8) & 0xFF) / 255)
    let blue = Self.linear(Double(sRGB & 0xFF) / 255)
    let l = cbrt(0.412_221_470_8 * red + 0.536_332_536_3 * green + 0.051_445_992_9 * blue)
    let m = cbrt(0.211_903_498_2 * red + 0.680_699_545_1 * green + 0.107_396_956_6 * blue)
    let s = cbrt(0.088_302_461_9 * red + 0.281_718_837_6 * green + 0.629_978_700_5 * blue)
    lightness = 0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s
    a = 1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s
    b = 0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s
  }

  func sRGB(adjustingLightnessBy adjustment: CGFloat) -> UInt32 {
    let adjustedLightness = lightness + Double(adjustment)
    let l = pow(adjustedLightness + 0.396_337_777_4 * a + 0.215_803_757_3 * b, 3)
    let m = pow(adjustedLightness - 0.105_561_345_8 * a - 0.063_854_172_8 * b, 3)
    let s = pow(adjustedLightness - 0.089_484_177_5 * a - 1.291_485_548 * b, 3)
    return Self.hex(
      red: 4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
      green: -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
      blue: -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s
    )
  }

  private static func linear(_ channel: Double) -> Double {
    channel <= 0.04045
      ? channel / 12.92
      : pow((channel + 0.055) / 1.055, 2.4)
  }

  private static func encoded(_ channel: Double) -> UInt32 {
    let value =
      channel <= 0.003_130_8
      ? 12.92 * channel
      : 1.055 * pow(channel, 1 / 2.4) - 0.055
    return UInt32((min(max(value, 0), 1) * 255).rounded())
  }

  private static func hex(red: Double, green: Double, blue: Double) -> UInt32 {
    encoded(red) << 16 | encoded(green) << 8 | encoded(blue)
  }
}

public struct FlowingStrings: Equatable, Sendable {
  public var selected: String
  public var notSelected: String
  public var expanded: String
  public var collapsed: String
  public var on: String
  public var off: String
  public var search: String
  public var noResults: String

  public init(
    selected: String = "Selected",
    notSelected: String = "Not Selected",
    expanded: String = "Expanded",
    collapsed: String = "Collapsed",
    on: String = "On",
    off: String = "Off",
    search: String = "Search",
    noResults: String = "No Results"
  ) {
    self.selected = selected
    self.notSelected = notSelected
    self.expanded = expanded
    self.collapsed = collapsed
    self.on = on
    self.off = off
    self.search = search
    self.noResults = noResults
  }
}

public enum FlowingFontWeight: String, Sendable {
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

public enum FlowingFontDesign: String, Sendable {
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

public struct FlowingTextStyle: Sendable {
  public var size: CGFloat
  public var weight: FlowingFontWeight
  public var design: FlowingFontDesign
  public var usesMonospacedDigits: Bool
  public var fontName: String?

  public init(
    size: CGFloat,
    weight: FlowingFontWeight = .regular,
    design: FlowingFontDesign = .standard,
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

private struct FlowingAccentKey: EnvironmentKey {
  static let defaultValue = FlowingAccent.celadon
}

private struct FlowingStringsKey: EnvironmentKey {
  static let defaultValue = FlowingStrings()
}

private struct FlowingMetricsKey: EnvironmentKey {
  static let defaultValue = FlowingMetrics.standard
}

private struct FlowingTypographyKey: EnvironmentKey {
  static let defaultValue = FlowingTypography.standard
}

private struct FlowingSurfacesKey: EnvironmentKey {
  static let defaultValue = FlowingSurfaces.standard
}

extension EnvironmentValues {
  public var flowingAccent: FlowingAccent {
    get { self[FlowingAccentKey.self] }
    set { self[FlowingAccentKey.self] = newValue }
  }

  public var flowingStrings: FlowingStrings {
    get { self[FlowingStringsKey.self] }
    set { self[FlowingStringsKey.self] = newValue }
  }

  public var flowingMetrics: FlowingMetrics {
    get { self[FlowingMetricsKey.self] }
    set { self[FlowingMetricsKey.self] = newValue }
  }

  public var flowingTypography: FlowingTypography {
    get { self[FlowingTypographyKey.self] }
    set { self[FlowingTypographyKey.self] = newValue }
  }

  public var flowingSurfaces: FlowingSurfaces {
    get { self[FlowingSurfacesKey.self] }
    set { self[FlowingSurfacesKey.self] = newValue }
  }
}

extension View {
  public func flowingAccent(_ accent: FlowingAccent) -> some View {
    environment(\.flowingAccent, accent)
  }

  public func flowingStrings(_ strings: FlowingStrings) -> some View {
    environment(\.flowingStrings, strings)
  }

  public func flowingMetrics(_ metrics: FlowingMetrics) -> some View {
    environment(\.flowingMetrics, metrics)
  }

  public func flowingTypography(_ typography: FlowingTypography) -> some View {
    environment(\.flowingTypography, typography)
  }

  public func flowingSurfaces(_ surfaces: FlowingSurfaces) -> some View {
    environment(\.flowingSurfaces, surfaces)
  }
}

public enum FlowingPalette {
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

  static func dynamicNSColor(
    light: UInt32,
    lightAlpha: CGFloat = 1,
    dark: UInt32,
    darkAlpha: CGFloat = 1
  ) -> NSColor {
    NSColor(name: nil) { appearance in
      appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
        ? srgb(dark, darkAlpha)
        : srgb(light, lightAlpha)
    }
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
