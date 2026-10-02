import { makeAutoObservable, runInAction, when } from 'mobx'
import type { NativeBridge } from '../bridge/NativeBridge'
import { NativeError } from '../bridge/NativeBridge'
import { logToNative } from '../bridge/logToNative'
import type { LocalFile } from '../bridge/protocol'
import { strings } from '../i18n/strings'
import { describeError } from './describeError'

export type UploadStatus =
  | { kind: 'uploading'; fraction: number }
  | { kind: 'uploaded'; assetUrl: string }
  | { kind: 'failed'; message: string }

export type Attachment = {
  id: string
  file: LocalFile
  status: UploadStatus
}

/** What survives a quit: enough to find the file again and to skip re-uploading finished ones. */
export type PersistedAttachment = {
  id: string
  path: string
  name: string
  contentType: string
  assetUrl: string | null
}

export type UploadsOutcome = { kind: 'ready' } | { kind: 'failed'; failedNames: string[] }

/**
 * Every file added to the draft, whether inline in the description or in the tray.
 * Uploads start the moment a file is added so that creating the issue rarely has to wait.
 * Removed files are not deleted from Linear's storage; nothing links to them, so they are harmless.
 */
export class AttachmentsController {
  attachments = new Map<string, Attachment>()

  private readonly _bridge: NativeBridge
  private readonly _createId: () => string
  private readonly _unsubscribeProgress: () => void

  constructor(bridge: NativeBridge, createId: () => string = () => crypto.randomUUID()) {
    this._bridge = bridge
    this._createId = createId
    makeAutoObservable<this, '_bridge' | '_createId' | '_unsubscribeProgress'>(this, {
      _bridge: false,
      _createId: false,
      _unsubscribeProgress: false,
    })
    this._unsubscribeProgress = bridge.on('upload.progress', ({ uploadId, fraction }) => {
      this.onUploadProgress(uploadId, fraction)
    })
  }

  dispose(): void {
    this._unsubscribeProgress()
  }

  get(attachmentId: string): Attachment | null {
    return this.attachments.get(attachmentId) ?? null
  }

  /** Adds files and starts uploading them; returns the new attachment ids in the same order. */
  add(files: LocalFile[]): string[] {
    return files.map((file) => {
      const attachmentId = this._createId()
      this.attachments.set(attachmentId, { id: attachmentId, file, status: { kind: 'uploading', fraction: 0 } })
      void this.upload(attachmentId)
      return attachmentId
    })
  }

  retry(attachmentId: string): void {
    const attachment = this.attachments.get(attachmentId)
    if (!attachment || attachment.status.kind !== 'failed') return
    attachment.status = { kind: 'uploading', fraction: 0 }
    void this.upload(attachmentId)
  }

  remove(attachmentId: string): void {
    const attachment = this.attachments.get(attachmentId)
    if (!attachment) return
    this.attachments.delete(attachmentId)
    if (attachment.status.kind === 'uploading') {
      void this._bridge.call('upload.cancel', { uploadId: attachmentId }).catch((error: unknown) => {
        void logToNative(this._bridge, 'warning', 'upload cancel failed', { attachmentId, error: String(error) })
      })
    }
  }

  /** Drops every attachment except the ones still referenced; used when the draft resets. */
  retainOnly(attachmentIds: ReadonlySet<string>): void {
    for (const attachmentId of [...this.attachments.keys()]) {
      if (!attachmentIds.has(attachmentId)) this.remove(attachmentId)
    }
  }

  /** Resolves once none of the given attachments is still uploading. */
  async waitForUploads(attachmentIds: string[]): Promise<UploadsOutcome> {
    const attachments = () => attachmentIds.flatMap((attachmentId) => this.attachments.get(attachmentId) ?? [])
    await when(() => attachments().every((attachment) => attachment.status.kind !== 'uploading'))

    const failedNames = attachments()
      .filter((attachment) => attachment.status.kind === 'failed')
      .map((attachment) => attachment.file.name)
    if (failedNames.length > 0) return { kind: 'failed', failedNames }
    return { kind: 'ready' }
  }

  isUploading(attachmentIds: string[]): boolean {
    return attachmentIds.some((attachmentId) => this.attachments.get(attachmentId)?.status.kind === 'uploading')
  }

  assetUrl(attachmentId: string): string | null {
    const status = this.attachments.get(attachmentId)?.status
    return status?.kind === 'uploaded' ? status.assetUrl : null
  }

  toPersisted(): PersistedAttachment[] {
    return [...this.attachments.values()].map((attachment) => ({
      id: attachment.id,
      path: attachment.file.path,
      name: attachment.file.name,
      contentType: attachment.file.contentType,
      assetUrl: attachment.status.kind === 'uploaded' ? attachment.status.assetUrl : null,
    }))
  }

  /**
   * Brings back attachments from a saved draft. Finished uploads keep their Linear URL; unfinished ones
   * upload again. Files that no longer exist on disk come back as failed so the user can see what's missing.
   */
  async restore(persisted: PersistedAttachment[]): Promise<void> {
    if (persisted.length === 0) return
    const { files } = await this._bridge.call('files.register', { paths: persisted.map((attachment) => attachment.path) })
    const filesByPath = new Map(files.map((file) => [file.path, file]))

    runInAction(() => {
      for (const saved of persisted) {
        const file = filesByPath.get(saved.path)
        if (!file) {
          const missingFile: LocalFile = {
            path: saved.path,
            name: saved.name,
            size: 0,
            contentType: saved.contentType,
            kind: saved.contentType.startsWith('video/') ? 'video' : 'image',
            previewUrl: '',
          }
          const status: UploadStatus = saved.assetUrl
            ? { kind: 'uploaded', assetUrl: saved.assetUrl }
            : { kind: 'failed', message: strings.attachments.missingFile }
          this.attachments.set(saved.id, { id: saved.id, file: missingFile, status })
          continue
        }
        const status: UploadStatus = saved.assetUrl
          ? { kind: 'uploaded', assetUrl: saved.assetUrl }
          : { kind: 'uploading', fraction: 0 }
        this.attachments.set(saved.id, { id: saved.id, file, status })
        if (!saved.assetUrl) void this.upload(saved.id)
      }
    })
  }

  private onUploadProgress(uploadId: string, fraction: number): void {
    const attachment = this.attachments.get(uploadId)
    if (!attachment || attachment.status.kind !== 'uploading') return
    attachment.status = { kind: 'uploading', fraction }
  }

  private async upload(attachmentId: string): Promise<void> {
    const attachment = this.attachments.get(attachmentId)
    if (!attachment) return
    const { file } = attachment

    try {
      const { assetUrl } = await this._bridge.call('upload.start', {
        uploadId: attachmentId,
        path: file.path,
        name: file.name,
        contentType: file.contentType,
      })
      this.finishUpload(attachmentId, { kind: 'uploaded', assetUrl })
    } catch (error) {
      // Cancellation only happens when the attachment was removed, so there is nothing left to update.
      if (error instanceof NativeError && error.code === 'cancelled') return
      const message = describeError(error)
      void logToNative(this._bridge, 'warning', 'upload failed', { attachmentId, name: file.name, error: message })
      this.finishUpload(attachmentId, { kind: 'failed', message })
    }
  }

  private finishUpload(attachmentId: string, status: UploadStatus): void {
    const attachment = this.attachments.get(attachmentId)
    // The attachment may have been removed while its upload was finishing.
    if (!attachment || attachment.status.kind !== 'uploading') return
    attachment.status = status
  }
}
