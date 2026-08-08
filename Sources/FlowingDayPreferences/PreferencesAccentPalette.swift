enum PreferencesNamedAccentBase {
  static let coral: UInt32 = 0xC87F69
  static let rose: UInt32 = 0xC67B8D
  static let berry: UInt32 = 0xDD62A7
  static let fuchsia: UInt32 = 0xBD7BAC
  static let crimson: UInt32 = 0xDF6B6F
  static let apricot: UInt32 = 0xB18D62
  static let yuzu: UInt32 = 0x939D37
  static let honey: UInt32 = 0xAC9326
  static let butter: UInt32 = 0xA3936D
  static let sage: UInt32 = 0x76A454
  static let seafoam: UInt32 = 0x4DA5A0
  static let mist: UInt32 = 0x759CA2
  static let dew: UInt32 = 0x849A97
  static let glacier: UInt32 = 0x5AA0B1
  static let sky: UInt32 = 0x769BAB
  static let periwinkle: UInt32 = 0x738AF9
  static let plum: UInt32 = 0xA187BE
  static let wisteria: UInt32 = 0x968AC7
  static let violet: UInt32 = 0xC26ECE
  static let lilac: UInt32 = 0xA18CA4
}

extension PreferencesAccent {
  public static let coral = named(base: PreferencesNamedAccentBase.coral)
  public static let rose = named(base: PreferencesNamedAccentBase.rose)
  public static let berry = named(base: PreferencesNamedAccentBase.berry)
  public static let fuchsia = named(base: PreferencesNamedAccentBase.fuchsia)
  public static let crimson = named(base: PreferencesNamedAccentBase.crimson)
  public static let apricot = named(base: PreferencesNamedAccentBase.apricot)
  public static let yuzu = named(base: PreferencesNamedAccentBase.yuzu)
  public static let honey = named(base: PreferencesNamedAccentBase.honey)
  public static let butter = named(base: PreferencesNamedAccentBase.butter)
  public static let sage = named(base: PreferencesNamedAccentBase.sage)
  public static let seafoam = named(base: PreferencesNamedAccentBase.seafoam)
  public static let mist = named(base: PreferencesNamedAccentBase.mist)
  public static let dew = named(base: PreferencesNamedAccentBase.dew)
  public static let glacier = named(base: PreferencesNamedAccentBase.glacier)
  public static let sky = named(base: PreferencesNamedAccentBase.sky)
  public static let periwinkle = named(base: PreferencesNamedAccentBase.periwinkle)
  public static let plum = named(base: PreferencesNamedAccentBase.plum)
  public static let wisteria = named(base: PreferencesNamedAccentBase.wisteria)
  public static let violet = named(base: PreferencesNamedAccentBase.violet)
  public static let lilac = named(base: PreferencesNamedAccentBase.lilac)

  private static func named(base: UInt32) -> PreferencesAccent {
    PreferencesAccent.derived(
      base: base,
      fillLightness: PreferencesAccentToken.fillLightness,
      foregroundContrast: PreferencesAccentToken.foregroundContrast
    )
  }
}
