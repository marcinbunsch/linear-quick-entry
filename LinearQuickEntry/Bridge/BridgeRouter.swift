import AppKit

/// Panel-window operations the router needs but doesn't own; supplied by PanelController.
struct PanelActions {
    var hide: () -> Void
    var resize: (_ height: CGFloat) -> Void
    var openSettings: () -> Void
    /// Shows an Open panel; returns the chosen files, or none when cancelled.
    var pickFiles: () async -> [URL]
    /// Hides the panel while the user selects a region, then shows it again.
    var captureScreenshot: () async throws -> LocalFile?
    var issueCreated: (_ issue: CreatedIssue) -> Void
}

struct CreatedIssue: Decodable {
    let identifier: String
    let title: String
    let url: String
}

/// Answers the panel's requests (`NativeMethods` in web/src/bridge/protocol.ts) using the native services.
/// Every result is a JSON-compatible Foundation value, ready to hand back to JavaScript.
final class BridgeRouter {
    struct Dependencies {
        let linearClient: LinearClient
        let uploader: AttachmentUploader
        let diskStore: DiskStore
        let registry: LocalFileRegistry
        let settings: AppSettings
        let pasteboard: NSPasteboard
        let sendEvent: (_ name: String, _ payload: any Encodable) -> Void
    }

    private let dependencies: Dependencies
    private let panelActions: PanelActions

    init(dependencies: Dependencies, panelActions: PanelActions) {
        self.dependencies = dependencies
        self.panelActions = panelActions
    }

    func handle(method: String, params: [String: Any]) async throws -> Any {
        switch method {
        case "graphql":
            guard let query = params["query"] as? String else { throw BridgeError(.invalidParams, "graphql needs a query") }
            let variables = params["variables"] as? [String: Any] ?? [:]
            let response = try await dependencies.linearClient.send(query: query, variables: variables)
            return try encode(GraphQLResult(status: response.status, body: response.body))

        case "storage.read":
            let request = try decode(StorageReadParams.self, from: params)
            return try encode(StorageReadResult(value: try dependencies.diskStore.read(key: request.key)))

        case "storage.write":
            let request = try decode(StorageWriteParams.self, from: params)
            try dependencies.diskStore.write(key: request.key, value: request.value)
            return emptyResult

        case "files.pick":
            let urls = await panelActions.pickFiles()
            return try encode(FilesResult(dependencies.registry.register(urls)))

        case "files.readClipboard":
            let registration = try ClipboardReader(registry: dependencies.registry, pasteboard: dependencies.pasteboard).readFiles()
            return try encode(FilesResult(registration))

        case "files.register":
            let request = try decode(RegisterParams.self, from: params)
            let registration = dependencies.registry.register(request.paths.map { URL(fileURLWithPath: $0) })
            return try encode(RegisterResult(files: registration.files))

        case "screenshot.capture":
            return try encode(ScreenshotResult(file: try await panelActions.captureScreenshot()))

        case "upload.start":
            let request = try decode(UploadStartParams.self, from: params)
            guard dependencies.registry.isRegistered(path: request.path) else {
                throw BridgeError(.fileUnavailable, "\(request.name) was not added through the panel")
            }
            let sendEvent = dependencies.sendEvent
            let assetUrl = try await dependencies.uploader.upload(
                uploadId: request.uploadId,
                fileURL: URL(fileURLWithPath: request.path),
                name: request.name,
                contentType: request.contentType,
                onProgress: { fraction in sendEvent("upload.progress", UploadProgressEvent(uploadId: request.uploadId, fraction: fraction)) }
            )
            return try encode(UploadStartResult(assetUrl: assetUrl))

        case "upload.cancel":
            let request = try decode(UploadCancelParams.self, from: params)
            dependencies.uploader.cancel(uploadId: request.uploadId)
            return emptyResult

        case "panel.hide":
            panelActions.hide()
            return emptyResult

        case "panel.resize":
            let request = try decode(ResizeParams.self, from: params)
            panelActions.resize(request.height)
            return emptyResult

        case "issue.created":
            panelActions.issueCreated(try decode(CreatedIssue.self, from: params))
            return emptyResult

        case "settings.get":
            return try encode(dependencies.settings.snapshot)

        case "settings.open":
            panelActions.openSettings()
            return emptyResult

        case "log":
            logFromPanel(params)
            return emptyResult

        default:
            throw BridgeError(.invalidParams, "Unknown method \(method)")
        }
    }

    private var emptyResult: [String: Any] { [:] }

    private func logFromPanel(_ params: [String: Any]) {
        let message = params["message"] as? String ?? ""
        let fields = (params["fields"] as? [String: Any] ?? [:])
            .sorted { $0.key < $1.key }
            .map { "\($0.key)=\($0.value)" }
            .joined(separator: " ")
        let line = fields.isEmpty ? message : "\(message) \(fields)"
        switch params["level"] as? String {
        case "error": Log.web.error("\(line, privacy: .public)")
        case "warning": Log.web.warning("\(line, privacy: .public)")
        default: Log.web.info("\(line, privacy: .public)")
        }
    }

    private func decode<Params: Decodable>(_ type: Params.Type, from params: [String: Any]) throws -> Params {
        do {
            let data = try JSONSerialization.data(withJSONObject: params)
            return try JSONDecoder().decode(type, from: data)
        } catch {
            throw BridgeError(.invalidParams, "Invalid parameters: \(error.localizedDescription)")
        }
    }

    private func encode(_ value: some Encodable) throws -> Any {
        let data = try JSONEncoder().encode(value)
        return try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
    }
}

// Parameter and result shapes; names and fields mirror NativeMethods in protocol.ts.

private struct GraphQLResult: Encodable {
    let status: Int
    let body: String
}

private struct StorageReadParams: Decodable { let key: String }

private struct StorageReadResult: Encodable {
    let value: String?

    // Encode a missing value as null rather than leaving the key out; the panel expects `value: null`.
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(value, forKey: .value)
    }

    private enum CodingKeys: String, CodingKey { case value }
}

private struct StorageWriteParams: Decodable {
    let key: String
    let value: String
}

private struct FilesResult: Encodable {
    let files: [LocalFile]
    let rejected: [String]

    init(_ registration: LocalFileRegistry.Registration) {
        files = registration.files
        rejected = registration.rejected
    }
}

private struct RegisterParams: Decodable { let paths: [String] }
private struct RegisterResult: Encodable { let files: [LocalFile] }

private struct ScreenshotResult: Encodable {
    let file: LocalFile?

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(file, forKey: .file)
    }

    private enum CodingKeys: String, CodingKey { case file }
}

private struct UploadStartParams: Decodable {
    let uploadId: String
    let path: String
    let name: String
    let contentType: String
}

private struct UploadStartResult: Encodable { let assetUrl: String }
private struct UploadCancelParams: Decodable { let uploadId: String }
private struct ResizeParams: Decodable { let height: CGFloat }

struct UploadProgressEvent: Encodable {
    let uploadId: String
    let fraction: Double
}
