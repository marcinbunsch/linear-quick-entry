import AppKit
import UniformTypeIdentifiers
import WebKit

/// How the panel was opened; mirrors `PanelOpenMode` in web/src/bridge/protocol.ts.
enum PanelOpenMode: String, Encodable {
    case newIssue
    case subIssueOfLastParent
}

/// Owns the floating panel and its web view for the whole app lifetime. The page is loaded once at
/// launch and kept alive, so the hotkey shows a ready panel with the draft still in it.
final class PanelController: NSObject, WKNavigationDelegate {
    struct Services {
        let linearClient: LinearClient
        let uploader: AttachmentUploader
        let diskStore: DiskStore
        let registry: LocalFileRegistry
        let settings: AppSettings
        let webRoot: URL
    }

    var onOpenSettings: () -> Void = {}
    var onIssueCreated: (CreatedIssue) -> Void = { _ in }

    private let panel = QuickEntryPanel()
    private let webView: FileDropWebView
    private let bridge = WebBridge()
    private let registry: LocalFileRegistry
    /// The app that was in front when the panel opened; it gets focus back when the panel closes.
    private var previousApp: NSRunningApplication?
    private var contentHeight = PanelGeometry.minimumHeight
    private var panelURL = AppSchemeHandler.entryURL
    private var recentTerminations: [Date] = []
    private let placementStore = PanelPlacementStore()
    /// Watches mouse drags while the user moves the panel by its header; nil when not dragging.
    private var dragMonitor: Any?

    // Three crashes within a minute means the page itself is broken, not that memory ran low once.
    private static let maximumTerminationsInWindow = 3
    private static let terminationWindow: TimeInterval = 60

    init(services: Services) {
        registry = services.registry
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(AppSchemeHandler(webRoot: services.webRoot, registry: services.registry), forURLScheme: AppSchemeHandler.scheme)
        configuration.userContentController.addScriptMessageHandler(bridge, contentWorld: .page, name: WebBridge.handlerName)
        configuration.userContentController.addUserScript(Self.errorReporterScript)
        webView = FileDropWebView(frame: panel.contentLayoutRect, configuration: configuration)
        super.init()

        // The page paints the card itself; without this the transparent window shows a white rectangle.
        webView.setValue(false, forKey: "drawsBackground")
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        #if DEBUG
        webView.isInspectable = true
        #endif
        panel.contentView = webView

        bridge.webView = webView
        bridge.router = BridgeRouter(
            dependencies: BridgeRouter.Dependencies(
                linearClient: services.linearClient,
                uploader: services.uploader,
                diskStore: services.diskStore,
                registry: services.registry,
                settings: services.settings,
                pasteboard: .general,
                sendEvent: { [bridge] name, payload in bridge.sendEvent(name, payload: payload) }
            ),
            panelActions: makePanelActions()
        )
        webView.onFileDrag = { [weak self] event in self?.onFileDrag(event) }
    }

    var isVisible: Bool { panel.isVisible }

    /// Loads the page in the background at launch so the first hotkey press is instant.
    func load() async {
        #if DEBUG
        // Debug builds use the Vite dev server for hot reload when it's running, and the bundled build otherwise.
        let devServerURL = URL(string: "http://localhost:5173/")!
        if await Self.isReachable(devServerURL) { panelURL = devServerURL }
        #endif
        Log.panel.info("loading web panel url=\(self.panelURL.absoluteString, privacy: .public)")
        webView.load(URLRequest(url: panelURL))
    }

    func toggle(mode: PanelOpenMode) {
        let isInFront = panel.isVisible && panel.isKeyWindow
        if isInFront && mode == .newIssue {
            hide()
        } else {
            show(mode: mode)
        }
    }

    func show(mode: PanelOpenMode) {
        if !panel.isVisible {
            let frontmost = NSWorkspace.shared.frontmostApplication
            previousApp = frontmost?.processIdentifier == ProcessInfo.processInfo.processIdentifier ? nil : frontmost
            panel.setFrame(initialFrame(on: screenUnderMouse()), display: false)
        }
        bringToFront()
        bridge.sendEvent("panel.shown", payload: ["mode": mode.rawValue])
        Log.panel.info("panel shown mode=\(mode.rawValue, privacy: .public)")
    }

