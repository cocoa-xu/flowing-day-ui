import SwiftUI

public enum FlowingConfirmationKind: String, CaseIterable, Hashable, Sendable {
  case confirmation
  case warning
  case destructive

  var buttonRole: ButtonRole? {
    self == .destructive ? .destructive : nil
  }

  var severity: DialogSeverity {
    self == .confirmation ? .automatic : .critical
  }

  var systemImage: String? {
    switch self {
    case .confirmation: nil
    case .warning: "exclamationmark.triangle"
    case .destructive: "trash"
    }
  }
}

extension View {
  public func flowingConfirmationDialog(
    _ title: String,
    message: String? = nil,
    isPresented: Binding<Bool>,
    confirmationTitle: String,
    cancellationTitle: String = "Cancel",
    kind: FlowingConfirmationKind = .confirmation,
    confirmationIsDefault: Bool = true,
    onConfirm: @escaping () -> Void,
    onCancel: @escaping () -> Void = {}
  ) -> some View {
    modifier(
      FlowingConfirmationDialogModifier(
        title: title,
        message: message,
        isPresented: isPresented,
        confirmationTitle: confirmationTitle,
        cancellationTitle: cancellationTitle,
        kind: kind,
        confirmationIsDefault: confirmationIsDefault,
        onConfirm: onConfirm,
        onCancel: onCancel
      )
    )
  }

  public func flowingDialog<DialogContent: View>(
    isPresented: Binding<Bool>,
    onDismiss: (() -> Void)? = nil,
    @ViewBuilder content: @escaping () -> DialogContent
  ) -> some View {
    sheet(isPresented: isPresented, onDismiss: onDismiss, content: content)
  }
}

private struct FlowingConfirmationDialogModifier: ViewModifier {
  let title: String
  let message: String?
  @Binding var isPresented: Bool
  let confirmationTitle: String
  let cancellationTitle: String
  let kind: FlowingConfirmationKind
  let confirmationIsDefault: Bool
  let onConfirm: () -> Void
  let onCancel: () -> Void

  func body(content: Content) -> some View {
    content
      .alert(title, isPresented: $isPresented) {
        Button(cancellationTitle, role: .cancel, action: onCancel)
        Button(confirmationTitle, role: kind.buttonRole, action: onConfirm)
          .keyboardShortcut(confirmationIsDefault ? .defaultAction : nil)
      } message: {
        if let message {
          Text(message)
        }
      }
      .dialogIcon(kind.systemImage.map { Image(systemName: $0) })
      .dialogSeverity(kind.severity)
  }
}

public enum FlowingDialogActionEmphasis: String, CaseIterable, Hashable, Sendable {
  case standard
  case prominent
}

public struct FlowingDialogAction: View {
  private let action: () -> Void
  private let emphasis: FlowingDialogActionEmphasis
  private let keyboardShortcut: KeyboardShortcut?
  private let role: ButtonRole?
  private let systemImage: String?
  private let title: String

  public init(
    _ title: String,
    systemImage: String? = nil,
    role: ButtonRole? = nil,
    emphasis: FlowingDialogActionEmphasis = .standard,
    keyboardShortcut: KeyboardShortcut? = nil,
    action: @escaping () -> Void
  ) {
    self.title = title
    self.systemImage = systemImage
    self.role = role
    self.emphasis = emphasis
    self.keyboardShortcut = keyboardShortcut
    self.action = action
  }

  public var body: some View {
    Button(role: role, action: action) {
      if let systemImage {
        Label(title, systemImage: systemImage)
      } else {
        Text(title)
      }
    }
    .buttonStyle(FlowingDialogActionButtonStyle(emphasis: emphasis))
    .keyboardShortcut(keyboardShortcut)
  }
}

public struct FlowingDialog<Content: View, Actions: View>: View {
  @Environment(\.preferencesAccent) private var accent
  @Environment(\.preferencesSurfaces) private var surfaces
  @Environment(\.preferencesTypography) private var typography
  private let actions: Actions
  private let content: Content
  private let message: String?
  private let systemImage: String?
  private let title: String
  private let tone: FlowingStatusTone

