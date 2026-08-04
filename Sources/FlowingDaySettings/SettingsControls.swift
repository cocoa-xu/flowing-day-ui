import AppKit
import SwiftUI

public struct SettingsSectionHeader: View {
  @Environment(\.settingsTypography) private var typography
  private let title: String

  public init(_ title: String) {
    self.title = title
  }

  public var body: some View {
    Text(title.uppercased())
      .font(typography.sectionHeader.font)
      .tracking(0.7)
      .foregroundStyle(SettingsPalette.faint)
      .padding(.leading, 4)
      .padding(.bottom, 7)
  }
}

public struct SettingsCard<Content: View>: View {
  @Environment(\.settingsMetrics) private var metrics
  @Environment(\.settingsSurfaces) private var surfaces
  private let content: Content

  public init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  public var body: some View {
    VStack(spacing: 0) {
      content
    }
    .background(surfaces.card)
    .clipShape(RoundedRectangle(cornerRadius: metrics.cardRadius, style: .continuous))
    .overlay {
      RoundedRectangle(cornerRadius: metrics.cardRadius, style: .continuous)
        .strokeBorder(SettingsPalette.edge)
    }
  }
}

public struct SettingsRowSeparator: View {
  @Environment(\.settingsMetrics) private var metrics
  private let isIndented: Bool

  public init(isIndented: Bool = false) {
    self.isIndented = isIndented
  }

  public var body: some View {
    Rectangle()
      .fill(SettingsPalette.hairline)
      .frame(height: 1)
      .padding(.leading, metrics.rowInset + (isIndented ? 34 : 0))
  }
}

public struct SettingsPaneStack<Content: View>: View {
  @Environment(\.settingsMetrics) private var metrics
  private let content: Content

  public init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: metrics.sectionSpacing) {
      content
    }
  }
}

public struct SettingsSection<Content: View>: View {
  @Environment(\.settingsTypography) private var typography
  private let title: String
  private let footer: String?
  private let content: Content

  public init(
    _ title: String,
    footer: String? = nil,
    @ViewBuilder content: () -> Content
  ) {
    self.title = title
    self.footer = footer
    self.content = content()
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      SettingsSectionHeader(title)
      SettingsCard { content }
      if let footer {
        Text(footer)
          .font(typography.rowCaption.font)
          .foregroundStyle(SettingsPalette.faint)
          .fixedSize(horizontal: false, vertical: true)
          .padding(.horizontal, 4)
          .padding(.top, 7)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

public struct SettingsRow<Trailing: View>: View {
  @Environment(\.settingsMetrics) private var metrics
  @Environment(\.settingsTypography) private var typography
  private let symbol: String?
  private let title: String
  private let caption: String?
  private let trailing: Trailing

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    @ViewBuilder trailing: () -> Trailing
  ) {
    self.symbol = symbol
    self.title = title
    self.caption = caption
    self.trailing = trailing()
  }

  public var body: some View {
    HStack(alignment: .center, spacing: 14) {
      if let symbol {
        Image(systemName: symbol)
          .font(.system(size: 13, weight: .medium))
          .foregroundStyle(SettingsPalette.muted)
          .frame(width: 20)
      }
      VStack(alignment: .leading, spacing: 2) {
        Text(title)
          .font(typography.rowTitle.font)
          .foregroundStyle(SettingsPalette.ink)
        if let caption {
          Text(caption)
            .font(typography.rowCaption.font)
            .foregroundStyle(SettingsPalette.faint)
            .fixedSize(horizontal: false, vertical: true)
        }
      }
      Spacer(minLength: 10)
      trailing
    }
    .padding(.horizontal, metrics.rowInset)
    .padding(.vertical, caption == nil ? 10 : 11)
    .frame(minHeight: 42)
  }
}

extension SettingsRow where Trailing == EmptyView {
  public init(symbol: String? = nil, title: String, caption: String? = nil) {
    self.init(symbol: symbol, title: title, caption: caption) { EmptyView() }
  }
}

public struct SettingsSwitchRow: View {
  private let symbol: String?
  private let title: String
  private let caption: String?
  @Binding private var isOn: Bool

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    isOn: Binding<Bool>
  ) {
    self.symbol = symbol
    self.title = title
    self.caption = caption
    _isOn = isOn
  }

  public var body: some View {
    SettingsRow(symbol: symbol, title: title, caption: caption) {
      SettingsSwitch(isOn: $isOn)
    }
  }
}

public struct SettingsSwitch: View {
  @Binding private var isOn: Bool

