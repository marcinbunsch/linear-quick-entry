import Foundation
import Testing
@testable import LinearQuickEntry

/// Everything that goes through StubURLProtocol, serialized because the stub is shared process-wide.
@Suite(.serialized)
struct NetworkTests {
    // Deliberately not in Linear's key format, so secret scanners don't mistake it for a real key.
    static let apiKey = "test-api-key-not-real"

    static func client(apiKey: String? = apiKey) -> LinearClient {
        LinearClient(session: StubURLProtocol.makeSession(), apiKeyProvider: { apiKey })
    }

    @Suite(.serialized)
    struct LinearClientTests {
        @Test("graphql pass-through -> personal key sent as-is, Linear's status and body returned untouched")
        func passThrough() async throws {
            StubURLProtocol.install { _ in .json(#"{"data":{"viewer":{"id":"a5e10000"}}}"#) }

            let response = try await NetworkTests.client().send(query: "query Viewer { viewer { id } }", variables: ["first": 20])

            #expect(response.status == 200)
            #expect(response.body == #"{"data":{"viewer":{"id":"a5e10000"}}}"#)
            let request = try #require(StubURLProtocol.recordedRequests.first)
            #expect(request.url == LinearClient.endpoint)
            #expect(request.value(forHTTPHeaderField: "Authorization") == NetworkTests.apiKey)
            #expect(request.jsonBody["query"] as? String == "query Viewer { viewer { id } }")
            #expect((request.jsonBody["variables"] as? [String: Any])?["first"] as? Int == 20)
        }

        @Test("GraphQL errors -> still returned to the panel, which reads them itself")
        func graphQLErrorsPassedThrough() async throws {
            StubURLProtocol.install { _ in .json(#"{"errors":[{"message":"Rate limit exceeded"}]}"#, status: 400) }

            let response = try await NetworkTests.client().send(query: "query Viewer { viewer { id } }", variables: [:])

            #expect(response.status == 400)
            #expect(response.body.contains("Rate limit exceeded"))
        }

        @Test("no stored key -> missingApiKey, and nothing sent")
        func missingKey() async throws {
            StubURLProtocol.install { _ in .json("{}") }

            await #expect(throws: BridgeError(.missingApiKey, "No Linear API key is stored")) {
                try await NetworkTests.client(apiKey: nil).send(query: "query Viewer { viewer { id } }", variables: [:])
            }
            #expect(StubURLProtocol.recordedRequests.isEmpty)
        }

        @Test("testing a key -> workspace and user name")
        func identity() async throws {
            StubURLProtocol.install { _ in .json(#"{"data":{"viewer":{"name":"Marcin Bunsch"},"organization":{"name":"Acme"}}}"#) }

            let identity = try await NetworkTests.client(apiKey: nil).fetchIdentity(apiKey: "test-api-key-typed-in-settings")

            #expect(identity == LinearClient.Identity(userName: "Marcin Bunsch", organizationName: "Acme"))
            #expect(StubURLProtocol.recordedRequests.first?.value(forHTTPHeaderField: "Authorization") == "test-api-key-typed-in-settings")
        }

        @Test("testing a revoked key -> Linear's readable message")
        func identityRejected() async throws {
            StubURLProtocol.install { _ in
                .json(#"{"errors":[{"message":"Authentication required, not authenticated","extensions":{"userPresentableMessage":"You need to authenticate to access this operation."}}]}"#, status: 400)
            }

            await #expect(throws: BridgeError(.http, "You need to authenticate to access this operation.")) {
                try await NetworkTests.client().fetchIdentity(apiKey: "test-api-key-revoked")
            }
        }
    }

    @Suite(.serialized)
    struct AttachmentUploaderTests {
        static let uploadURL = "https://storage.googleapis.com/linear-uploads/3f2c/screenshot.png?X-Goog-Signature=abc123"
        static let assetURL = "https://uploads.linear.app/acme/3f2c/screenshot.png"

        static func stubLinearAndStorage(storageStatus: Int = 200) {
            let endpoint = LinearClient.endpoint
            let uploadURL = Self.uploadURL
            let assetURL = Self.assetURL
            StubURLProtocol.install { request in
                if request.url == endpoint {
                    return .json("""
                    {"data":{"fileUpload":{"success":true,"uploadFile":{"uploadUrl":"\(uploadURL)","assetUrl":"\(assetURL)","headers":[{"key":"x-goog-meta-content-disposition","value":"inline"}]}}}}
                    """)
                }
                return Reply(status: storageStatus, body: Data())
            }
        }

        typealias Reply = StubURLProtocol.Reply

        static func temporaryScreenshot() throws -> URL {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("Screenshot \(UUID().uuidString).png")
            try Data(repeating: 0x89, count: 4_096).write(to: url)
            return url
        }

        @Test("upload -> asks Linear for a signed URL with the file's size, then PUTs the file with Linear's headers")
        func uploadsFile() async throws {
            Self.stubLinearAndStorage()
            let fileURL = try Self.temporaryScreenshot()
            defer { try? FileManager.default.removeItem(at: fileURL) }
            let uploader = AttachmentUploader(client: NetworkTests.client(), session: StubURLProtocol.makeSession())

            let assetUrl = try await uploader.upload(uploadId: "attachment-1", fileURL: fileURL, name: "screenshot.png", contentType: "image/png", onProgress: { _ in })

            #expect(assetUrl == Self.assetURL)
            let requests = StubURLProtocol.recordedRequests
            try #require(requests.count == 2)
            let variables = requests[0].jsonBody["variables"] as? [String: Any]
            #expect(variables?["filename"] as? String == "screenshot.png")
            #expect(variables?["contentType"] as? String == "image/png")
            #expect(variables?["size"] as? Int == 4_096)
            #expect(requests[1].httpMethod == "PUT")
            #expect(requests[1].url?.absoluteString == Self.uploadURL)
            #expect(requests[1].value(forHTTPHeaderField: "Content-Type") == "image/png")
            #expect(requests[1].value(forHTTPHeaderField: "x-goog-meta-content-disposition") == "inline")
        }

        @Test("storage refuses the file -> http error naming the status")
        func storageRejects() async throws {
            Self.stubLinearAndStorage(storageStatus: 403)
            let fileURL = try Self.temporaryScreenshot()
            defer { try? FileManager.default.removeItem(at: fileURL) }
            let uploader = AttachmentUploader(client: NetworkTests.client(), session: StubURLProtocol.makeSession())

            await #expect(throws: BridgeError(.http, "Upload rejected with HTTP 403")) {
                try await uploader.upload(uploadId: "attachment-1", fileURL: fileURL, name: "screenshot.png", contentType: "image/png", onProgress: { _ in })
            }
        }

        @Test("file deleted before upload -> fileUnavailable, and Linear never asked")
        func missingFile() async throws {
            Self.stubLinearAndStorage()
            let uploader = AttachmentUploader(client: NetworkTests.client(), session: StubURLProtocol.makeSession())
            let missing = FileManager.default.temporaryDirectory.appendingPathComponent("deleted-\(UUID().uuidString).mov")

            let error = await #expect(throws: BridgeError.self) {
                try await uploader.upload(uploadId: "attachment-1", fileURL: missing, name: "deleted.mov", contentType: "video/quicktime", onProgress: { _ in })
            }
            #expect(error?.code == .fileUnavailable)
            #expect(StubURLProtocol.recordedRequests.isEmpty)
        }
    }

    @Suite(.serialized)
    struct BridgeRouterTests {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("BridgeRouterTests-\(UUID().uuidString)")

        func makeRouter(apiKey: String? = NetworkTests.apiKey) -> BridgeRouter {
            let client = NetworkTests.client(apiKey: apiKey)
            let defaults = UserDefaults(suiteName: "BridgeRouterTests-\(UUID().uuidString)") ?? .standard
            return BridgeRouter(
                dependencies: BridgeRouter.Dependencies(
                    linearClient: client,
                    uploader: AttachmentUploader(client: client, session: StubURLProtocol.makeSession()),
                    diskStore: DiskStore(directory: directory),
                    registry: LocalFileRegistry(),
                    settings: AppSettings(defaults: defaults),
                    pasteboard: .withUniqueName(),
                    sendEvent: { _, _ in }
                ),
                panelActions: PanelActions(
                    hide: {},
                    resize: { _ in },
                    openSettings: {},
                    pickFiles: { [] },
                    captureScreenshot: { nil },
                    issueCreated: { _ in }
                )
            )
        }

        @Test("storage.write then storage.read -> same text back; unknown key -> null")
        func storageRoundTrip() async throws {
            let router = makeRouter()
            defer { try? FileManager.default.removeItem(at: directory) }

            _ = try await router.handle(method: "storage.write", params: ["key": "draft", "value": #"{"version":1,"value":{"title":"Apple Pay sheet never closes"}}"#])
            let stored = try await router.handle(method: "storage.read", params: ["key": "draft"]) as? [String: Any]
            let missing = try await router.handle(method: "storage.read", params: ["key": "preferences"]) as? [String: Any]

            #expect(stored?["value"] as? String == #"{"version":1,"value":{"title":"Apple Pay sheet never closes"}}"#)
            #expect(missing?["value"] is NSNull)
        }

        @Test("storage key outside the allowed list -> refused")
        func storageKeyRefused() async throws {
            await #expect(throws: BridgeError(.invalidParams, "Unknown storage key ../../.ssh/config")) {
                try await makeRouter().handle(method: "storage.write", params: ["key": "../../.ssh/config", "value": "x"])
            }
        }

        @Test("upload of a file the panel never registered -> refused before anything is sent")
        func uploadOfUnregisteredFile() async throws {
            StubURLProtocol.install { _ in .json("{}") }
            let error = await #expect(throws: BridgeError.self) {
                let params: [String: Any] = ["uploadId": "attachment-1", "path": "/Users/marcin/.ssh/id_ed25519", "name": "id_ed25519", "contentType": "image/png"]
                return try await makeRouter().handle(method: "upload.start", params: params)
            }
            #expect(error?.code == .fileUnavailable)
            #expect(StubURLProtocol.recordedRequests.isEmpty)
        }

        @Test("graphql with no key stored -> missingApiKey reply")
        func graphqlWithoutKey() async throws {
            let error = await #expect(throws: BridgeError.self) {
                try await makeRouter(apiKey: nil).handle(method: "graphql", params: ["query": "query Viewer { viewer { id } }", "variables": [String: Any]()])
            }
            #expect(error?.replyString == "missingApiKey: No Linear API key is stored")
        }

        @Test("settings.get -> current settings in the panel's shape")
        func settingsGet() async throws {
            let settings = try await makeRouter().handle(method: "settings.get", params: [:]) as? [String: Any]

            #expect(settings?["prefillLastParent"] as? Bool == false)
        }

        @Test("unknown method -> invalidParams")
        func unknownMethod() async throws {
            await #expect(throws: BridgeError(.invalidParams, "Unknown method issues.delete")) {
                try await makeRouter().handle(method: "issues.delete", params: [:])
            }
        }
    }
}