    func hide() {
        guard panel.isVisible else { return }
        panel.orderOut(nil)
        Log.panel.info("panel hidden")
        guard NSApp.isActive else { return }
        if let previousApp, !previousApp.isTerminated {
            previousApp.activate()
        } else {
            NSApp.hide(nil)
        }
    }

    func sendEvent(_ name: String, payload: any Encodable) {
        bridge.sendEvent(name, payload: payload)
    }

    // MARK: - Navigation

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        Log.panel.info("web panel loaded")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        Log.panel.error("web panel failed to load error=\(error.localizedDescription, privacy: .public)")
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // The web process can be killed under memory pressure; loading again restores the panel and its saved draft.
        // A page that crashes on every load would otherwise reload in a tight loop, so give up after a few quick crashes.
        let now = Date()
        recentTerminations = recentTerminations.filter { now.timeIntervalSince($0) < Self.terminationWindow } + [now]
        guard recentTerminations.count <= Self.maximumTerminationsInWindow else {
            Log.panel.fault("web content process keeps terminating, not reloading count=\(self.recentTerminations.count)")
            return
        }
        Log.panel.warning("web content process terminated, loading again")
        webView.load(URLRequest(url: panelURL))
    }

    // MARK: - Private

    /// Reports uncaught page errors to the unified log. Injected natively so it also catches a bundle that fails to load.
    private static let errorReporterScript = WKUserScript(
        source: """
        (() => {
          const report = (message, source) => window.webkit.messageHandlers.\(WebBridge.handlerName).postMessage({
            method: 'log',
            params: { level: 'error', message: 'uncaught page error', fields: { error: String(message), source: String(source) } },
          }).catch(() => {});
          window.addEventListener('error', (event) => report(event.message, `${event.filename}:${event.lineno}`));
          window.addEventListener('unhandledrejection', (event) => report(event.reason, 'unhandled promise rejection'));
        })();
        """,
        injectionTime: .atDocumentStart,
        forMainFrameOnly: true
    )

    #if DEBUG
    private static func isReachable(_ url: URL) async -> Bool {
        var request = URLRequest(url: url)
        // 0.5s: the dev server is local, so anything slower means it isn't running.
        request.timeoutInterval = 0.5
        let response = try? await URLSession.shared.data(for: request).1
        return (response as? HTTPURLResponse)?.statusCode == 200
    }
    #endif

    /// Spotlight-style: the panel takes the keyboard without activating the app. macOS 14+ refuses
    /// activation requests from a background app (even `ignoringOtherApps`), which left the panel on
    /// screen with typing still going to the app underneath. A non-activating panel can be key anyway.
    private func bringToFront() {
        panel.orderFrontRegardless()
        panel.makeKey()
        panel.makeFirstResponder(webView)
    }

    /// Where the dragged panel was left on this screen, or the default spot under the menu bar.
    private func initialFrame(on screen: NSScreen) -> CGRect {
        if let topLeft = placementStore.topLeft(for: screen.frame) {
            return PanelGeometry.frame(height: contentHeight, topLeft: topLeft, on: screen.visibleFrame)
        }
        return PanelGeometry.frame(height: contentHeight, on: screen.visibleFrame)
    }

    /// The page asks for this on a mouse-down in an empty part of the header or footer. The panel then
    /// follows the mouse until it's released, and the spot is remembered for this screen.
    private func beginDrag() {
        // The request arrives a moment after the mouse-down; a click that's already over must not
        // leave the panel glued to the next drag (like selecting text).
        let isMouseDown = NSEvent.pressedMouseButtons & 1 != 0
        guard isMouseDown, dragMonitor == nil else { return }
        let startMouse = NSEvent.mouseLocation
        let startOrigin = panel.frame.origin
        dragMonitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDragged, .leftMouseUp]) { [weak self] event in
            guard let self else { return event }
            if event.type == .leftMouseUp {
                self.endDrag()
                return event
            }
            let mouse = NSEvent.mouseLocation
            self.panel.setFrameOrigin(NSPoint(x: startOrigin.x + mouse.x - startMouse.x, y: startOrigin.y + mouse.y - startMouse.y))
            return event
        }
    }

    private func endDrag() {
        if let dragMonitor { NSEvent.removeMonitor(dragMonitor) }
        dragMonitor = nil
        guard let screen = panel.screen else { return }
        placementStore.save(topLeft: CGPoint(x: panel.frame.minX, y: panel.frame.maxY), for: screen.frame)
        Log.panel.info("panel moved")
    }

    private func resize(toHeight height: CGFloat) {
        contentHeight = height
        guard panel.isVisible, let screen = panel.screen else { return }
        let frame = PanelGeometry.resized(panel.frame, toHeight: height, within: screen.visibleFrame)
        guard frame != panel.frame else { return }
        panel.setFrame(frame, display: true)
    }

    private func screenUnderMouse() -> NSScreen {
        let mouse = NSEvent.mouseLocation
        return NSScreen.screens.first { NSMouseInRect(mouse, $0.frame, false) } ?? NSScreen.main ?? NSScreen.screens[0]
    }

    private func onFileDrag(_ event: FileDropWebView.FileDragEvent) {
        switch event {
        case .moved(let point):
            bridge.sendEvent("files.dragOver", payload: PointPayload(x: point.x, y: point.y))
        case .exited:
            bridge.sendEvent("files.dragExit", payload: [String: String]())
        case .dropped(let urls, let point):
            let registration = registry.register(urls)
            bridge.sendEvent("files.dropped", payload: DroppedFilesPayload(files: registration.files, rejected: registration.rejected, x: point.x, y: point.y))
            // Files usually come from Finder, which now has focus; take it back so typing continues in the panel.
            bringToFront()
        }
    }

    private func makePanelActions() -> PanelActions {
        PanelActions(
            hide: { [weak self] in self?.hide() },
            resize: { [weak self] height in self?.resize(toHeight: height) },
            openSettings: { [weak self] in self?.onOpenSettings() },
            pickFiles: { [weak self] in await self?.pickFiles() ?? [] },
            captureScreenshot: { [weak self] in try await self?.captureScreenshot() ?? .cancelled },
            beginDrag: { [weak self] in self?.beginDrag() },
            issueCreated: { [weak self] issue in self?.onIssueCreated(issue) }
        )
    }

    private func pickFiles() async -> [URL] {
        let openPanel = NSOpenPanel()
        openPanel.allowedContentTypes = [.image, .movie]
        openPanel.allowsMultipleSelection = true
        openPanel.canChooseDirectories = false
        // Above the floating panel, or the Open dialog would open behind it.
        openPanel.level = .modalPanel
        let response = await withCheckedContinuation { continuation in
            openPanel.begin { response in continuation.resume(returning: response) }
        }
        bringToFront()
        return response == .OK ? openPanel.urls : []
    }

    private func captureScreenshot() async throws -> ScreenshotOutcome {
        // Without permission macOS shows its own prompt, or the user has to visit System Settings.
        // The floating panel would sit on top of either, so it stays hidden until the next hotkey.
        guard CGPreflightScreenCaptureAccess() else {
            panel.orderOut(nil)
            ScreenRecordingPermission.request()
            return .needsPermission
        }
        // Out of the way while the user selects a region, then straight back.
        panel.orderOut(nil)
        defer { bringToFront() }
        guard let file = try await ScreenshotCapturer(registry: registry).capture() else { return .cancelled }
        return .captured(file)
    }
}

private struct PointPayload: Encodable {
    let x: CGFloat
    let y: CGFloat
}

private struct DroppedFilesPayload: Encodable {
    let files: [LocalFile]
    let rejected: [String]
    let x: CGFloat
    let y: CGFloat
}