  public init(isOn: Binding<Bool>) {
    _isOn = isOn
  }

  public var body: some View {
    Toggle("", isOn: $isOn)
      .toggleStyle(.switch)
      .labelsHidden()
      .controlSize(.small)
  }
}

public struct SettingsSliderRow: View {
  @Environment(\.settingsMetrics) private var metrics
  @Environment(\.settingsTypography) private var typography
  private let symbol: String?
  private let title: String
  private let caption: String?
  @Binding private var value: Double
  private let range: ClosedRange<Double>
  private let step: Double?
  private let format: (Double) -> String

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    value: Binding<Double>,
    in range: ClosedRange<Double>,
    step: Double? = nil,
    format: @escaping (Double) -> String
  ) {
    self.symbol = symbol
    self.title = title
    self.caption = caption
    _value = value
    self.range = range
    self.step = step
    self.format = format
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      HStack(spacing: 10) {
        if let symbol {
          Image(systemName: symbol)
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(SettingsPalette.muted)
            .frame(width: 20)
        }
        Text(title)
          .font(typography.rowTitle.font)
          .foregroundStyle(SettingsPalette.ink)
        Spacer(minLength: 10)
        Text(format(value))
          .font(typography.sliderValue.font)
          .foregroundStyle(SettingsPalette.muted)
      }
      SettingsSlider(value: $value, range: range, step: step)
      if let caption {
        Text(caption)
          .font(typography.rowCaption.font)
          .foregroundStyle(SettingsPalette.faint)
          .fixedSize(horizontal: false, vertical: true)
      }
    }
    .padding(.horizontal, metrics.rowInset)
    .padding(.vertical, 11)
  }
}

public enum SettingsSliderMath {
  public static func fraction(
    of value: Double,
    in range: ClosedRange<Double>
  ) -> Double {
    let span = range.upperBound - range.lowerBound
    guard span > 0 else { return 0 }
    return min(max((value - range.lowerBound) / span, 0), 1)
  }

  public static func value(
    atFraction fraction: Double,
    in range: ClosedRange<Double>
  ) -> Double {
    let clamped = min(max(fraction, 0), 1)
    return range.lowerBound + clamped * (range.upperBound - range.lowerBound)
  }
}

public struct SettingsSlider: View {
  @Binding private var value: Double
  private let range: ClosedRange<Double>
  private let step: Double?
  @Environment(\.settingsAccent) private var accent

  public init(
    value: Binding<Double>,
    range: ClosedRange<Double>,
    step: Double? = nil
  ) {
    _value = value
    self.range = range
    self.step = step
  }

  public var body: some View {
    SettingsSliderRepresentable(value: $value, range: range, step: step, accent: accent)
      .frame(height: 16)
      .accessibilityElement()
      .accessibilityValue(Text(String(format: "%.2f", value)))
      .accessibilityAdjustableAction { direction in
        let delta = step ?? (range.upperBound - range.lowerBound) / 20
        let proposed = value + (direction == .increment ? delta : -delta)
        value = min(max(proposed, range.lowerBound), range.upperBound)
      }
  }
}

private struct SettingsSliderRepresentable: NSViewRepresentable {
  @Binding var value: Double
  let range: ClosedRange<Double>
  let step: Double?
  let accent: SettingsAccent

  func makeCoordinator() -> Coordinator {
    Coordinator(value: $value)
  }

  func makeNSView(context: Context) -> SettingsSliderControl {
    let control = SettingsSliderControl()
    control.target = context.coordinator
    control.action = #selector(Coordinator.valueChanged(_:))
    return control
  }

