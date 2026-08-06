import SwiftUI

@main
struct FlowingDayGraphCanvasExampleApp: App {
  var body: some Scene {
    WindowGroup("Graph Canvas") {
      GraphCanvasShowcaseView()
        .frame(minWidth: 960, minHeight: 640)
        .preferredColorScheme(.light)
    }
    .defaultSize(width: 1180, height: 760)
  }
}
