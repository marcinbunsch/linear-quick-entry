import Foundation

/// Talks to Linear's GraphQL API with the stored API key. The key never leaves this process.
struct LinearClient {
    static let endpoint = URL(string: "https://api.linear.app/graphql")!

    let session: URLSession
    let apiKeyProvider: () throws -> String?

    /// The panel's pass-through: returns Linear's raw status and body so the panel can read GraphQL errors itself.
    func send(query: String, variables: [String: Any]) async throws -> (status: Int, body: String) {
        let body = try JSONSerialization.data(withJSONObject: ["query": query, "variables": variables])
        let (data, response) = try await perform(body: body, apiKey: try requireApiKey())
        return (response.statusCode, String(decoding: data, as: UTF8.self))
    }

    /// Who the key belongs to; the Settings window uses it to test a key before saving it.
    func fetchIdentity(apiKey: String) async throws -> Identity {
        let query = "query SettingsIdentity { viewer { name } organization { name } }"
        let body = try JSONSerialization.data(withJSONObject: ["query": query, "variables": [String: Any]()])
        let (data, response) = try await perform(body: body, apiKey: apiKey)
        let envelope = try decodeEnvelope(IdentityData.self, from: data, status: response.statusCode)
        return Identity(userName: envelope.viewer.name, organizationName: envelope.organization.name)
    }

    /// Asks Linear for a signed URL to upload one file to its storage.
    func requestUploadTarget(contentType: String, filename: String, size: Int) async throws -> UploadTarget {
        let query = """
        mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
          fileUpload(contentType: $contentType, filename: $filename, size: $size) {
            success
            uploadFile { uploadUrl assetUrl headers { key value } }
          }
        }
        """
        let variables: [String: Any] = ["contentType": contentType, "filename": filename, "size": size]
        let body = try JSONSerialization.data(withJSONObject: ["query": query, "variables": variables])
        let (data, response) = try await perform(body: body, apiKey: try requireApiKey())
        let envelope = try decodeEnvelope(FileUploadData.self, from: data, status: response.statusCode)
        guard envelope.fileUpload.success, let uploadFile = envelope.fileUpload.uploadFile else {
            throw BridgeError(.http, "Linear did not accept the upload of \(filename)")
        }
        return uploadFile
    }

    struct Identity: Equatable {
        let userName: String
        let organizationName: String
    }

    struct UploadTarget: Decodable {
        let uploadUrl: String
        let assetUrl: String
        let headers: [Header]

        struct Header: Decodable {
            let key: String
            let value: String
        }
    }

    private func requireApiKey() throws -> String {
        guard let apiKey = try apiKeyProvider(), !apiKey.isEmpty else {
            throw BridgeError(.missingApiKey, "No Linear API key is stored")
        }
        return apiKey
    }

    private func perform(body: Data, apiKey: String) async throws -> (Data, HTTPURLResponse) {
        var request = URLRequest(url: Self.endpoint)
        request.httpMethod = "POST"
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // Personal API keys go in the header as-is; "Bearer" is only for OAuth tokens.
        request.setValue(apiKey, forHTTPHeaderField: "Authorization")

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else { throw BridgeError(.network, "Linear sent a non-HTTP response") }
            return (data, httpResponse)
        } catch {
            throw BridgeError.from(urlError: error)
        }
    }

    private func decodeEnvelope<Payload: Decodable>(_ type: Payload.Type, from data: Data, status: Int) throws -> Payload {
        let envelope: Envelope<Payload>
        do {
            envelope = try JSONDecoder().decode(Envelope<Payload>.self, from: data)
        } catch {
            throw BridgeError(.http, "Linear returned an unreadable response (HTTP \(status))")
        }
        if let firstError = envelope.errors?.first {
            throw BridgeError(.http, firstError.extensions?.userPresentableMessage ?? firstError.message)
        }
        guard let payload = envelope.data else { throw BridgeError(.http, "Linear returned no data (HTTP \(status))") }
        return payload
    }

    private struct Envelope<Payload: Decodable>: Decodable {
        let data: Payload?
        let errors: [GraphQLError]?
    }

    private struct GraphQLError: Decodable {
        let message: String
        let extensions: Extensions?

        struct Extensions: Decodable {
            let userPresentableMessage: String?
        }
    }

    private struct IdentityData: Decodable {
        let viewer: Viewer
        let organization: Organization

        struct Viewer: Decodable { let name: String }
        struct Organization: Decodable { let name: String }
    }

    private struct FileUploadData: Decodable {
        let fileUpload: Payload

        struct Payload: Decodable {
            let success: Bool
            let uploadFile: UploadTarget?
        }
    }
}