  func updateNSView(_ control: SettingsSliderControl, context: Context) {
    context.coordinator.value = $value
    control.value = value
    control.range = range
    control.step = step
    control.accentColor = NSColor(accent.fill)
    control.trackColor = NSColor(SettingsPalette.hairline)
    control.knobColor = SettingsPalette.sliderKnobColor
    control.knobBorderColor = SettingsPalette.sliderKnobBorderColor
    control.needsDisplay = true
  }

  final class Coordinator: NSObject {
    var value: Binding<Double>

    init(value: Binding<Double>) {
      self.value = value
    }

    @MainActor
    @objc func valueChanged(_ sender: SettingsSliderControl) {
      value.wrappedValue = sender.value
    }
  }
}

final class SettingsSliderControl: NSControl {
  var value = 0.0
  var range = 0.0...1.0
  var step: Double?
  var accentColor = NSColor.controlAccentColor
  var trackColor = NSColor.separatorColor
  var knobColor = NSColor.controlBackgroundColor
  var knobBorderColor = NSColor.separatorColor

  private let knobDiameter: CGFloat = 13
  private let trackHeight: CGFloat = 3

  override var mouseDownCanMoveWindow: Bool { false }

  override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
    true
  }

  override func mouseDown(with event: NSEvent) {
    updateValue(with: event)
  }

  override func mouseDragged(with event: NSEvent) {
    updateValue(with: event)
  }

  override func draw(_ dirtyRect: NSRect) {
    let usableWidth = max(bounds.width - knobDiameter, 1)
    let fraction = SettingsSliderMath.fraction(of: value, in: range)
    let knobX = usableWidth * fraction
    let trackRect = NSRect(
      x: knobDiameter / 2,
      y: bounds.midY - trackHeight / 2,
      width: usableWidth,
      height: trackHeight
    )
    let progressRect = NSRect(
      x: trackRect.minX,
      y: trackRect.minY,
      width: knobX,
      height: trackHeight
    )
    let knobRect = NSRect(
      x: knobX,
      y: bounds.midY - knobDiameter / 2,
      width: knobDiameter,
      height: knobDiameter
    )

    trackColor.setFill()
    NSBezierPath(
      roundedRect: trackRect,
      xRadius: trackHeight / 2,
      yRadius: trackHeight / 2
    ).fill()

    accentColor.setFill()
    NSBezierPath(
      roundedRect: progressRect,
      xRadius: trackHeight / 2,
      yRadius: trackHeight / 2
    ).fill()

    NSGraphicsContext.saveGraphicsState()
    let shadow = NSShadow()
    shadow.shadowColor = NSColor.black.withAlphaComponent(0.16)
    shadow.shadowBlurRadius = 1.5
    shadow.shadowOffset = NSSize(width: 0, height: -0.5)
    shadow.set()
    knobColor.setFill()
    NSBezierPath(ovalIn: knobRect).fill()
    NSGraphicsContext.restoreGraphicsState()

    knobBorderColor.setStroke()
    let border = NSBezierPath(ovalIn: knobRect.insetBy(dx: 0.25, dy: 0.25))
    border.lineWidth = 0.5
    border.stroke()
  }

  private func updateValue(with event: NSEvent) {
    let location = convert(event.locationInWindow, from: nil)
    let usableWidth = max(bounds.width - knobDiameter, 1)
    let fraction = (location.x - knobDiameter / 2) / usableWidth
    let proposed = SettingsSliderMath.value(atFraction: fraction, in: range)
    if let step, step > 0 {
      let steps = ((proposed - range.lowerBound) / step).rounded()
      value = min(max(range.lowerBound + steps * step, range.lowerBound), range.upperBound)
    } else {
      value = proposed
    }
    needsDisplay = true
    sendAction(action, to: target)
  }
}

public struct SettingsPopupOption<Value: Hashable>: Identifiable {
  public let value: Value
  public let label: String
  public var id: Value { value }

  public init(_ value: Value, label: String) {
    self.value = value
    self.label = label
  }
}

