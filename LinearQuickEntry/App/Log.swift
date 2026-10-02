import os

/// Unified log categories; view them in Console.app filtered by subsystem `pl.bunsch.LinearQuickEntry`.
enum Log {
    static let subsystem = "pl.bunsch.LinearQuickEntry"

    static let app = Logger(subsystem: subsystem, category: "app")
    static let panel = Logger(subsystem: subsystem, category: "panel")
    static let bridge = Logger(subsystem: subsystem, category: "bridge")
    static let linear = Logger(subsystem: subsystem, category: "linear")
    static let uploads = Logger(subsystem: subsystem, category: "uploads")
    static let files = Logger(subsystem: subsystem, category: "files")
    /// Lines the web panel sends through the bridge.
    static let web = Logger(subsystem: subsystem, category: "web")
}
