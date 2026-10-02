// The contract between the React panel and the native Swift shell.
// The Swift side mirrors these shapes in LinearQuickEntry/Bridge/BridgeMessages.swift — change both together.

/** A file on disk the native side has accepted as an attachment (images and videos only). */
export type LocalFile = {
  path: string
  name: string
  /** Bytes. */
  size: number
  contentType: string
  kind: 'image' | 'video'
  /** lqe://preview/<token> URL the webview can load; only valid for this app session. */
  previewUrl: string
}

export type PanelOpenMode = 'newIssue' | 'subIssueOfLastParent'

export type NativeSettings = {
  prefillLastParent: boolean
}

/** Requests from the panel to the native side. Each one gets exactly one reply. */
export type NativeMethods = {
  /** Sends a GraphQL request to Linear with the stored API key; replies with the raw HTTP status and body. */
  graphql: {
    params: { query: string; variables: Record<string, unknown> }
    result: { status: number; body: string }
  }
  'storage.read': { params: { key: StorageKey }; result: { value: string | null } }
  'storage.write': { params: { key: StorageKey; value: string }; result: Record<string, never> }
  'files.pick': { params: Record<string, never>; result: { files: LocalFile[]; rejected: string[] } }
  'files.readClipboard': { params: Record<string, never>; result: { files: LocalFile[]; rejected: string[] } }
  /** Re-registers files from a restored draft so they get fresh preview URLs. Missing files are dropped. */
  'files.register': { params: { paths: string[] }; result: { files: LocalFile[] } }
  'screenshot.capture': { params: Record<string, never>; result: { file: LocalFile | null } }
  /** Uploads to Linear's storage. Progress arrives as `upload.progress` events. */
  'upload.start': {
    params: { uploadId: string; path: string; name: string; contentType: string }
    result: { assetUrl: string }
  }
  'upload.cancel': { params: { uploadId: string }; result: Record<string, never> }
  'panel.hide': { params: Record<string, never>; result: Record<string, never> }
  /** Height in CSS pixels of the visible modal, so the native window can follow it. */
  'panel.resize': { params: { height: number }; result: Record<string, never> }
  /** Copies the URL and shows the "Created ENG-123" message. */
  'issue.created': { params: { identifier: string; title: string; url: string }; result: Record<string, never> }
  'settings.get': { params: Record<string, never>; result: NativeSettings }
  'settings.open': { params: Record<string, never>; result: Record<string, never> }
  log: {
    params: { level: 'info' | 'warning' | 'error'; message: string; fields: Record<string, string | number | boolean> }
    result: Record<string, never>
  }
}

export type NativeMethodName = keyof NativeMethods

/** Pushed from the native side to the panel. */
export type NativeEvents = {
  'panel.shown': { mode: PanelOpenMode }
  /** Coordinates are CSS pixels in the webview viewport. */
  'files.dragOver': { x: number; y: number }
  'files.dragExit': Record<string, never>
  'files.dropped': { files: LocalFile[]; rejected: string[]; x: number; y: number }
  'upload.progress': { uploadId: string; fraction: number }
  'settings.changed': NativeSettings
  /** The API key was added, replaced or removed; cached workspace data is no longer trustworthy. */
  'apiKey.changed': Record<string, never>
}

export type NativeEventName = keyof NativeEvents

export type StorageKey = 'draft' | 'preferences' | 'reference-data'

/** Error codes the native side puts in a rejected reply, as `<code>: <message>`. */
export type NativeErrorCode = 'missingApiKey' | 'network' | 'http' | 'invalidParams' | 'fileUnavailable' | 'cancelled' | 'internal'
