import Foundation
import Observation

/// Preferences set in the Settings window. The web panel reads them through the bridge.
@Observable
final class AppSettings {
    /// When on, a fresh draft starts as a sub-issue of the last parent instead of only suggesting it.
    var prefillLastParent: Bool {
        didSet {
            defaults.set(prefillLastParent, forKey: Keys.prefillLastParent)
            onChange?(snapshot)
        }
    }

    /// Called after any setting changes, so the panel can be told.
    @ObservationIgnored var onChange: ((Snapshot) -> Void)?

    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        prefillLastParent = defaults.bool(forKey: Keys.prefillLastParent)
    }

    /// Mirrors `NativeSettings` in web/src/bridge/protocol.ts.
    struct Snapshot: Encodable, Equatable {
        let prefillLastParent: Bool
    }

    var snapshot: Snapshot { Snapshot(prefillLastParent: prefillLastParent) }

    private enum Keys {
        static let prefillLastParent = "prefillLastParent"
    }
}
