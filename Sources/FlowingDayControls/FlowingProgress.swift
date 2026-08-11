import SwiftUI

enum FlowingProgressMath {
  static func fraction(value: Double, total: Double) -> Double {
    guard value.isFinite, total.isFinite, total > 0 else { return 0 }
    return min(max(value / total, 0), 1)
  }
}

enum FlowingProgressMetrics {
  static let labelSpacing: CGFloat = 6
  static let trackHeight: CGFloat = 4
  static let activitySpacing: CGFloat = 8
}

public struct FlowingProgress<Label: View>: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingTypography) private var typography
  private let fraction: Double?
  private let label: Label

  public init(
    value: Double,
    total: Double = 1,
    @ViewBuilder label: () -> Label
  ) {
    fraction = FlowingProgressMath.fraction(value: value, total: total)
    self.label = label()
  }

  public init(@ViewBuilder label: () -> Label) {
    fraction = nil
    self.label = label()
  }

  public var body: some View {
    Group {
      if let fraction {
        VStack(
          alignment: .leading,
          spacing: FlowingProgressMetrics.labelSpacing
        ) {
          label
          GeometryReader { geometry in
            ZStack(alignment: .leading) {
              Capsule().fill(FlowingPalette.hairline)
              Capsule()
                .fill(accent.fill)
                .frame(width: geometry.size.width * fraction)
            }
          }
          .frame(height: FlowingProgressMetrics.trackHeight)
          .animation(progressAnimation, value: fraction)
        }
        .accessibilityRepresentation {
          ProgressView(value: fraction) {
            label
          }
        }
      } else {
        HStack(spacing: FlowingProgressMetrics.activitySpacing) {
          FlowingProgressActivityIndicator()
          label
        }
        .accessibilityRepresentation {
          ProgressView {
            label
          }
        }
      }
    }
    .font(typography.value.font)
    .foregroundStyle(FlowingPalette.muted)
  }

  private var progressAnimation: Animation? {
    reduceMotion ? nil : .easeOut(duration: FlowingMotion.selection)
  }
}

private struct FlowingProgressActivityIndicator: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.flowingAccent) private var accent

  var body: some View {
    TimelineView(.animation(paused: reduceMotion)) { context in
      Circle()
        .trim(from: 0.12, to: 0.76)
        .stroke(
          accent.fill,
          style: StrokeStyle(lineWidth: 2, lineCap: .round)
        )
        .rotationEffect(rotation(at: context.date))
    }
    .frame(width: 14, height: 14)
    .accessibilityHidden(true)
  }

  private func rotation(at date: Date) -> Angle {
    guard !reduceMotion else { return .degrees(-90) }
    let phase = date.timeIntervalSinceReferenceDate
      .truncatingRemainder(dividingBy: 0.9)
    return .degrees((phase / 0.9) * 360 - 90)
  }
}

extension FlowingProgress where Label == Text {
  public init(_ title: String, value: Double, total: Double = 1) {
    self.init(value: value, total: total) {
      Text(title)
    }
  }

  public init(_ title: String) {
    self.init {
      Text(title)
    }
  }
}