public struct SettingsPopupRow<Value: Hashable>: View {
  @Environment(\.settingsAccent) private var accent
  @Environment(\.settingsStrings) private var strings
  @Environment(\.settingsMetrics) private var metrics
  @Environment(\.settingsTypography) private var typography
  @Environment(\.settingsSurfaces) private var surfaces
  private let symbol: String?
  private let title: String
  private let caption: String?
  private let minimumControlWidth: CGFloat?
  @Binding private var selection: Value
  private let options: [SettingsPopupOption<Value>]

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    minimumControlWidth: CGFloat? = nil,
    selection: Binding<Value>,
    options: [SettingsPopupOption<Value>]
  ) {
    self.symbol = symbol
    self.title = title
    self.caption = caption
    self.minimumControlWidth = minimumControlWidth
    _selection = selection
    self.options = options
  }

  public var body: some View {
    SettingsRow(symbol: symbol, title: title, caption: caption) {
      SettingsPopupControl(
        selection: $selection,
        options: options,
        minimumWidth: minimumControlWidth ?? 0,
        accent: accent,
        strings: strings,
        controlRadius: metrics.controlRadius,
        textStyle: typography.value,
        optionTextStyle: typography.selectionLabel,
        menuBackgroundColor: surfaces.control
      )
      .fixedSize()
    }
  }
}

public struct SettingsSegmentedRow<Value: Hashable>: View {
  private let symbol: String?
  private let title: String
  private let caption: String?
  private let controlWidth: CGFloat
  @Binding private var selection: Value
  private let options: [SettingsPopupOption<Value>]

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    controlWidth: CGFloat = 300,
    selection: Binding<Value>,
    options: [SettingsPopupOption<Value>]
  ) {
    self.symbol = symbol
    self.title = title
    self.caption = caption
    self.controlWidth = controlWidth
    _selection = selection
    self.options = options
  }

  public var body: some View {
    SettingsRow(symbol: symbol, title: title, caption: caption) {
      HStack(spacing: 6) {
        ForEach(options) { option in
          SettingsSelectionButton(
            title: option.label,
            isSelected: selection == option.value,
            isCompact: true,
            style: .single
          ) {
            selection = option.value
          }
        }
      }
      .frame(width: controlWidth)
    }
  }
}

public struct SettingsSymbolSegmentOption<Value: Hashable>: Identifiable {
  public let value: Value
  public let label: String
  public let symbol: String?
  public var id: Value { value }

  public init(_ value: Value, label: String, symbol: String? = nil) {
    self.value = value
    self.label = label
    self.symbol = symbol
  }
}

public struct SettingsSymbolSegmentedRow<Value: Hashable>: View {
  private let rowSymbol: String?
  private let title: String
  private let caption: String?
  private let controlWidth: CGFloat
  @Binding private var selection: Value
  private let options: [SettingsSymbolSegmentOption<Value>]

  public init(
    rowSymbol: String? = nil,
    title: String,
    caption: String? = nil,
    controlWidth: CGFloat = 300,
    selection: Binding<Value>,
    options: [SettingsSymbolSegmentOption<Value>]
  ) {
    self.rowSymbol = rowSymbol
    self.title = title
    self.caption = caption
    self.controlWidth = controlWidth
    _selection = selection
    self.options = options
  }

  public var body: some View {
    SettingsRow(symbol: rowSymbol, title: title, caption: caption) {
      HStack(spacing: 6) {
        ForEach(options) { option in
          SettingsSymbolSelectionButton(
            label: option.label,
            symbol: option.symbol,
            isSelected: selection == option.value
          ) {
            selection = option.value
          }
        }
      }
      .frame(width: controlWidth)
    }
  }
}

public struct SettingsCheckToggle: View {
  private let title: String
  @Binding private var isOn: Bool

  public init(_ title: String, isOn: Binding<Bool>) {
    self.title = title
    _isOn = isOn
  }

  public var body: some View {
    SettingsSelectionButton(
      title: title,
      isSelected: isOn,
      style: .multiple
    ) {
      isOn.toggle()
    }
  }
}

enum SettingsSelectionStyle {
  case single
  case multiple

