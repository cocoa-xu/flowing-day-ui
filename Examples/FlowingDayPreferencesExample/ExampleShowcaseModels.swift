import FlowingDayControls
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
  case cherry
  case petal
  case rose
  case berry

  case peach
  case citrus
  case tangerine
  case nectar
  case apricot
  case amber
  case marigold

  case butter
  case honey
  case pollen
  case sunbeam
  case daffodil
  case yuzu
  case lemon

  case leaf
  case sage
  case sprout
  case meadow
  case clover
  case fern
  case mint

  case dew
  case seafoam
  case lagoon
  case tide
  case celadon
  case ripple
  case mist

  case glacier
  case brook
  case sky
  case rain
  case breeze
  case bluebell
  case evening

  case wisteria
  case bloom
  case plum
  case iris
  case lilac
  case violet
  case fuchsia

  case custom

  static let palette = allCases.filter { $0 != .custom }
  static let featured: [Self] = [
    .petal,
    .apricot,
    .honey,
    .leaf,
    .seafoam,
    .brook,
    .wisteria,
  ]

  var title: String {
    switch self {
    case .coral: "Coral"
    case .poppy: "Poppy"
    case .crimson: "Crimson"
    case .cherry: "Cherry"
    case .petal: "Petal"
    case .rose: "Rose"
    case .berry: "Berry"

    case .peach: "Peach"
    case .citrus: "Citrus"
    case .tangerine: "Tangerine"
    case .nectar: "Nectar"
    case .apricot: "Apricot"
    case .amber: "Amber"
    case .marigold: "Marigold"

    case .butter: "Butter"
    case .honey: "Honey"
    case .pollen: "Pollen"
    case .sunbeam: "Sunbeam"
    case .daffodil: "Daffodil"
    case .yuzu: "Yuzu"
    case .lemon: "Lemon"

    case .leaf: "Leaf"
    case .sage: "Sage"
    case .sprout: "Sprout"
    case .meadow: "Meadow"
    case .clover: "Clover"
    case .fern: "Fern"
    case .mint: "Mint"

    case .dew: "Dew"
    case .seafoam: "Seafoam"
    case .lagoon: "Lagoon"
    case .tide: "Tide"
    case .celadon: "Celadon"
    case .ripple: "Ripple"
    case .mist: "Mist"

    case .glacier: "Glacier"
    case .brook: "Brook"
    case .sky: "Sky"
    case .rain: "Rain"
    case .breeze: "Breeze"
    case .bluebell: "Bluebell"
    case .evening: "Evening"

    case .wisteria: "Wisteria"
    case .bloom: "Bloom"
    case .plum: "Plum"
    case .iris: "Iris"
    case .lilac: "Lilac"
    case .violet: "Violet"
    case .fuchsia: "Fuchsia"

    case .custom: "Custom"
    }
  }

  var color: Color {
    preset?.fill ?? FlowingAccent.celadon.fill
  }

  func value(customColor: Color) -> FlowingAccent {
    preset ?? FlowingAccent(fill: customColor, foreground: customColor)
  }

  private var preset: FlowingAccent? {
    switch self {
    case .coral: .coral
    case .poppy: .poppy
    case .crimson: .crimson
    case .cherry: .cherry
    case .petal: .petal
    case .rose: .rose
    case .berry: .berry

    case .peach: .peach
    case .citrus: .citrus
    case .tangerine: .tangerine
    case .nectar: .nectar
    case .apricot: .apricot
    case .amber: .amber
    case .marigold: .marigold

    case .butter: .butter
    case .honey: .honey
    case .pollen: .pollen
    case .sunbeam: .sunbeam
    case .daffodil: .daffodil
    case .yuzu: .yuzu
    case .lemon: .lemon

    case .leaf: .leaf
    case .sage: .sage
    case .sprout: .sprout
    case .meadow: .meadow
    case .clover: .clover
    case .fern: .fern
    case .mint: .mint

    case .dew: .dew
    case .seafoam: .seafoam
    case .lagoon: .lagoon
    case .tide: .tide
    case .celadon: .celadon
    case .ripple: .ripple
    case .mist: .mist

    case .glacier: .glacier
    case .brook: .brook
    case .sky: .sky
    case .rain: .rain
    case .breeze: .breeze
    case .bluebell: .bluebell
    case .evening: .evening

    case .wisteria: .wisteria
    case .bloom: .bloom
    case .plum: .plum
    case .iris: .iris
    case .lilac: .lilac
    case .violet: .violet
    case .fuchsia: .fuchsia

    case .custom: nil
    }
  }
}

enum ExampleAccentMenuSelection: Hashable {
  case accent(ExampleAccent)
  case allColors
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

enum ExampleContentLayout: Hashable {
  case centered
  case fluid

  var policy: PreferencesContentWidthPolicy {
    switch self {
    case .centered: .centered()
    case .fluid: .fluid
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
  static let candidateCapacity = 7
  static let columnCount = 7

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
    case .red: [.coral, .poppy, .crimson, .cherry, .petal, .rose, .berry]
    case .orange: [.peach, .citrus, .tangerine, .nectar, .apricot, .amber, .marigold]
    case .yellow: [.butter, .honey, .pollen, .sunbeam, .daffodil, .yuzu, .lemon]
    case .green: [.leaf, .sage, .sprout, .meadow, .clover, .fern, .mint]
    case .cyan: [.dew, .seafoam, .lagoon, .tide, .celadon, .ripple, .mist]
    case .blue: [.glacier, .brook, .sky, .rain, .breeze, .bluebell, .evening]
    case .purple: [.wisteria, .bloom, .plum, .iris, .lilac, .violet, .fuchsia]
    }
  }

  var displaySlotCount: Int {
    let boundedCount = min(accents.count, Self.candidateCapacity)
    let rowCount = max(1, (boundedCount + Self.columnCount - 1) / Self.columnCount)
    return rowCount * Self.columnCount
  }
}

extension PreferencesTypography {
  mutating func apply(scale: CGFloat, headingFace: FlowingFontDesign) {
    controls.apply(scale: scale)
    brandTitle.size *= scale
    brandSubtitle.size *= scale
    sidebarGroup.size *= scale
    sidebarItem.size *= scale
    sidebarItemSelected.size *= scale
    pageTitle.size *= scale
    pageSubtitle.size *= scale
    sliderValue.size *= scale
    brandTitle.design = headingFace
    pageTitle.design = headingFace
  }
}

extension FlowingTypography {
  mutating func apply(scale: CGFloat) {
    contentTitle.size *= scale
    body.size *= scale
    sectionHeader.size *= scale
    rowTitle.size *= scale
    rowCaption.size *= scale
    value.size *= scale
    selectionLabel.size *= scale
    buttonLabel.size *= scale
    tag.size *= scale
  }
}
