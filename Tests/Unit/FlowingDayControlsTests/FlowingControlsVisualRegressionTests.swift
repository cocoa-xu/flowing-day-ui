import AppKit
import FlowingDayControls
import SwiftUI
import XCTest

@MainActor
final class FlowingControlsVisualRegressionTests: XCTestCase {
  func testRepresentativeControlsMatchVisualReferences() throws {
    let rendered = try Dictionary(
      uniqueKeysWithValues: VisualScenario.allCases.map { scenario in
        let first = try VisualRenderer.render(scenario)
        let second = try VisualRenderer.render(scenario)
        XCTAssertEqual(first.signature, second.signature, "Rendering must be deterministic")
        return (scenario.rawValue, first)
      })

    if ProcessInfo.processInfo.environment["FLOWING_RECORD_VISUAL_SIGNATURES"] == "1" {
      for (name, render) in rendered {
        let output = FileManager.default.temporaryDirectory
          .appendingPathComponent("FlowingDayControls-\(name).png")
        try render.pngData.write(to: output, options: .atomic)
        print(output.path)
      }
      let references = VisualReferences(
        signatures: rendered.mapValues(\.signature)
      )
      let encoder = JSONEncoder()
      encoder.outputFormatting = [.sortedKeys]
      print(String(decoding: try encoder.encode(references), as: UTF8.self))
      return
    }

    let references = try VisualReferences.load()
    XCTAssertEqual(Set(references.signatures.keys), Set(VisualScenario.allCases.map(\.rawValue)))

    for scenario in VisualScenario.allCases {
      let actual = try XCTUnwrap(rendered[scenario.rawValue])
      let expected = try XCTUnwrap(references.signatures[scenario.rawValue])
      let difference = try expected.difference(from: actual.signature)
      guard difference.isAcceptable else {
        let output = FileManager.default.temporaryDirectory
          .appendingPathComponent("FlowingDayControls-\(scenario.rawValue).png")
        try actual.pngData.write(to: output, options: .atomic)
        let mean = String(format: "%.2f", difference.mean)
        let changedTiles = String(format: "%.1f%%", difference.changedTileRatio * 100)
        XCTFail(
          "Visual regression in \(scenario.rawValue): mean delta \(mean), "
            + "changed tiles \(changedTiles). Rendered output: \(output.path)")
        continue
      }
    }
  }
}

private enum VisualScenario: String, CaseIterable {
  case light
  case dark
  case alternateAccent = "alternate-accent"
  case disabled
  case rightToLeft = "right-to-left"

  var colorScheme: ColorScheme {
    switch self {
    case .dark:
      .dark
    case .light, .alternateAccent, .disabled, .rightToLeft:
      .light
    }
  }

  var appearance: NSAppearance.Name {
    switch self {
    case .dark:
      .darkAqua
    case .light, .alternateAccent, .disabled, .rightToLeft:
      .aqua
    }
  }

  var accent: FlowingAccent {
    self == .alternateAccent ? .honey : .petal
  }
}

private struct VisualReferences: Codable {
  let version = 1
  let signatures: [String: VisualSignature]

  private enum CodingKeys: CodingKey {
    case version
    case signatures
  }

  init(signatures: [String: VisualSignature]) {
    self.signatures = signatures
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    let version = try container.decode(Int.self, forKey: .version)
    guard version == self.version else {
      throw VisualRegressionError.unsupportedReferenceVersion(version)
    }
    signatures = try container.decode([String: VisualSignature].self, forKey: .signatures)
  }

  static func load() throws -> Self {
    let url = try XCTUnwrap(
      Bundle.module.url(
        forResource: "controls",
        withExtension: "json",
        subdirectory: "VisualReferences"
      )
    )
    return try JSONDecoder().decode(Self.self, from: Data(contentsOf: url))
  }
}

private struct VisualSignature: Codable, Equatable {
  static let columns = 12
  static let rows = 9
  static let changedTileThreshold = 12.0
  static let maximumChangedTileRatio = 0.08
  static let maximumMeanDifference = 3.0

  let columns: Int
  let rows: Int
  let samples: [UInt8]

