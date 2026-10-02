import Foundation

/// Error codes shared with the web panel (`NativeErrorCode` in web/src/bridge/protocol.ts).
enum BridgeErrorCode: String, Sendable {
    case missingApiKey
    case network
    case http
    case invalidParams
    case fileUnavailable
    case cancelled
    case `internal`
}

/// Every native failure the panel can see. Replies carry it to JavaScript as "<code>: <message>".
struct BridgeError: Error, LocalizedError, Equatable {
    let code: BridgeErrorCode
    let message: String

    init(_ code: BridgeErrorCode, _ message: String) {
        self.code = code
        self.message = message
    }

    var errorDescription: String? { message }

    var replyString: String { "\(code.rawValue): \(message)" }

    /// Maps URLSession failures: cancellation stays cancellation, everything else is a network problem.
    static func from(urlError error: Error) -> BridgeError {
        if let bridgeError = error as? BridgeError { return bridgeError }
        if error is CancellationError { return BridgeError(.cancelled, "Cancelled") }
        if let urlError = error as? URLError, urlError.code == .cancelled { return BridgeError(.cancelled, "Cancelled") }
        return BridgeError(.network, error.localizedDescription)
    }
}
