import WebKit

/// The WebKit side of the bridge: receives `window.webkit.messageHandlers.native.postMessage(...)`
/// calls and replies through their promises; pushes events with `window.__lqeNativeEvent(name, payload)`.
final class WebBridge: NSObject, WKScriptMessageHandlerWithReply {
    static let handlerName = "native"

    var router: BridgeRouter?
    weak var webView: WKWebView?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) async -> (Any?, String?) {
        guard
            let body = message.body as? [String: Any],
            let method = body["method"] as? String
        else {
            return (nil, BridgeError(.invalidParams, "Malformed bridge message").replyString)
        }
        guard let router else {
            return (nil, BridgeError(.internal, "Bridge is not ready").replyString)
        }

        let params = body["params"] as? [String: Any] ?? [:]
        do {
            return (try await router.handle(method: method, params: params), nil)
        } catch let error as BridgeError {
            // Expected outcomes (a removed attachment, no key saved yet) are left to the panel; anything else is worth a log line.
            let isExpected = error.code == .cancelled || error.code == .missingApiKey
            if !isExpected {
                Log.bridge.warning("request failed method=\(method, privacy: .public) error=\(error.replyString, privacy: .public)")
            }
            return (nil, error.replyString)
        } catch {
            Log.bridge.error("request failed method=\(method, privacy: .public) error=\(error.localizedDescription, privacy: .public)")
            return (nil, BridgeError(.internal, error.localizedDescription).replyString)
        }
    }

    func sendEvent(_ name: String, payload: any Encodable) {
        guard let webView else { return }
        do {
            let nameLiteral = String(decoding: try JSONEncoder().encode(name), as: UTF8.self)
            let payloadLiteral = String(decoding: try JSONEncoder().encode(payload), as: UTF8.self)
            // The page may not have loaded yet (first launch); the optional call drops early events instead of throwing.
            webView.evaluateJavaScript("window.__lqeNativeEvent?.(\(nameLiteral), \(payloadLiteral))")
        } catch {
            Log.bridge.error("event encoding failed name=\(name, privacy: .public) error=\(error.localizedDescription, privacy: .public)")
        }
    }
}
