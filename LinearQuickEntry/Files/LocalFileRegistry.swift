import AVFoundation
import AppKit
import UniformTypeIdentifiers

/// A file accepted as an attachment. Mirrors `LocalFile` in web/src/bridge/protocol.ts.
struct LocalFile: Encodable, Equatable {
    let path: String
    let name: String
    let size: Int
    let contentType: String
    let kind: Kind
    let previewUrl: String

    enum Kind: String, Encodable {
        case image
        case video
    }
}

/// Decides which files can be attached (images and videos only) and serves their previews to the webview.
/// Preview URLs are random tokens, so the webview can only load files that were registered here.
final class LocalFileRegistry {
    static let previewHost = "preview"

    private var previewsByToken: [String: URL] = [:]
    private var registeredPaths = Set<String>()
    private var posterCache: [URL: Data] = [:]

    struct Registration {
        var files: [LocalFile] = []
        /// File names that aren't images or videos, or that couldn't be read.
        var rejected: [String] = []
    }

    func register(_ urls: [URL]) -> Registration {
        var registration = Registration()
        for url in urls {
            if let file = register(url) {
                registration.files.append(file)
            } else {
                registration.rejected.append(url.lastPathComponent)
            }
        }
        return registration
    }

    /// Nil when the file is missing or isn't an image or video.
    func register(_ url: URL) -> LocalFile? {
        let fileURL = url.standardizedFileURL
        guard
            let values = try? fileURL.resourceValues(forKeys: [.contentTypeKey, .fileSizeKey, .isRegularFileKey]),
            values.isRegularFile == true,
            let contentType = values.contentType,
            let kind = Self.kind(of: contentType)
        else {
            Log.files.info("file rejected name=\(url.lastPathComponent, privacy: .public)")
            return nil
        }

        let token = UUID().uuidString
        previewsByToken[token] = fileURL
        registeredPaths.insert(fileURL.path)
        return LocalFile(
            path: fileURL.path,
            name: fileURL.lastPathComponent,
            size: values.fileSize ?? 0,
            contentType: contentType.preferredMIMEType ?? "application/octet-stream",
            kind: kind,
            previewUrl: "\(AppSchemeHandler.scheme)://\(Self.previewHost)/\(token)"
        )
    }

    /// Uploads are limited to files that went through `register`, so the panel can't send arbitrary files to Linear.
    func isRegistered(path: String) -> Bool {
        registeredPaths.contains(URL(fileURLWithPath: path).standardizedFileURL.path)
    }

    /// The image to show for a preview token: the file itself for images, a still frame for videos.
    func preview(token: String) async throws -> (data: Data, mimeType: String) {
        guard let fileURL = previewsByToken[token] else { throw BridgeError(.fileUnavailable, "Unknown preview") }
        let contentType = try fileURL.resourceValues(forKeys: [.contentTypeKey]).contentType
        if let contentType, contentType.conforms(to: .image) {
            return (try Data(contentsOf: fileURL), contentType.preferredMIMEType ?? "image/png")
        }
        return (try await poster(for: fileURL), "image/png")
    }

    static func kind(of contentType: UTType) -> LocalFile.Kind? {
        if contentType.conforms(to: .image) { return .image }
        if contentType.conforms(to: .movie) { return .video }
        return nil
    }

    private func poster(for videoURL: URL) async throws -> Data {
        if let cached = posterCache[videoURL] { return cached }
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: videoURL))
        generator.appliesPreferredTrackTransform = true
        // 1280px is plenty for a preview in a 720px-wide panel on a Retina screen.
        generator.maximumSize = CGSize(width: 1280, height: 1280)
        let (image, _) = try await generator.image(at: .zero)
        guard let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else {
            throw BridgeError(.internal, "Couldn't render a preview for \(videoURL.lastPathComponent)")
        }
        posterCache[videoURL] = png
        return png
    }
}
