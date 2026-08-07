import FlowingDayCanvas
import FlowingDayGraphComposition
import FlowingDayGraphCore
import SwiftUI

public enum FlowingGraphCanvasRenderingBackendPreference: Equatable, Sendable {
  case automatic
  case swiftUI
  case metal
}

public enum FlowingGraphCanvasResolvedRenderingBackend: Equatable, Sendable {
  case swiftUI
  case metal
}

public struct FlowingGraphCanvasRenderingBackendCapabilities: Equatable, Sendable {
  public let hasMetalDevice: Bool
  public let hasMetalVisualAdapter: Bool

  public init(hasMetalDevice: Bool, hasMetalVisualAdapter: Bool) {
    self.hasMetalDevice = hasMetalDevice
    self.hasMetalVisualAdapter = hasMetalVisualAdapter
  }

  public var supportsMetal: Bool {
    hasMetalDevice && hasMetalVisualAdapter
  }
}

public enum FlowingGraphCanvasRenderingBackendResolver {
  public static func resolve(
    preference: FlowingGraphCanvasRenderingBackendPreference,
    capabilities: FlowingGraphCanvasRenderingBackendCapabilities
  ) -> FlowingGraphCanvasResolvedRenderingBackend {
    switch preference {
    case .automatic, .metal:
      capabilities.supportsMetal ? .metal : .swiftUI
    case .swiftUI:
      .swiftUI
    }
  }
}

@MainActor
public struct FlowingGraphCanvasBackendContext<Schema: FlowingGraphCanvasSchema> {
  public let content: FlowingGraphCanvasContent<Schema>
  public let sessionID: FlowingGraphCanvasSessionID
  public let session: Binding<FlowingGraphCanvasSessionState<Schema>>
  public let configuration: FlowingGraphCanvasConfiguration
  public let interactionPolicy: FlowingGraphCanvasInteractionPolicy<Schema>
  public let accessibilitySnapshot:
    FlowingGraphCanvasAccessibilitySnapshot<FlowingGraphCompositionElementID<Schema>>?
  public let contentInsets: EdgeInsets
  public let contentChangeBehavior: FlowingCanvasContentChangeBehavior
  public let command: FlowingGraphCanvasSessionCommand<Schema>?

  private let smartMagnifyAction:
    (FlowingGraphCanvasSmartMagnifyContext<Schema>) -> FlowingCanvasViewportAction
  private let viewportChangeAction:
    (FlowingCanvasViewport, FlowingCanvasViewportChangePhase) -> Void
  private let intentAction: (FlowingGraphCanvasInteractionIntent<Schema>) -> Void

  public init(
    content: FlowingGraphCanvasContent<Schema>,
    sessionID: FlowingGraphCanvasSessionID,
    session: Binding<FlowingGraphCanvasSessionState<Schema>>,
    configuration: FlowingGraphCanvasConfiguration,
    interactionPolicy: FlowingGraphCanvasInteractionPolicy<Schema>,
    accessibilitySnapshot:
      FlowingGraphCanvasAccessibilitySnapshot<FlowingGraphCompositionElementID<Schema>>?,
    contentInsets: EdgeInsets,
    contentChangeBehavior: FlowingCanvasContentChangeBehavior,
    command: FlowingGraphCanvasSessionCommand<Schema>?,
    onSmartMagnify:
      @escaping (FlowingGraphCanvasSmartMagnifyContext<Schema>) ->
      FlowingCanvasViewportAction,
    onViewportChange:
      @escaping (FlowingCanvasViewport, FlowingCanvasViewportChangePhase) -> Void,
    onIntent: @escaping (FlowingGraphCanvasInteractionIntent<Schema>) -> Void
  ) {
    self.content = content
    self.sessionID = sessionID
    self.session = session
    self.configuration = configuration
    self.interactionPolicy = interactionPolicy
    self.accessibilitySnapshot = accessibilitySnapshot
    self.contentInsets = contentInsets
    self.contentChangeBehavior = contentChangeBehavior
    self.command = command
    smartMagnifyAction = onSmartMagnify
    viewportChangeAction = onViewportChange
    intentAction = onIntent
  }

  public func smartMagnify(
    _ context: FlowingGraphCanvasSmartMagnifyContext<Schema>
  ) -> FlowingCanvasViewportAction {
    smartMagnifyAction(context)
  }

  public func viewportDidChange(
    _ viewport: FlowingCanvasViewport,
    phase: FlowingCanvasViewportChangePhase
  ) {
    viewportChangeAction(viewport, phase)
  }

  public func send(_ intent: FlowingGraphCanvasInteractionIntent<Schema>) {
    intentAction(intent)
  }
}

@MainActor
public struct FlowingGraphCanvasMetalVisualAdapter<Schema: FlowingGraphCanvasSchema> {
  private let availability: () -> Bool
  private let makeContent: (FlowingGraphCanvasBackendContext<Schema>) -> AnyView

  public init<Content: View>(
    isAvailable: @escaping () -> Bool = {
      FlowingGraphCanvasMetalBackendView.isSupported
    },
    @ViewBuilder content: @escaping (FlowingGraphCanvasBackendContext<Schema>) -> Content
  ) {
    availability = isAvailable
    makeContent = { AnyView(content($0)) }
  }

  public var isAvailable: Bool {
    availability()
  }

  public func callAsFunction(
    _ context: FlowingGraphCanvasBackendContext<Schema>
  ) -> AnyView {
    makeContent(context)
  }
}
