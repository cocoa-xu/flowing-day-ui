import FlowingDayCanvas
import SwiftUI

public struct FlowingGraphCanvasDefaultConnectionPreviewStyle {
  public let pendingColor: Color
  public let validColor: Color
  public let invalidColor: Color
  public let lineWidth: CGFloat
  public let targetDiameter: CGFloat

  public init(
    pendingColor: Color = .accentColor,
    validColor: Color = .green,
    invalidColor: Color = .red,
    lineWidth: CGFloat = 2,
    targetDiameter: CGFloat = 10
  ) {
    precondition(lineWidth > 0 && lineWidth.isFinite)
    precondition(targetDiameter > 0 && targetDiameter.isFinite)
    self.pendingColor = pendingColor
    self.validColor = validColor
    self.invalidColor = invalidColor
    self.lineWidth = lineWidth
    self.targetDiameter = targetDiameter
  }
}

public struct FlowingGraphCanvasDefaultConnectionPreview<
  Schema: FlowingGraphCanvasSchema
>: View {
  public let preview: FlowingGraphCanvasConnectionPreview<Schema>
  public let transform: FlowingCanvasTransform
  public let style: FlowingGraphCanvasDefaultConnectionPreviewStyle

  public init(
    preview: FlowingGraphCanvasConnectionPreview<Schema>,
    transform: FlowingCanvasTransform,
    style: FlowingGraphCanvasDefaultConnectionPreviewStyle = .init()
  ) {
    self.preview = preview
    self.transform = transform
    self.style = style
  }

  public var body: some View {
    let first = transformed(preview.first)
    let second = transformed(preview.second)
    let color = previewColor
    ZStack(alignment: .topLeading) {
      FlowingGraphCanvasConnectionPreviewPath(first: first, second: second)
        .stroke(
          color,
          style: StrokeStyle(
            lineWidth: style.lineWidth,
            lineCap: .round,
            lineJoin: .round,
            dash: preview.validation?.isValid == false ? [5, 4] : []
          )
        )
      Circle()
        .fill(color.opacity(0.16))
        .overlay {
          Circle().strokeBorder(color, lineWidth: style.lineWidth)
        }
        .frame(width: style.targetDiameter, height: style.targetDiameter)
        .position(second.position)
      if case .invalid(let feedback) = preview.validation,
        let message = feedback.message,
        !message.isEmpty
      {
        Text(message)
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(color)
          .padding(.horizontal, 7)
          .padding(.vertical, 4)
          .background(.background.opacity(0.94), in: RoundedRectangle(cornerRadius: 6))
          .position(x: second.position.x, y: second.position.y + 24)
      }
    }
    .allowsHitTesting(false)
    .accessibilityHidden(true)
  }

  private var previewColor: Color {
    switch preview.validation {
    case .valid:
      style.validColor
    case .invalid:
      style.invalidColor
    case nil:
      style.pendingColor
    }
  }

  private func transformed(_ anchor: FlowingGraphCanvasAnchor) -> FlowingGraphCanvasAnchor {
    FlowingGraphCanvasAnchor(
      position: transform.applying(to: anchor.position),
      normal: anchor.normal
    )
  }
}

private struct FlowingGraphCanvasConnectionPreviewPath: Shape {
  let first: FlowingGraphCanvasAnchor
  let second: FlowingGraphCanvasAnchor

  func path(in rect: CGRect) -> Path {
    let distance = hypot(
      second.position.x - first.position.x,
      second.position.y - first.position.y
    )
    let controlDistance = max(36, min(distance * 0.42, 160))
    let firstNormal = normalized(
      first.normal,
      fallback: CGVector(
        dx: second.position.x - first.position.x,
        dy: second.position.y - first.position.y
      )
    )
    let secondNormal = normalized(
      second.normal,
      fallback: CGVector(
        dx: first.position.x - second.position.x,
        dy: first.position.y - second.position.y
      )
    )
    var path = Path()
    path.move(to: first.position)
    path.addCurve(
      to: second.position,
      control1: CGPoint(
        x: first.position.x + firstNormal.dx * controlDistance,
        y: first.position.y + firstNormal.dy * controlDistance
      ),
      control2: CGPoint(
        x: second.position.x + secondNormal.dx * controlDistance,
        y: second.position.y + secondNormal.dy * controlDistance
      )
    )
    return path
  }

  private func normalized(_ vector: CGVector, fallback: CGVector) -> CGVector {
    let candidate = vector == .zero ? fallback : vector
    let length = hypot(candidate.dx, candidate.dy)
    guard length > 0 else { return .zero }
    return CGVector(dx: candidate.dx / length, dy: candidate.dy / length)
  }
}
