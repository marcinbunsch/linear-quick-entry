import AppKit
import SwiftUI

/// The small "Created ENG-123" message shown after an issue is created. Clicking it opens the issue.
/// A window of our own rather than a system notification, so it needs no permission prompt.
final class CreatedIssueHUD {
    // 4s: long enough to read an identifier and click it, short enough to be gone before the next task.
    private static let displayDuration: Duration = .seconds(4)

    private var panel: NSPanel?
    private var dismissTask: Task<Void, Never>?

    func show(_ issue: CreatedIssue) {
        dismissTask?.cancel()
        panel?.orderOut(nil)

        let issueURL = URL(string: issue.url)
        let view = CreatedIssueView(identifier: issue.identifier, title: issue.title) { [weak self] in
            if let issueURL { NSWorkspace.shared.open(issueURL) }
            self?.dismiss()
        }
        let hostingView = NSHostingView(rootView: view)
        hostingView.frame.size = hostingView.fittingSize

        let panel = NSPanel(contentRect: hostingView.frame, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.contentView = hostingView
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient]
        panel.hasShadow = true
        panel.isReleasedWhenClosed = false

        if let screen = NSScreen.main {
            // Top centre, just under the menu bar.
            let visible = screen.visibleFrame
            panel.setFrameOrigin(NSPoint(x: visible.midX - hostingView.frame.width / 2, y: visible.maxY - hostingView.frame.height - 16))
        }
        panel.orderFrontRegardless()
        self.panel = panel

        dismissTask = Task { [weak self] in
            try? await Task.sleep(for: Self.displayDuration)
            guard !Task.isCancelled else { return }
            self?.dismiss()
        }
    }

    private func dismiss() {
        dismissTask?.cancel()
        panel?.orderOut(nil)
        panel = nil
    }
}

private struct CreatedIssueView: View {
    let identifier: String
    let title: String
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: 10) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Created \(identifier)")
                        .font(.system(size: 13, weight: .semibold))
                    Text(title)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Text("Link copied · Click to open")
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .frame(maxWidth: 360, alignment: .leading)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }
}
