import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tokensPath = resolve(repositoryRoot, 'web/packages/core/src/tokens/tokens.json')
const themeOutputPath = resolve(repositoryRoot, 'Sources/FlowingDayControls/FlowingTheme.swift')
const accentOutputPath = resolve(
  repositoryRoot,
  'Sources/FlowingDayControls/FlowingAccentPalette.swift',
)
const preferencesOutputPath = resolve(
  repositoryRoot,
  'Sources/FlowingDayPreferences/PreferencesTheme.swift',
)
const raw = JSON.parse(await readFile(tokensPath, 'utf8'))
const groups = raw.groups
const tokens = new Map(
  groups.flatMap((group) =>
    Object.entries(group.tokens ?? {}).map(([name, token]) => [name, { ...token, group }]),
  ),
)

const valueKinds = ['color', 'px', 'ms', 'number', 'ref', 'css']
const consumedTokens = new Set()
const swiftFontWeights = [
  'ultraLight',
  'thin',
  'light',
  'regular',
  'medium',
  'semibold',
  'bold',
  'heavy',
  'black',
]
const swiftFontDesigns = new Set(['standard', 'rounded', 'serif', 'monospaced'])

const tokenFontWeights = Object.keys(raw.fontWeights).filter((name) => !name.startsWith('$'))
if (tokenFontWeights.join() !== swiftFontWeights.join()) {
  throw new Error('fontWeights must match FlowingFontWeight')
}

for (const [role, style] of Object.entries(raw.typography.roles)) {
  if (style.weight !== undefined && !swiftFontWeights.includes(style.weight)) {
    throw new Error(`${role} has an unknown Swift font weight`)
  }
  if (style.design !== undefined && !swiftFontDesigns.has(style.design)) {
    throw new Error(`${role} has an unknown Swift font design`)
  }
}

for (const [name, token] of tokens) {
  const kinds = valueKinds.filter((kind) => token[kind] !== undefined)
  if (kinds.length !== 1) throw new Error(`${name} must have exactly one value kind`)
  if (token.alpha !== undefined && token.color === undefined) {
    throw new Error(`${name} has alpha without a color`)
  }
}

const token = (name) => {
  const value = tokens.get(name)
  if (value === undefined) throw new Error(`Missing token: ${name}`)
  return value
}

const consume = (name, expectedSource) => {
  const value = token(name)
  if (expectedSource !== undefined && value.group.source !== expectedSource) {
    throw new Error(`${name} must come from ${expectedSource}`)
  }
  consumedTokens.add(name)
  return value
}

const paired = (value) => typeof value === 'object' && value !== null && 'light' in value
const appearanceValue = (value, appearance) => (paired(value) ? value[appearance] : value)
const swiftNumber = (value) => String(value)
const swiftSeconds = (milliseconds) => swiftNumber(milliseconds / 1000)
const swiftHex = (value) => `0x${value.toUpperCase()}`
const swiftIdentifier = (value) =>
  value.replace(/-([a-z0-9])/g, (_, character) => character.toUpperCase())

const namedAccentFamilies = Object.entries(raw.namedAccents?.families ?? {})
const namedAccentEntries = namedAccentFamilies.flatMap(([family, accents]) =>
  Object.entries(accents).map(([name, value]) => ({ family, name, value })),
)
const namedAccentNames = new Set(namedAccentEntries.map(({ name }) => name))

if (raw.namedAccents?.$source !== 'FlowingNamedAccentBase') {
  throw new Error('namedAccents must come from FlowingNamedAccentBase')
}
if (namedAccentEntries.length === 0 || namedAccentNames.size !== namedAccentEntries.length) {
  throw new Error('namedAccents must contain unique names')
}
for (const { name, value } of namedAccentEntries) {
  if (!/^[0-9A-Fa-f]{6}$/.test(value.color ?? '') || value.alpha !== undefined) {
    throw new Error(`${name} must be one opaque color`)
  }
}

function colorArguments(value) {
  const light = appearanceValue(value.color, 'light')
  const dark = appearanceValue(value.color, 'dark')
  const lightAlpha = value.alpha === undefined ? 1 : appearanceValue(value.alpha, 'light')
  const darkAlpha = value.alpha === undefined ? 1 : appearanceValue(value.alpha, 'dark')
  return { light, dark, lightAlpha, darkAlpha }
}

