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
  case poppy
  case crimson
  case petal
  case rose
  case berry
  case fuchsia
  case apricot
  case butter
  case honey
  case sunbeam
  case yuzu
  case leaf
  case sage
  case sprout
  case meadow
  case clover
  case mint
  case dew
  case seafoam
  case celadon
  case mist
  case glacier
  case brook
  case sky
  case rain
  case breeze
  case bluebell
  case wisteria
  case bloom
  case plum
  case iris
  case lilac
  case violet
  case custom

  static let palette = allCases.filter { $0 != .custom }

  var title: String {
    switch self {
    case .coral: "Coral"
    case .poppy: "Poppy"
    case .crimson: "Crimson"
    case .petal: "Petal"
    case .rose: "Rose"
    case .berry: "Berry"
    case .fuchsia: "Fuchsia"
    case .apricot: "Apricot"
    case .butter: "Butter"
    case .honey: "Honey"
    case .sunbeam: "Sunbeam"
    case .yuzu: "Yuzu"
    case .leaf: "Leaf"
    case .sage: "Sage"
    case .sprout: "Sprout"
    case .meadow: "Meadow"
    case .clover: "Clover"
    case .mint: "Mint"
    case .dew: "Dew"
    case .seafoam: "Seafoam"
    case .celadon: "Celadon"
    case .mist: "Mist"
    case .glacier: "Glacier"
    case .brook: "Brook"
    case .sky: "Sky"
    case .rain: "Rain"
    case .breeze: "Breeze"
    case .bluebell: "Bluebell"
    case .wisteria: "Wisteria"
    case .bloom: "Bloom"
    case .plum: "Plum"
    case .iris: "Iris"
    case .lilac: "Lilac"
    case .violet: "Violet"
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
    case .poppy: .poppy
    case .crimson: .crimson
    case .petal: .petal
    case .rose: .rose
    case .berry: .berry
    case .fuchsia: .fuchsia
    case .apricot: .apricot
    case .butter: .butter
    case .honey: .honey
    case .sunbeam: .sunbeam
    case .yuzu: .yuzu
    case .leaf: .leaf
    case .sage: .sage
    case .sprout: .sprout
    case .meadow: .meadow
    case .clover: .clover
    case .mint: .mint
    case .dew: .dew
    case .seafoam: .seafoam
    case .celadon: .celadon
    case .mist: .mist
    case .glacier: .glacier
    case .brook: .brook
    case .sky: .sky
    case .rain: .rain
    case .breeze: .breeze
    case .bluebell: .bluebell
    case .wisteria: .wisteria
    case .bloom: .bloom
    case .plum: .plum
    case .iris: .iris
    case .lilac: .lilac
    case .violet: .violet
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
    case .red: [.coral, .poppy, .crimson, .petal, .rose, .berry, .fuchsia]
    case .orange: [.apricot]
    case .yellow: [.butter, .honey, .sunbeam, .yuzu]
    case .green: [.leaf, .sage, .sprout, .meadow, .clover, .mint]
    case .cyan: [.dew, .seafoam, .celadon, .mist]
    case .blue: [.glacier, .brook, .sky, .rain, .breeze, .bluebell]
    case .purple: [.wisteria, .bloom, .plum, .iris, .lilac, .violet]
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
