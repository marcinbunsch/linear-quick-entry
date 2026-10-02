import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NativeMethods } from '../bridge/protocol'
import { AttachmentsController } from '../state/AttachmentsController'
import { FakeNativeBridge } from '../test/FakeNativeBridge'
import { flushPromises, screenRecordingFile, screenshotFile } from '../test/fixtures'
import { DescriptionEditorController } from './DescriptionEditorController'

type UploadResult = NativeMethods['upload.start']['result']

function setup() {
  const bridge = new FakeNativeBridge()
  const assetUrls: Record<string, string> = {
    [screenshotFile('Checkout [mobile].png').path]: 'https://uploads.linear.app/acme/7d1e/checkout-mobile.png',
    [screenRecordingFile().path]: 'https://uploads.linear.app/acme/88aa/checkout-bug.mov',
  }
  bridge.handle('upload.start', async ({ path }): Promise<UploadResult> => ({ assetUrl: assetUrls[path] ?? '' }))
  let nextId = 0
  const attachments = new AttachmentsController(bridge, () => `attachment-${++nextId}`)
  const onChange = vi.fn()
  const editor = new DescriptionEditorController(attachments, { onChange, onPasteFiles: vi.fn(), onFocus: vi.fn() })
  return { attachments, editor, onChange }
}

describe('DescriptionEditorController', () => {
  let current: ReturnType<typeof setup> | null = null
  afterEach(() => current?.editor.dispose())

  it('text with inline media -> markdown with Linear upload URLs in place', async () => {
    current = setup()
    const { attachments, editor } = current
    editor.setContent({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The card form jumps after the 3DS redirect:' }] }],
    })

    const attachmentIds = attachments.add([screenshotFile('Checkout [mobile].png'), screenRecordingFile()])
    editor.insertAttachmentsAtSelection(attachmentIds)
    await flushPromises()

    const markdown = editor.getMarkdown()
    expect(markdown).toContain('The card form jumps after the 3DS redirect:')
    expect(markdown).toContain('![Checkout mobile.png](https://uploads.linear.app/acme/7d1e/checkout-mobile.png)')
    expect(markdown).toContain('![checkout-bug.mov](https://uploads.linear.app/acme/88aa/checkout-bug.mov)')
    expect(editor.referencedAttachmentIds()).toEqual(['attachment-1', 'attachment-2'])
  })

  it('empty editor -> empty markdown', () => {
    current = setup()

    expect(current.editor.getMarkdown()).toBe('')
  })

  it('restoring saved content -> not reported back as a user edit', () => {
    current = setup()

    current.editor.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Restored draft' }] }] })

    expect(current.onChange).not.toHaveBeenCalled()
    expect(current.editor.getMarkdown()).toBe('Restored draft')
  })

  it('typing -> change reported with the document', () => {
    current = setup()

    current.editor.editor.commands.insertContent('Steps to reproduce')

    expect(current.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'doc' }))
  })
})
