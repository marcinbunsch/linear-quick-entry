import AppKit
import KeyboardShortcuts
import SwiftUI

struct SettingsView: View {
    @Bindable var model: SettingsModel

    var body: some View {
        @Bindable var settings = model.settings
        Form {
            Section {
                apiKeySection
            } header: {
                Text("Linear API key")
            } footer: {
                Text("Create a personal API key in Linear under Settings → Security & access. It's stored in your keychain and only sent to Linear.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Shortcuts") {
                KeyboardShortcuts.Recorder("New issue:", name: .newIssue)
                KeyboardShortcuts.Recorder("New sub-issue of last parent:", name: .newSubIssueOfLastParent)
            }

            Section("Behaviour") {
                Toggle("Start new issues as a sub-issue of the last parent", isOn: $settings.prefillLastParent)
                Toggle("Launch at login", isOn: Binding(get: { model.launchAtLogin }, set: { model.setLaunchAtLogin($0) }))
                if let launchAtLoginError = model.launchAtLoginError {
                    Text(launchAtLoginError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
        }
        .formStyle(.grouped)
        .frame(width: 480)
        .fixedSize(horizontal: false, vertical: true)
        .task { await model.checkStoredKey() }
    }

    @ViewBuilder
    private var apiKeySection: some View {
        HStack {
            SecureField(model.hasStoredKey ? "Replace the stored key" : "lin_api_…", text: $model.apiKeyInput)
                .onSubmit { Task { await model.saveApiKey() } }
            Button("Save") { Task { await model.saveApiKey() } }
                .disabled(model.apiKeyInput.trimmingCharacters(in: .whitespaces).isEmpty || model.connectionState == .checking)
        }
        HStack {
            connectionStatus
            Spacer()
            if model.hasStoredKey {
                Button("Remove key", role: .destructive) { model.removeApiKey() }
            }
        }
    }

    @ViewBuilder
    private var connectionStatus: some View {
        switch model.connectionState {
        case .unknown:
            Label(model.hasStoredKey ? "Key stored" : "No key stored", systemImage: "key")
                .foregroundStyle(.secondary)
        case .checking:
            HStack(spacing: 6) {
                ProgressView().controlSize(.small)
                Text("Checking with Linear…").foregroundStyle(.secondary)
            }
        case .connected(let identity):
            Label("Connected to \(identity.organizationName) as \(identity.userName)", systemImage: "checkmark.circle.fill")
                .foregroundStyle(.green)
        case .failed(let message):
            Label(message, systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
        }
    }
}

/// Hosts SettingsView in a plain window. A SwiftUI `Settings` scene can't be opened reliably from
/// AppKit code on macOS 14+, and the panel's "Open Settings" button needs exactly that.
final class SettingsWindowController {
    private let model: SettingsModel
    private var window: NSWindow?

    init(model: SettingsModel) {
        self.model = model
    }

    func show() {
        if window == nil {
            let window = NSWindow(contentViewController: NSHostingController(rootView: SettingsView(model: model)))
            window.title = "Linear Quick Entry Settings"
            window.styleMask = [.titled, .closable]
            window.isReleasedWhenClosed = false
            window.center()
            self.window = window
        }
        NSApp.activate()
        window?.makeKeyAndOrderFront(nil)
    }
}
