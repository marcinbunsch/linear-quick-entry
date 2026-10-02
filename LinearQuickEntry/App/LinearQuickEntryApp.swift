import KeyboardShortcuts
import Sparkle
import SwiftUI

@main
struct LinearQuickEntryApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        MenuBarExtra {
            MenuBarContent(appDelegate: appDelegate, updater: appDelegate.updaterController.updater)
        } label: {
            // A template image, so macOS tints it for light and dark menu bars. Source: design/MenuBarIcon.svg.
            Image("MenuBarIcon")
                .accessibilityLabel("Linear Quick Entry")
        }
    }
}

private struct MenuBarContent: View {
    let appDelegate: AppDelegate
    let updater: SPUUpdater

    var body: some View {
        Button("New Issue") { appDelegate.showPanel() }
            .globalKeyboardShortcut(.newIssue)
        if !appDelegate.settingsModel.hasStoredKey {
            Button("Add Linear API Key…") { appDelegate.showSettings() }
        }
        Divider()
        Button("Settings…") { appDelegate.showSettings() }
            .keyboardShortcut(",")
        if AppDelegate.hasUpdateSigningKey {
            Button("Check for Updates…") { updater.checkForUpdates() }
        }
        Divider()
        Button("Quit Linear Quick Entry") { NSApp.terminate(nil) }
            .keyboardShortcut("q")
    }
}
