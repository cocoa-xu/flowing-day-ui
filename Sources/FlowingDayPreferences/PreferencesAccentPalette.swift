enum PreferencesNamedAccentBase {
  static let coral: UInt32 = 0xC87F69
  static let poppy: UInt32 = 0xE96452
  static let crimson: UInt32 = 0xDF6B6F
  static let petal: UInt32 = 0xD67084
  static let rose: UInt32 = 0xC67B8D
  static let berry: UInt32 = 0xDD62A7
  static let fuchsia: UInt32 = 0xBD7BAC
  static let apricot: UInt32 = 0xB18D62
  static let butter: UInt32 = 0xA3936D
  static let honey: UInt32 = 0xAC9326
  static let sunbeam: UInt32 = 0x99985D
  static let yuzu: UInt32 = 0x939D37
  static let leaf: UInt32 = 0x74A629
  static let sage: UInt32 = 0x76A454
  static let sprout: UInt32 = 0x56AD16
  static let meadow: UInt32 = 0x7BA073
  static let clover: UInt32 = 0x28B051
  static let mint: UInt32 = 0x73A08D
  static let dew: UInt32 = 0x719F99
  static let seafoam: UInt32 = 0x4DA5A0
  static let mist: UInt32 = 0x759CA2
  static let glacier: UInt32 = 0x5AA0B1
  static let brook: UInt32 = 0x29A3C5
  static let sky: UInt32 = 0x769BAB
  static let rain: UInt32 = 0x6999C8
  static let breeze: UInt32 = 0x6F92DE
  static let bluebell: UInt32 = 0x5784FF
  static let wisteria: UInt32 = 0x968AC7
  static let bloom: UInt32 = 0x9F82D5
  static let plum: UInt32 = 0xA187BE
  static let iris: UInt32 = 0xC558FC
  static let lilac: UInt32 = 0xA986AE
  static let violet: UInt32 = 0xC26ECE
}

extension PreferencesAccent {
  public static let coral = named(base: PreferencesNamedAccentBase.coral)
  public static let poppy = named(base: PreferencesNamedAccentBase.poppy)
  public static let crimson = named(base: PreferencesNamedAccentBase.crimson)
  public static let petal = named(base: PreferencesNamedAccentBase.petal)
  public static let rose = named(base: PreferencesNamedAccentBase.rose)
  public static let berry = named(base: PreferencesNamedAccentBase.berry)
  public static let fuchsia = named(base: PreferencesNamedAccentBase.fuchsia)
  public static let apricot = named(base: PreferencesNamedAccentBase.apricot)
  public static let butter = named(base: PreferencesNamedAccentBase.butter)
  public static let honey = named(base: PreferencesNamedAccentBase.honey)
  public static let sunbeam = named(base: PreferencesNamedAccentBase.sunbeam)
  public static let yuzu = named(base: PreferencesNamedAccentBase.yuzu)
  public static let leaf = named(base: PreferencesNamedAccentBase.leaf)
  public static let sage = named(base: PreferencesNamedAccentBase.sage)
  public static let sprout = named(base: PreferencesNamedAccentBase.sprout)
  public static let meadow = named(base: PreferencesNamedAccentBase.meadow)
  public static let clover = named(base: PreferencesNamedAccentBase.clover)
  public static let mint = named(base: PreferencesNamedAccentBase.mint)
  public static let dew = named(base: PreferencesNamedAccentBase.dew)
  public static let seafoam = named(base: PreferencesNamedAccentBase.seafoam)
  public static let mist = named(base: PreferencesNamedAccentBase.mist)
  public static let glacier = named(base: PreferencesNamedAccentBase.glacier)
  public static let brook = named(base: PreferencesNamedAccentBase.brook)
  public static let sky = named(base: PreferencesNamedAccentBase.sky)
  public static let rain = named(base: PreferencesNamedAccentBase.rain)
  public static let breeze = named(base: PreferencesNamedAccentBase.breeze)
  public static let bluebell = named(base: PreferencesNamedAccentBase.bluebell)
  public static let wisteria = named(base: PreferencesNamedAccentBase.wisteria)
  public static let bloom = named(base: PreferencesNamedAccentBase.bloom)
  public static let plum = named(base: PreferencesNamedAccentBase.plum)
  public static let iris = named(base: PreferencesNamedAccentBase.iris)
  public static let lilac = named(base: PreferencesNamedAccentBase.lilac)
  public static let violet = named(base: PreferencesNamedAccentBase.violet)

  private static func named(base: UInt32) -> PreferencesAccent {
    PreferencesAccent.derived(
      base: base,
      fillLightness: PreferencesAccentToken.fillLightness,
      foregroundContrast: PreferencesAccentToken.foregroundContrast
    )
  }
}
