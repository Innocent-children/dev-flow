// swift-tools-version: 6.0
import PackageDescription

// TaskBelayPet is the macOS arm64 desktop component shipped inside the unified
// `@imotong/taskbelay` package. It reads the existing local WebUI HTTP interface
// and never owns Task or transition semantics; those stay in the Go Core.
let package = Package(
    name: "TaskBelayPet",
    defaultLocalization: "en",
    platforms: [
        .macOS(.v14)
    ],
    targets: [
        .executableTarget(
            name: "TaskBelayPet",
            path: "Sources/TaskBelayPet",
            swiftSettings: [
                .swiftLanguageMode(.v5)
            ]
        ),
        .testTarget(
            name: "TaskBelayPetTests",
            dependencies: ["TaskBelayPet"],
            path: "Tests/TaskBelayPetTests",
            swiftSettings: [
                .swiftLanguageMode(.v5)
            ]
        ),
    ]
)
