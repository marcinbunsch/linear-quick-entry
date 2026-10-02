import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { observer } from 'mobx-react-lite'
import type { MediaNodeOptions } from '../editor/MediaNode'
import { AttachmentPreview } from './AttachmentPreview'

/** Renders a media node in the editor from the live attachment state. */
export const MediaNodeView = observer(function MediaNodeView({ node, extension, deleteNode }: ReactNodeViewProps) {
  const options: MediaNodeOptions = extension.options
  const attachmentId = String(node.attrs.attachmentId)
  const attachment = options.attachments?.get(attachmentId)

  return (
    <NodeViewWrapper className="my-1.5" data-drag-handle>
      {attachment ? (
        <AttachmentPreview
          attachment={attachment}
          size="inline"
          onRetry={() => options.attachments?.retry(attachmentId)}
          onRemove={deleteNode}
        />
      ) : (
        <span className="text-[12px] text-[var(--color-text-faint)]">{String(node.attrs.name)}</span>
      )}
    </NodeViewWrapper>
  )
})
