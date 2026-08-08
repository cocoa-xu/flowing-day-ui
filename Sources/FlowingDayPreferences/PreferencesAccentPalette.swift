enum PreferencesNamedAccentBase {
  static let coral: UInt32 = 0xC87F69
  static let apricot: UInt32 = 0xB18D62
  static let yuzu: UInt32 = 0x939D37
  static let glacier: UInt32 = 0x5AA0B1
  static let seafoam: UInt32 = 0x4DA5A0
  static let mist: UInt32 = 0x759CA2
  static let sage: UInt32 = 0x76A454
  static let plum: UInt32 = 0xA187BE
  static let honey: UInt32 = 0xAC9326
  static let wisteria: UInt32 = 0x968AC7
}

extension PreferencesAccent {
  public static let coral = named(base: PreferencesNamedAccentBase.coral)
  public static let apricot = named(base: PreferencesNamedAccentBase.apricot)
  public static let yuzu = named(base: PreferencesNamedAccentBase.yuzu)
  public static let glacier = named(base: PreferencesNamedAccentBase.glacier)
  public static let seafoam = named(base: PreferencesNamedAccentBase.seafoam)
  public static let mist = named(base: PreferencesNamedAccentBase.mist)
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