  private enum CodingKeys: CodingKey {
    case columns
    case rows
    case sampleData
  }

  init(bitmap: NSBitmapImageRep) throws {
    columns = Self.columns
    rows = Self.rows
    guard bitmap.pixelsWide > columns, bitmap.pixelsHigh > rows else {
      throw VisualRegressionError.invalidBitmap
    }

    var result: [UInt8] = []
    result.reserveCapacity(columns * rows * 3)
    for row in 0..<rows {
      for column in 0..<columns {
        let bounds = tileBounds(
          column: column,
          row: row,
          width: bitmap.pixelsWide,
          height: bitmap.pixelsHigh
        )
        let average = try averageColor(in: bitmap, bounds: bounds)
        result.append(contentsOf: average)
      }
    }
    samples = result
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    columns = try container.decode(Int.self, forKey: .columns)
    rows = try container.decode(Int.self, forKey: .rows)
    let encoded = try container.decode(String.self, forKey: .sampleData)
    guard let data = Data(base64Encoded: encoded) else {
      throw VisualRegressionError.invalidReferenceData
    }
    samples = Array(data)
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(columns, forKey: .columns)
    try container.encode(rows, forKey: .rows)
    try container.encode(Data(samples).base64EncodedString(), forKey: .sampleData)
  }

  func difference(from actual: Self) throws -> VisualDifference {
    guard columns == actual.columns, rows == actual.rows, samples.count == actual.samples.count
    else {
      throw VisualRegressionError.incompatibleSignatures
    }

    var total = 0.0
    var changedTiles = 0
    for tile in 0..<(columns * rows) {
      let channelStart = tile * 3
      var tileDelta = 0.0
      for channel in 0..<3 {
        tileDelta += abs(
          Double(samples[channelStart + channel]) - Double(actual.samples[channelStart + channel])
        )
      }
      let average = tileDelta / 3
      total += average
      if average > Self.changedTileThreshold {
        changedTiles += 1
      }
    }

    return VisualDifference(
      mean: total / Double(columns * rows),
      changedTileRatio: Double(changedTiles) / Double(columns * rows)
    )
  }
}

private struct VisualDifference {
  let mean: Double
  let changedTileRatio: Double

  var isAcceptable: Bool {
    mean <= VisualSignature.maximumMeanDifference
      && changedTileRatio <= VisualSignature.maximumChangedTileRatio
  }
}

private struct VisualRender {
  let pngData: Data
  let signature: VisualSignature
}

private enum VisualRenderer {
  static let size = CGSize(width: 720, height: 620)

  @MainActor
  static func render(_ scenario: VisualScenario) throws -> VisualRender {
    let content = ControlsVisualFixture(accent: scenario.accent)
      .environment(\.colorScheme, scenario.colorScheme)
      .environment(\.layoutDirection, scenario == .rightToLeft ? .rightToLeft : .leftToRight)
      .disabled(scenario == .disabled)
      .frame(width: size.width, height: size.height)

    let hostingView = NSHostingView(rootView: content)
    hostingView.frame = CGRect(origin: .zero, size: size)
    hostingView.appearance = NSAppearance(named: scenario.appearance)
    hostingView.layoutSubtreeIfNeeded()
    hostingView.displayIfNeeded()

    guard
      let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(size.width),
        pixelsHigh: Int(size.height),
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
      )
    else {
      throw VisualRegressionError.invalidBitmap
    }

    hostingView.cacheDisplay(in: hostingView.bounds, to: bitmap)
    guard let pngData = bitmap.representation(using: .png, properties: [:]) else {
      throw VisualRegressionError.pngEncodingFailed
    }
    return try VisualRender(pngData: pngData, signature: VisualSignature(bitmap: bitmap))
  }
}

private struct ControlsVisualFixture: View {
  let accent: FlowingAccent

