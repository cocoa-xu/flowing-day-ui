import FlowingDayPreferences
import SwiftUI

enum ExampleAppearance: Hashable {
  case system
  case light
  case dark

  var colorScheme: ColorScheme? {
    switch self {
    case .system: nil
    case .light: .light
    case .dark: .dark
    }
  }
}

enum ExampleAccent: CaseIterable, Hashable {
  case coral
  case rose
  case berry
  case fuchsia
  case crimson
  case poppy
  case apricot
  case yuzu
  case honey
  case butter
  case sunbeam
  case sage
  case meadow
  case mint
  case sprout
  case clover
  case celadon
  case seafoam
  case mist
  case dew
  case glacier
  case sky
  case periwinkle
  case breeze
  case brook
  case bluebell
  case plum
  case wisteria
  case violet
  case lilac
  case bloom
  case iris
  case custom

  static let palette = allCases.filter { $0 != .custom }

  var title: String {
    switch self {
    case .coral: "Coral"
    case .rose: "Rose"
    case .berry: "Berry"
    case .fuchsia: "Fuchsia"
    case .crimson: "Crimson"
    case .poppy: "Poppy"
    case .apricot: "Apricot"
    case .yuzu: "Yuzu"
    case .honey: "Honey"
    case .butter: "Butter"
    case .sunbeam: "Sunbeam"
    case .sage: "Sage"
    case .meadow: "Meadow"
    case .mint: "Mint"
    case .sprout: "Sprout"
    case .clover: "Clover"
    case .celadon: "Celadon"
    case .seafoam: "Seafoam"
    case .mist: "Mist"
    case .dew: "Dew"
    case .glacier: "Glacier"
    case .sky: "Sky"
    case .periwinkle: "Periwinkle"
    case .breeze: "Breeze"
    case .brook: "Brook"
    case .bluebell: "Bluebell"
    case .plum: "Plum"
    case .wisteria: "Wisteria"
    case .violet: "Violet"
    case .lilac: "Lilac"
    case .bloom: "Bloom"
    case .iris: "Iris"
    case .custom: "Custom"
    }
  }

  var color: Color {
    preset?.fill ?? PreferencesAccent.celadon.fill
  }

  func value(customColor: Color) -> PreferencesAccent {
    preset ?? PreferencesAccent(fill: customColor, foreground: customColor)
  }

  private var preset: PreferencesAccent? {
    switch self {
    case .coral: .coral
    case .rose: .rose
    case .berry: .berry
    case .fuchsia: .fuchsia
    case .crimson: .crimson
    case .poppy: .poppy
    case .apricot: .apricot
    case .yuzu: .yuzu
    case .honey: .honey
    case .butter: .butter
    case .sunbeam: .sunbeam
    case .sage: .sage
    case .meadow: .meadow
    case .mint: .mint
    case .sprout: .sprout
    case .clover: .clover
    case .celadon: .celadon
    case .seafoam: .seafoam
    case .mist: .mist
    case .dew: .dew
    case .glacier: .glacier
    case .sky: .sky
    case .periwinkle: .periwinkle
    case .breeze: .breeze
    case .brook: .brook
    case .bluebell: .bluebell
    case .plum: .plum
    case .wisteria: .wisteria
    case .violet: .violet
    case .lilac: .lilac
    case .bloom: .bloom
    case .iris: .iris
    case .custom: nil
    }
  }
}

enum ExampleCorners: Hashable {
  case soft
  case medium
  case sharp

  var windowRadius: CGFloat {
    switch self {
    case .soft: 18
    case .medium: 12
    case .sharp: 4
    }
  }

  var cardRadius: CGFloat {
    switch self {
    case .soft: 14
    case .medium: 9
    case .sharp: 3
    }
  }

  var controlRadius: CGFloat {
    switch self {
    case .soft: 9
    case .medium: 6
    case .sharp: 3
    }
  }
}

enum ExampleDensity: Hashable {
  case compact
  case standard
  case roomy

  var rowInset: CGFloat {
    switch self {
    case .compact: 12
    case .standard: 18
    case .roomy: 26
    }
  }

  var sectionSpacing: CGFloat {
    switch self {
    case .compact: 14
    case .standard: 20
    case .roomy: 28
    }
  }
}

enum ExampleContentWidth: Hashable {
  case narrow
  case standard
  case wide

  var value: CGFloat {
    switch self {
    case .narrow: 560
    case .standard: 720
    case .wide: 860
    }
  }
}

enum ExampleTextScale: Hashable {
  case small
  case standard
  case large

  var multiplier: CGFloat {
    switch self {
    case .small: 0.9
    case .standard: 1
    case .large: 1.1
    }
  }
}

enum ExampleSelection: Hashable {
  case first
  case second
  case third
}

enum ExampleSymbol: Hashable {
  case eye
  case bolt
  case hare
}

struct ExampleLabel: Identifiable {
  let id: String

  init(_ id: String) {
    self.id = id
  }
}

enum ExampleAccentFamily: CaseIterable, Identifiable {
  static let candidateCapacity = 10
  static let columnCount = 5

  case red
  case orange
  case yellow
  case green
  case cyan
  case blue
  case purple

  var id: Self { self }

  var title: String {
    switch self {
    case .red: "Red"
    case .orange: "Orange"
    case .yellow: "Yellow"
    case .green: "Green"
    case .cyan: "Cyan"
    case .blue: "Blue"
    case .purple: "Purple"
    }
  }

  var accents: [ExampleAccent] {
    switch self {
    case .red: [.coral, .rose, .berry, .fuchsia, .crimson, .poppy]
    case .orange: [.apricot]
    case .yellow: [.yuzu, .honey, .butter, .sunbeam]
    case .green: [.sage, .meadow, .mint, .sprout, .clover]
    case .cyan: [.celadon, .seafoam, .mist, .dew]
    case .blue: [.glacier, .sky, .periwinkle, .breeze, .brook, .bluebell]
    case .purple: [.plum, .wisteria, .violet, .lilac, .bloom, .iris]
    }
  }

  var displaySlotCount: Int {
    let boundedCount = min(accents.count, Self.candidateCapacity)
    let rowCount = max(1, (boundedCount + Self.columnCount - 1) / Self.columnCount)
    return rowCount * Self.columnCount
  }
}

extension PreferencesTypography {
  mutating func apply(scale: CGFloat, headingFace: PreferencesFontDesign) {
    brandTitle.size *= scale
    brandSubtitle.size *= scale
    sidebarGroup.size *= scale
    sidebarItem.size *= scale
    sidebarItemSelected.size *= scale
    pageTitle.size *= scale
    pageSubtitle.size *= scale
    contentTitle.size *= scale
    body.size *= scale
    sectionHeader.size *= scale
    rowTitle.size *= scale
    rowCaption.size *= scale
    value.size *= scale
    sliderValue.size *= scale
    selectionLabel.size *= scale
    buttonLabel.size *= scale
    tag.size *= scale
    brandTitle.design = headingFace
    pageTitle.design = headingFace
  }
}
