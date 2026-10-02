import AppKit

/// Remembers where the user dragged the panel, per screen. Opening on a different screen
/// (or after the screen's size changed) falls back to the default spot.
struct PanelPlacementStore {
    private static let key = "panelPlacement"
    let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func topLeft(for screenFrame: CGRect) -> CGPoint? {
        guard
            let data = defaults.data(forKey: Self.key),
            let placement = try? JSONDecoder().decode(Placement.self, from: data),
            placement.screenFrame == screenFrame
        else { return nil }
        return placement.topLeft
    }

    func save(topLeft: CGPoint, for screenFrame: CGRect) {
        guard let data = try? JSONEncoder().encode(Placement(screenFrame: screenFrame, topLeft: topLeft)) else { return }
        defaults.set(data, forKey: Self.key)
    }

    private struct Placement: Codable {
        let screenFrame: CGRect
        let topLeft: CGPoint
    }
}

/// Screen Recording access for screenshots.
///
/// macOS decides whether to show its prompt: only the first time this exact app signature asks.
/// Permission granted to an earlier build (say, an unsigned one) doesn't carry over, and a new grant
/// only takes effect after the app is reopened, so the panel explains both instead of guessing.
enum ScreenRecordingPermission {
    static func request() {
        CGRequestScreenCaptureAccess()
    }

    static func openSettings() {
        guard let settingsURL = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture") else { return }
        NSWorkspace.shared.open(settingsURL)
    }
}
