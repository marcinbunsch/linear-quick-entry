import AppKit

/// Files the app creates itself: pasted images and screenshots. They live in Caches so a restored
/// draft can still find them, and macOS may clean them up when space runs low.
enum CapturedFiles {
    static func directory() throws -> URL {
        let caches = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let directory = caches.appendingPathComponent(Log.subsystem, isDirectory: true).appendingPathComponent("Captures", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    /// "Screenshot 2026-10-02 at 14.31.07.png", matching how macOS names its own screenshots.
    static func newFileURL(prefix: String, date: Date = Date()) throws -> URL {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd 'at' HH.mm.ss"
        let baseName = "\(prefix) \(formatter.string(from: date))"
        let directory = try directory()
        var candidate = directory.appendingPathComponent("\(baseName).png")
        var suffix = 2
        while FileManager.default.fileExists(atPath: candidate.path) {
            candidate = directory.appendingPathComponent("\(baseName) (\(suffix)).png")
            suffix += 1
        }
        return candidate
    }
}

/// Reads attachable files from the clipboard: copied files from Finder, or raw image data from a screenshot or an app.
struct ClipboardReader {
    let registry: LocalFileRegistry
    let pasteboard: NSPasteboard

    func readFiles() throws -> LocalFileRegistry.Registration {
        let fileURLs = pasteboard.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL] ?? []
        if !fileURLs.isEmpty { return registry.register(fileURLs) }

        guard let pngData = imageDataAsPNG() else { return LocalFileRegistry.Registration() }
        let fileURL = try CapturedFiles.newFileURL(prefix: "Pasted image")
        try pngData.write(to: fileURL, options: .atomic)
        return registry.register([fileURL])
    }

    private func imageDataAsPNG() -> Data? {
        if let png = pasteboard.data(forType: .png) { return png }
        guard let tiff = pasteboard.data(forType: .tiff), let bitmap = NSBitmapImageRep(data: tiff) else { return nil }
        return bitmap.representation(using: .png, properties: [:])
    }
}

/// Lets the user drag out a region of the screen with the system's own screenshot tool.
struct ScreenshotCapturer {
    let registry: LocalFileRegistry

    /// Nil when the user pressed Escape instead of selecting a region.
    func capture() async throws -> LocalFile? {
        let fileURL = try CapturedFiles.newFileURL(prefix: "Screenshot")
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
        // -i: interactive region or window selection, -x: no camera shutter sound.
        process.arguments = ["-i", "-x", fileURL.path]

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            process.terminationHandler = { _ in continuation.resume() }
            do {
                try process.run()
            } catch {
                process.terminationHandler = nil
                continuation.resume(throwing: BridgeError(.internal, "Couldn't start screencapture: \(error.localizedDescription)"))
            }
        }

        // screencapture exits without writing a file when the selection is cancelled.
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return nil }
        return registry.register(fileURL)
    }
}
