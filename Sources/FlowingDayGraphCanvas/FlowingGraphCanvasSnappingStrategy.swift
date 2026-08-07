import CoreGraphics
import FlowingDayGraphComposition
import FlowingDayGraphCore

public struct FlowingGraphCanvasTranslationSnapRequest<Schema: FlowingGraphCanvasSchema>:
  Sendable
{
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  public let movingBounds: CGRect
  public let proposedTranslation: CGSize
  public let candidates: [FlowingGraphCanvasSnapCandidate<ElementID>]
  public let configuration: FlowingGraphCanvasSnappingConfiguration
  public let zoom: CGFloat
  public let snapState: FlowingGraphCanvasSnapState
  public let allowsSnapping: Bool

  public init(
    movingBounds: CGRect,
    proposedTranslation: CGSize,
    candidates: [FlowingGraphCanvasSnapCandidate<ElementID>],
    configuration: FlowingGraphCanvasSnappingConfiguration,
    zoom: CGFloat,
    snapState: FlowingGraphCanvasSnapState = .init(),
    allowsSnapping: Bool = true
  ) {
    precondition(zoom > 0 && zoom.isFinite)
    self.movingBounds = movingBounds
    self.proposedTranslation = proposedTranslation
    self.candidates = candidates
    self.configuration = configuration
    self.zoom = zoom
    self.snapState = snapState
    self.allowsSnapping = allowsSnapping
  }

  public func standardResult() -> FlowingGraphCanvasSnapResult {
    FlowingGraphCanvasArrangement.snap(
      movingBounds: movingBounds,
      proposedTranslation: proposedTranslation,
      candidates: candidates,
      configuration: configuration,
      zoom: zoom,
      snapState: snapState,
      allowsSnapping: allowsSnapping
    )
  }
}

public struct FlowingGraphCanvasResizeSnapRequest<Schema: FlowingGraphCanvasSchema>:
  Sendable
{
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  public let baseFrame: CGRect
  public let proposedFrame: CGRect
  public let edges: FlowingGraphCanvasResizeEdges
  public let candidates: [FlowingGraphCanvasSnapCandidate<ElementID>]
  public let configuration: FlowingGraphCanvasSnappingConfiguration
  public let minimumSize: CGSize
  public let maximumSize: CGSize?
  public let zoom: CGFloat
  public let snapState: FlowingGraphCanvasSnapState
  public let allowsSnapping: Bool
  public let behavior: FlowingGraphCanvasResizeBehavior

  public init(
    baseFrame: CGRect,
    proposedFrame: CGRect,
    edges: FlowingGraphCanvasResizeEdges,
    candidates: [FlowingGraphCanvasSnapCandidate<ElementID>],
    configuration: FlowingGraphCanvasSnappingConfiguration,
    minimumSize: CGSize,
    maximumSize: CGSize? = nil,
    zoom: CGFloat,
    snapState: FlowingGraphCanvasSnapState = .init(),
    allowsSnapping: Bool = true,
    behavior: FlowingGraphCanvasResizeBehavior = .standard
  ) {
    precondition(edges.isValid)
    precondition(minimumSize.width >= 0 && minimumSize.width.isFinite)
    precondition(minimumSize.height >= 0 && minimumSize.height.isFinite)
    if let maximumSize {
      precondition(maximumSize.width >= minimumSize.width && maximumSize.width.isFinite)
      precondition(maximumSize.height >= minimumSize.height && maximumSize.height.isFinite)
    }
    precondition(zoom > 0 && zoom.isFinite)
    self.baseFrame = baseFrame
    self.proposedFrame = proposedFrame
    self.edges = edges
    self.candidates = candidates
    self.configuration = configuration
    self.minimumSize = minimumSize
    self.maximumSize = maximumSize
    self.zoom = zoom
    self.snapState = snapState
    self.allowsSnapping = allowsSnapping
    self.behavior = behavior
  }

  public func standardResult() -> FlowingGraphCanvasResizeResult {
    FlowingGraphCanvasArrangement.resize(
      baseFrame: baseFrame,
      proposedFrame: proposedFrame,
      edges: edges,
      candidates: candidates,
      configuration: configuration,
      minimumSize: minimumSize,
      maximumSize: maximumSize,
      zoom: zoom,
      snapState: snapState,
      allowsSnapping: allowsSnapping,
      behavior: behavior
    )
  }
}

public struct FlowingGraphCanvasSnappingStrategy<Schema: FlowingGraphCanvasSchema>:
  Sendable
{
  public typealias TranslationRequest = FlowingGraphCanvasTranslationSnapRequest<Schema>
  public typealias ResizeRequest = FlowingGraphCanvasResizeSnapRequest<Schema>

  private let translationAction: @Sendable (TranslationRequest) -> FlowingGraphCanvasSnapResult
  private let resizeAction: @Sendable (ResizeRequest) -> FlowingGraphCanvasResizeResult

  public init(
    translation:
      @escaping @Sendable (TranslationRequest) -> FlowingGraphCanvasSnapResult = {
        $0.standardResult()
      },
    resize:
      @escaping @Sendable (ResizeRequest) -> FlowingGraphCanvasResizeResult = {
        $0.standardResult()
      }
  ) {
    translationAction = translation
    resizeAction = resize
  }

  public func snap(_ request: TranslationRequest) -> FlowingGraphCanvasSnapResult {
    translationAction(request)
  }

  public func resize(_ request: ResizeRequest) -> FlowingGraphCanvasResizeResult {
    resizeAction(request)
  }

  public static var standard: Self {
    Self()
  }
}
