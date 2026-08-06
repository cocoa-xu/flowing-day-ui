import AppKit
import Foundation
import SwiftUI

public enum FlowingCanvasExportFormat: String, CaseIterable, Identifiable, Sendable {
  case pdf
  case png
  case jpeg
  case bmp

  public var id: Self { self }

  public var filenameExtension: String { rawValue }

  public var supportsTransparency: Bool {
    self != .jpeg
  }
}

public struct FlowingCanvasExportRenderingConfiguration: Equatable, Sendable {
  public let format: FlowingCanvasExportFormat
  public let rasterDPI: Int
  public let jpegCompressionQuality: CGFloat

  public init(
    format: FlowingCanvasExportFormat,
    rasterDPI: Int = 144,
    jpegCompressionQuality: CGFloat = 0.92
  ) {
    self.format = format
    self.rasterDPI = rasterDPI
    self.jpegCompressionQuality = jpegCompressionQuality
  }
}

public enum FlowingCanvasExportRenderingIssue: Error, Equatable, Sendable {
  case invalidOutputSize
  case invalidRasterDPI
  case invalidJPEGCompressionQuality
  case renderingFailed
}

@MainActor
public struct FlowingCanvasExportRenderer {
  public init() {}

  public func data<Content: View>(
    content: Content,
    size: CGSize,
    configuration: FlowingCanvasExportRenderingConfiguration
  ) throws -> Data {
    guard size.width.isFinite, size.height.isFinite, size.width > 0, size.height > 0 else {
      throw FlowingCanvasExportRenderingIssue.invalidOutputSize
    }
    guard configuration.rasterDPI > 0 else {
      throw FlowingCanvasExportRenderingIssue.invalidRasterDPI
    }
    guard configuration.jpegCompressionQuality.isFinite,
      (0...1).contains(configuration.jpegCompressionQuality)
    else {
      throw FlowingCanvasExportRenderingIssue.invalidJPEGCompressionQuality
    }

    let canvas = content.frame(width: size.width, height: size.height, alignment: .topLeading)
    switch configuration.format {
    case .pdf:
      return try pdfData(content: canvas, size: size)
    case .png, .jpeg, .bmp:
      return try bitmapData(
        content: canvas,
        size: size,
        configuration: configuration
      )
    }
  }

  private func pdfData<Content: View>(content: Content, size: CGSize) throws -> Data {
    let renderer = ImageRenderer(content: content)
    renderer.proposedSize = ProposedViewSize(width: size.width, height: size.height)
    let data = NSMutableData()
    guard let consumer = CGDataConsumer(data: data as CFMutableData) else {
      throw FlowingCanvasExportRenderingIssue.renderingFailed
    }
    var mediaBox = CGRect(origin: .zero, size: size)
    guard let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
      throw FlowingCanvasExportRenderingIssue.renderingFailed
    }

    renderer.render { _, draw in
      context.beginPDFPage(nil)
      draw(context)
      context.endPDFPage()
      context.closePDF()
    }
    guard data.length > 0 else {
      throw FlowingCanvasExportRenderingIssue.renderingFailed
    }
    return data as Data
  }

  private func bitmapData<Content: View>(
    content: Content,
    size: CGSize,
    configuration: FlowingCanvasExportRenderingConfiguration
  ) throws -> Data {
    let renderer = ImageRenderer(content: content)
    renderer.proposedSize = ProposedViewSize(width: size.width, height: size.height)
    renderer.scale = CGFloat(configuration.rasterDPI) / 72
    guard let image = renderer.nsImage,
      let tiffData = image.tiffRepresentation,
      let representation = NSBitmapImageRep(data: tiffData)
    else {
      throw FlowingCanvasExportRenderingIssue.renderingFailed
    }
    representation.size = size

    let fileType: NSBitmapImageRep.FileType
    let properties: [NSBitmapImageRep.PropertyKey: Any]
    switch configuration.format {
    case .png:
      fileType = .png
      properties = [:]
    case .jpeg:
      fileType = .jpeg
      properties = [.compressionFactor: configuration.jpegCompressionQuality]
    case .bmp:
      fileType = .bmp
      properties = [:]
    case .pdf:
      throw FlowingCanvasExportRenderingIssue.renderingFailed
    }
    guard let data = representation.representation(using: fileType, properties: properties) else {
      throw FlowingCanvasExportRenderingIssue.renderingFailed
    }
    return data
  }
}
