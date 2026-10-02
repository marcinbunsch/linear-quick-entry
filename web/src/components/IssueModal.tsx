import { EditorContent } from '@tiptap/react'
import { observer } from 'mobx-react-lite'
import { useEffect, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { strings } from '../i18n/strings'
import type { AppController } from '../state/AppController'
import { AttachmentPreview } from './AttachmentPreview'
import { FieldChips } from './FieldChips'
import { HeaderBar } from './HeaderBar'
import { CameraIcon, PaperclipIcon } from './Icons'

type IssueModalProps = {
  app: AppController
  titleRef: RefObject<HTMLTextAreaElement | null>
  onPickerClosed: () => void
}

/** The "New issue" card, laid out like Linear's own dialog. */
export const IssueModal = observer(function IssueModal({ app, titleRef, onPickerClosed }: IssueModalProps) {
  return (
    <div
      className="panel-shadow relative flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
      onMouseDown={(event) => {
        if (isWindowDragStart(event)) app.beginWindowDrag()
      }}
      data-testid="issue-modal"
    >
      <HeaderBar app={app} onPickerClosed={onPickerClosed} />
      <StatusBanner app={app} />
      <div className="flex max-h-[60vh] flex-col overflow-y-auto px-[18px] pt-3">
        <TitleInput app={app} titleRef={titleRef} />
        <DescriptionArea app={app} />
        <AttachmentTray app={app} />
      </div>
      <div className="px-3 pb-3 pt-3">
        <FieldChips app={app} onPickerClosed={onPickerClosed} />
      </div>
      <Footer app={app} />
      <DropOverlay app={app} />
    </div>
  )
})

/** The header and footer move the window, like a title bar, except where they hold a control. */
function isWindowDragStart(event: MouseEvent): boolean {
  if (event.button !== 0 || !(event.target instanceof Element)) return false
  const isInDragArea = event.target.closest('[data-drag-area]') != null
  const isOnControl = event.target.closest('button, input, textarea, a, [role="switch"], label') != null
  return isInDragArea && !isOnControl
}

const TitleInput = observer(function TitleInput({ app, titleRef }: { app: AppController; titleRef: RefObject<HTMLTextAreaElement | null> }) {
  const title = app.draft.fields.title

  // A textarea so long titles wrap like Linear's; it grows with its content and Enter never inserts a newline.
  useEffect(() => {
    const element = titleRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [title, titleRef])

  return (
    <textarea
      ref={titleRef}
      rows={1}
      value={title}
      placeholder={strings.title.placeholder}
      onChange={(event) => app.draft.setTitle(event.target.value.replace(/\n/g, ' '))}
      onFocus={() => app.setLastFocusedField('title')}
      onKeyDown={(event) => {
        // Plain Enter moves on to the description, as in Linear.
        const isPlainEnter = event.key === 'Enter' && !event.metaKey && !event.altKey && !event.shiftKey
        if (!isPlainEnter) return
        event.preventDefault()
        app.editor.focus()
      }}
      onPaste={(event) => {
        if (event.clipboardData.files.length === 0) return
        event.preventDefault()
        void app.pasteFiles({ kind: 'tray' })
      }}
      className="w-full resize-none overflow-hidden bg-transparent text-[19px] font-medium leading-snug tracking-[-0.01em] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)]"
      data-testid="title-input"
    />
  )
})

const DescriptionArea = observer(function DescriptionArea({ app }: { app: AppController }) {
  const isDropTarget = app.dropTarget === 'inline'
  return (
    <div
      className={`mt-2.5 rounded-md transition-colors ${isDropTarget ? 'bg-[var(--color-selection)] outline-2 outline-dashed outline-[var(--color-accent)]' : ''}`}
      data-testid="description"
    >
      <EditorContent editor={app.editor.editor} />
    </div>
  )
})

const AttachmentTray = observer(function AttachmentTray({ app }: { app: AppController }) {
  const attachments = app.draft.fields.trayAttachmentIds.flatMap((attachmentId) => app.attachments.get(attachmentId) ?? [])
  if (attachments.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2 pb-1" data-testid="attachment-tray">
      {attachments.map((attachment) => (
        <AttachmentPreview
          key={attachment.id}
          attachment={attachment}
          size="tile"
          onRetry={() => app.attachments.retry(attachment.id)}
          onRemove={() => app.removeTrayAttachment(attachment.id)}
        />
      ))}
    </div>
  )
})

/** Workspace loading, refresh failures, submit failures and short notices, most important first. */
const StatusBanner = observer(function StatusBanner({ app }: { app: AppController }) {
  const { submitter, referenceData } = app
  const submitError = submitter.state.kind === 'failed' ? submitter.state.message : null
  const refreshError = referenceData.refreshState.kind === 'failed' ? referenceData.refreshState.message : null
  const isLoadingWorkspace = !referenceData.data && referenceData.refreshState.kind === 'refreshing'

  const openSettings = () => app.openSettings()

  if (submitError) {
    const onOpenSettings = isApiKeyProblem(submitError) ? openSettings : undefined
    return <Banner tone="danger" message={submitError} onDismiss={() => submitter.dismissError()} onOpenSettings={onOpenSettings} />
  }
  if (refreshError && !referenceData.data) {
    const onOpenSettings = isApiKeyProblem(refreshError) ? openSettings : undefined
    return <Banner tone="danger" message={refreshError} onRetry={() => void referenceData.refresh()} onOpenSettings={onOpenSettings} />
  }
  if (isLoadingWorkspace) return <Banner tone="info" message={strings.status.loadingWorkspace} />
  if (app.notice?.kind === 'screenRecordingNeeded') {
    return <Banner tone="info" message={app.notice.message} onOpenSettings={() => app.openScreenRecordingSettings()} onDismiss={() => app.dismissNotice()} />
  }
  if (app.notice) return <Banner tone="info" message={app.notice.message} onDismiss={() => app.dismissNotice()} />
  return null
})

function isApiKeyProblem(message: string): boolean {
  return message === strings.errors.missingApiKey || message === strings.errors.invalidApiKey
}

function Banner({
  tone,
  message,
  onDismiss,
  onRetry,
  onOpenSettings,
}: {
  tone: 'info' | 'danger'
  message: string
  onDismiss?: () => void
  onRetry?: () => void
  onOpenSettings?: () => void
}) {
  const toneClass = tone === 'danger' ? 'border-[var(--color-danger)]/40 text-[var(--color-danger)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
  return (
    <div className={`mx-4 mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] ${toneClass}`} role="status" data-testid="status-banner">
      <span className="flex-1">{message}</span>
      {onOpenSettings && <BannerButton label={strings.status.openSettings} onClick={onOpenSettings} />}
      {onRetry && <BannerButton label={strings.status.retry} onClick={onRetry} />}
      {onDismiss && <BannerButton label="✕" onClick={onDismiss} />}
    </div>
  )
}

function BannerButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded px-1.5 py-0.5 text-[var(--color-text)] hover:bg-[var(--color-chip-hover)]">
      {label}
    </button>
  )
}

