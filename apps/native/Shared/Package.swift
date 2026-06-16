// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "WatermelonCore",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(name: "WatermelonCore", targets: ["WatermelonCore"]),
    ],
    targets: [
        .target(name: "WatermelonCore"),
    ]
)
