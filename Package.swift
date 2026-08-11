// swift-tools-version: 6.1

import PackageDescription

let package = Package(
  name: "FlowingDayUI",
  platforms: [
    .macOS(.v13)
  ],
  products: [
    .library(name: "FlowingDayCanvas", targets: ["FlowingDayCanvas"]),
    .library(name: "FlowingDayCanvasExport", targets: ["FlowingDayCanvasExport"]),
    .library(name: "FlowingDayGraphAutomation", targets: ["FlowingDayGraphAutomation"]),
    .library(
      name: "FlowingDayGraphCanvasAutomation",
      targets: ["FlowingDayGraphCanvasAutomation"]
    ),
    .library(name: "FlowingDayGraphCanvas", targets: ["FlowingDayGraphCanvas"]),
    .library(
      name: "FlowingDayGraphCollaboration",
      targets: ["FlowingDayGraphCollaboration"]
    ),
    .library(name: "FlowingDayGraphComposition", targets: ["FlowingDayGraphComposition"]),
    .library(name: "FlowingDayGraphCore", targets: ["FlowingDayGraphCore"]),
    .library(name: "FlowingDayGraphHistory", targets: ["FlowingDayGraphHistory"]),
    .library(name: "FlowingDayGraphLayout", targets: ["FlowingDayGraphLayout"]),
    .library(name: "FlowingDayControls", targets: ["FlowingDayControls"]),
    .library(name: "FlowingDayPreferences", targets: ["FlowingDayPreferences"]),
    .executable(
      name: "FlowingDayPreferencesExample",
      targets: ["FlowingDayPreferencesExample"]
    ),
    .executable(
      name: "FlowingDayGraphCanvasExample",
      targets: ["FlowingDayGraphCanvasExample"]
    ),
  ],
  targets: [
    .target(name: "FlowingDayCanvas"),
    .target(
      name: "FlowingDayCanvasExport",
      dependencies: [
        "FlowingDayCanvas",
        "FlowingDayGraphCanvas",
        "FlowingDayGraphComposition",
        "FlowingDayGraphLayout",
      ]
    ),
    .target(
      name: "FlowingDayGraphAutomation",
      dependencies: [
        "FlowingDayGraphCollaboration",
        "FlowingDayGraphComposition",
        "FlowingDayGraphCore",
      ]
    ),
    .target(
      name: "FlowingDayGraphCanvas",
      dependencies: [
        "FlowingDayCanvas",
        "FlowingDayGraphComposition",
        "FlowingDayGraphCore",
        "FlowingDayGraphLayout",
      ]
    ),
    .target(
      name: "FlowingDayGraphCanvasAutomation",
      dependencies: [
        "FlowingDayGraphAutomation",
        "FlowingDayGraphCanvas",
        "FlowingDayGraphComposition",
        "FlowingDayGraphCore",
      ]
    ),
    .target(
      name: "FlowingDayGraphCollaboration",
      dependencies: [
        "FlowingDayGraphComposition",
        "FlowingDayGraphCore",
      ]
    ),
    .target(
      name: "FlowingDayGraphComposition",
      dependencies: ["FlowingDayGraphCore"]
    ),
    .target(name: "FlowingDayGraphCore"),
    .target(
      name: "FlowingDayGraphHistory",
      dependencies: [
        "FlowingDayGraphCollaboration",
        "FlowingDayGraphComposition",
        "FlowingDayGraphCore",
      ]
    ),
    .target(
      name: "FlowingDayGraphLayout",
      dependencies: ["FlowingDayGraphCore"]
    ),
    .target(name: "FlowingDayControls"),
    .target(
      name: "FlowingDayPreferences",
      dependencies: ["FlowingDayControls"]
    ),
    .executableTarget(
      name: "FlowingDayPreferencesExample",
      dependencies: ["FlowingDayControls", "FlowingDayPreferences"],
      path: "Examples/FlowingDayPreferencesExample"
    ),
    .executableTarget(
      name: "FlowingDayGraphCanvasExample",
      dependencies: [
        "FlowingDayCanvas",
        "FlowingDayGraphCanvas",
        "FlowingDayGraphComposition",
        "FlowingDayGraphCore",
        "FlowingDayGraphLayout",
        "FlowingDayControls",
      ],
      path: "Examples/FlowingDayGraphCanvasExample"
    ),
    .testTarget(
      name: "FlowingDayCanvasTests",
      dependencies: ["FlowingDayCanvas"],
      path: "Tests/Unit/FlowingDayCanvasTests"
    ),
    .testTarget(
      name: "FlowingDayCanvasExportTests",
      dependencies: [
        "FlowingDayCanvasExport",
        "FlowingDayGraphComposition",
        "FlowingDayGraphCore",
        "FlowingDayGraphLayout",
      ],
      path: "Tests/Unit/FlowingDayCanvasExportTests"
    ),
    .testTarget(
      name: "FlowingDayGraphAutomationTests",
      dependencies: [
        "FlowingDayGraphAutomation",
        "FlowingDayGraphCollaboration",
        "FlowingDayGraphComposition",
        "FlowingDayGraphCore",
      ],
      path: "Tests/Unit/FlowingDayGraphAutomationTests"
    ),
    .testTarget(
      name: "FlowingDayGraphCanvasTests",
      dependencies: [
        "FlowingDayCanvas",
        "FlowingDayGraphCanvas",
        "FlowingDayGraphCanvasExample",
      ],
      path: "Tests/Unit/FlowingDayGraphCanvasTests"
    ),
    .testTarget(
      name: "FlowingDayGraphCanvasAutomationTests",
      dependencies: [
        "FlowingDayGraphCanvasAutomation",
        "FlowingDayGraphCanvas",
        "FlowingDayGraphComposition",
        "FlowingDayGraphCore",
      ],
      path: "Tests/Unit/FlowingDayGraphCanvasAutomationTests"
    ),
    .testTarget(
      name: "FlowingDayGraphCollaborationTests",
      dependencies: [
        "FlowingDayGraphCollaboration",
        "FlowingDayGraphComposition",
        "FlowingDayGraphCore",
      ],
      path: "Tests/Unit/FlowingDayGraphCollaborationTests"
    ),
    .testTarget(
      name: "FlowingDayGraphCompositionTests",
      dependencies: ["FlowingDayGraphComposition"],
      path: "Tests/Unit/FlowingDayGraphCompositionTests"
    ),
    .testTarget(
      name: "FlowingDayGraphCoreTests",
      dependencies: ["FlowingDayGraphCore"],
      path: "Tests/Unit/FlowingDayGraphCoreTests"
    ),
    .testTarget(
      name: "FlowingDayGraphHistoryTests",
      dependencies: [
        "FlowingDayGraphCollaboration",
        "FlowingDayGraphComposition",
        "FlowingDayGraphCore",
        "FlowingDayGraphHistory",
      ],
      path: "Tests/Unit/FlowingDayGraphHistoryTests"
    ),
    .testTarget(
      name: "FlowingDayGraphLayoutTests",
      dependencies: ["FlowingDayGraphLayout"],
      path: "Tests/Unit/FlowingDayGraphLayoutTests"
    ),
    .testTarget(
      name: "FlowingDayControlsTests",
      dependencies: ["FlowingDayControls"],
      path: "Tests/Unit/FlowingDayControlsTests",
      resources: [.copy("VisualReferences")]
    ),
    .testTarget(
      name: "FlowingDayPreferencesTests",
      dependencies: [
        "FlowingDayControls",
        "FlowingDayPreferences",
        "FlowingDayPreferencesExample",
      ],
      path: "Tests/Unit/FlowingDayPreferencesTests"
    ),
  ]
)