const Footer = observer(function Footer({ app }: { app: AppController }) {
  const { state } = app.submitter
  return (
    <div className="flex items-center gap-2 px-3 pb-3 pt-3" data-drag-area>
      <RoundIconButton title={`${strings.attachments.attachFiles} (⌘⇧U)`} onClick={() => void app.pickFiles()} testId="attach-files">
        <PaperclipIcon />
      </RoundIconButton>
      <RoundIconButton title={`${strings.attachments.screenshot} (⌘⇧R)`} onClick={() => void app.captureScreenshot()} testId="capture-screenshot">
        <CameraIcon />
      </RoundIconButton>
      <div className="flex-1" />
      <CreateMoreSwitch app={app} />
      <button
        type="button"
        disabled={app.submitter.isBusy}
        onClick={() => void app.submit({ createAnother: app.createMore })}
        title="⌘↩"
        className="ml-2 flex h-8 items-center rounded-full bg-[var(--color-accent)] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
        data-testid="create-issue"
      >
        {footerButtonLabel(state.kind)}
      </button>
    </div>
  )
})

/** Linear's "Create more" switch; ⌥⌘↩ creates another regardless of it. */
const CreateMoreSwitch = observer(function CreateMoreSwitch({ app }: { app: AppController }) {
  const isOn = app.createMore
  return (
    <label className="flex cursor-default items-center gap-2 text-[13px] text-[var(--color-text-secondary)]" title="⌥⌘↩ creates another once">
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        onClick={() => app.setCreateMore(!isOn)}
        className={`relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors ${isOn ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-toggle-off)]'}`}
        data-testid="create-more"
      >
        <span className={`absolute top-[2px] size-[14px] rounded-full bg-white shadow-sm transition-[left] ${isOn ? 'left-[14px]' : 'left-[2px]'}`} />
      </button>
      {strings.footer.createMore}
    </label>
  )
})

function footerButtonLabel(kind: AppController['submitter']['state']['kind']): string {
  if (kind === 'waitingForUploads') return strings.footer.waitingForUploads
  if (kind === 'creating') return strings.footer.creating
  return strings.footer.create
}

function RoundIconButton({ title, onClick, testId, children }: { title: string; onClick: () => void; testId: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-chip)] text-[var(--color-icon)] transition-colors hover:bg-[var(--color-chip-hover)] hover:text-[var(--color-text)] [&_svg]:size-[15px]"
      data-testid={testId}
    >
      {children}
    </button>
  )
}

/** Shown while files are dragged over the panel but outside the description: they'll land in the tray. */
const DropOverlay = observer(function DropOverlay({ app }: { app: AppController }) {
  if (app.dropTarget !== 'tray') return null
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-accent)] bg-[var(--color-surface)]/80 text-[13px] text-[var(--color-text)]"
      data-testid="drop-overlay"
    >
      {strings.attachments.dropTray}
    </div>
  )
})
