import SwiftUI

public struct FlowingTooltipContent<Content: View>: View {
  @Environment(\.preferencesTypography) private var typography
  private let content: Content
  private let systemImage: String?
  private let title: String?

  public init(
    title: String? = nil,
    systemImage: String? = nil,
    @ViewBuilder content: () -> Content
  ) {
    self.title = title
    self.systemImage = systemImage
    self.content = content()
  }

  public var body: some View {
    HStack(alignment: .top, spacing: 8) {
      if let systemImage {
        Image(systemName: systemImage)
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(PreferencesPalette.muted)
          .frame(width: 15)
      }
      VStack(alignment: .leading, spacing: 2) {
        if let title {
          Text(title)
            .font(typography.rowTitle.font)
            .foregroundStyle(PreferencesPalette.ink)
        }
        content
          .font(typography.rowCaption.font)
          .foregroundStyle(PreferencesPalette.muted)
          .fixedSize(horizontal: false, vertical: true)
      }
    }
    .padding(.horizontal, FlowingTooltipMetrics.horizontalInset)
    .padding(.vertical, FlowingTooltipMetrics.verticalInset)
    .frame(maxWidth: FlowingTooltipMetrics.maximumWidth, alignment: .leading)
    .accessibilityElement(children: .combine)
  }
}

extension FlowingTooltipContent where Content == Text {
  public init(
    _ message: String,
    title: String? = nil,
    systemImage: String? = nil
  ) {
    self.init(title: title, systemImage: systemImage) {
      Text(message)
    }
  }
}

extension View {
  public func flowingTooltip<Tooltip: View>(
    _ accessibilityText: String,
    delay: TimeInterval = FlowingTooltipDefaults.delay,
    arrowEdge: Edge = .top,
    @ViewBuilder content: @escaping () -> Tooltip
  ) -> some View {
    precondition(delay.isFinite && delay >= 0)
    return modifier(
      FlowingTooltipModifier(
        accessibilityText: accessibilityText,
        delay: delay,
        arrowEdge: arrowEdge,
        tooltip: content
      )
    )
  }
}

private struct FlowingTooltipModifier<Tooltip: View>: ViewModifier {
  @FocusState private var isFocused: Bool
  @State private var isHovering = false
  @State private var isPresented = false
  @State private var presentationTask: Task<Void, Never>?
  let accessibilityText: String
  let delay: TimeInterval
  let arrowEdge: Edge
  let tooltip: () -> Tooltip

  func body(content: Content) -> some View {
    content
      .focused($isFocused)
      .accessibilityHint(accessibilityText)
      .onHover { hovering in
        isHovering = hovering
        updatePresentation()
      }
      .onChange(of: isFocused) { _ in
        updatePresentation()
      }
      .onDisappear {
        presentationTask?.cancel()
        presentationTask = nil
        isPresented = false
      }
      .popover(
        isPresented: $isPresented,
        attachmentAnchor: .rect(.bounds),
        arrowEdge: arrowEdge
      ) {
        tooltip()
          .allowsHitTesting(false)
      }
  }

  private func updatePresentation() {
    presentationTask?.cancel()
    presentationTask = nil

    guard isHovering || isFocused else {
      isPresented = false
      return
    }

    let nanoseconds = UInt64((delay * 1_000_000_000).rounded())
    presentationTask = Task { @MainActor in
      try? await Task.sleep(nanoseconds: nanoseconds)
      guard !Task.isCancelled, isHovering || isFocused else { return }
      isPresented = true
    }
  }
}

public struct FlowingPopover<Label: View, Content: View>: View {
  @Environment(\.preferencesStrings) private var strings
  @Binding private var isPresented: Bool
  private let accessibilityLabel: String
  private let arrowEdge: Edge
  private let attachmentAnchor: PopoverAttachmentAnchor
  private let content: Content
  private let contentInsets: EdgeInsets
  private let label: Label
  private let maximumWidth: CGFloat
  private let minimumWidth: CGFloat

  public init(
    isPresented: Binding<Bool>,
    accessibilityLabel: String,
    attachmentAnchor: PopoverAttachmentAnchor = .rect(.bounds),
    arrowEdge: Edge = .top,
    minimumWidth: CGFloat = 220,
    maximumWidth: CGFloat = 320,
    contentInsets: EdgeInsets = EdgeInsets(top: 13, leading: 13, bottom: 13, trailing: 13),
    @ViewBuilder label: () -> Label,
    @ViewBuilder content: () -> Content
  ) {
    precondition(minimumWidth.isFinite && minimumWidth >= 0)
    precondition(maximumWidth.isFinite && maximumWidth >= minimumWidth)
    _isPresented = isPresented
    self.accessibilityLabel = accessibilityLabel
    self.attachmentAnchor = attachmentAnchor
    self.arrowEdge = arrowEdge
    self.minimumWidth = minimumWidth
    self.maximumWidth = maximumWidth
    self.contentInsets = contentInsets
    self.label = label()
    self.content = content()
  }

  public var body: some View {
    Button {
      isPresented.toggle()
    } label: {
      label
    }
    .accessibilityLabel(accessibilityLabel)
    .accessibilityValue(isPresented ? strings.expanded : strings.collapsed)
    .accessibilityAddTraits(isPresented ? .isSelected : [])
    .popover(
      isPresented: $isPresented,
      attachmentAnchor: attachmentAnchor,
      arrowEdge: arrowEdge
    ) {
      FlowingPopoverSurface(
        minimumWidth: minimumWidth,
        maximumWidth: maximumWidth,
        contentInsets: contentInsets
      ) {
        content
      }
    }
  }
}

private struct FlowingPopoverSurface<Content: View>: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.preferencesSurfaces) private var surfaces
  let minimumWidth: CGFloat
  let maximumWidth: CGFloat
  let contentInsets: EdgeInsets
  let content: Content

  init(
    minimumWidth: CGFloat,
    maximumWidth: CGFloat,
    contentInsets: EdgeInsets,
    @ViewBuilder content: () -> Content
  ) {
    self.minimumWidth = minimumWidth
    self.maximumWidth = maximumWidth
    self.contentInsets = contentInsets
    self.content = content()
  }

  var body: some View {
    content
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(contentInsets)
      .frame(minWidth: minimumWidth, maxWidth: maximumWidth, alignment: .leading)
      .background(surfaces.canvas)
      .onExitCommand { dismiss() }
      .accessibilityElement(children: .contain)
  }
}

public enum FlowingTooltipDefaults {
  public static let delay: TimeInterval = 0.65
}

enum FlowingTooltipMetrics {
  static let maximumWidth: CGFloat = 260
  static let horizontalInset: CGFloat = 10
  static let verticalInset: CGFloat = 8
}