function colorExpression(value, functionName = 'FlowingPalette.dynamic', indentation = '  ') {
  const { light, dark, lightAlpha, darkAlpha } = colorArguments(value)
  if (lightAlpha === 1 && darkAlpha === 1) {
    return `${functionName}(light: ${swiftHex(light)}, dark: ${swiftHex(dark)})`
  }
  const translucent = functionName.replace(/dynamic$/, 'translucent')
  return `${translucent}(\n${indentation}  light: ${swiftHex(light)},\n${indentation}  lightAlpha: ${swiftNumber(lightAlpha)},\n${indentation}  dark: ${swiftHex(dark)},\n${indentation}  darkAlpha: ${swiftNumber(darkAlpha)}\n${indentation})`
}

function surfaceExpression(name) {
  const reference = consume(name, 'FlowingSurfaces.standard').ref
  if (!reference?.startsWith('palette-')) {
    throw new Error(`${name} must reference a palette token`)
  }
  return `FlowingPalette.${swiftIdentifier(reference.slice('palette-'.length))}`
}

function textStyleExpression(style, indentation = '') {
  const argumentsList = [`size: ${swiftNumber(style.size)}`]
  if (style.weight !== undefined) argumentsList.push(`weight: .${style.weight}`)
  if (style.design !== undefined) argumentsList.push(`design: .${style.design}`)
  if (style.monospacedDigits === true) argumentsList.push('usesMonospacedDigits: true')
  if (argumentsList.length === 1) return `FlowingTextStyle(${argumentsList[0]})`
  return `FlowingTextStyle(\n${indentation}  ${argumentsList.join(`,\n${indentation}  `)}\n${indentation})`
}

function typographyProperties() {
  return Object.keys(raw.typography.roles)
    .map((role) => `  public var ${swiftIdentifier(role)}: FlowingTextStyle`)
    .join('\n')
}

function typographyParameters() {
  return Object.entries(raw.typography.roles)
    .map(
      ([role, style]) =>
        `    ${swiftIdentifier(role)}: FlowingTextStyle = ${textStyleExpression(style, '    ')}`,
    )
    .join(',\n')
}

function typographyAssignments() {
  return Object.keys(raw.typography.roles)
    .map((role) => {
      const name = swiftIdentifier(role)
      return `    self.${name} = ${name}`
    })
    .join('\n')
}

function paletteDeclarations() {
  const names = Object.keys(token('palette-canvas').group.tokens)
  return names
    .map((name) => {
      const identifier = swiftIdentifier(name.slice('palette-'.length))
      return `  public static let ${identifier} = ${colorExpression(consume(name, 'FlowingPalette'))}`
    })
    .join('\n')
}

function motionDeclaration(name, reduced = false) {
  const value = reduced ? raw.reducedMotion[name] : consume(name, null)
  const baseName = swiftIdentifier(name.slice('motion-'.length))
  const regularIdentifier = baseName === 'default' ? 'defaultDuration' : baseName
  const identifier = reduced
    ? `reduced${baseName[0].toUpperCase()}${baseName.slice(1)}`
    : regularIdentifier
  if (value.ms !== undefined) {
    return `  public static let ${identifier}: TimeInterval = ${swiftSeconds(value.ms)}`
  }
  if (value.px !== undefined) {
    return `  public static let ${identifier}: CGFloat = ${swiftNumber(value.px)}`
  }
  return null
}

const motionNames = Object.keys(token('motion-disclosure').group.tokens).filter(
  (name) => token(name).css === undefined,
)
const reducedMotionNames = Object.keys(raw.reducedMotion).filter((name) => !name.startsWith('$'))
const motionDeclarations = [
  ...motionNames.map((name) => motionDeclaration(name)),
  ...reducedMotionNames.map((name) => motionDeclaration(name, true)),
]
  .filter(Boolean)
  .join('\n')

const accentReference = consume('accent', 'FlowingAccent.celadon').ref
if (accentReference !== 'accent-celadon') {
  throw new Error('accent must reference accent-celadon')
}
const celadon = namedAccentEntries.find(({ name }) => name === 'celadon')?.value
if (celadon === undefined) throw new Error('namedAccents must contain celadon')
const accentBase = celadon.color
const accentLift = consume('accent-lift', 'FlowingAccent.celadon').number
const accentContrast = consume('accent-contrast', 'FlowingAccent.celadon').number
const metric = (name) =>
  swiftNumber(consume(`metric-${name}`, 'FlowingMetrics.standard').px)
const windowValue = (name) =>
  swiftNumber(consume(name, 'PreferencesViewConfiguration').px)
