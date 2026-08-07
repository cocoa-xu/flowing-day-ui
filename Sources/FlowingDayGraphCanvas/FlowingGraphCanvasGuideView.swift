import FlowingDayCanvas
import Foundation
import SwiftUI

public struct FlowingGraphCanvasGuideRenderContext: Equatable, Sendable {
  public let guide: FlowingGraphCanvasGuide
  public let renderedStart: CGPoint
  public let renderedEnd: CGPoint
  public let renderedLength: CGFloat

  public init(
    guide: FlowingGraphCanvasGuide,
    transform: FlowingCanvasTransform
  ) {
    let start: CGPoint
    let end: CGPoint
    switch guide.axis {
    case .horizontal:
      start = CGPoint(x: guide.lowerBound, y: guide.position)
      end = CGPoint(x: guide.upperBound, y: guide.position)
    case .vertical:
      start = CGPoint(x: guide.position, y: guide.lowerBound)
      end = CGPoint(x: guide.position, y: guide.upperBound)
    }
    renderedStart = transform.applying(to: start)
    renderedEnd = transform.applying(to: end)
    renderedLength = hypot(
      renderedEnd.x - renderedStart.x,
      renderedEnd.y - renderedStart.y
    )
    self.guide = guide
  }

  public var renderedMidpoint: CGPoint {
    CGPoint(
      x: (renderedStart.x + renderedEnd.x) / 2,
      y: (renderedStart.y + renderedEnd.y) / 2
    )
  }

  public var usesEndpointTicks: Bool {
    guide.kind == .equalSpacing || guide.kind == .equalSize || guide.kind == .resize
  }
}

public struct FlowingGraphCanvasDefaultGuideStyle {
  public let lineColor: Color
  public let labelForegroundColor: Color
  public let labelBackgroundColor: Color
  public let lineWidth: CGFloat
  public let tickLength: CGFloat
  public let gridDash: [CGFloat]
  public let minimumLabelLength: CGFloat
  public let labelFontSize: CGFloat
  public let labelHorizontalPadding: CGFloat
  public let labelVerticalPadding: CGFloat

  public init(
    lineColor: Color = .accentColor.opacity(0.84),
    labelForegroundColor: Color = .white,
    labelBackgroundColor: Color = .accentColor,
    lineWidth: CGFloat = 1,
    tickLength: CGFloat = 7,
    gridDash: [CGFloat] = [3, 3],
    minimumLabelLength: CGFloat = 24,
    labelFontSize: CGFloat = 9,
    labelHorizontalPadding: CGFloat = 5,
    labelVerticalPadding: CGFloat = 2
  ) {
    precondition(lineWidth > 0 && lineWidth.isFinite)
    precondition(tickLength >= 0 && tickLength.isFinite)
    precondition(gridDash.allSatisfy { $0 >= 0 && $0.isFinite })
    precondition(minimumLabelLength >= 0 && minimumLabelLength.isFinite)
    precondition(labelFontSize > 0 && labelFontSize.isFinite)
    precondition(labelHorizontalPadding >= 0 && labelHorizontalPadding.isFinite)
    precondition(labelVerticalPadding >= 0 && labelVerticalPadding.isFinite)
    self.lineColor = lineColor
    self.labelForegroundColor = labelForegroundColor
    self.labelBackgroundColor = labelBackgroundColor
    self.lineWidth = lineWidth
    self.tickLength = tickLength
    self.gridDash = gridDash
    self.minimumLabelLength = minimumLabelLength
    self.labelFontSize = labelFontSize
    self.labelHorizontalPadding = labelHorizontalPadding
    self.labelVerticalPadding = labelVerticalPadding
  }
}

public struct FlowingGraphCanvasGuideLayer<Content: View>: View {
  private let guides: [FlowingGraphCanvasGuide]
  private let transform: FlowingCanvasTransform
  private let content: (FlowingGraphCanvasGuideRenderContext) -> Content

  public init(
    guides: [FlowingGraphCanvasGuide],
    transform: FlowingCanvasTransform,
    @ViewBuilder content: @escaping (FlowingGraphCanvasGuideRenderContext) -> Content
  ) {
    self.guides = guides
    self.transform = transform
    self.content = content
  }

  public var body: some View {
    ZStack(alignment: .topLeading) {
      ForEach(guides.indices, id: \.self) { index in
        content(
          FlowingGraphCanvasGuideRenderContext(
            guide: guides[index],
            transform: transform
          )
        )
      }
    }
    .allowsHitTesting(false)
  }
}

public struct FlowingGraphCanvasDefaultGuide: View {
  public let context: FlowingGraphCanvasGuideRenderContext
  public let style: FlowingGraphCanvasDefaultGuideStyle
  public let measurementText: (CGFloat) -> String

  public init(
    context: FlowingGraphCanvasGuideRenderContext,
    style: FlowingGraphCanvasDefaultGuideStyle = .init(),
    measurementText: @escaping (CGFloat) -> String = {
      String(format: "%.0f", $0.rounded())
    }
  ) {
    self.context = context
    self.style = style
    self.measurementText = measurementText
  }

  public var body: some View {
    ZStack(alignment: .topLeading) {
      Path { path in
        path.move(to: context.renderedStart)
        path.addLine(to: context.renderedEnd)
        guard context.usesEndpointTicks else { return }
        addTick(to: &path, at: context.renderedStart)
        addTick(to: &path, at: context.renderedEnd)
      }
      .stroke(
        style.lineColor,
        style: StrokeStyle(
          lineWidth: style.lineWidth,
          dash: context.guide.kind == .grid ? style.gridDash : []
        )
      )
      if let measurement = context.guide.measurement,
        context.renderedLength >= style.minimumLabelLength
      {
        Text(measurementText(measurement))
          .font(.system(size: style.labelFontSize, weight: .medium))
          .foregroundStyle(style.labelForegroundColor)
          .padding(.horizontal, style.labelHorizontalPadding)
          .padding(.vertical, style.labelVerticalPadding)
          .background(style.labelBackgroundColor, in: Capsule())
          .position(context.renderedMidpoint)
      }
    }
  }

  private func addTick(to path: inout Path, at point: CGPoint) {
    let radius = style.tickLength / 2
    switch context.guide.axis {
    case .horizontal:
      path.move(to: CGPoint(x: point.x, y: point.y - radius))
      path.addLine(to: CGPoint(x: point.x, y: point.y + radius))
    case .vertical:
      path.move(to: CGPoint(x: point.x - radius, y: point.y))
      path.addLine(to: CGPoint(x: point.x + radius, y: point.y))
    }
  }
}
