import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MediaNodeView } from '../components/MediaNodeView'
import type { AttachmentsController } from '../state/AttachmentsController'
import { mediaMarkdown } from './mediaMarkdown'

export type MediaNodeOptions = {
  attachments: AttachmentsController | null
}

export type MediaAttributes = {
  attachmentId: string
  kind: 'image' | 'video'
  name: string
}

/**
 * An image or video in the description. The node stores only the attachment id; the preview, upload
 * progress and final Linear URL all come from the AttachmentsController, so the node never goes stale.
 */
export const MediaNode = Node.create<MediaNodeOptions>({
  name: 'media',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return { attachments: null }
  },

  addAttributes() {
    return {
      attachmentId: { default: '' },
      kind: { default: 'image' },
      name: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-media-attachment-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-media-attachment-id': HTMLAttributes.attachmentId })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MediaNodeView)
  },

  renderMarkdown(node) {
    const attachmentId = String(node.attrs?.attachmentId ?? '')
    const assetUrl = this.options.attachments?.assetUrl(attachmentId)
    // Submitting waits for uploads, so a missing URL means the attachment was removed; leave nothing behind.
    if (!assetUrl) return ''
    return mediaMarkdown(String(node.attrs?.name ?? ''), assetUrl)
  },
})
