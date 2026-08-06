import FlowingDayCanvas
import FlowingDayGraphCanvas
import FlowingDayGraphComposition
import FlowingDayGraphCore
import FlowingDayPreferences
import SwiftUI

struct GraphCanvasShowcaseView: View {
  @StateObject private var model = GraphCanvasShowcaseModel()
  @State private var session = FlowingGraphCanvasSessionState<ShowcaseCanvasSchema>()
  @State private var command: FlowingGraphCanvasSessionCommand<ShowcaseCanvasSchema>?
  @State private var viewportByPath:
    [FlowingGraphInstancePath<String, String>: FlowingCanvasTransform] = [:]
  private let sessionID = FlowingGraphCanvasSessionID()

  var body: some View {
    VStack(spacing: 0) {
      header
      Divider().overlay(PreferencesPalette.hairline)
      HStack(spacing: 0) {
        sidebar
        Divider().overlay(PreferencesPalette.hairline)
        canvas
      }
    }
    .background(PreferencesPalette.canvas)
    .onAppear(perform: fitPresentation)
  }

  private var header: some View {
    HStack(spacing: 22) {
      VStack(alignment: .leading, spacing: 2) {
        Text("Graph Canvas")
          .font(.system(size: 17, weight: .semibold, design: .rounded))
          .foregroundStyle(PreferencesPalette.ink)
        Text("Layouts, composition, interaction, and rendering")
          .font(.system(size: 11.5))
          .foregroundStyle(PreferencesPalette.muted)
      }
      Spacer(minLength: 20)
      showcasePicker(
        title: "Layout",
        selection: Binding(
          get: { model.layoutStyle },
          set: {
            model.selectLayout($0)
            fitPresentation()
          }
        )
      )
      showcasePicker(
        title: "Presentation",
        selection: Binding(
          get: { model.presentationStyle },
          set: { transition(to: $0) }
        )
      )
    }
    .padding(.horizontal, 22)
    .frame(height: 74)
    .background(PreferencesPalette.control)
  }

