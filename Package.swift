// swift-tools-version: 6.1

import PackageDescription

let package = Package(
  name: "FlowingDayUI",
  platforms: [
    .macOS(.v13)
  ],
  products: [
    .library(name: "FlowingDayCanvas", targets: ["FlowingDayCanvas"]),
    .library(name: "FlowingDayGraphCore", targets: ["FlowingDayGraphCore"]),
    .library(name: "FlowingDayPreferences", targets: ["FlowingDayPreferences"]),
    .executable(
      name: "FlowingDayPreferencesExample",
      targets: ["FlowingDayPreferencesExample"]
    ),
  ],
  targets: [
    .target(name: "FlowingDayCanvas"),
    .target(name: "FlowingDayGraphCore"),
    .target(name: "FlowingDayPreferences"),
    .executableTarget(
      name: "FlowingDayPreferencesExample",
      dependencies: ["FlowingDayPreferences"],
      path: "Examples/FlowingDayPreferencesExample"
    ),
    .testTarget(
      name: "FlowingDayCanvasTests",
      dependencies: ["FlowingDayCanvas"]
    ),
    .testTarget(
      name: "FlowingDayGraphCoreTests",
      dependencies: ["FlowingDayGraphCore"]
    ),
    .testTarget(
      name: "FlowingDayPreferencesTests",
      dependencies: ["FlowingDayPreferences", "FlowingDayPreferencesExample"]
    ),
  ]
)
