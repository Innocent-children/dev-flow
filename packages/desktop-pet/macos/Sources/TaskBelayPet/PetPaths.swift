import Foundation

/// Locations of the desktop component's own records inside the user product
/// root. The lifecycle manager treats `pet` as its own confirmed reset target,
/// separate from the Task data directory.
struct PetPaths: Equatable {
    let root: String
    let instanceLock: String
    let runtimeRecord: String
    let settings: String
    let appearances: String

    init(productRoot: String) {
        let root = (productRoot as NSString).appendingPathComponent("pet")
        self.root = root
        instanceLock = (root as NSString).appendingPathComponent("instance.lock")
        runtimeRecord = (root as NSString).appendingPathComponent("runtime.json")
        settings = (root as NSString).appendingPathComponent("settings.json")
        appearances = (root as NSString).appendingPathComponent("appearances")
    }
}
