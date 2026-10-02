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

/// Asking for Screen Recording access. macOS shows its prompt only the first time an app asks;
/// after that the only way is System Settings, so later requests open the right page there.
enum ScreenRecordingPermission {
    private static let hasAskedKey = "hasRequestedScreenRecording"

    static func request(defaults: UserDefaults = .standard) {
        if defaults.bool(forKey: hasAskedKey) {
            if let settingsURL = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture") {
                NSWorkspace.shared.open(settingsURL)
            }
            return
        }
        defaults.set(true, forKey: hasAskedKey)
        CGRequestScreenCaptureAccess()
    }
}
