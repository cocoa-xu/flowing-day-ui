// swift-tools-version: 6.1

import PackageDescription

let package = Package(
  name: "FlowingDayUI",
  platforms: [
    .macOS(.v13)
  ],
  products: [
    .library(name: "FlowingDaySettings", targets: ["FlowingDaySettings"])
  ],
  targets: [
    .target(name: "FlowingDaySettings"),
    .testTarget(
      name: "FlowingDaySettingsTests",
      dependencies: ["FlowingDaySettings"]
    ),
  ]
)
