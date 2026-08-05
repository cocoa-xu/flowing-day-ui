import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tokensPath = resolve(repositoryRoot, 'web/packages/core/src/tokens/tokens.json')
const outputPath = resolve(repositoryRoot, 'Sources/FlowingDaySettings/SettingsTheme.swift')
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
  throw new Error('fontWeights must match SettingsFontWeight')
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

function colorArguments(value) {
  const light = appearanceValue(value.color, 'light')
  const dark = appearanceValue(value.color, 'dark')
  const lightAlpha = value.alpha === undefined ? 1 : appearanceValue(value.alpha, 'light')
  const darkAlpha = value.alpha === undefined ? 1 : appearanceValue(value.alpha, 'dark')
  return { light, dark, lightAlpha, darkAlpha }
}

function colorExpression(value, functionName = 'SettingsPalette.dynamic', indentation = '  ') {
  const { light, dark, lightAlpha, darkAlpha } = colorArguments(value)
  if (lightAlpha === 1 && darkAlpha === 1) {
    return `${functionName}(light: ${swiftHex(light)}, dark: ${swiftHex(dark)})`
  }
  const translucent = functionName.replace(/dynamic$/, 'translucent')
  return `${translucent}(\n${indentation}  light: ${swiftHex(light)},\n${indentation}  lightAlpha: ${swiftNumber(lightAlpha)},\n${indentation}  dark: ${swiftHex(dark)},\n${indentation}  darkAlpha: ${swiftNumber(darkAlpha)}\n${indentation})`
}

function surfaceExpression(name) {
  const reference = consume(name, 'SettingsSurfaces.standard').ref
  if (!reference?.startsWith('palette-')) {
    throw new Error(`${name} must reference a palette token`)
  }
  return `SettingsPalette.${swiftIdentifier(reference.slice('palette-'.length))}`
}

function textStyleExpression(style, indentation = '') {
  const argumentsList = [`size: ${swiftNumber(style.size)}`]
  if (style.weight !== undefined) argumentsList.push(`weight: .${style.weight}`)
  if (style.design !== undefined) argumentsList.push(`design: .${style.design}`)
  if (style.monospacedDigits === true) argumentsList.push('usesMonospacedDigits: true')
  if (argumentsList.length === 1) return `SettingsTextStyle(${argumentsList[0]})`
  return `SettingsTextStyle(\n${indentation}  ${argumentsList.join(`,\n${indentation}  `)}\n${indentation})`
}

function typographyProperties() {
  return Object.keys(raw.typography.roles)
    .map((role) => `  public var ${swiftIdentifier(role)}: SettingsTextStyle`)
    .join('\n')
}

function typographyParameters() {
  return Object.entries(raw.typography.roles)
    .map(
      ([role, style]) =>
        `    ${swiftIdentifier(role)}: SettingsTextStyle = ${textStyleExpression(style, '    ')}`,
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
      return `  public static let ${identifier} = ${colorExpression(consume(name, 'SettingsPalette'))}`
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
    return `  static let ${identifier}: TimeInterval = ${swiftSeconds(value.ms)}`
  }
  if (value.px !== undefined) {
    return `  static let ${identifier}: CGFloat = ${swiftNumber(value.px)}`
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

const accentBase = appearanceValue(consume('accent', 'SettingsAccent.celadon').color, 'light')
const accentLift = consume('accent-lift', 'SettingsAccent.celadon').number
const accentContrast = consume('accent-contrast', 'SettingsAccent.celadon').number
const metric = (name) =>
  swiftNumber(consume(`metric-${name}`, 'SettingsMetrics.standard').px)
const windowValue = (name) =>
  swiftNumber(consume(name, 'SettingsViewConfiguration').px)
const knobFill = colorExpression(
  consume('knob-fill', 'SettingsPalette'),
  'SettingsPalette.dynamicNSColor',
)
const knobBorder = colorExpression(
  consume('knob-border', 'SettingsPalette'),
  'SettingsPalette.dynamicNSColor',
)
const closeHover = colorExpression(consume('close-hover', 'SettingsViewConfiguration'))

const output = `// Generated by scripts/generate-swift-theme.mjs from tokens.json. Do not edit.

import AppKit
import SwiftUI

public struct SettingsMetrics: Equatable, Sendable {
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

  public static let standard = SettingsMetrics()
}

public struct SettingsTypography: Sendable {
${typographyProperties()}

  public init(
${typographyParameters()}
  ) {
${typographyAssignments()}
  }

  public static let standard = SettingsTypography()
}

public struct SettingsSurfaces: Equatable, Sendable {
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

  public static let standard = SettingsSurfaces()
}

public struct SettingsViewConfiguration {
  public var applicationName: String
  public var settingsTitle: String
  public var applicationIcon: NSImage?
  public var sidebarFooter: String?
  public var defaultAccent: SettingsAccent
  public var strings: SettingsStrings
  public var metrics: SettingsMetrics
  public var typography: SettingsTypography
  public var surfaces: SettingsSurfaces
  public var sidebarWidth: CGFloat
  public var cornerRadius: CGFloat

  public init(
    applicationName: String,
    settingsTitle: String = "Settings",
    applicationIcon: NSImage? = nil,
    sidebarFooter: String? = nil,
    defaultAccent: SettingsAccent = .celadon,
    strings: SettingsStrings = SettingsStrings(),
    metrics: SettingsMetrics = .standard,
    typography: SettingsTypography = .standard,
    surfaces: SettingsSurfaces = .standard,
    sidebarWidth: CGFloat = ${windowValue('sidebar-width')},
    cornerRadius: CGFloat = ${windowValue('window-radius')}
  ) {
    self.applicationName = applicationName
    self.settingsTitle = settingsTitle
    self.applicationIcon = applicationIcon
    self.sidebarFooter = sidebarFooter
    self.defaultAccent = defaultAccent
    self.strings = strings
    self.metrics = metrics
    self.typography = typography
    self.surfaces = surfaces
    self.sidebarWidth = sidebarWidth
    self.cornerRadius = cornerRadius
  }
}

enum SettingsAccentToken {
  static let base: UInt32 = ${swiftHex(accentBase)}
  static let fillLightness = SettingsAppearanceValue<CGFloat>(
    light: ${swiftNumber(accentLift.light)},
    dark: ${swiftNumber(accentLift.dark)}
  )
  static let foregroundContrast = SettingsAppearanceValue<CGFloat>(
    light: ${swiftNumber(accentContrast.light)},
    dark: ${swiftNumber(accentContrast.dark)}
  )
}

extension SettingsAccent {
  public static let celadon = SettingsAccent.derived(
    base: SettingsAccentToken.base,
    fillLightness: SettingsAccentToken.fillLightness,
    foregroundContrast: SettingsAccentToken.foregroundContrast
  )
}

extension SettingsPalette {
${paletteDeclarations()}

  static let sliderKnobColor = ${knobFill}
  static let sliderKnobBorderColor = ${knobBorder}
  static let closeHover = ${closeHover}
}

enum SettingsMotion {
${motionDeclarations}
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
  const current = await readFile(outputPath, 'utf8').catch(() => '')
  if (current !== output) {
    console.error('SettingsTheme.swift is out of date. Run node scripts/generate-swift-theme.mjs.')
    process.exitCode = 1
  }
} else {
  await writeFile(outputPath, output, 'utf8')
  console.log(`generated ${outputPath}`)
}