  func symbol(isSelected: Bool) -> String? {
    switch (self, isSelected) {
    case (.single, _): nil
    case (.multiple, true): "checkmark.circle.fill"
    case (.multiple, false): "circle"
    }
  }
}

private struct SettingsSelectionButton: View {
  @Environment(\.settingsAccent) private var accent
  @Environment(\.settingsStrings) private var strings
  @Environment(\.settingsMetrics) private var metrics
  @Environment(\.settingsTypography) private var typography
  @Environment(\.settingsSurfaces) private var surfaces
  let title: String
  let isSelected: Bool
  var isCompact = false
  let style: SettingsSelectionStyle
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 6) {
        if let symbol = style.symbol(isSelected: isSelected) {
          Image(systemName: symbol)
            .font(.system(size: 11, weight: .semibold))
        }
        Text(title)
          .font(typography.selectionLabel.font)
          .lineLimit(1)
          .minimumScaleFactor(isCompact ? 0.72 : 1)
      }
      .foregroundStyle(isSelected ? accent.foreground : SettingsPalette.muted)
      .frame(maxWidth: .infinity)
      .padding(.horizontal, isCompact ? 6 : 9)
      .padding(.vertical, 7)
      .background(
        isSelected ? accent.wash : surfaces.control,
        in: RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
      )
      .overlay {
        RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
          .strokeBorder(
            isSelected ? accent.foreground.opacity(0.22) : SettingsPalette.hairline
          )
      }
    }
    .buttonStyle(.plain)
    .animation(.default, value: isSelected)
    .accessibilityValue(isSelected ? strings.selected : strings.notSelected)
  }
}

private struct SettingsSymbolSelectionButton: View {
  @Environment(\.settingsAccent) private var accent
  @Environment(\.settingsStrings) private var strings
  @Environment(\.settingsMetrics) private var metrics
  @Environment(\.settingsTypography) private var typography
  @Environment(\.settingsSurfaces) private var surfaces
  let label: String
  let symbol: String?
  let isSelected: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Group {
        if let symbol {
          Image(systemName: symbol)
            .font(.system(size: 12, weight: .semibold))
        } else {
          Text(label)
            .font(typography.selectionLabel.font)
            .lineLimit(1)
        }
      }
      .foregroundStyle(isSelected ? accent.foreground : SettingsPalette.muted)
      .frame(maxWidth: .infinity)
      .padding(.horizontal, 6)
      .padding(.vertical, 8)
      .background(
        isSelected ? accent.wash : surfaces.control,
        in: RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
      )
      .overlay {
        RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
          .strokeBorder(
            isSelected ? accent.foreground.opacity(0.22) : SettingsPalette.hairline
          )
      }
    }
    .buttonStyle(.plain)
    .help(label)
    .accessibilityLabel(label)
    .accessibilityValue(isSelected ? strings.selected : strings.notSelected)
    .animation(.default, value: isSelected)
  }
}

public struct SettingsButtonRow: View {
  private let symbol: String?
  private let title: String
  private let caption: String?
  private let buttonTitle: String
  private let action: () -> Void

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    buttonTitle: String,
    action: @escaping () -> Void
  ) {
    self.symbol = symbol
    self.title = title
    self.caption = caption
    self.buttonTitle = buttonTitle
    self.action = action
  }

  public var body: some View {
    SettingsRow(symbol: symbol, title: title, caption: caption) {
      Button(buttonTitle, action: action)
        .buttonStyle(SettingsSoftButtonStyle())
    }
  }
}

