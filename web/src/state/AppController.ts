import { compareStructural, makeAutoObservable, reaction, runInAction, toJS, type IReactionDisposer } from 'mobx'
import type { NativeBridge } from '../bridge/NativeBridge'
import { logToNative } from '../bridge/logToNative'
import type { LocalFile, NativeSettings, PanelOpenMode } from '../bridge/protocol'
import { DescriptionEditorController } from '../editor/DescriptionEditorController'
import { strings } from '../i18n/strings'
import { LinearClient } from '../linear/LinearClient'
import type { ParentIssue } from '../linear/model'
import { AttachmentsController, type PersistedAttachment } from './AttachmentsController'
import { describeError } from './describeError'
import { DraftController, type DraftFields } from './DraftController'
import { ParentSearchController } from './ParentSearchController'
import { PersistentStore } from './PersistentStore'
import { PreferencesController } from './PreferencesController'
import { ReferenceDataController } from './ReferenceDataController'
import type { OpenMenu, Shortcut } from './shortcuts'
import { SubmitController } from './SubmitController'

type DraftSnapshot = { fields: DraftFields; attachments: PersistedAttachment[] }

/** Where newly added files go: inline in the description (at the cursor or a drop point) or in the tray below it. */
export type AttachTarget = { kind: 'inlineAtSelection' } | { kind: 'inlineAtPoint'; x: number; y: number } | { kind: 'tray' }

export type Lifecycle = 'starting' | 'ready' | 'disposed'

// 300ms: drafts are saved shortly after typing pauses rather than on every keystroke.
const DRAFT_SAVE_DELAY_MS = 300
// 5s: long enough to read a one-line notice, short enough not to linger over the form.
const NOTICE_DURATION_MS = 5_000

/**
 * The panel's root: builds every controller, restores the saved draft, listens to the native side,
 * and runs the flows that span several controllers (open, attach, submit, clear).
 */
export class AppController {
  readonly referenceData: ReferenceDataController
  readonly preferences: PreferencesController
  readonly draft: DraftController
  readonly attachments: AttachmentsController
  readonly parentSearch: ParentSearchController
  readonly editor: DescriptionEditorController
  readonly submitter: SubmitController

  lifecycle: Lifecycle = 'starting'
  settings: NativeSettings = { prefillLastParent: false }
  openPicker: OpenMenu | null = null
  /** Linear's "Create more" switch: when on, creating an issue keeps the panel open for the next one. */
  createMore = false
  lastFocusedField: 'title' | 'description' = 'title'
  dropTarget: 'inline' | 'tray' | null = null
  notice: string | null = null
  /** Bumped whenever the title should take focus; the title input watches it. */
  titleFocusRequest = 0

  private readonly _bridge: NativeBridge
  private readonly _draftStore: PersistentStore<DraftSnapshot>
  private readonly _disposers: Array<() => void> = []
  private _noticeTimer: ReturnType<typeof setTimeout> | null = null

  constructor(bridge: NativeBridge) {
    this._bridge = bridge
    const client = new LinearClient(bridge)
    this._draftStore = new PersistentStore(bridge, 'draft', 1)
    this.referenceData = new ReferenceDataController(bridge, client)
    this.preferences = new PreferencesController(bridge)
    this.draft = new DraftController(this.referenceData)
    this.attachments = new AttachmentsController(bridge)
    this.parentSearch = new ParentSearchController(client)
    this.editor = new DescriptionEditorController(this.attachments, {
      onChange: (description) => this.draft.setDescription(description),
      onPasteFiles: () => void this.pasteFiles({ kind: 'inlineAtSelection' }),
      onFocus: () => this.setLastFocusedField('description'),
    })
    this.submitter = new SubmitController({
      bridge,
      client,
      draft: this.draft,
      attachments: this.attachments,
      editor: this.editor,
    })
    makeAutoObservable<this, '_bridge' | '_draftStore' | '_disposers' | '_noticeTimer'>(this, {
      referenceData: false,
      preferences: false,
      draft: false,
      attachments: false,
      parentSearch: false,
      editor: false,
      submitter: false,
      _bridge: false,
      _draftStore: false,
      _disposers: false,
      _noticeTimer: false,
    })
  }

