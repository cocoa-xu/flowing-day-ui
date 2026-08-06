import AppKit
import SwiftUI

@main
struct FlowingDayGraphCanvasExampleApp: App {
  private let runsPerformanceBenchmark = ProcessInfo.processInfo.arguments.contains(
    "--canvas-performance-benchmark"
  )
  private let runsPerformancePreview = ProcessInfo.processInfo.arguments.contains(
    "--canvas-performance-preview"
  )
  var body: some Scene {
    WindowGroup("Graph Canvas") {
      if runsPerformancePreview {
        GraphCanvasPerformancePreviewView()
          .frame(minWidth: 960, minHeight: 640)
          .preferredColorScheme(.light)
          .onAppear {
            NSApplication.shared.activate(ignoringOtherApps: true)
          }
      } else if runsPerformanceBenchmark {
        GraphCanvasPerformanceBenchmarkView()
          .frame(minWidth: 960, minHeight: 640)
          .preferredColorScheme(.light)
      } else {
        GraphCanvasShowcaseView()
          .frame(minWidth: 960, minHeight: 640)
          .preferredColorScheme(.light)
      }
    }
    .defaultSize(width: 1180, height: 760)
  }
}