public struct SettingsExpandableRow: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.settingsAccent) private var accent
  @Environment(\.settingsStrings) private var strings
  @Environment(\.settingsMetrics) private var metrics
  @Environment(\.settingsTypography) private var typography
  private let symbol: String?
  private let title: String
  private let caption: String?
  @Binding private var isExpanded: Bool

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    isExpanded: Binding<Bool>
  ) {
    self.symbol = symbol
    self.title = title
    self.caption = caption
    _isExpanded = isExpanded
  }

  public var body: some View {
    Button {
      isExpanded.toggle()
    } label: {
      HStack(alignment: .center, spacing: 14) {
        if let symbol {
          Image(systemName: symbol)
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(SettingsPalette.muted)
            .frame(width: 20)
        }
        VStack(alignment: .leading, spacing: 2) {
          Text(title)
            .font(typography.rowTitle.font)
            .foregroundStyle(SettingsPalette.ink)
          if let caption {
            Text(caption)
              .font(typography.rowCaption.font)
              .foregroundStyle(SettingsPalette.faint)
              .fixedSize(horizontal: false, vertical: true)
          }
        }
        Spacer(minLength: 10)
        Image(systemName: "chevron.down")
          .font(.system(size: 10, weight: .semibold))
          .foregroundStyle(accent.foreground)
          .rotationEffect(.degrees(isExpanded ? 180 : 0))
      }
      .padding(.horizontal, metrics.rowInset)
      .padding(.vertical, caption == nil ? 10 : 11)
      .frame(minHeight: 42)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .animation(reduceMotion ? nil : .easeOut(duration: 0.18), value: isExpanded)
    .accessibilityValue(isExpanded ? strings.expanded : strings.collapsed)
  }
}

public struct SettingsValueRow<Trailing: View>: View {
  @Environment(\.settingsTypography) private var typography
  private let symbol: String?
  private let title: String
  private let value: String
  private let trailing: Trailing

  public init(
    symbol: String? = nil,
    title: String,
    value: String,
    @ViewBuilder trailing: () -> Trailing
  ) {
    self.symbol = symbol
    self.title = title
    self.value = value
    self.trailing = trailing()
  }

  public var body: some View {
    SettingsRow(symbol: symbol, title: title) {
      HStack(spacing: 10) {
        Text(value)
          .font(typography.value.font)
          .foregroundStyle(SettingsPalette.muted)
          .lineLimit(1)
          .truncationMode(.middle)
          .textSelection(.enabled)
        trailing
      }
    }
  }
}

extension SettingsValueRow where Trailing == EmptyView {
  public init(symbol: String? = nil, title: String, value: String) {
    self.init(symbol: symbol, title: title, value: value) { EmptyView() }
  }
}

public struct SettingsEmptyRow: View {
  @Environment(\.settingsMetrics) private var metrics
  @Environment(\.settingsTypography) private var typography
  private let message: String
  private let symbol: String?

  public init(_ message: String, symbol: String? = nil) {
    self.message = message
    self.symbol = symbol
  }

  public var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 8) {
      if let symbol {
        Image(systemName: symbol)
      }
      Text(message)
        .fixedSize(horizontal: false, vertical: true)
    }
    .font(typography.value.font)
    .foregroundStyle(SettingsPalette.faint)
    .padding(.horizontal, metrics.rowInset)
    .padding(.vertical, 14)
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

public struct SettingsChip: View {
  @Environment(\.settingsAccent) private var accent
  @Environment(\.settingsTypography) private var typography
  @State private var isHovering = false
  private let title: String
  private let action: () -> Void

  public init(_ title: String, action: @escaping () -> Void) {
    self.title = title
    self.action = action
  }

  public var body: some View {
    Button(action: action) {
      Text(title)
        .font(typography.selectionLabel.font)
        .foregroundStyle(accent.foreground)
        .lineLimit(1)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(
          isHovering ? accent.wash : accent.veil,
          in: RoundedRectangle(cornerRadius: 8, style: .continuous)
        )
    }
    .buttonStyle(.plain)
    .onHover { isHovering = $0 }
  }
}

public struct SettingsTag: View {
  @Environment(\.settingsAccent) private var accent
  @Environment(\.settingsTypography) private var typography
  private let title: String

  public init(_ title: String) {
    self.title = title
  }

