// swift-tools-version: 6.1

import PackageDescription

let package = Package(
  name: "FlowingDayUI",
  platforms: [
    .macOS(.v13)
  ],
  products: [
    .library(name: "FlowingDayPreferences", targets: ["FlowingDayPreferences"])
  ],
  targets: [
    .target(name: "FlowingDayPreferences"),
    .testTarget(
      name: "FlowingDayPreferencesTests",
      dependencies: ["FlowingDayPreferences"]
    ),
  ]
)
