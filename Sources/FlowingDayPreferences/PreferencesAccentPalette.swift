enum PreferencesNamedAccentBase {
  static let yuzu: UInt32 = 0x939B50
  static let glacier: UInt32 = 0x5AA0B1
  static let seafoam: UInt32 = 0x4DA5A0
  static let sage: UInt32 = 0x839E72
  static let plum: UInt32 = 0xA187BE
  static let honey: UInt32 = 0xA89441
  static let wisteria: UInt32 = 0x968AC7
}

extension PreferencesAccent {
  public static let yuzu = named(base: PreferencesNamedAccentBase.yuzu)
  public static let glacier = named(base: PreferencesNamedAccentBase.glacier)
  public static let seafoam = named(base: PreferencesNamedAccentBase.seafoam)
  public static let sage = named(base: PreferencesNamedAccentBase.sage)
  public static let plum = named(base: PreferencesNamedAccentBase.plum)
  public static let honey = named(base: PreferencesNamedAccentBase.honey)
  public static let wisteria = named(base: PreferencesNamedAccentBase.wisteria)

  private static func named(base: UInt32) -> PreferencesAccent {
    PreferencesAccent.derived(
      base: base,
      fillLightness: PreferencesAccentToken.fillLightness,
      foregroundContrast: PreferencesAccentToken.foregroundContrast
    )
  }
}