  private var sidebar: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 22) {
        sidebarSection("Breadcrumb") {
          VStack(alignment: .leading, spacing: 7) {
            ForEach(Array(model.breadcrumb.enumerated()), id: \.offset) { index, segment in
              Button {
                navigate(to: segment.focusPath)
              } label: {
                HStack(spacing: 8) {
                  Image(systemName: index == 0 ? "circle.grid.2x2" : "square.stack.3d.up")
                    .frame(width: 16)
                  Text(model.title(for: segment))
                  Spacer()
                  if segment.focusPath == model.projectionState.focusPath {
                    Image(systemName: "checkmark")
                  }
                }
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(PreferencesPalette.ink)
                .padding(.horizontal, 10)
                .frame(height: 34)
                .background(
                  RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(
                      segment.focusPath == model.projectionState.focusPath
                        ? PreferencesAccent.celadon.wash
                        : PreferencesPalette.field.opacity(0.55)
                    )
                )
              }
              .buttonStyle(.plain)
            }
          }
        }

        sidebarSection("Interface Bindings") {
          VStack(spacing: 8) {
            ForEach(model.bindingRows, id: \.external) { row in
              Button {
                model.toggleBinding(row.external)
              } label: {
                HStack(spacing: 8) {
                  bindingIndicator(isActive: row.internalEndpoint != nil)
                  VStack(alignment: .leading, spacing: 2) {
                    Text(row.external.capitalized)
                      .foregroundStyle(PreferencesPalette.ink)
                    if let endpoint = row.internalEndpoint {
                      Text("Mapped to \(endpoint)")
                        .foregroundStyle(PreferencesPalette.muted)
                    } else {
                      Text("Unbound external port")
                        .foregroundStyle(PreferencesPalette.faint)
                    }
                  }
                  Spacer(minLength: 0)
                }
                .font(.system(size: 11.5))
                .padding(10)
                .background(
                  RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(PreferencesPalette.field.opacity(0.55))
                )
              }
              .buttonStyle(.plain)
            }
          }
        }

        sidebarSection("Component Surface") {
          VStack(alignment: .leading, spacing: 8) {
            capability("Node, edge, and port builders", icon: "square.on.circle")
            capability("Selection and transient drag", icon: "cursorarrow.click.2")
            capability("World decoration builder", icon: "sparkles.rectangle.stack")
            capability("Viewport overlay builder", icon: "rectangle.inset.filled")
          }
        }

        sidebarSection("Latest Intent") {
          Text(model.lastEvent)
            .font(.system(size: 11.5))
            .foregroundStyle(PreferencesPalette.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(
              RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(PreferencesPalette.field.opacity(0.55))
            )
        }

        if let errorMessage = model.errorMessage {
          sidebarSection("Error") {
            Text(errorMessage)
              .font(.system(size: 11))
              .foregroundStyle(.red)
              .textSelection(.enabled)
          }
        }
      }
      .padding(18)
    }
    .frame(width: 274)
    .background(PreferencesPalette.card)
  }

  @ViewBuilder
  private var canvas: some View {
    if let content = model.content {
      FlowingGraphCanvas(
        content: content,
        sessionID: sessionID,
        session: $session,
        configuration: FlowingGraphCanvasConfiguration(
          canvas: FlowingCanvasConfiguration(
            initialZoom: 0.9,
            focusedZoom: 1.15,
            zoomRange: 0.2...4
          ),
          nodeDraggingMode: .multiple,
          snapping: .standard
        ),
        command: command,
        onViewportChange: { viewport, phase in
          guard phase == .ended else { return }
          viewportByPath[model.projectionState.focusPath] = viewport.transform
        },
        onIntent: model.send,
        background: { ShowcaseGridBackground(context: $0) },
        node: { ShowcaseNode(node: $0, context: $1) },
        edge: {
          FlowingGraphCanvasDefaultEdge(
            context: $1,
            style: FlowingGraphCanvasDefaultEdgeStyle(
              color: PreferencesPalette.faint.opacity(0.72),
              selectedColor: PreferencesAccent.celadon.fill
            )
          )
        },
        port: { ShowcasePort(port: $0, context: $1) },
        decorations: { ShowcaseWorldDecoration(context: $0) },
        overlays: { context in
          ZStack {
            ShowcaseCanvasTools(
              session: $session,
              content: context.content,
              proxy: context.proxy
            )
            FlowingGraphMiniMapOverlay(placement: .topTrailing) {
              FlowingGraphCanvasMiniMap(
                content: context.content,
                proxy: context.proxy,
                configuration: FlowingGraphMiniMapConfiguration(visibility: .always),
                style: FlowingGraphMiniMapStyle(
                  background: PreferencesPalette.control.opacity(0.96),
                  border: PreferencesPalette.hairline,
                  edge: PreferencesPalette.faint.opacity(0.4),
                  viewportFill: PreferencesAccent.celadon.fill.opacity(0.12),
                  viewportStroke: PreferencesAccent.celadon.fill,
                  nodeStyles: [
                    FlowingGraphMiniMapNodeStyle(
                      fill: PreferencesPalette.muted.opacity(0.62)
                    )
                  ]
                )
              )
            }
          }
        }
      )
    } else {
      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(PreferencesPalette.canvas)
    }
  }

  private func showcasePicker<Selection>(
    title: String,
    selection: Binding<Selection>
  ) -> some View
  where
    Selection: Hashable & CaseIterable & Identifiable & RawRepresentable,
    Selection.RawValue == String
  {
    VStack(alignment: .leading, spacing: 4) {
      Text(title.uppercased())
        .font(.system(size: 8.5, weight: .semibold))
        .tracking(0.7)
        .foregroundStyle(PreferencesPalette.faint)
      Picker(title, selection: selection) {
        ForEach(Array(Selection.allCases)) { option in
          Text(option.rawValue).tag(option)
        }
      }
      .labelsHidden()
      .pickerStyle(.segmented)
      .frame(width: 224)
    }
  }

  private func sidebarSection<Content: View>(
    _ title: String,
    @ViewBuilder content: () -> Content
  ) -> some View {
    VStack(alignment: .leading, spacing: 9) {
      Text(title.uppercased())
        .font(.system(size: 9, weight: .semibold))
        .tracking(0.7)
        .foregroundStyle(PreferencesPalette.faint)
      content()
    }
  }

  private func capability(_ title: String, icon: String) -> some View {
    HStack(spacing: 8) {
      Image(systemName: icon)
        .foregroundStyle(PreferencesAccent.celadon.foreground)
        .frame(width: 18)
      Text(title)
        .foregroundStyle(PreferencesPalette.muted)
    }
    .font(.system(size: 11.5))
  }

  private func bindingIndicator(isActive: Bool) -> some View {
    Circle()
      .fill(isActive ? PreferencesAccent.celadon.fill : PreferencesPalette.control)
      .overlay {
        if isActive {
          Image(systemName: "checkmark")
            .font(.system(size: 7, weight: .bold))
            .foregroundStyle(PreferencesAccent.celadon.foreground)
        } else {
          Circle().strokeBorder(PreferencesPalette.hairline)
        }
      }
      .frame(width: 16, height: 16)
  }

  private func transition(to style: ShowcasePresentationStyle) {
    viewportByPath[model.projectionState.focusPath] = session.viewport.transform
    model.selectPresentation(style)
    restoreOrFitViewport()
  }

  private func navigate(to focusPath: FlowingGraphInstancePath<String, String>) {
    guard focusPath != model.projectionState.focusPath else { return }
    viewportByPath[model.projectionState.focusPath] = session.viewport.transform
    model.navigate(to: focusPath)
    restoreOrFitViewport()
  }

  private func restoreOrFitViewport() {
    if let transform = viewportByPath[model.projectionState.focusPath] {
      command = FlowingGraphCanvasSessionCommand(
        targetSessionID: sessionID,
        action: .restoreViewport(transform)
      )
    } else {
      fitPresentation()
    }
  }

  private func fitPresentation() {
    command = FlowingGraphCanvasSessionCommand(
      targetSessionID: sessionID,
      action: .fit(scope: .presentation, padding: 56, maximumZoom: 1.1)
    )
  }
}