  private let segments = [
    FlowingSegmentOption("general", label: "General", systemImage: "gearshape"),
    FlowingSegmentOption("appearance", label: "Appearance", systemImage: "paintpalette"),
    FlowingSegmentOption("advanced", label: "Advanced", systemImage: "slider.horizontal.3"),
  ]
  private let tabs = [
    FlowingTabOption("overview", label: "Overview", systemImage: "rectangle.grid.1x2"),
    FlowingTabOption("details", label: "Details", systemImage: "list.bullet.rectangle"),
    FlowingTabOption("history", label: "History", systemImage: "clock.arrow.circlepath"),
  ]

  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      header
      FlowingTabs(label: "Example pages", selection: .constant("overview"), options: tabs)
      FlowingSection(
        "Controls",
        footer: "Reusable controls preserve native input and accessibility behavior.",
        contentInsets: EdgeInsets(top: 16, leading: 16, bottom: 16, trailing: 16)
      ) {
        VStack(alignment: .leading, spacing: 15) {
          FlowingSegmentedControl(
            label: "Settings section",
            selection: .constant("appearance"),
            options: segments
          )
          HStack(spacing: 18) {
            FlowingCheckbox(
              "Automatic updates",
              isOn: .constant(true),
              widthPolicy: .fitContent()
            )
            FlowingSwitch("Live preview", isOn: .constant(true))
            Spacer(minLength: 0)
            FlowingBadge("Ready", systemImage: "checkmark", tone: .success)
          }
          HStack(spacing: 12) {
            FlowingTextField(
              "Project name",
              text: .constant("Flowing Day"),
              systemImage: "text.cursor"
            )
            FlowingSecureField("Access key", text: .constant("gentle-morning"))
          }
          FlowingSlider("Progress", value: .constant(0.64), in: 0...1)
          FlowingProgress("Preparing preview", value: 0.64)
        }
      }
      FlowingCallout(
        "Changes are applied immediately and stay local to this preview.",
        title: "Preview Ready",
        tone: .informational
      )
      HStack(spacing: 10) {
        Button("Continue") {}
          .buttonStyle(FlowingSoftButtonStyle(isProminent: true))
        Button("Not Now") {}
          .buttonStyle(FlowingSoftButtonStyle())
        Spacer(minLength: 0)
        FlowingValueText("64%")
      }
    }
    .padding(28)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(FlowingPalette.canvas)
    .flowingAccent(accent)
  }

  private var header: some View {
    HStack(alignment: .firstTextBaseline) {
      VStack(alignment: .leading, spacing: 3) {
        Text("Flowing Day")
          .font(FlowingTypography.standard.contentTitle.font)
          .foregroundStyle(FlowingPalette.ink)
        Text("A calm, native foundation for thoughtful interfaces.")
          .font(FlowingTypography.standard.body.font)
          .foregroundStyle(FlowingPalette.muted)
      }
      Spacer(minLength: 12)
      FlowingBadge("Components", tone: .accent, emphasis: .strong)
    }
  }
}

private enum VisualRegressionError: Error {
  case incompatibleSignatures
  case invalidBitmap
  case invalidReferenceData
  case pngEncodingFailed
  case unsupportedReferenceVersion(Int)
}

private func tileBounds(
  column: Int,
  row: Int,
  width: Int,
  height: Int
) -> (x: Range<Int>, y: Range<Int>) {
  let minimumX = column * width / VisualSignature.columns
  let maximumX = (column + 1) * width / VisualSignature.columns
  let minimumY = row * height / VisualSignature.rows
  let maximumY = (row + 1) * height / VisualSignature.rows
  let x = minimumX..<maximumX
  let y = minimumY..<maximumY
  return (x, y)
}

private func averageColor(
  in bitmap: NSBitmapImageRep,
  bounds: (x: Range<Int>, y: Range<Int>)
) throws -> [UInt8] {
  var red = 0.0
  var green = 0.0
  var blue = 0.0
  var count = 0.0
  for y in stride(from: bounds.y.lowerBound, to: bounds.y.upperBound, by: 3) {
    for x in stride(from: bounds.x.lowerBound, to: bounds.x.upperBound, by: 3) {
      guard let color = bitmap.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB) else {
        throw VisualRegressionError.invalidBitmap
      }
      red += color.redComponent
      green += color.greenComponent
      blue += color.blueComponent
      count += 1
    }
  }
  return [red, green, blue].map { UInt8(($0 / count * 255).rounded()) }
}
