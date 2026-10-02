import UniformTypeIdentifiers
import WebKit

/// Serves `lqe://app/…` from the bundled web build and `lqe://preview/<token>` from the file registry.
/// A custom scheme instead of file:// gives the page a proper origin and keeps it away from the rest of the disk.
final class AppSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "lqe"
    static let appHost = "app"
    static let entryURL = URL(string: "\(scheme)://\(appHost)/index.html")!

    private let webRoot: URL
    private let registry: LocalFileRegistry
    /// WebKit may cancel a request while a video poster is still rendering; replying after that crashes.
    private var stoppedTasks = Set<ObjectIdentifier>()

    init(webRoot: URL, registry: LocalFileRegistry) {
        self.webRoot = webRoot.standardizedFileURL
        self.registry = registry
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(BridgeError(.invalidParams, "Request without URL"))
            return
        }

        switch url.host {
        case Self.appHost:
            serveBundledFile(at: url.path, to: urlSchemeTask)
        case LocalFileRegistry.previewHost:
            servePreview(token: url.lastPathComponent, to: urlSchemeTask)
        default:
            respond(to: urlSchemeTask, status: 404, data: Data(), mimeType: "text/plain")
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {
        stoppedTasks.insert(ObjectIdentifier(urlSchemeTask))
    }

    private func serveBundledFile(at path: String, to task: any WKURLSchemeTask) {
        let relativePath = path.isEmpty || path == "/" ? "index.html" : String(path.drop(while: { $0 == "/" }))
        let fileURL = webRoot.appendingPathComponent(relativePath).standardizedFileURL
        // Refuse anything that resolves outside the web build, such as "/../../secrets".
        let isInsideWebRoot = fileURL.path.hasPrefix(webRoot.path + "/")
        guard isInsideWebRoot, let data = try? Data(contentsOf: fileURL) else {
            Log.panel.warning("bundled file missing path=\(path, privacy: .public)")
            respond(to: task, status: 404, data: Data(), mimeType: "text/plain")
            return
        }
        respond(to: task, status: 200, data: data, mimeType: Self.mimeType(forPathExtension: fileURL.pathExtension))
    }

    private func servePreview(token: String, to task: any WKURLSchemeTask) {
        let taskIdentifier = ObjectIdentifier(task)
        Task {
            defer { stoppedTasks.remove(taskIdentifier) }
            do {
                let preview = try await registry.preview(token: token)
                guard !stoppedTasks.contains(taskIdentifier) else { return }
                respond(to: task, status: 200, data: preview.data, mimeType: preview.mimeType)
            } catch {
                guard !stoppedTasks.contains(taskIdentifier) else { return }
                Log.files.warning("preview failed error=\(error.localizedDescription, privacy: .public)")
                respond(to: task, status: 404, data: Data(), mimeType: "text/plain")
            }
        }
    }

    /// The response must carry the request's own URL: WebKit kills the page's process when they differ.
    private func respond(to task: any WKURLSchemeTask, status: Int, data: Data, mimeType: String) {
        let headers = ["Content-Type": mimeType, "Content-Length": String(data.count), "Cache-Control": "no-store"]
        guard let url = task.request.url, let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else {
            task.didFailWithError(BridgeError(.internal, "Couldn't build a response for \(String(describing: task.request.url))"))
            return
        }
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    static func mimeType(forPathExtension pathExtension: String) -> String {
        // Module scripts are refused unless served with a JavaScript MIME type.
        if pathExtension == "js" || pathExtension == "mjs" { return "text/javascript" }
        return UTType(filenameExtension: pathExtension)?.preferredMIMEType ?? "application/octet-stream"
    }
}