  public init(
    _ title: String,
    message: String? = nil,
    systemImage: String? = nil,
    tone: FlowingStatusTone = .accent,
    @ViewBuilder content: () -> Content,
    @ViewBuilder actions: () -> Actions
  ) {
    self.title = title
    self.message = message
    self.systemImage = systemImage
    self.tone = tone
    self.content = content()
    self.actions = actions()
  }

  public var body: some View {
    VStack(spacing: 0) {
      header
        .padding(.horizontal, FlowingDialogMetrics.horizontalInset)
        .padding(.vertical, FlowingDialogMetrics.headerVerticalInset)

      FlowingSeparator()

      content
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(FlowingDialogMetrics.horizontalInset)

      FlowingSeparator()

      HStack(spacing: FlowingDialogMetrics.actionSpacing) {
        Spacer(minLength: 0)
        actions
      }
      .padding(.horizontal, FlowingDialogMetrics.horizontalInset)
      .padding(.vertical, FlowingDialogMetrics.actionVerticalInset)
    }
    .frame(
      minWidth: FlowingDialogMetrics.minimumWidth,
      idealWidth: FlowingDialogMetrics.idealWidth,
      maxWidth: FlowingDialogMetrics.maximumWidth
    )
    .background(surfaces.canvas)
    .accessibilityElement(children: .contain)
  }

  private var header: some View {
    HStack(alignment: .top, spacing: FlowingDialogMetrics.headerSpacing) {
      Image(systemName: systemImage ?? tone.defaultSystemImage)
        .font(.system(size: FlowingDialogMetrics.symbolSize, weight: .semibold))
        .foregroundStyle(toneColor)
        .frame(
          width: FlowingDialogMetrics.symbolContainerSize,
          height: FlowingDialogMetrics.symbolContainerSize
        )
        .background(toneColor.opacity(0.09), in: symbolShape)

      VStack(alignment: .leading, spacing: 3) {
        Text(title)
          .font(typography.contentTitle.font)
          .foregroundStyle(PreferencesPalette.ink)
        if let message {
          Text(message)
            .font(typography.body.font)
            .foregroundStyle(PreferencesPalette.muted)
            .fixedSize(horizontal: false, vertical: true)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  private var toneColor: Color {
    tone.color(accent: accent)
  }

  private var symbolShape: RoundedRectangle {
    RoundedRectangle(cornerRadius: 10, style: .continuous)
  }
}

private enum FlowingDialogMetrics {
  static let minimumWidth: CGFloat = 380
  static let idealWidth: CGFloat = 440
  static let maximumWidth: CGFloat = 560
  static let horizontalInset: CGFloat = 20
  static let headerVerticalInset: CGFloat = 18
  static let actionVerticalInset: CGFloat = 14
  static let headerSpacing: CGFloat = 12
  static let actionSpacing: CGFloat = 8
  static let symbolSize: CGFloat = 14
  static let symbolContainerSize: CGFloat = 32
}

private struct FlowingDialogActionButtonStyle: ButtonStyle {
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.preferencesAccent) private var accent
  @Environment(\.preferencesMetrics) private var metrics
  @Environment(\.preferencesTypography) private var typography
  let emphasis: FlowingDialogActionEmphasis

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(typography.buttonLabel.font)
      .foregroundStyle(foreground(role: configuration.role))
      .lineLimit(1)
      .padding(.horizontal, 12)
      .frame(minHeight: 29)
      .background(background(role: configuration.role), in: shape)
      .overlay {
        shape.strokeBorder(border(role: configuration.role))
      }
      .opacity(opacity(isPressed: configuration.isPressed))
  }

  private func foreground(role: ButtonRole?) -> Color {
    if role == .destructive, emphasis == .standard {
      return .red
    }
    return emphasis == .prominent ? .white : accent.foreground
  }

  private func background(role: ButtonRole?) -> Color {
    if role == .destructive {
      return emphasis == .prominent ? .red : Color.red.opacity(0.08)
    }
    return emphasis == .prominent ? accent.fill : accent.veil
  }

  private func border(role: ButtonRole?) -> Color {
    if emphasis == .prominent {
      return .clear
    }
    return role == .destructive ? Color.red.opacity(0.16) : PreferencesPalette.hairline
  }

  private var shape: RoundedRectangle {
    RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
  }

  private func opacity(isPressed: Bool) -> Double {
    guard isEnabled else { return 0.42 }
    return isPressed ? 0.62 : 1
  }
}
