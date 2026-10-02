import Foundation
import Observation
import ServiceManagement

/// State behind the Settings window: the API key, its connection check, and launch at login.
@Observable
final class SettingsModel {
    enum ConnectionState: Equatable {
        case unknown
        case checking
        case connected(LinearClient.Identity)
        case failed(String)
    }

    var apiKeyInput = ""
    private(set) var hasStoredKey = false
    private(set) var connectionState: ConnectionState = .unknown
    private(set) var launchAtLogin = SMAppService.mainApp.status == .enabled
    private(set) var launchAtLoginError: String?

    let settings: AppSettings

    /// Called after the stored key is saved or removed, so the panel drops data from the old workspace.
    @ObservationIgnored var onApiKeyChanged: () -> Void = {}

    @ObservationIgnored private let apiKeyStore: ApiKeyStore
    @ObservationIgnored private let linearClient: LinearClient

    init(settings: AppSettings, apiKeyStore: ApiKeyStore, linearClient: LinearClient) {
        self.settings = settings
        self.apiKeyStore = apiKeyStore
        self.linearClient = linearClient
        hasStoredKey = (try? apiKeyStore.read()) != nil
    }

    /// Checks the typed key against Linear first, so a typo is caught before it replaces a working key.
    func saveApiKey() async {
        let apiKey = apiKeyInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !apiKey.isEmpty else { return }
        connectionState = .checking
        do {
            let identity = try await linearClient.fetchIdentity(apiKey: apiKey)
            try apiKeyStore.save(apiKey)
            hasStoredKey = true
            apiKeyInput = ""
            connectionState = .connected(identity)
            Log.app.info("api key saved")
            onApiKeyChanged()
        } catch {
            connectionState = .failed(error.localizedDescription)
            Log.app.warning("api key check failed error=\(error.localizedDescription, privacy: .public)")
        }
    }

    /// Re-checks the stored key, e.g. when the Settings window opens.
    func checkStoredKey() async {
        guard let apiKey = try? apiKeyStore.read() else {
            hasStoredKey = false
            connectionState = .unknown
            return
        }
        connectionState = .checking
        do {
            connectionState = .connected(try await linearClient.fetchIdentity(apiKey: apiKey))
        } catch {
            connectionState = .failed(error.localizedDescription)
        }
    }

    func removeApiKey() {
        do {
            try apiKeyStore.delete()
            hasStoredKey = false
            connectionState = .unknown
            Log.app.info("api key removed")
            onApiKeyChanged()
        } catch {
            connectionState = .failed(error.localizedDescription)
        }
    }

    func setLaunchAtLogin(_ isEnabled: Bool) {
        do {
            if isEnabled {
                try SMAppService.mainApp.register()
            } else {
                try SMAppService.mainApp.unregister()
            }
            launchAtLoginError = nil
        } catch {
            // Registration can fail when the app runs from a build folder rather than /Applications.
            launchAtLoginError = error.localizedDescription
            Log.app.warning("launch at login change failed error=\(error.localizedDescription, privacy: .public)")
        }
        launchAtLogin = SMAppService.mainApp.status == .enabled
    }
}
