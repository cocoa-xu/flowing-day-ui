import FlowingDayCanvas
import FlowingDayGraphCanvas
import FlowingDayGraphComposition
import FlowingDayPreferences
import SwiftUI

struct ShowcaseGridBackground: View {
  let context: FlowingCanvasRenderContext

  var body: some View {
    let levels = FlowingCanvasGridLevels(
      baseSpacing: 24,
      zoom: context.zoom,
      minimumVisualSpacing: 13,
      scaleFactor: 2
    )
    Canvas { graphics, size in
      draw(levels.coarse, in: &graphics, size: size, radius: 1.15)
      draw(levels.fine, in: &graphics, size: size, radius: 0.85)
    }
    .background(PreferencesPalette.canvas)
  }

  private func draw(
    _ level: FlowingCanvasGridLevel,
    in graphics: inout GraphicsContext,
    size: CGSize,
    radius: CGFloat
  ) {
    let spacing = level.spacing
    let startX = context.transform.offset.width.truncatingRemainder(dividingBy: spacing)
    let startY = context.transform.offset.height.truncatingRemainder(dividingBy: spacing)
    var x = startX
    while x < size.width {
      var y = startY
      while y < size.height {
        let rect = CGRect(
          x: x - radius,
          y: y - radius,
          width: radius * 2,
          height: radius * 2
        )
        graphics.fill(
          Path(ellipseIn: rect),
          with: .color(PreferencesPalette.faint.opacity(0.18 + 0.18 * level.opacity))
        )
        y += spacing
      }
      x += spacing
    }
  }
}

struct ShowcaseNode: View {
  let node: FlowingGraphPresentationNode<ShowcaseCanvasSchema>
  let context: FlowingGraphCanvasNodeContext<ShowcaseCanvasSchema>

  var body: some View {
    let scale = context.renderScale
    ZStack(alignment: .topLeading) {
      RoundedRectangle(cornerRadius: 14 * scale, style: .continuous)
        .fill(PreferencesPalette.control)
        .overlay {
          RoundedRectangle(cornerRadius: 14 * scale, style: .continuous)
            .strokeBorder(
              context.isSelected
                ? PreferencesAccent.celadon.fill
                : PreferencesPalette.hairline,
              lineWidth: context.isSelected ? 2 : 1
            )
        }
        .shadow(color: .black.opacity(0.07), radius: 10 * scale, y: 4 * scale)
      VStack(alignment: .leading, spacing: 3 * scale) {
        Text(node.value)
          .font(.system(size: 13 * scale, weight: .semibold, design: .rounded))
          .foregroundStyle(PreferencesPalette.ink)
        Text(node.value == "Subgraph" ? "Composite node" : "Graph node")
          .font(.system(size: 9.5 * scale))
          .foregroundStyle(PreferencesPalette.muted)
        Spacer(minLength: 0)
      }
      .padding(13 * scale)
    }
    .contextMenu {
      Button("Inspect") {
        context.actions.send(.inspect)
      }
      if node.value == "Subgraph" {
        Button("Expand Inline") {
          context.actions.send(.expand)
        }
        Button("Focus Subgraph") {
          context.actions.send(.drillIn)
        }
      }
    }
    .overlay(alignment: .topLeading) {
      resizeHandle(edges: [.leading, .top], x: -0.5, y: -0.5)
    }
    .overlay(alignment: .topTrailing) {
      resizeHandle(edges: [.trailing, .top], x: 0.5, y: -0.5)
    }
    .overlay(alignment: .bottomLeading) {
      resizeHandle(edges: [.leading, .bottom], x: -0.5, y: 0.5)
    }
    .overlay(alignment: .bottomTrailing) {
      resizeHandle(edges: [.trailing, .bottom], x: 0.5, y: 0.5)
    }
  }

  @ViewBuilder
  private func resizeHandle(
    edges: FlowingGraphCanvasResizeEdges,
    x: CGFloat,
    y: CGFloat
  ) -> some View {
    if context.isSelected && context.resizeActions.isEnabled {
      let diameter = 10 * context.renderScale
      FlowingGraphCanvasResizeHandle(edges: edges, actions: context.resizeActions) {
        Circle()
          .fill(PreferencesPalette.control)
          .overlay {
            Circle().strokeBorder(PreferencesAccent.celadon.fill, lineWidth: 1.5)
          }
          .frame(width: diameter, height: diameter)
      }
      .offset(x: diameter * x, y: diameter * y)
    }
  }
}

struct ShowcasePort: View {
  let port: FlowingGraphPresentationPort<ShowcaseCanvasSchema>
  let context: FlowingGraphCanvasPortContext<ShowcaseCanvasSchema>

  var body: some View {
    Circle()
      .fill(
        context.isSelected
          ? PreferencesAccent.celadon.fill
          : PreferencesPalette.control
      )
      .overlay {
        Circle().strokeBorder(PreferencesAccent.celadon.fill, lineWidth: 1.5)
      }
      .frame(width: 11 * context.renderScale, height: 11 * context.renderScale)
      .help(port.value)
  }
}

struct ShowcaseWorldDecoration: View {
  let context: FlowingGraphCanvasWorldContext<ShowcaseCanvasSchema>

  var body: some View {
    let point = context.surface.localTransform.applying(
      to: CGPoint(
        x: context.content.contentBounds.minX + 10,
        y: context.content.contentBounds.minY + 10
      )
    )
    Text("World Decoration")
      .font(.system(size: 9 * context.renderContext.zoom, weight: .medium))
      .foregroundStyle(PreferencesPalette.faint)
      .position(point)
      .allowsHitTesting(false)
  }
}

struct ShowcaseCanvasTools: View {
  @Binding var session: FlowingGraphCanvasSessionState<ShowcaseCanvasSchema>
  let content: FlowingGraphCanvasContent<ShowcaseCanvasSchema>
  let proxy: FlowingCanvasProxy

  var body: some View {
    FlowingCanvasViewportOverlay(
      alignment: .bottomTrailing,
      insets: EdgeInsets(top: 0, leading: 0, bottom: 18, trailing: 18)
    ) {
      HStack(spacing: 2) {
        toolButton("cursorarrow", tool: .select)
        toolButton("hand.draw", tool: .pan)
        Divider().frame(height: 18)
        Button("Fit") {
          proxy.fit(content.contentBounds, padding: 56, maximumZoom: 1.1)
        }
        .font(.system(size: 11.5, weight: .semibold))
        .foregroundStyle(PreferencesPalette.ink)
        .buttonStyle(.plain)
        .padding(.horizontal, 10)
      }
      .padding(4)
      .background(
        Capsule()
          .fill(PreferencesPalette.control)
          .shadow(color: .black.opacity(0.09), radius: 10, y: 4)
      )
      .overlay {
        Capsule().strokeBorder(PreferencesPalette.hairline)
      }
    }
  }

  private func toolButton(
    _ symbol: String,
    tool: FlowingGraphCanvasTool
  ) -> some View {
    Button {
      session.tool = tool
    } label: {
      Image(systemName: symbol)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(
          session.tool == tool
            ? PreferencesAccent.celadon.foreground
            : PreferencesPalette.muted
        )
        .frame(width: 30, height: 28)
        .background(
          RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(
              session.tool == tool
                ? PreferencesAccent.celadon.fill
                : Color.clear
            )
        )
    }
    .buttonStyle(.plain)
  }
}
