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
  case celadon
  case yuzu
  case glacier
  case seafoam
  case sage
  case plum
  case honey
  case wisteria
  case custom

  static let palette = allCases.filter { $0 != .custom }

  var title: String {
    switch self {
    case .celadon: "Celadon"
    case .yuzu: "Yuzu"
    case .glacier: "Glacier"
    case .seafoam: "Seafoam"
    case .sage: "Sage"
    case .plum: "Plum"
    case .honey: "Honey"
    case .wisteria: "Wisteria"
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
    case .celadon: .celadon
    case .yuzu: .yuzu
    case .glacier: .glacier
    case .seafoam: .seafoam
    case .sage: .sage
    case .plum: .plum
    case .honey: .honey
    case .wisteria: .wisteria
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

struct ExampleAccentChip: Identifiable {
  let id: String
  let accent: ExampleAccent
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