  public var body: some View {
    Text(title)
      .font(typography.tag.font)
      .foregroundStyle(accent.foreground)
      .lineLimit(1)
      .fixedSize(horizontal: true, vertical: false)
      .padding(.horizontal, 10)
      .padding(.vertical, 6)
      .background(accent.veil, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
  }
}

public struct SettingsFlowGrid<Item: Identifiable, Label: View>: View {
  @Environment(\.settingsMetrics) private var metrics
  private let items: [Item]
  private let spacing: CGFloat
  private let label: (Item) -> Label

  public init(
    items: [Item],
    spacing: CGFloat = 7,
    @ViewBuilder label: @escaping (Item) -> Label
  ) {
    self.items = items
    self.spacing = spacing
    self.label = label
  }

  public var body: some View {
    SettingsWrappingLayout(spacing: spacing) {
      ForEach(items) { label($0) }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, metrics.rowInset)
    .padding(.vertical, 13)
  }
}

private struct SettingsWrappingLayout: Layout {
  let spacing: CGFloat

  func sizeThatFits(
    proposal: ProposedViewSize,
    subviews: Subviews,
    cache: inout ()
  ) -> CGSize {
    layout(
      subviews: subviews,
      width: proposal.width ?? .greatestFiniteMagnitude
    ).size
  }

  func placeSubviews(
    in bounds: CGRect,
    proposal: ProposedViewSize,
    subviews: Subviews,
    cache: inout ()
  ) {
    let result = layout(subviews: subviews, width: bounds.width)
    for (index, origin) in result.origins.enumerated() {
      subviews[index].place(
        at: CGPoint(x: bounds.minX + origin.x, y: bounds.minY + origin.y),
        proposal: .unspecified
      )
    }
  }

  private func layout(
    subviews: Subviews,
    width: CGFloat
  ) -> (size: CGSize, origins: [CGPoint]) {
    var origins: [CGPoint] = []
    var x: CGFloat = 0
    var y: CGFloat = 0
    var rowHeight: CGFloat = 0
    var usedWidth: CGFloat = 0

    for subview in subviews {
      let size = subview.sizeThatFits(.unspecified)
      if x > 0, x + size.width > width {
        x = 0
        y += rowHeight + spacing
        rowHeight = 0
      }
      origins.append(CGPoint(x: x, y: y))
      x += size.width + spacing
      rowHeight = max(rowHeight, size.height)
      usedWidth = max(usedWidth, x - spacing)
    }

    return (
      CGSize(width: min(usedWidth, width), height: y + rowHeight),
      origins
    )
  }
}

public struct SettingsGrid<Item: Identifiable, Label: View>: View {
  @Environment(\.settingsMetrics) private var metrics
  private let items: [Item]
  private let minimumWidth: CGFloat
  private let label: (Item) -> Label

  public init(
    items: [Item],
    minimumWidth: CGFloat = 96,
    @ViewBuilder label: @escaping (Item) -> Label
  ) {
    self.items = items
    self.minimumWidth = minimumWidth
    self.label = label
  }

  public var body: some View {
    LazyVGrid(
      columns: [GridItem(.adaptive(minimum: minimumWidth), spacing: 7)],
      spacing: 7
    ) {
      ForEach(items) { label($0) }
    }
    .padding(.horizontal, metrics.rowInset)
    .padding(.vertical, 13)
  }
}

public struct SettingsSoftButtonStyle: ButtonStyle {
  @Environment(\.settingsAccent) private var accent
  @Environment(\.settingsMetrics) private var metrics
  @Environment(\.settingsTypography) private var typography
  private let isProminent: Bool

  public init(isProminent: Bool = false) {
    self.isProminent = isProminent
  }

  public func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(typography.buttonLabel.font)
      .foregroundStyle(
        isProminent
          ? AnyShapeStyle(Color.white)
          : AnyShapeStyle(accent.foreground)
      )
      .padding(.horizontal, 12)
      .padding(.vertical, 5)
      .background {
        RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
          .fill(
            isProminent
              ? AnyShapeStyle(accent.fill)
              : AnyShapeStyle(accent.veil)
          )
      }
      .overlay {
        RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
          .strokeBorder(isProminent ? Color.clear : SettingsPalette.hairline)
      }
      .opacity(configuration.isPressed ? 0.6 : 1)
  }
}
