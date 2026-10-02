import Foundation
import Testing
@testable import LinearQuickEntry

struct DiskStoreTests {
    let store = DiskStore(directory: FileManager.default.temporaryDirectory.appendingPathComponent("DiskStoreTests-\(UUID().uuidString)"))

    @Test("nothing saved yet -> nil, not an error")
    func missingFile() throws {
        #expect(try store.read(key: "draft") == nil)
    }

    @Test("write then read -> same text, and the folder is created on first write")
    func roundTrip() throws {
        defer { try? FileManager.default.removeItem(at: store.directory) }

        try store.write(key: "reference-data", value: #"{"version":1}"#)

        #expect(try store.read(key: "reference-data") == #"{"version":1}"#)
    }
}

struct LocalFileRegistryTests {
    func temporaryFile(named name: String) throws -> URL {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("LocalFileRegistryTests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = directory.appendingPathComponent(name)
        try Data(repeating: 0, count: 2_048).write(to: url)
        return url
    }

    @Test("PNG screenshot -> accepted as an image with a preview URL")
    func image() throws {
        let registry = LocalFileRegistry()
        let url = try temporaryFile(named: "Screenshot 2026-10-02 at 14.31.07.png")

        let file = try #require(registry.register(url))

        #expect(file.kind == .image)
        #expect(file.contentType == "image/png")
        #expect(file.size == 2_048)
        #expect(file.name == "Screenshot 2026-10-02 at 14.31.07.png")
        #expect(file.previewUrl.hasPrefix("lqe://preview/"))
        #expect(registry.isRegistered(path: url.path))
    }

    @Test("QuickTime recording -> accepted as a video")
    func video() throws {
        let file = try #require(LocalFileRegistry().register(try temporaryFile(named: "checkout-bug.mov")))

        #expect(file.kind == .video)
        #expect(file.contentType == "video/quicktime")
    }

    @Test("PDF and missing files -> rejected by name, the rest still registered")
    func rejected() throws {
        let registry = LocalFileRegistry()
        let pdf = try temporaryFile(named: "invoice.pdf")
        let png = try temporaryFile(named: "mockup.png")
        let missing = URL(fileURLWithPath: "/private/tmp/does-not-exist-\(UUID().uuidString).png")

        let registration = registry.register([pdf, png, missing])

        #expect(registration.files.map(\.name) == ["mockup.png"])
        #expect(registration.rejected == ["invoice.pdf", missing.lastPathComponent])
        #expect(!registry.isRegistered(path: pdf.path))
    }
}

struct PanelGeometryTests {
    // A 1512×982 MacBook screen with a 37pt menu bar.
    let visibleFrame = CGRect(x: 0, y: 0, width: 1512, height: 945)

    @Test("new panel -> centred, top edge 18% down the screen")
    func placement() {
        let frame = PanelGeometry.frame(height: 400, on: visibleFrame)

        #expect(frame.width == PanelGeometry.width)
        #expect(frame.midX == visibleFrame.midX)
        #expect(abs(frame.maxY - (945 - 945 * 0.18)) < 0.001)
        #expect(frame.height == 400)
    }

    @Test("card grows -> top edge stays put, panel extends downwards")
    func growsDownwards() {
        let original = PanelGeometry.frame(height: 300, on: visibleFrame)

        let resized = PanelGeometry.resized(original, toHeight: 520, within: visibleFrame)

        #expect(resized.maxY == original.maxY)
        #expect(resized.height == 520)
    }

    @Test("tiny or huge heights -> clamped to the minimum and to 85% of the screen")
    func clamped() {
        #expect(PanelGeometry.frame(height: 40, on: visibleFrame).height == PanelGeometry.minimumHeight)
        #expect(PanelGeometry.frame(height: 5_000, on: visibleFrame).height <= 945 * 0.85)
    }
}

struct AppSchemeHandlerTests {
    @Test("web build files -> MIME types WebKit accepts for module scripts and styles")
    func mimeTypes() {
        #expect(AppSchemeHandler.mimeType(forPathExtension: "js") == "text/javascript")
        #expect(AppSchemeHandler.mimeType(forPathExtension: "css") == "text/css")
        #expect(AppSchemeHandler.mimeType(forPathExtension: "html") == "text/html")
    }
}