const knobFill = colorExpression(
  consume('knob-fill', 'FlowingPalette'),
  'FlowingPalette.dynamicNSColor',
)
const knobBorder = colorExpression(
  consume('knob-border', 'FlowingPalette'),
  'FlowingPalette.dynamicNSColor',
)
const closeHover = colorExpression(consume('close-hover', 'PreferencesViewConfiguration'))

const output = `// Generated by scripts/generate-swift-theme.mjs from tokens.json. Do not edit.

import SwiftUI

public struct FlowingMetrics: Equatable, Sendable {
  public var cardRadius: CGFloat
  public var controlRadius: CGFloat
  public var rowInset: CGFloat
  public var contentWidth: CGFloat
  public var sectionSpacing: CGFloat

  public init(
    cardRadius: CGFloat = ${metric('card-radius')},
    controlRadius: CGFloat = ${metric('control-radius')},
    rowInset: CGFloat = ${metric('row-inset')},
    contentWidth: CGFloat = ${metric('content-width')},
    sectionSpacing: CGFloat = ${metric('section-spacing')}
  ) {
    self.cardRadius = cardRadius
    self.controlRadius = controlRadius
    self.rowInset = rowInset
    self.contentWidth = contentWidth
    self.sectionSpacing = sectionSpacing
  }

  public static let standard = FlowingMetrics()
}

public struct FlowingTypography: Sendable {
${typographyProperties()}

  public init(
${typographyParameters()}
  ) {
${typographyAssignments()}
  }

  public static let standard = FlowingTypography()
}

public struct FlowingSurfaces: Equatable, Sendable {
  public var canvas: Color
  public var sidebar: Color
  public var card: Color
  public var control: Color
  public var field: Color

  public init(
    canvas: Color = ${surfaceExpression('surface-canvas')},
    sidebar: Color = ${surfaceExpression('surface-sidebar')},
    card: Color = ${surfaceExpression('surface-card')},
    control: Color = ${surfaceExpression('surface-control')},
    field: Color = ${surfaceExpression('surface-field')}
  ) {
    self.canvas = canvas
    self.sidebar = sidebar
    self.card = card
    self.control = control
    self.field = field
  }

  public static let standard = FlowingSurfaces()
}

enum FlowingAccentToken {
  static let base: UInt32 = ${swiftHex(accentBase)}
  static let fillLightness = FlowingAppearanceValue<CGFloat>(
    light: ${swiftNumber(accentLift.light)},
    dark: ${swiftNumber(accentLift.dark)}
  )
  static let foregroundContrast = FlowingAppearanceValue<CGFloat>(
    light: ${swiftNumber(accentContrast.light)},
    dark: ${swiftNumber(accentContrast.dark)}
  )
}

extension FlowingAccent {
  public static let celadon = FlowingAccent.derived(
    base: FlowingAccentToken.base,
    fillLightness: FlowingAccentToken.fillLightness,
    foregroundContrast: FlowingAccentToken.foregroundContrast
  )
}

extension FlowingPalette {
${paletteDeclarations()}

  static let sliderKnobColor = ${knobFill}
  static let sliderKnobBorderColor = ${knobBorder}
  public static let closeHover = ${closeHover}
}

public enum FlowingMotion {
${motionDeclarations}
}
`

