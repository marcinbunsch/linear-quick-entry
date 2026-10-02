import { describe, expect, it } from 'vitest'
import { NativeError } from '../bridge/NativeBridge'
import type { NativeMethods } from '../bridge/protocol'
import { FakeNativeBridge } from '../test/FakeNativeBridge'
import { flushPromises, screenRecordingFile, screenshotFile } from '../test/fixtures'
import { AttachmentsController } from './AttachmentsController'

type UploadResult = NativeMethods['upload.start']['result']

/** Uploads stay pending until the test settles them, so in-between states can be observed. */
function deferredUploads(bridge: FakeNativeBridge) {
  const pending = new Map<string, { resolve: (result: UploadResult) => void; reject: (error: Error) => void }>()
  bridge.handle('upload.start', ({ uploadId }) => new Promise((resolve, reject) => pending.set(uploadId, { resolve, reject })))
  return {
    succeed(uploadId: string, assetUrl: string) {
      pending.get(uploadId)?.resolve({ assetUrl })
    },
    fail(uploadId: string, error: Error) {
      pending.get(uploadId)?.reject(error)
    },
  }
}

function sequentialIds() {
  let next = 0
  return () => `attachment-${++next}`
}

describe('AttachmentsController', () => {
  it('file added -> upload starts immediately and progress events move the fraction', async () => {
    const bridge = new FakeNativeBridge()
    deferredUploads(bridge)
    const attachments = new AttachmentsController(bridge, sequentialIds())

    const [attachmentId] = attachments.add([screenshotFile()])
    bridge.emit('upload.progress', { uploadId: 'attachment-1', fraction: 0.4 })

    expect(attachmentId).toBe('attachment-1')
    expect(bridge.callsTo('upload.start')).toEqual([
      { uploadId: 'attachment-1', path: screenshotFile().path, name: screenshotFile().name, contentType: 'image/png' },
    ])
    expect(attachments.get('attachment-1')?.status).toEqual({ kind: 'uploading', fraction: 0.4 })
  })

  it('upload finishes -> Linear asset URL available', async () => {
    const bridge = new FakeNativeBridge()
    const uploads = deferredUploads(bridge)
    const attachments = new AttachmentsController(bridge, sequentialIds())

    attachments.add([screenshotFile()])
    uploads.succeed('attachment-1', 'https://uploads.linear.app/acme/3f2c/screenshot.png')
    await flushPromises()

    expect(attachments.assetUrl('attachment-1')).toBe('https://uploads.linear.app/acme/3f2c/screenshot.png')
  })

  it('upload fails then retried -> uploads again and can succeed', async () => {
    const bridge = new FakeNativeBridge()
    const uploads = deferredUploads(bridge)
    const attachments = new AttachmentsController(bridge, sequentialIds())

    attachments.add([screenRecordingFile()])
    uploads.fail('attachment-1', new NativeError('http', 'Upload rejected with HTTP 403'))
    await flushPromises()
    expect(attachments.get('attachment-1')?.status).toEqual({ kind: 'failed', message: 'Upload rejected with HTTP 403' })

    attachments.retry('attachment-1')
    uploads.succeed('attachment-1', 'https://uploads.linear.app/acme/9a1b/checkout-bug.mov')
    await flushPromises()

    expect(bridge.callsTo('upload.start')).toHaveLength(2)
    expect(attachments.assetUrl('attachment-1')).toBe('https://uploads.linear.app/acme/9a1b/checkout-bug.mov')
  })

  it('removed while uploading -> upload cancelled and the late result ignored', async () => {
    const bridge = new FakeNativeBridge()
    const uploads = deferredUploads(bridge)
    const attachments = new AttachmentsController(bridge, sequentialIds())

    attachments.add([screenshotFile()])
    attachments.remove('attachment-1')
    uploads.fail('attachment-1', new NativeError('cancelled', 'Upload cancelled'))
    await flushPromises()

    expect(bridge.callsTo('upload.cancel')).toEqual([{ uploadId: 'attachment-1' }])
    expect(attachments.get('attachment-1')).toBeNull()
  })

  it('waitForUploads with one still uploading -> resolves once it finishes', async () => {
    const bridge = new FakeNativeBridge()
    const uploads = deferredUploads(bridge)
    const attachments = new AttachmentsController(bridge, sequentialIds())
    attachments.add([screenshotFile(), screenRecordingFile()])
    uploads.succeed('attachment-1', 'https://uploads.linear.app/acme/1/shot.png')

    let outcome: unknown = null
    void attachments.waitForUploads(['attachment-1', 'attachment-2']).then((result) => (outcome = result))
    await flushPromises()
    expect(outcome).toBeNull()

    uploads.succeed('attachment-2', 'https://uploads.linear.app/acme/2/checkout-bug.mov')
    await flushPromises()
    expect(outcome).toEqual({ kind: 'ready' })
  })

  it('waitForUploads with a failed upload -> reports the failed file names', async () => {
    const bridge = new FakeNativeBridge()
    const uploads = deferredUploads(bridge)
    const attachments = new AttachmentsController(bridge, sequentialIds())
    attachments.add([screenRecordingFile()])
    uploads.fail('attachment-1', new NativeError('network', 'The Internet connection appears to be offline.'))

    const outcome = await attachments.waitForUploads(['attachment-1'])

    expect(outcome).toEqual({ kind: 'failed', failedNames: ['checkout-bug.mov'] })
  })

  it('restoring a saved draft -> finished uploads kept, unfinished re-uploaded, missing files marked failed', async () => {
    const bridge = new FakeNativeBridge()
    deferredUploads(bridge)
    const recording = screenRecordingFile()
    bridge.handle('files.register', async () => ({ files: [screenshotFile(), recording] }))
    const attachments = new AttachmentsController(bridge, sequentialIds())

    await attachments.restore([
      { id: 'saved-1', path: screenshotFile().path, name: screenshotFile().name, contentType: 'image/png', assetUrl: 'https://uploads.linear.app/acme/1/shot.png' },
      { id: 'saved-2', path: recording.path, name: recording.name, contentType: 'video/quicktime', assetUrl: null },
      { id: 'saved-3', path: '/private/var/folders/tmp/deleted.png', name: 'deleted.png', contentType: 'image/png', assetUrl: null },
    ])

    expect(attachments.get('saved-1')?.status).toEqual({ kind: 'uploaded', assetUrl: 'https://uploads.linear.app/acme/1/shot.png' })
    expect(attachments.get('saved-2')?.status.kind).toBe('uploading')
    expect(attachments.get('saved-3')?.status.kind).toBe('failed')
    expect(bridge.callsTo('upload.start')).toHaveLength(1)
  })
})
