import Foundation

/// The runtime record written atomically after the window is ready. It lets the
/// launcher and a later `stop` request identify the running instance by actual
/// process facts instead of a PID or an application name.
struct InstanceRecord: Codable, Equatable {
    let pid: Int
    let processStartIdentity: String
    let executablePath: String
    let corePath: String
    let coreIdentity: String
    let dataRootDigest: String

    enum CodingKeys: String, CodingKey {
        case pid
        case processStartIdentity = "process_start_identity"
        case executablePath = "executable_path"
        case corePath = "core_path"
        case coreIdentity = "core_identity"
        case dataRootDigest = "data_root_digest"
    }

    static func decode(_ data: Data) -> InstanceRecord? {
        guard let record = try? JSONDecoder().decode(InstanceRecord.self, from: data) else { return nil }
        guard record.pid > 0,
              !record.processStartIdentity.isEmpty,
              !record.executablePath.isEmpty,
              !record.corePath.isEmpty,
              !record.coreIdentity.isEmpty,
              !record.dataRootDigest.isEmpty else {
            return nil
        }
        return record
    }

    func encoded() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(self)
    }
}

/// What a `run` request must do after inspecting the lock and the record.
enum SingleInstanceDecision: Equatable {
    /// No instance holds the lock; start a window and write a fresh record.
    case start
    /// The same Core and data directory are already running; ask it to show.
    case restore(pid: Int32)
    /// An instance is running for a different Core or data directory.
    case conflict(InstanceConflict)
}

enum InstanceConflict: String, Equatable {
    case coreDiffers = "core_differs"
    case dataDirectoryDiffers = "data_directory_differs"
    case recordUnverifiable = "record_unverifiable"
}

/// What a `stop` request must do for the record it found.
enum StopDecision: Equatable {
    /// No instance is recorded, so stopping already succeeded.
    case nothingToStop
    /// The recorded instance matches this request; ask it to shut down.
    case terminate(pid: Int32)
    /// The record belongs to another Core, which this request must not stop.
    case otherCoreInUse
    /// The record no longer describes a live matching process; discard it.
    case expiredRecord
}

/// Single-instance and shutdown decisions expressed as pure functions so the
/// targeted tests cover them without a window or a live process.
enum InstanceRules {
    /// Decides a `run` request. `lockAcquired` reports whether this process now
    /// holds `instance.lock`. An expired record is only removed after both the
    /// lock is free and no process matches the record.
    static func decideRun(
        lockAcquired: Bool,
        record: InstanceRecord?,
        liveIdentity: NativeProcess.Identity?,
        currentIdentity: NativeProcess.Identity?,
        corePath: String,
        coreIdentity: String,
        dataRootDigest: String
    ) -> SingleInstanceDecision {
        if lockAcquired {
            return .start
        }
        guard let record, let liveIdentity, let currentIdentity else {
            return .conflict(.recordUnverifiable)
        }
        guard liveIdentity.pid == Int32(record.pid),
              liveIdentity.startIdentity == record.processStartIdentity,
              liveIdentity.executablePath == record.executablePath,
              liveIdentity.ownerUserID == currentIdentity.ownerUserID else {
            return .conflict(.recordUnverifiable)
        }
        if record.corePath != corePath || record.coreIdentity != coreIdentity {
            return .conflict(.coreDiffers)
        }
        if record.dataRootDigest != dataRootDigest {
            return .conflict(.dataDirectoryDiffers)
        }
        return .restore(pid: Int32(record.pid))
    }

    /// Decides a `stop` request. `requestedCorePath` is nil for `dev-flow pet
    /// stop`, which stops the current user's instance, and set during Adapter
    /// maintenance, which must only stop instances using that Core.
    static func decideStop(
        record: InstanceRecord?,
        liveIdentity: NativeProcess.Identity?,
        currentUserID: uid_t,
        requestedExecutablePath: String?,
        requestedCorePath: String?
    ) -> StopDecision {
        guard let record else { return .nothingToStop }
        if let requestedCorePath, requestedCorePath != record.corePath {
            return .otherCoreInUse
        }
        guard let liveIdentity else { return .expiredRecord }
        guard liveIdentity.pid == Int32(record.pid),
              liveIdentity.startIdentity == record.processStartIdentity,
              liveIdentity.ownerUserID == currentUserID else {
            return .expiredRecord
        }
        if let requestedExecutablePath, liveIdentity.executablePath != requestedExecutablePath {
            return .expiredRecord
        }
        if liveIdentity.executablePath != record.executablePath {
            return .expiredRecord
        }
        return .terminate(pid: Int32(record.pid))
    }
}
