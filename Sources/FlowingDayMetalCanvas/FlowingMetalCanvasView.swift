import AppKit
import Combine
import FlowingDayCanvas
import MetalKit
import SwiftUI

@MainActor
open class FlowingMetalCanvasController: ObservableObject {
  @Published public private(set) var viewport: FlowingCanvasViewport

  private weak var canvas: FlowingMetalCanvasView?

  public init(initialZoom: CGFloat = 1) {
    viewport = FlowingCanvasViewport(
      transform: FlowingCanvasTransform(zoom: initialZoom, offset: .zero)
    )
  }

  public var zoom: CGFloat {
    viewport.transform.zoom
  }

  public func attach(_ canvas: FlowingMetalCanvasView) {
    self.canvas = canvas
    publish(canvas.viewport, phase: .ended)
  }

  public func center(
    on worldPoint: CGPoint,
    phase: FlowingCanvasViewportChangePhase = .ended
  ) {
    canvas?.center(on: worldPoint, phase: phase)
  }

  public func setZoom(
    _ zoom: CGFloat,
    phase: FlowingCanvasViewportChangePhase = .ended
  ) {
    canvas?.setZoom(zoom, phase: phase)
  }

  fileprivate func publish(
    _ viewport: FlowingCanvasViewport,
    phase: FlowingCanvasViewportChangePhase
  ) {
    guard self.viewport != viewport else { return }
    self.viewport = viewport
  }
}

@MainActor
open class FlowingMetalCanvasView: MTKView, MTKViewDelegate {
  public let commandQueue: any MTLCommandQueue
  public let configuration: FlowingMetalCanvasConfiguration
  public let viewportController: FlowingMetalCanvasController

  public var camera: FlowingMetalCanvasCamera {
    didSet {
      guard oldValue != camera else { return }
      publishViewport(phase: .continuous)
      viewportDidChange(phase: .continuous)
    }
  }

  public var contentInsets: EdgeInsets {
    didSet {
      guard oldValue != contentInsets else { return }
      publishViewport(phase: .ended)
      viewportDidChange(phase: .ended)
    }
  }

  public var viewport: FlowingCanvasViewport {
    FlowingCanvasViewport(
      transform: camera.transform,
      size: bounds.size,
      contentBounds: FlowingMetalCanvasCamera.availableViewportRect(
        viewportSize: bounds.size,
        contentInsets: contentInsets
      )
    )
  }

  public init(
    device: any MTLDevice,
    configuration: FlowingMetalCanvasConfiguration = .standard,
    contentInsets: EdgeInsets = EdgeInsets(),
    viewportController: FlowingMetalCanvasController
  ) {
    guard let commandQueue = device.makeCommandQueue() else {
      preconditionFailure("Metal command queue creation failed")
    }
    self.commandQueue = commandQueue
    self.configuration = configuration
    self.contentInsets = contentInsets
    self.viewportController = viewportController
    camera = FlowingMetalCanvasCamera(zoom: configuration.initialZoom)
    super.init(frame: .zero, device: device)
    delegate = self
    preferredFramesPerSecond = configuration.preferredFramesPerSecond
    sampleCount =
      device.supportsTextureSampleCount(configuration.preferredSampleCount)
      ? configuration.preferredSampleCount
      : 1
    addGestureRecognizer(
      NSMagnificationGestureRecognizer(
        target: self,
        action: #selector(handleMagnification(_:))
      )
    )
    viewportController.attach(self)
  }

  @available(*, unavailable)
  public required init(coder: NSCoder) {
    fatalError()
  }

  open override var isFlipped: Bool { true }
  open override var acceptsFirstResponder: Bool { true }

  open override func viewDidMoveToWindow() {
    super.viewDidMoveToWindow()
    window?.acceptsMouseMovedEvents = true
    publishViewport(phase: .ended)
  }

  open override func layout() {
    super.layout()
    publishViewport(phase: .ended)
  }

  open override func scrollWheel(with event: NSEvent) {
    let multiplier =
      event.hasPreciseScrollingDeltas
      ? 1
      : configuration.discreteScrollMultiplier
    camera.pan(
      by: CGSize(
        width: event.scrollingDeltaX * multiplier,
        height: event.scrollingDeltaY * multiplier
      )
    )
    if !event.hasPreciseScrollingDeltas
      || event.phase == .ended
      || event.momentumPhase == .ended
    {
      finishViewportChange()
    }
  }

  public func center(
    on worldPoint: CGPoint,
    phase: FlowingCanvasViewportChangePhase = .ended
  ) {
    camera.anchor(
      worldPoint: worldPoint,
      at: CGPoint(x: viewport.contentBounds.midX, y: viewport.contentBounds.midY),
      zoom: camera.zoom,
      range: configuration.zoomRange
    )
    if phase == .ended {
      finishViewportChange()
    }
  }

  open func setZoom(
    _ requestedZoom: CGFloat,
    phase: FlowingCanvasViewportChangePhase = .ended
  ) {
    let center = CGPoint(x: viewport.contentBounds.midX, y: viewport.contentBounds.midY)
    camera.anchor(
      worldPoint: camera.worldPoint(for: center),
      at: center,
      zoom: requestedZoom,
      range: configuration.zoomRange
    )
    if phase == .ended {
      finishViewportChange()
    }
  }

  public func finishViewportChange() {
    publishViewport(phase: .ended)
    viewportDidChange(phase: .ended)
  }

  public func publishViewport(phase: FlowingCanvasViewportChangePhase) {
    viewportController.publish(viewport, phase: phase)
  }

  open func viewportInteractionWillBegin() {}
  open func viewportInteractionDidEnd() {}
  open func viewportDidChange(phase: FlowingCanvasViewportChangePhase) {
    needsDisplay = true
  }
  open func drawableSizeDidChange(_ size: CGSize) {}
  open func renderFrame(in view: MTKView) {}

  public final func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
    publishViewport(phase: .ended)
    drawableSizeDidChange(size)
  }

  public final func draw(in view: MTKView) {
    renderFrame(in: view)
  }

  @objc
  private func handleMagnification(_ gesture: NSMagnificationGestureRecognizer) {
    if gesture.state == .began {
      viewportInteractionWillBegin()
    }
    let magnification = gesture.magnification
    if magnification != 0 {
      camera.magnify(
        by: magnification,
        at: gesture.location(in: self),
        sensitivity: configuration.pinchSensitivity,
        range: configuration.zoomRange
      )
      gesture.magnification = 0
    }
    if gesture.state == .ended || gesture.state == .cancelled {
      finishViewportChange()
      viewportInteractionDidEnd()
    }
  }
}
