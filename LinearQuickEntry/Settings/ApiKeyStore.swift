import Foundation

/// The API key, read from the keychain once and then kept in memory.
///
/// Each keychain read can show macOS's "wants to use your confidential information" prompt, and opening
/// the panel sends several Linear requests at once; reading per request meant a stack of prompts.
/// A refused read is remembered too, so one "Deny" doesn't turn into a prompt per request.
final class ApiKeyStore {
    private let keychain: KeychainStore
    private var cached: Result<String?, Error>?

    init(keychain: KeychainStore) {
        self.keychain = keychain
    }

    func read() throws -> String? {
        if let cached { return try cached.get() }
        let result = Result { try keychain.read() }
        cached = result
        if case .failure(let error) = result {
            Log.app.warning("api key read failed error=\(error.localizedDescription, privacy: .public)")
        }
        return try result.get()
    }

    func save(_ apiKey: String) throws {
        try keychain.save(apiKey)
        cached = .success(apiKey)
    }

    func delete() throws {
        try keychain.delete()
        cached = .success(nil)
    }
}