const preferencesOutput = `// Generated by scripts/generate-swift-theme.mjs from tokens.json. Do not edit.

import AppKit
import FlowingDayControls
import SwiftUI

public struct PreferencesStrings: Equatable, Sendable {
  public var closePreferences: String
  public var controls: FlowingStrings

  public init(
    closePreferences: String = "Close Preferences",
    controls: FlowingStrings = FlowingStrings()
  ) {
    self.closePreferences = closePreferences
    self.controls = controls
  }
}

public enum PreferencesContentWidthPolicy: Equatable, Sendable {
  case fluid
  case centered(maximumWidth: CGFloat? = nil)

  func resolvedMaximumWidth(defaultWidth: CGFloat) -> CGFloat? {
    switch self {
    case .fluid:
      return nil
    case .centered(let maximumWidth):
      let fallback = defaultWidth.isFinite && defaultWidth > 0 ? defaultWidth : 1
      guard let maximumWidth else { return fallback }
      return maximumWidth.isFinite && maximumWidth > 0 ? maximumWidth : fallback
    }
  }
}

public struct PreferencesViewConfiguration {
  public var applicationName: String
  public var preferencesTitle: String
  public var applicationIcon: NSImage?
  public var sidebarFooter: String?
  public var defaultAccent: FlowingAccent
  public var strings: PreferencesStrings
  public var metrics: FlowingMetrics
  public var typography: FlowingTypography
  public var surfaces: FlowingSurfaces
  public var contentWidthPolicy: PreferencesContentWidthPolicy
  public var sidebarWidth: CGFloat
  public var cornerRadius: CGFloat

  public init(
    applicationName: String,
    preferencesTitle: String = "Preferences",
    applicationIcon: NSImage? = nil,
    sidebarFooter: String? = nil,
    defaultAccent: FlowingAccent = .celadon,
    strings: PreferencesStrings = PreferencesStrings(),
    metrics: FlowingMetrics = .standard,
    typography: FlowingTypography = .standard,
    surfaces: FlowingSurfaces = .standard,
    contentWidthPolicy: PreferencesContentWidthPolicy = .centered(),
    sidebarWidth: CGFloat = ${windowValue('sidebar-width')},
    cornerRadius: CGFloat = ${windowValue('window-radius')}
  ) {
    self.applicationName = applicationName
    self.preferencesTitle = preferencesTitle
    self.applicationIcon = applicationIcon
    self.sidebarFooter = sidebarFooter
    self.defaultAccent = defaultAccent
    self.strings = strings
    self.metrics = metrics
    self.typography = typography
    self.surfaces = surfaces
    self.contentWidthPolicy = contentWidthPolicy
    self.sidebarWidth = sidebarWidth
    self.cornerRadius = cornerRadius
  }
}
`

const namedAccentBaseDeclarations = namedAccentFamilies
  .map(([, accents]) =>
    Object.entries(accents)
      .map(([name, value]) => {
        const expression = name === 'celadon' ? 'FlowingAccentToken.base' : swiftHex(value.color)
        return `  static let ${swiftIdentifier(name)}: UInt32 = ${expression}`
      })
      .join('\n'),
  )
  .join('\n\n')

const namedAccentAll = namedAccentFamilies
  .map(([, accents]) => `    ${Object.keys(accents).map(swiftIdentifier).join(', ')},`)
  .join('\n')

const namedAccentProperties = namedAccentFamilies
  .map(([, accents]) =>
    Object.keys(accents)
      .filter((name) => name !== 'celadon')
      .map(
        (name) =>
          `  public static let ${swiftIdentifier(name)} = named(base: FlowingNamedAccentBase.${swiftIdentifier(name)})`,
      )
      .join('\n'),
  )
  .join('\n\n')

const accentOutput = `// Generated by scripts/generate-swift-theme.mjs from tokens.json. Do not edit.

enum FlowingNamedAccentBase {
${namedAccentBaseDeclarations}

  static let all: [UInt32] = [
${namedAccentAll}
  ]
}

extension FlowingAccent {
${namedAccentProperties}

  private static func named(base: UInt32) -> FlowingAccent {
    FlowingAccent.derived(
      base: base,
      fillLightness: FlowingAccentToken.fillLightness,
      foregroundContrast: FlowingAccentToken.foregroundContrast
    )
  }
}
`

const unhandledTokens = [...tokens]
  .filter(([, value]) => value.platform !== 'web' && value.css === undefined)
  .map(([name]) => name)
  .filter((name) => !consumedTokens.has(name))

if (unhandledTokens.length > 0) {
  throw new Error(`Swift emitter does not handle: ${unhandledTokens.join(', ')}`)
}

if (process.argv.includes('--check')) {
  const currentTheme = await readFile(themeOutputPath, 'utf8').catch(() => '')
  const currentAccents = await readFile(accentOutputPath, 'utf8').catch(() => '')
  const currentPreferences = await readFile(preferencesOutputPath, 'utf8').catch(() => '')
  if (
    currentTheme !== output ||
    currentAccents !== accentOutput ||
    currentPreferences !== preferencesOutput
  ) {
    console.error('Generated Swift theme files are out of date. Run node scripts/generate-swift-theme.mjs.')
    process.exitCode = 1
  }
} else {
  await writeFile(themeOutputPath, output, 'utf8')
  await writeFile(accentOutputPath, accentOutput, 'utf8')
  await writeFile(preferencesOutputPath, preferencesOutput, 'utf8')
  console.log(`generated ${themeOutputPath}`)
  console.log(`generated ${accentOutputPath}`)
  console.log(`generated ${preferencesOutputPath}`)
}
