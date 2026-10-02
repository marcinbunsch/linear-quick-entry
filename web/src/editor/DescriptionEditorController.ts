import { Editor, type JSONContent } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import { strings } from '../i18n/strings'
import type { AttachmentsController } from '../state/AttachmentsController'
import { MediaNode, type MediaAttributes } from './MediaNode'

type DescriptionEditorCallbacks = {
  onChange: (description: JSONContent | null) => void
  /** The user pasted something with files in it; the native side reads the real files from the clipboard. */
  onPasteFiles: () => void
  onFocus: () => void
}

/**
 * Owns the Tiptap editor for the description. Created once and kept alive with the panel,
 * because the draft (and the editor's undo history) outlives every open/close of the window.
 */
export class DescriptionEditorController {
  readonly editor: Editor

  private readonly _attachments: AttachmentsController
  private readonly _callbacks: DescriptionEditorCallbacks
  /** Set while we replace content ourselves, so restoring a draft doesn't echo back as a user edit. */
  private _isApplyingContent = false

  constructor(attachments: AttachmentsController, callbacks: DescriptionEditorCallbacks) {
    this._attachments = attachments
    this._callbacks = callbacks
    this.editor = new Editor({
      extensions: [
        StarterKit.configure({ link: { openOnClick: false } }),
        Placeholder.configure({ placeholder: strings.description.placeholder }),
        Markdown,
        MediaNode.configure({ attachments }),
      ],
      editorProps: {
        handlePaste: (_view, event) => {
          const hasFiles = (event.clipboardData?.files.length ?? 0) > 0
          if (!hasFiles) return false
          this._callbacks.onPasteFiles()
          return true
        },
      },
      onUpdate: ({ editor }) => {
        if (this._isApplyingContent) return
        this._callbacks.onChange(editor.isEmpty ? null : editor.getJSON())
      },
      onFocus: () => {
        this._callbacks.onFocus()
      },
    })
  }

  dispose(): void {
    this.editor.destroy()
  }

  setContent(description: JSONContent | null): void {
    this._isApplyingContent = true
    try {
      if (description) this.editor.commands.setContent(description)
      else this.editor.commands.clearContent()
    } finally {
      this._isApplyingContent = false
    }
  }

  focus(): void {
    this.editor.commands.focus()
  }

  /** Inserts attachments at the cursor, or at the end when the description was never focused. */
  insertAttachmentsAtSelection(attachmentIds: string[]): void {
    this.insertAttachmentsAt(this.editor.state.selection.to, attachmentIds)
  }

  /** Inserts attachments where a file was dropped; viewport coordinates in CSS pixels. */
  insertAttachmentsAtPoint(attachmentIds: string[], point: { x: number; y: number }): void {
    const position = this.editor.view.posAtCoords({ left: point.x, top: point.y })?.pos
    this.insertAttachmentsAt(position ?? this.editor.state.doc.content.size, attachmentIds)
  }

  /** True when the point is over the description area, used to decide between inline and tray. */
  containsPoint(point: { x: number; y: number }): boolean {
    const element = document.elementFromPoint(point.x, point.y)
    return element != null && this.editor.view.dom.contains(element)
  }

  referencedAttachmentIds(): string[] {
    const attachmentIds: string[] = []
    this.editor.state.doc.descendants((node) => {
      if (node.type.name === MediaNode.name) attachmentIds.push(String(node.attrs.attachmentId))
    })
    return attachmentIds
  }

  /** The description as Linear-flavoured markdown, with uploaded files linked by their Linear URLs. */
  getMarkdown(): string {
    if (this.editor.isEmpty) return ''
    return this.editor.getMarkdown().trim()
  }

  private insertAttachmentsAt(position: number, attachmentIds: string[]): void {
    const nodes = attachmentIds.flatMap((attachmentId): JSONContent[] => {
      const attachment = this._attachments.get(attachmentId)
      if (!attachment) return []
      const attrs: MediaAttributes = { attachmentId, kind: attachment.file.kind, name: attachment.file.name }
      return [{ type: MediaNode.name, attrs }]
    })
    if (nodes.length === 0) return
    this.editor.chain().focus().insertContentAt(position, nodes).run()
  }
}
