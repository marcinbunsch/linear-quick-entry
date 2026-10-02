import AppKit

/// The floating window that holds the web view. Borderless and transparent: the page draws the card,
/// its rounded corners and its shadow.
final class QuickEntryPanel: NSPanel {
    init() {
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: PanelGeometry.width, height: PanelGeometry.minimumHeight),
            styleMask: [.borderless, .nonactivatingPanel, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        isFloatingPanel = true
        level = .floating
        // Over every Space, including full-screen apps.
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient]
        // Stays up while the user drags files in from Finder; only Esc, the hotkey or submitting hides it.
        hidesOnDeactivate = false
        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        isReleasedWhenClosed = false
        animationBehavior = .utilityWindow
    }

    // Borderless windows refuse key status by default, which would leave the title field unable to take typing.
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

/// Where the panel sits: horizontally centred, its top a fixed distance down the screen,
/// growing downwards as the card grows.
enum PanelGeometry {
    /// The 720px card plus 24px of transparent margin on each side for its shadow (the page's `p-6`).
    static let width: CGFloat = 768
    static let minimumHeight: CGFloat = 220
    /// 18% down from the top of the usable screen, roughly where Spotlight and Linear's own dialog sit.
    static let topOffsetFraction: CGFloat = 0.18

    static func frame(height: CGFloat, on visibleFrame: CGRect) -> CGRect {
        let clampedHeight = clamp(height: height, within: visibleFrame)
        let top = visibleFrame.maxY - visibleFrame.height * topOffsetFraction
        let bottom = max(visibleFrame.minY, top - clampedHeight)
        return CGRect(x: visibleFrame.midX - width / 2, y: bottom, width: width, height: clampedHeight)
    }

    /// Keeps the top edge where it is, so typing never makes the title jump.
    static func resized(_ frame: CGRect, toHeight height: CGFloat, within visibleFrame: CGRect) -> CGRect {
        let clampedHeight = clamp(height: height, within: visibleFrame)
        let bottom = max(visibleFrame.minY, frame.maxY - clampedHeight)
        return CGRect(x: frame.minX, y: bottom, width: frame.width, height: frame.maxY - bottom)
    }

    /// A panel the user dragged: same top-left corner, kept fully on the usable part of the screen.
    static func frame(height: CGFloat, topLeft: CGPoint, on visibleFrame: CGRect) -> CGRect {
        let clampedHeight = clamp(height: height, within: visibleFrame)
        let x = min(max(topLeft.x, visibleFrame.minX), visibleFrame.maxX - width)
        let top = min(max(topLeft.y, visibleFrame.minY + clampedHeight), visibleFrame.maxY)
        return CGRect(x: x, y: top - clampedHeight, width: width, height: clampedHeight)
    }

    private static func clamp(height: CGFloat, within visibleFrame: CGRect) -> CGFloat {
        // 85%: leave some of the screen visible so the panel never reads as a full window.
        min(max(height, minimumHeight), visibleFrame.height * 0.85)
    }
}
