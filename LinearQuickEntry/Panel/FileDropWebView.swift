import WebKit

/// A web view that takes file drags for itself so the native side gets real file paths.
///
/// Left to WebKit, a dropped file reaches JavaScript as a File object without its path, and a large
/// video would have to be copied through the bridge byte by byte. Here, drags carrying file URLs are
/// handled natively and reported with their drop point; every other drag (text, the editor moving
/// an image) goes to WebKit unchanged through `super`.
final class FileDropWebView: WKWebView {
    enum FileDragEvent {
        /// Point in CSS pixels, origin at the top left of the page.
        case moved(CGPoint)
        case exited
        case dropped([URL], CGPoint)
    }

    var onFileDrag: ((FileDragEvent) -> Void)?

    private var isHandlingFileDrag = false

    override func draggingEntered(_ sender: any NSDraggingInfo) -> NSDragOperation {
        isHandlingFileDrag = !fileURLs(in: sender).isEmpty
        guard isHandlingFileDrag else { return super.draggingEntered(sender) }
        onFileDrag?(.moved(pagePoint(for: sender)))
        return .copy
    }

    override func draggingUpdated(_ sender: any NSDraggingInfo) -> NSDragOperation {
        guard isHandlingFileDrag else { return super.draggingUpdated(sender) }
        onFileDrag?(.moved(pagePoint(for: sender)))
        return .copy
    }

    override func draggingExited(_ sender: (any NSDraggingInfo)?) {
        guard isHandlingFileDrag else {
            super.draggingExited(sender)
            return
        }
        isHandlingFileDrag = false
        onFileDrag?(.exited)
    }

    override func prepareForDragOperation(_ sender: any NSDraggingInfo) -> Bool {
        guard isHandlingFileDrag else { return super.prepareForDragOperation(sender) }
        return true
    }

    override func performDragOperation(_ sender: any NSDraggingInfo) -> Bool {
        guard isHandlingFileDrag else { return super.performDragOperation(sender) }
        isHandlingFileDrag = false
        onFileDrag?(.dropped(fileURLs(in: sender), pagePoint(for: sender)))
        return true
    }

    private func fileURLs(in draggingInfo: any NSDraggingInfo) -> [URL] {
        let objects = draggingInfo.draggingPasteboard.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true])
        return objects as? [URL] ?? []
    }

    private func pagePoint(for draggingInfo: any NSDraggingInfo) -> CGPoint {
        let point = convert(draggingInfo.draggingLocation, from: nil)
        let y = isFlipped ? point.y : bounds.height - point.y
        // The page is never zoomed, so one point is one CSS pixel.
        return CGPoint(x: point.x, y: y)
    }
}
