// swift-tools-version: 6.0
import PackageDescription

// DevFlowPet is the macOS arm64 desktop component shipped inside the unified
// `@imotong/dev-flow` package. It reads the existing local WebUI HTTP interface
// and never owns Task or transition semantics; those stay in the Go Core.
let package = Package(
    name: "DevFlowPet",
    defaultLocalization: "en",
    platforms: [
        .macOS(.v14)
    ],
    targets: [
        .executableTarget(
            name: "DevFlowPet",
            path: "Sources/DevFlowPet",
            swiftSettings: [
                .swiftLanguageMode(.v5)
            ]
        ),
        .testTarget(
            name: "DevFlowPetTests",
            dependencies: ["DevFlowPet"],
            path: "Tests/DevFlowPetTests",
            swiftSettings: [
                .swiftLanguageMode(.v5)
            ]
        ),
    ]
)
