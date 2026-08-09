import FlowingDayPreferences
import SwiftUI

enum ExamplePage: String, CaseIterable {
  case appearance
  case layout
  case typography
  case motion
  case icons
  case components
  case about
}

struct ExamplePreferencesView: View {
  @State private var selection = ExamplePage.appearance
  @State private var appearance = ExampleAppearance.system
  @State private var accent = ExampleAccent.petal
  @State private var customAccent = ExampleAccent.petal.color
  @State private var corners = ExampleCorners.soft
  @State private var density = ExampleDensity.standard
  @State private var contentLayout = ExampleContentLayout.centered
  @State private var contentWidth = ExampleContentWidth.standard
  @State private var sidebarWidth = 224.0
  @State private var textScale = ExampleTextScale.standard
  @State private var headingFace = PreferencesFontDesign.rounded
  @State private var showsSeparators = true

  var body: some View {
    PreferencesView(
      selection: $selection,
      configuration: configuration,
      groups: pageGroups
    )
    .preferredColorScheme(appearance.colorScheme)
  }

  private var configuration: PreferencesViewConfiguration {
    PreferencesViewConfiguration(
      applicationName: "FlowingDayUI",
      sidebarFooter: "Every control here changes this window.",
      defaultAccent: accent.value(customColor: customAccent),
      metrics: metrics,
      typography: typography,
      contentWidthPolicy: contentLayout.policy,
      sidebarWidth: sidebarWidth,
      cornerRadius: corners.windowRadius
    )
  }

  private var metrics: PreferencesMetrics {
    var metrics = PreferencesMetrics.standard
    metrics.cardRadius = corners.cardRadius
    metrics.controlRadius = corners.controlRadius
    metrics.rowInset = density.rowInset
    metrics.contentWidth = contentWidth.value
    metrics.sectionSpacing = density.sectionSpacing
    return metrics
  }

  private var typography: PreferencesTypography {
    var typography = PreferencesTypography.standard
    typography.apply(scale: textScale.multiplier, headingFace: headingFace)
    return typography
  }

  private var customAccentBinding: Binding<Color> {
    Binding(
      get: { customAccent },
      set: {
        customAccent = $0
        accent = .custom
      }
    )
  }

  private var pageGroups: [PreferencesPageGroup<ExamplePage>] {
    [
      PreferencesPageGroup(
        id: "design",
        pages: [appearancePage, layoutPage, typographyPage]
      ),
      PreferencesPageGroup(
        id: "behavior",
        title: "Behavior",
        pages: [motionPage, iconsPage]
      ),
      PreferencesPageGroup(
        id: "reference",
        title: "Reference",
        pages: [componentsPage, aboutPage]
      ),
    ]
  }

  private var appearancePage: PreferencesPage<ExamplePage> {
    PreferencesPage(
      id: .appearance,
      title: "Appearance",
      subtitle: "Theme and surface components, live",
      icon: .system("paintbrush")
    ) {
      AppearanceShowcase(
        appearance: $appearance,
        accent: $accent,
        customAccent: customAccentBinding,
        corners: $corners,
        showsSeparators: $showsSeparators
      )
    }
  }

  private var layoutPage: PreferencesPage<ExamplePage> {
    PreferencesPage(
      id: .layout,
      title: "Layout",
      subtitle: "Spacing, measure, and the sidebar",
      icon: .system("ruler")
    ) {
      LayoutShowcase(
        density: $density,
        contentLayout: $contentLayout,
        contentWidth: $contentWidth,
        sidebarWidth: $sidebarWidth
      )
    }
  }

  private var typographyPage: PreferencesPage<ExamplePage> {
    PreferencesPage(
      id: .typography,
      title: "Typography",
      subtitle: "Seventeen semantic text roles",
      icon: .system("textformat")
    ) {
      TypographyShowcase(textScale: $textScale, headingFace: $headingFace)
    }
  }

  private var motionPage: PreferencesPage<ExamplePage> {
    PreferencesPage(
      id: .motion,
      title: "Motion",
      subtitle: "Disclosure and Reduce Motion behavior",
      icon: .system("bolt")
    ) {
      MotionShowcase()
    }
  }

  private var iconsPage: PreferencesPage<ExamplePage> {
    PreferencesPage(
      id: .icons,
      title: "Icons",
      subtitle: "SF Symbols and icon presentation",
      icon: .system("sparkles")
    ) {
      IconsShowcase()
    }
  }

  private var componentsPage: PreferencesPage<ExamplePage> {
    PreferencesPage(
      id: .components,
      title: "Components",
      subtitle: "Every control type, live",
      icon: .system("list.bullet")
    ) {
      ComponentsShowcase(accent: $accent)
    }
  }

  private var aboutPage: PreferencesPage<ExamplePage> {
    PreferencesPage(
      id: .about,
      title: "About",
      subtitle: "The package behind this window",
      icon: .system("info.circle"),
      headerIcon: .application
    ) {
      AboutShowcase()
    }
  }
}
