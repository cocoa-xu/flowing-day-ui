// swift-tools-version: 6.1

import PackageDescription

let package = Package(
  name: "FlowingDayUI",
  platforms: [
    .macOS(.v13)
  ],
  products: [
    .library(name: "FlowingDayPreferences", targets: ["FlowingDayPreferences"]),
    .executable(
      name: "FlowingDayPreferencesExample",
      targets: ["FlowingDayPreferencesExample"]
    ),
  ],
  targets: [
    .target(name: "FlowingDayPreferences"),
    .executableTarget(
      name: "FlowingDayPreferencesExample",
      dependencies: ["FlowingDayPreferences"],
      path: "Examples/FlowingDayPreferencesExample"
    ),
    .testTarget(
      name: "FlowingDayPreferencesTests",
      dependencies: ["FlowingDayPreferences", "FlowingDayPreferencesExample"]
    ),
  ]
)
