# Linear Quick Entry

A Mac menu bar app for filing Linear issues without leaving what you're doing. Press a hotkey, a "New issue" window floats over everything, you type, press ⌘↩, and it's gone.

## What it does

- **Title and description.** The description editor works like Linear's own, with headings, lists, code and links.
- **Images and videos.** Paste them, drag them in from Finder, pick them with ⌘⇧U, or grab part of the screen with ⌘⇧R. Files dropped into the description appear where you drop them; files dropped anywhere else go into a strip below and are added to the end.
- **Every field you need.** Status, priority, assignee, project, estimate, labels, cycle and due date. Due dates understand plain language like "friday" or "in 2 weeks".
- **Sub-issues.** Search for a parent by title or by ID like `ENG-123`. The last parent you used is offered as a one-key suggestion (⌘P), and a second hotkey opens the window with it already applied.
- **Nothing gets lost.** Closing the window keeps what you typed, even across a restart. Uploads start the moment you add a file, so creating the issue rarely waits.

## Setting it up

1. Install the app from the [latest release](https://github.com/marcinbunsch/linear-quick-entry/releases/latest) and open it. It lives in the menu bar, not the Dock.
2. The Settings window opens on first launch. In Linear, go to **Settings → Security & access**, create a personal API key, and paste it in. The app checks the key with Linear before saving it, and keeps it in your keychain.
3. Press **⌃⌥L** to open the window. You can change the shortcut in Settings.

## Using it

| Keys | What happens |
| --- | --- |
| ⌃⌥L | Open or close the window |
| ⌃⌥⇧L | Open the window as a sub-issue of the last parent |
| ⌘↩ | Create the issue and close the window |
| ⌥⌘↩ | Create the issue and start another with the same parent |
| ⌘⇧T / S / P / A / J / E / L / C / D | Change team / status / priority / assignee / project / estimate / labels / cycle / due date |
| ⌘⇧I | Choose a parent issue |
| ⌘P | Accept the suggested parent |
| ⌘⇧U | Attach images or videos |
| ⌘⇧R | Capture part of the screen |
| ⌘⇧⌫ | Throw the draft away |
| Esc | Close a picker, or close the window |

After an issue is created, a small message shows its ID, and its link is on your clipboard. Click the message to open the issue.

Team and project carry over to the next issue. Everything else starts fresh. Settings has an option to always start new issues as a sub-issue of the last parent.

The first screenshot may make macOS ask for Screen Recording permission. If screenshots come out without your other windows in them, allow it in System Settings → Privacy & Security → Screen Recording.

## Building from source

You need Xcode 26 and Node 26 with pnpm.

1. Install the web panel's packages: `pnpm --dir web install`
2. Build the web panel: `pnpm --dir web build`
3. Open `LinearQuickEntry.xcodeproj` and run the `LinearQuickEntry` scheme.

Builds are unsigned by default, so macOS treats every rebuild as a new app and asks for your keychain password again. To avoid that, create `Support/Local.xcconfig` (git ignores it) naming your own certificate:

```
CODE_SIGN_IDENTITY = Developer ID Application
DEVELOPMENT_TEAM = ABCDE12345
```

While working on the panel, run `pnpm --dir web dev` first. Debug builds then load the panel from the dev server, so changes appear without rebuilding the app.

Run the tests with `pnpm --dir web test` and `xcodebuild test -project LinearQuickEntry.xcodeproj -scheme LinearQuickEntry`.

## How it's built

### In plain terms

1. The app is a native Mac app. It owns the menu bar icon, the hotkeys, the floating window, the Settings window and your API key.
2. Inside the floating window is a small web page that draws the "New issue" form.
3. When the form needs something from Linear, it asks the native app. The native app adds your API key, sends the request, and hands back Linear's answer. The key never reaches the web page.
4. Files work the same way. The native app reads them straight from disk and uploads them to Linear, so large videos never pass through the web page.
5. Your draft, your last team, project and parent, and a copy of your workspace's teams, labels and people are saved to disk. The form appears instantly and catches up with Linear in the background.

### Technical details

- **Native shell** (`LinearQuickEntry/`): Swift 6, AppKit and SwiftUI, macOS 14+. A borderless `NSPanel` hosts a `WKWebView` loaded once at launch from `lqe://app/` (a `WKURLSchemeHandler` serving `Resources/web`). Global hotkeys use [KeyboardShortcuts](https://github.com/sindresorhus/KeyboardShortcuts). Updates use [Sparkle](https://sparkle-project.org).
- **Bridge**: request/response through a `WKScriptMessageHandlerWithReply` named `native`, plus events pushed with `window.__lqeNativeEvent`. The contract is `web/src/bridge/protocol.ts`, mirrored in `LinearQuickEntry/Bridge/BridgeRouter.swift`. Errors cross as `"<code>: <message>"`.
- **Linear access**: the panel sends GraphQL documents typed by `graphql-codegen` from Linear's public schema (`web/linear-schema.graphql`, refreshed with `pnpm --dir web codegen`). Swift passes them through with the key. Uploads use `fileUpload` followed by a streamed `PUT` of the file.
- **File drops**: `FileDropWebView` takes drags carrying file URLs before WebKit sees them, registers the files, and sends their paths and the drop point to the page. Other drags go to WebKit as usual.
- **Web panel** (`web/`): React 19, MobX controllers (`web/src/state`), Tiptap 3 with its Markdown extension, cmdk and Radix popovers, and Tailwind 4. Controllers hold all state; components only render it.
- **Storage**: `~/Library/Application Support/pl.bunsch.LinearQuickEntry/{draft,preferences,reference-data}.json`. Pasted images and screenshots go to `~/Library/Caches/pl.bunsch.LinearQuickEntry/Captures`.
- **Logs**: Console.app, subsystem `pl.bunsch.LinearQuickEntry`. The web panel's logs and uncaught errors appear under the `web` category.

## Releasing

Releases are signed with a Developer ID certificate, notarized by Apple, and update themselves through [Sparkle](https://sparkle-project.org).

Setting it up, once, on the Mac that has the certificate:

1. Copy `.env.example` to `.env` and fill in the certificate's name, your Apple ID and an app-specific password. Git ignores `.env`.
2. Run `./scripts/setup-signing.sh`. It exports the certificate, creates the update-signing key, and stores everything as GitHub secrets. macOS asks for your keychain password along the way.
3. Commit the change it makes to `Support/Info.plist` (the update key's public half).

Cutting a release:

1. Run `./scripts/release.sh patch` (or `minor`, `major`, or an exact version like `0.1.0`). It bumps the version, tags it and pushes.
2. The Release workflow builds the DMG, notarizes it and attaches it, with the update feed, to a draft GitHub release.
3. Publish the draft. That's the moment existing installs see the update.

## Licence

MIT. See [LICENSE](LICENSE). Linear is a trademark of Linear Orbit, Inc.; this app is not made or endorsed by Linear.
