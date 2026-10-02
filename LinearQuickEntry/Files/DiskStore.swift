import Foundation

/// The panel's draft, preferences and workspace cache, one JSON file each in Application Support.
/// The panel owns the file contents; this only checks the key and moves strings to and from disk.
struct DiskStore {
    /// Mirrors `StorageKey` in web/src/bridge/protocol.ts. Anything else is refused, so the panel can't write arbitrary files.
    static let allowedKeys: Set<String> = ["draft", "preferences", "reference-data"]

    let directory: URL

    static func applicationSupport() throws -> DiskStore {
        let base = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        return DiskStore(directory: base.appendingPathComponent(Log.subsystem, isDirectory: true))
    }

    func read(key: String) throws -> String? {
        let url = try fileURL(for: key)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        return try String(contentsOf: url, encoding: .utf8)
    }

    func write(key: String, value: String) throws {
        let url = try fileURL(for: key)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        // Atomic, so a crash mid-write leaves the previous draft rather than half a file.
        try Data(value.utf8).write(to: url, options: .atomic)
    }

    private func fileURL(for key: String) throws -> URL {
        guard Self.allowedKeys.contains(key) else { throw BridgeError(.invalidParams, "Unknown storage key \(key)") }
        return directory.appendingPathComponent("\(key).json")
    }
}
