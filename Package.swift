// swift-tools-version: 6.1

import PackageDescription

let package = Package(
  name: "FlowingDayUI",
  platforms: [
    .macOS(.v13)
  ],
  products: [
    .library(name: "FlowingDayCanvas", targets: ["FlowingDayCanvas"]),
    .library(name: "FlowingDayGraphCanvas", targets: ["FlowingDayGraphCanvas"]),
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
      name: "FlowingDayGraphCanvas",
      dependencies: [
        "FlowingDayCanvas",
        "FlowingDayGraphComposition",
        "FlowingDayGraphCore",
        "FlowingDayGraphLayout",
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
      name: "FlowingDayGraphCanvasTests",
      dependencies: [
        "FlowingDayCanvas",
        "FlowingDayGraphCanvas",
        "FlowingDayGraphCanvasExample",
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
