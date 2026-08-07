import FlowingDayGraphAutomation
import FlowingDayGraphCanvas
import FlowingDayGraphComposition
import FlowingDayGraphCore
import Foundation

public struct FlowingGraphCanvasAutomationCommand<Schema: FlowingGraphCanvasSchema>:
  FlowingAutomationSessionCommand
{
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  public let id: UUID
  public let action: FlowingGraphCanvasSessionCommandAction<Schema>
  public let animated: Bool

  public init(
    id: UUID = UUID(),
    action: FlowingGraphCanvasSessionCommandAction<Schema>,
    animated: Bool = true
  ) {
    self.id = id
    self.action = action
    self.animated = animated
  }

  public var readRequirement: FlowingAutomationSessionReadRequirement<ElementID> {
    switch action {
    case .focus(let elementID, _), .inspect(let elementID):
      return .elements([elementID])
    case .jumpToElement(let elementID, let selection, _):
      return FlowingAutomationSessionReadRequirement(
        includesSessionState: selection == .add,
        elementIDs: [elementID]
      )
    case .pan(_, _, let zoom):
      return zoom == nil ? .sessionState : .none
    case .restoreViewport:
      return .none
    case .select(let selection):
      return selectionReadRequirement(selection)
    case .fit(let scope, _, _):
      return fitReadRequirement(scope)
    case .arrange:
      return FlowingAutomationSessionReadRequirement(
        includesSessionState: true,
        includesPresentation: true
      )
    }
  }

  private func selectionReadRequirement(
    _ selection: FlowingGraphCanvasSelectionCommand<Schema>
  ) -> FlowingAutomationSessionReadRequirement<ElementID> {
    switch selection {
    case .replace(let elementIDs):
      return .elements(elementIDs)
    case .add(let elementIDs), .remove(let elementIDs), .toggle(let elementIDs):
      return FlowingAutomationSessionReadRequirement(
        includesSessionState: true,
        elementIDs: elementIDs
      )
    case .clear:
      return .none
    }
  }

  private func fitReadRequirement(
    _ scope: FlowingGraphCanvasFitScope<Schema>
  ) -> FlowingAutomationSessionReadRequirement<ElementID> {
    switch scope {
    case .presentation:
      return .presentation
    case .selection:
      return FlowingAutomationSessionReadRequirement(
        includesSessionState: true,
        includesPresentation: true
      )
    case .elements(let elementIDs):
      return FlowingAutomationSessionReadRequirement(
        includesPresentation: true,
        elementIDs: elementIDs
      )
    }
  }
}

public struct FlowingGraphCanvasAutomationSessionAdapter<
  Schema: FlowingGraphCanvasSchema
>: Sendable {
  public let sessionID: FlowingGraphCanvasSessionID

  public init(sessionID: FlowingGraphCanvasSessionID) {
    self.sessionID = sessionID
  }

  public func canvasCommand(
    for command: FlowingGraphCanvasAutomationCommand<Schema>
  ) -> FlowingGraphCanvasSessionCommand<Schema> {
    FlowingGraphCanvasSessionCommand(
      id: command.id,
      targetSessionID: sessionID,
      action: command.action,
      animated: command.animated
    )
  }
}