  async start(): Promise<void> {
    if (this.lifecycle !== 'starting') return
    void logToNative(this._bridge, 'info', 'panel starting')

    const [settings] = await Promise.all([
      this._bridge.call('settings.get', {}),
      this.preferences.load(),
      this.referenceData.loadFromCache(),
    ])
    await this.restoreDraft()
    runInAction(() => {
      this.settings = settings
    })
    this.draft.ensureValidForWorkspace(this.preferences.preferences)

    this.subscribeToNativeEvents()
    this.watchReferenceData()
    this.autosaveDraft()
    this.referenceData.revalidateIfStale()

    runInAction(() => {
      this.lifecycle = 'ready'
    })
    void logToNative(this._bridge, 'info', 'panel ready')
  }

  dispose(): void {
    if (this.lifecycle === 'disposed') return
    this.lifecycle = 'disposed'
    for (const dispose of this._disposers) dispose()
    if (this._noticeTimer) clearTimeout(this._noticeTimer)
    this.attachments.dispose()
    this.parentSearch.dispose()
    this.editor.dispose()
  }

  /** The last parent, offered as a one-key suggestion while the draft has no parent. */
  get parentSuggestion(): ParentIssue | null {
    if (this.draft.fields.parent) return null
    return this.preferences.preferences.lastParent
  }

  onPanelShown(mode: PanelOpenMode): void {
    this.referenceData.revalidateIfStale()
    const { lastParent } = this.preferences.preferences
    const shouldPrefillParent = this.settings.prefillLastParent && !this.draft.hasContent && !this.draft.fields.parent
    if (lastParent && (mode === 'subIssueOfLastParent' || shouldPrefillParent)) {
      this.draft.setParent(lastParent)
    }
    this.titleFocusRequest += 1
  }

  hide(): void {
    this.openPicker = null
    void this._bridge.call('panel.hide', {})
  }

  runShortcut(shortcut: Shortcut): void {
    switch (shortcut.kind) {
      case 'submit':
        void this.submit({ createAnother: this.createMore })
        return
      case 'submitAndCreateAnother':
        void this.submit({ createAnother: true })
        return
      case 'openPicker':
        this.setOpenPicker(shortcut.picker)
        return
      case 'acceptParentSuggestion':
        this.acceptParentSuggestion()
        return
      case 'clearDraft':
        this.clearDraft()
        return
      case 'captureScreenshot':
        void this.captureScreenshot()
        return
      case 'pickFiles':
        void this.pickFiles()
        return
    }
  }

  /** Lets the native window follow the card's height; CSS pixels. */
  reportHeight(height: number): void {
    void this._bridge.call('panel.resize', { height: Math.ceil(height) })
  }

  openSettings(): void {
    void this._bridge.call('settings.open', {})
  }

  setCreateMore(createMore: boolean): void {
    this.createMore = createMore
  }

  setOpenPicker(picker: OpenMenu | null): void {
    this.openPicker = picker
    if (picker === 'parent') void this.parentSearch.loadSuggestions()
    if (picker !== 'parent') this.parentSearch.reset()
  }

  setLastFocusedField(field: 'title' | 'description'): void {
    this.lastFocusedField = field
  }

  acceptParentSuggestion(): void {
    const suggestion = this.parentSuggestion
    if (suggestion) this.draft.setParent(suggestion)
  }

  selectParent(parent: ParentIssue): void {
    this.draft.setParent(parent)
    this.openPicker = null
  }

  /** Creates the issue, then either closes the panel or starts the next one with the same parent. */
  async submit(options: { createAnother: boolean }): Promise<void> {
    const issue = await this.submitter.submit()
    const { teamId, projectId, parent } = this.draft.fields
    if (!issue || !teamId) return

    this.preferences.rememberCreatedIssue({ teamId, projectId, parent: parent ? toJS(parent) : null })
    void this._bridge.call('issue.created', { identifier: issue.identifier, title: issue.title, url: issue.url })
    this.attachments.retainOnly(new Set())
    this.editor.setContent(null)
    this.draft.resetAfterCreate({ keepParent: options.createAnother })

    if (options.createAnother) {
      this.titleFocusRequest += 1
      return
    }
    this.hide()
  }

  /** Throws away the draft, keeping only the sticky team and project. */
  clearDraft(): void {
    this.attachments.retainOnly(new Set())
    this.editor.setContent(null)
    this.draft.startFresh(this.preferences.preferences)
    this.submitter.dismissError()
    this.titleFocusRequest += 1
  }

  removeTrayAttachment(attachmentId: string): void {
    this.draft.removeTrayAttachment(attachmentId)
    this.attachments.remove(attachmentId)
  }

  async pickFiles(): Promise<void> {
    await this.runNativeFileAction(async () => this._bridge.call('files.pick', {}))
  }

