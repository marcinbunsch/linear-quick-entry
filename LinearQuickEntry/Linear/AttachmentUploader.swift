import Foundation
import os

/// Uploads files to Linear's storage: ask Linear for a signed URL, then PUT the file straight from disk.
/// Large videos are streamed from the file, never loaded into memory or passed through the webview.
final class AttachmentUploader {
    private let client: LinearClient
    private let session: URLSession
    private var uploadTasks: [String: Task<String, Error>] = [:]

    init(client: LinearClient, session: URLSession) {
        self.client = client
        self.session = session
    }

    /// Returns the asset URL to put in the issue description. `onProgress` gets 0...1 as bytes are sent.
    func upload(
        uploadId: String,
        fileURL: URL,
        name: String,
        contentType: String,
        onProgress: @escaping @MainActor (Double) -> Void
    ) async throws -> String {
        let task = Task { [client, session] in
            let size = try Self.fileSize(of: fileURL)
            let target = try await client.requestUploadTarget(contentType: contentType, filename: name, size: size)
            try Task.checkCancellation()
            try await Self.put(fileURL: fileURL, contentType: contentType, target: target, session: session, onProgress: onProgress)
            return target.assetUrl
        }
        uploadTasks[uploadId] = task
        defer { uploadTasks[uploadId] = nil }

        Log.uploads.info("upload started id=\(uploadId, privacy: .public) type=\(contentType, privacy: .public)")
        do {
            let assetUrl = try await task.value
            Log.uploads.info("upload finished id=\(uploadId, privacy: .public)")
            return assetUrl
        } catch {
            let bridgeError = BridgeError.from(urlError: error)
            Log.uploads.warning("upload failed id=\(uploadId, privacy: .public) error=\(bridgeError.replyString, privacy: .public)")
            throw bridgeError
        }
    }

    func cancel(uploadId: String) {
        guard let task = uploadTasks[uploadId] else { return }
        Log.uploads.info("upload cancelled id=\(uploadId, privacy: .public)")
        task.cancel()
    }

    private static func fileSize(of fileURL: URL) throws -> Int {
        do {
            let attributes = try FileManager.default.attributesOfItem(atPath: fileURL.path)
            guard let size = attributes[.size] as? NSNumber else { throw BridgeError(.fileUnavailable, "Can't read the size of \(fileURL.lastPathComponent)") }
            return size.intValue
        } catch let error as BridgeError {
            throw error
        } catch {
            throw BridgeError(.fileUnavailable, "\(fileURL.lastPathComponent) can't be read: \(error.localizedDescription)")
        }
    }

    private static func put(
        fileURL: URL,
        contentType: String,
        target: LinearClient.UploadTarget,
        session: URLSession,
        onProgress: @escaping @MainActor (Double) -> Void
    ) async throws {
        guard let uploadURL = URL(string: target.uploadUrl) else { throw BridgeError(.http, "Linear sent an invalid upload URL") }
        var request = URLRequest(url: uploadURL)
        request.httpMethod = "PUT"
        // The same headers Linear's own SDK example sends, plus the signed headers Linear returned.
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.setValue("public, max-age=31536000", forHTTPHeaderField: "Cache-Control")
        for header in target.headers {
            request.setValue(header.value, forHTTPHeaderField: header.key)
        }

        let delegate = UploadProgressDelegate(onProgress: onProgress)
        let (_, response) = try await session.upload(for: request, fromFile: fileURL, delegate: delegate)
        guard let httpResponse = response as? HTTPURLResponse else { throw BridgeError(.network, "Storage sent a non-HTTP response") }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw BridgeError(.http, "Upload rejected with HTTP \(httpResponse.statusCode)")
        }
    }
}

/// URLSession reports progress on its own queue; this hops it to the main actor for the bridge.
private nonisolated final class UploadProgressDelegate: NSObject, URLSessionTaskDelegate {
    // 1%: URLSession can report hundreds of times a second for a large video, and each report
    // becomes a JavaScript call; a progress ring can't show finer steps anyway.
    private static let minimumStep = 0.01

    private let onProgress: @MainActor (Double) -> Void
    private let lastReported = OSAllocatedUnfairLock(initialState: 0.0)

    init(onProgress: @escaping @MainActor (Double) -> Void) {
        self.onProgress = onProgress
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didSendBodyData bytesSent: Int64, totalBytesSent: Int64, totalBytesExpectedToSend: Int64) {
        guard totalBytesExpectedToSend > 0 else { return }
        let fraction = Double(totalBytesSent) / Double(totalBytesExpectedToSend)
        let shouldReport = lastReported.withLock { last in
            guard fraction - last >= Self.minimumStep || fraction >= 1 else { return false }
            last = fraction
            return true
        }
        guard shouldReport else { return }
        let onProgress = self.onProgress
        Task { @MainActor in onProgress(fraction) }
    }
}
