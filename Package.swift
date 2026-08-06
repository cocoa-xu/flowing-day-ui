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
    .library(name: "FlowingDayGraphCanvas", targets: ["FlowingDayGraphCanvas"]),
    .library(
      name: "FlowingDayGraphCollaboration",
      targets: ["FlowingDayGraphCollaboration"]
    ),
    .library(name: "FlowingDayGraphComposition", targets: ["FlowingDayGraphComposition"]),
    .library(name: "FlowingDayGraphCore", targets: ["FlowingDayGraphCore"]),
    .library(name: "FlowingDayGraphLayout", targets: ["FlowingDayGraphLayout"]),
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
      name: "FlowingDayGraphCanvas",
      dependencies: [
        "FlowingDayCanvas",
        "FlowingDayGraphComposition",
        "FlowingDayGraphCore",
        "FlowingDayGraphLayout",
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
      name: "FlowingDayGraphLayout",
      dependencies: ["FlowingDayGraphCore"]
    ),
    .target(name: "FlowingDayPreferences"),
    .executableTarget(
      name: "FlowingDayPreferencesExample",
      dependencies: ["FlowingDayPreferences"],
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
        "FlowingDayPreferences",
      ],
      path: "Examples/FlowingDayGraphCanvasExample"
    ),
    .testTarget(
      name: "FlowingDayCanvasTests",
      dependencies: ["FlowingDayCanvas"]
    ),
    .testTarget(
      name: "FlowingDayCanvasExportTests",
      dependencies: [
        "FlowingDayCanvasExport",
        "FlowingDayGraphComposition",
        "FlowingDayGraphCore",
        "FlowingDayGraphLayout",
      ]
    ),
    .testTarget(
      name: "FlowingDayGraphCanvasTests",
      dependencies: [
        "FlowingDayCanvas",
        "FlowingDayGraphCanvas",
        "FlowingDayGraphCanvasExample",
      ]
    ),
    .testTarget(
      name: "FlowingDayGraphCollaborationTests",
      dependencies: [
        "FlowingDayGraphCollaboration",
        "FlowingDayGraphComposition",
        "FlowingDayGraphCore",
      ]
    ),
    .testTarget(
      name: "FlowingDayGraphCompositionTests",
      dependencies: ["FlowingDayGraphComposition"]
    ),
    .testTarget(
      name: "FlowingDayGraphCoreTests",
      dependencies: ["FlowingDayGraphCore"]
    ),
    .testTarget(
      name: "FlowingDayGraphLayoutTests",
      dependencies: ["FlowingDayGraphLayout"]
    ),
    .testTarget(
      name: "FlowingDayPreferencesTests",
      dependencies: ["FlowingDayPreferences", "FlowingDayPreferencesExample"]
    ),
  ]
)
