import AppKit
import KeyboardShortcuts
import Sparkle

/// Builds the app's services once and connects the hotkeys, the panel, Settings and the updater.
final class AppDelegate: NSObject, NSApplicationDelegate {
    let settings = AppSettings()
    let settingsModel: SettingsModel
    let updaterController: SPUStandardUpdaterController

    private let linearClient: LinearClient
    private let createdIssueHUD = CreatedIssueHUD()
    private lazy var settingsWindow = SettingsWindowController(model: settingsModel)
    private var panelController: PanelController?

    override init() {
        let apiKeyStore = ApiKeyStore(keychain: .apiKey)
        linearClient = LinearClient(session: .shared, apiKeyProvider: { try apiKeyStore.read() })
        settingsModel = SettingsModel(settings: settings, apiKeyStore: apiKeyStore, linearClient: linearClient)
        // Sparkle refuses to start without a signing key; source builds have none and simply don't update.
        updaterController = SPUStandardUpdaterController(startingUpdater: Self.hasUpdateSigningKey, updaterDelegate: nil, userDriverDelegate: nil)
        super.init()
    }

    static var hasUpdateSigningKey: Bool {
        let key = Bundle.main.object(forInfoDictionaryKey: "SUPublicEDKey") as? String ?? ""
        return !key.isEmpty
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Unit tests run inside this app; they need the types, not a live panel and global hotkeys.
        guard !Self.isRunningTests else { return }
        Log.app.info("app launched")

        do {
            let panelController = try makePanelController()
            self.panelController = panelController
            Task { await panelController.load() }
        } catch {
            // Without its storage folder the panel can't keep drafts; better to say so than to lose work silently.
            Log.app.fault("panel setup failed error=\(error.localizedDescription, privacy: .public)")
            presentFatalError(error)
            return
        }

        KeyboardShortcuts.onKeyUp(for: .newIssue) { [weak self] in self?.panelController?.toggle(mode: .newIssue) }
        KeyboardShortcuts.onKeyUp(for: .newSubIssueOfLastParent) { [weak self] in self?.panelController?.toggle(mode: .subIssueOfLastParent) }

        if !settingsModel.hasStoredKey { settingsWindow.show() }
    }

    func showPanel() {
        panelController?.show(mode: .newIssue)
    }

    func showSettings() {
        settingsWindow.show()
    }

    private func makePanelController() throws -> PanelController {
        let registry = LocalFileRegistry()
        guard let webRoot = Bundle.main.resourceURL?.appendingPathComponent("web", isDirectory: true) else {
            throw BridgeError(.internal, "The app bundle has no resources folder")
        }
        let services = PanelController.Services(
            linearClient: linearClient,
            uploader: AttachmentUploader(client: linearClient, session: .shared),
            diskStore: try DiskStore.applicationSupport(),
            registry: registry,
            settings: settings,
            webRoot: webRoot
        )
        let panelController = PanelController(services: services)
        panelController.onOpenSettings = { [weak self] in self?.showSettings() }
        panelController.onIssueCreated = { [weak self] issue in self?.issueCreated(issue) }

        settings.onChange = { [weak panelController] snapshot in panelController?.sendEvent("settings.changed", payload: snapshot) }
        settingsModel.onApiKeyChanged = { [weak panelController] in panelController?.sendEvent("apiKey.changed", payload: [String: String]()) }
        return panelController
    }

    private func issueCreated(_ issue: CreatedIssue) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(issue.url, forType: .string)
        createdIssueHUD.show(issue)
        Log.app.info("issue created identifier=\(issue.identifier, privacy: .public)")
    }

    private func presentFatalError(_ error: Error) {
        let alert = NSAlert()
        alert.messageText = "Linear Quick Entry couldn't start"
        alert.informativeText = error.localizedDescription
        alert.runModal()
        NSApp.terminate(nil)
    }

    private static var isRunningTests: Bool {
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
    }
}