  async captureScreenshot(): Promise<void> {
    await this.runNativeFileAction(async () => {
      const { file } = await this._bridge.call('screenshot.capture', {})
      return { files: file ? [file] : [], rejected: [] }
    })
  }

  /** The native side reads the clipboard, because the webview only sees a placeholder for copied files. */
  async pasteFiles(target: AttachTarget): Promise<void> {
    try {
      const { files, rejected } = await this._bridge.call('files.readClipboard', {})
      this.addFiles(files, rejected, target)
    } catch (error) {
      this.showNotice(describeError(error))
    }
  }

  addFiles(files: LocalFile[], rejected: string[], target: AttachTarget): void {
    if (rejected.length > 0) this.showNotice(strings.attachments.rejected(rejected))
    if (files.length === 0) return
    const attachmentIds = this.attachments.add(files)
    if (target.kind === 'inlineAtSelection') this.editor.insertAttachmentsAtSelection(attachmentIds)
    if (target.kind === 'inlineAtPoint') this.editor.insertAttachmentsAtPoint(attachmentIds, target)
    if (target.kind === 'tray') this.draft.addTrayAttachments(attachmentIds)
  }

  dismissNotice(): void {
    this.notice = null
  }

  private showNotice(message: string): void {
    this.notice = message
    if (this._noticeTimer) clearTimeout(this._noticeTimer)
    this._noticeTimer = setTimeout(() => this.dismissNotice(), NOTICE_DURATION_MS)
  }

  /** Files from the picker or a screenshot go where the user was last typing. */
  private async runNativeFileAction(action: () => Promise<{ files: LocalFile[]; rejected: string[] }>): Promise<void> {
    const target: AttachTarget = this.lastFocusedField === 'description' ? { kind: 'inlineAtSelection' } : { kind: 'tray' }
    try {
      const { files, rejected } = await action()
      this.addFiles(files, rejected, target)
    } catch (error) {
      this.showNotice(describeError(error))
    }
  }

  private async restoreDraft(): Promise<void> {
    const snapshot = await this._draftStore.read()
    if (!snapshot) {
      this.draft.startFresh(this.preferences.preferences)
      return
    }
    await this.attachments.restore(snapshot.attachments)
    this.draft.restore(snapshot.fields)
    this.editor.setContent(snapshot.fields.description)
  }

  private subscribeToNativeEvents(): void {
    this._disposers.push(
      this._bridge.on('panel.shown', ({ mode }) => this.onPanelShown(mode)),
      this._bridge.on('files.dragOver', (point) => this.onDragOver(point)),
      this._bridge.on('files.dragExit', () => this.onDragExit()),
      this._bridge.on('files.dropped', ({ files, rejected, x, y }) => this.onFilesDropped(files, rejected, { x, y })),
      this._bridge.on('settings.changed', (settings) => this.onSettingsChanged(settings)),
      this._bridge.on('apiKey.changed', () => void this.referenceData.resetForNewApiKey()),
    )
  }

  private onDragOver(point: { x: number; y: number }): void {
    this.dropTarget = this.editor.containsPoint(point) ? 'inline' : 'tray'
  }

  private onDragExit(): void {
    this.dropTarget = null
  }

  private onFilesDropped(files: LocalFile[], rejected: string[], point: { x: number; y: number }): void {
    this.dropTarget = null
    const target: AttachTarget = this.editor.containsPoint(point) ? { kind: 'inlineAtPoint', ...point } : { kind: 'tray' }
    this.addFiles(files, rejected, target)
  }

  private onSettingsChanged(settings: NativeSettings): void {
    this.settings = settings
  }

  /** Fresh workspace data can invalidate the draft (a deleted label, a new active cycle), so re-check it. */
  private watchReferenceData(): void {
    const dispose: IReactionDisposer = reaction(
      () => this.referenceData.data,
      () => this.draft.ensureValidForWorkspace(this.preferences.preferences),
    )
    this._disposers.push(dispose)
  }

  private autosaveDraft(): void {
    const dispose = reaction(
      (): DraftSnapshot => ({ fields: toJS(this.draft.fields), attachments: this.attachments.toPersisted() }),
      (snapshot) => void this._draftStore.write(snapshot),
      // Structural comparison skips saves for changes that don't reach the snapshot, like upload progress ticks.
      { delay: DRAFT_SAVE_DELAY_MS, equals: compareStructural },
    )
    this._disposers.push(dispose)
  }
}
