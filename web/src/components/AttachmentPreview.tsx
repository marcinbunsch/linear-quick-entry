import { observer } from 'mobx-react-lite'
import { strings } from '../i18n/strings'
import type { Attachment } from '../state/AttachmentsController'
import { CloseIcon, PlayIcon } from './Icons'

type AttachmentPreviewProps = {
  attachment: Attachment
  onRetry: () => void
  onRemove: () => void
  /** Inline previews fill the description width; tray previews are small tiles. */
  size: 'inline' | 'tile'
}

/** A thumbnail with upload progress, a failure state with retry, and a remove button. */
export const AttachmentPreview = observer(function AttachmentPreview({ attachment, onRetry, onRemove, size }: AttachmentPreviewProps) {
  const { file, status } = attachment
  const frameClass =
    size === 'inline'
      ? 'relative inline-block max-w-full overflow-hidden rounded-md border border-[var(--color-border)]'
      : 'relative size-16 shrink-0 overflow-hidden rounded-md border border-[var(--color-border)]'
  const imageClass = size === 'inline' ? 'block max-h-72 max-w-full object-contain' : 'size-full object-cover'

  return (
    <div className={`group ${frameClass}`} data-media-frame data-testid={`attachment-${attachment.id}`} title={file.name}>
      {file.previewUrl ? (
        <img src={file.previewUrl} alt={file.name} className={imageClass} draggable={false} />
      ) : (
        <div className="flex size-16 items-center justify-center bg-[var(--color-chip)] text-[11px] text-[var(--color-text-muted)]">{file.name}</div>
      )}

      {file.kind === 'video' && (
        <span className="absolute bottom-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white">
          <PlayIcon />
        </span>
      )}

      {status.kind === 'uploading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30" title={strings.attachments.uploading}>
          <ProgressRing fraction={status.fraction} />
        </div>
      )}

      {status.kind === 'failed' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 p-1 text-center text-[11px] text-white" title={status.message}>
          <span>{strings.attachments.failed}</span>
          <button type="button" onClick={onRetry} className="rounded bg-white/20 px-1.5 py-0.5 hover:bg-white/30" data-testid="retry-upload">
            {strings.attachments.retry}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onRemove}
        title={strings.attachments.remove}
        className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-0.5 text-white group-hover:block"
        data-testid="remove-attachment"
      >
        <CloseIcon />
      </button>
    </div>
  )
})

function ProgressRing({ fraction }: { fraction: number }) {
  const radius = 9
  const circumference = 2 * Math.PI * radius
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r={radius} stroke="white" strokeOpacity="0.3" strokeWidth="2.5" fill="none" />
      <circle
        cx="12"
        cy="12"
        r={radius}
        stroke="white"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - Math.min(Math.max(fraction, 0.03), 1))}
        transform="rotate(-90 12 12)"
      />
    </svg>
  )
}
