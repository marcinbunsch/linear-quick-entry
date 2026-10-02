import { makeAutoObservable, runInAction } from 'mobx'
import type { NativeBridge } from '../bridge/NativeBridge'
import { logToNative } from '../bridge/logToNative'
import type { DescriptionEditorController } from '../editor/DescriptionEditorController'
import { mediaMarkdown } from '../editor/mediaMarkdown'
import { strings } from '../i18n/strings'
import { CreateIssueMutation } from '../linear/documents'
import type { IssueCreateInput } from '../linear/generated/graphql'
import type { LinearClient } from '../linear/LinearClient'
import type { AttachmentsController } from './AttachmentsController'
import { describeError } from './describeError'
import type { DraftController, DraftFields } from './DraftController'

export type SubmitState =
  | { kind: 'idle' }
  | { kind: 'waitingForUploads' }
  | { kind: 'creating' }
  | { kind: 'failed'; message: string }

export type CreatedIssue = { id: string; identifier: string; title: string; url: string }

type SubmitDependencies = {
  bridge: NativeBridge
  client: LinearClient
  draft: DraftController
  attachments: AttachmentsController
  editor: DescriptionEditorController
}

/** Turns the draft into a Linear issue: waits for uploads, builds the description, creates the issue. */
export class SubmitController {
  state: SubmitState = { kind: 'idle' }

  private readonly _dependencies: SubmitDependencies

  constructor(dependencies: SubmitDependencies) {
    this._dependencies = dependencies
    makeAutoObservable<this, '_dependencies'>(this, { _dependencies: false })
  }

  get isBusy(): boolean {
    return this.state.kind === 'waitingForUploads' || this.state.kind === 'creating'
  }

  dismissError(): void {
    if (this.state.kind === 'failed') this.state = { kind: 'idle' }
  }

  /** Returns the created issue, or null when it failed (the reason is in `state`) or a submit is already running. */
  async submit(): Promise<CreatedIssue | null> {
    if (this.isBusy) return null
    const { bridge, client, draft, attachments, editor } = this._dependencies
    const { fields } = draft

    if (!fields.teamId) return this.fail(strings.errors.noTeam)
    if (fields.title.trim() === '') return this.fail(strings.errors.noTitle)

    const attachmentIds = [...editor.referencedAttachmentIds(), ...fields.trayAttachmentIds]
    if (attachments.isUploading(attachmentIds)) this.state = { kind: 'waitingForUploads' }
    const uploads = await attachments.waitForUploads(attachmentIds)
    if (uploads.kind === 'failed') return this.fail(strings.errors.uploadsFailed(uploads.failedNames))

    runInAction(() => {
      this.state = { kind: 'creating' }
    })
    const trayMarkdown = fields.trayAttachmentIds.flatMap((attachmentId) => {
      const assetUrl = attachments.assetUrl(attachmentId)
      const name = attachments.get(attachmentId)?.file.name ?? ''
      return assetUrl ? [mediaMarkdown(name, assetUrl)] : []
    })
    const description = [editor.getMarkdown(), ...trayMarkdown].filter((part) => part !== '').join('\n\n')

    try {
      const response = await client.request(CreateIssueMutation, { input: buildIssueCreateInput(fields, fields.teamId, description) })
      const issue = response.issueCreate.issue
      if (!response.issueCreate.success || !issue) return this.fail(strings.errors.createRejected)
      void logToNative(bridge, 'info', 'issue created', { identifier: issue.identifier })
      runInAction(() => {
        this.state = { kind: 'idle' }
      })
      return issue
    } catch (error) {
      const message = describeError(error)
      void logToNative(bridge, 'warning', 'issue create failed', { error: message })
      return this.fail(message)
    }
  }

  private fail(message: string): null {
    runInAction(() => {
      this.state = { kind: 'failed', message }
    })
    return null
  }
}

/** Maps the draft to Linear's input, leaving out everything the user didn't set so Linear applies its own defaults. */
export function buildIssueCreateInput(fields: DraftFields, teamId: string, description: string): IssueCreateInput {
  return {
    teamId,
    title: fields.title.trim(),
    ...(description !== '' && { description }),
    ...(fields.stateId && { stateId: fields.stateId }),
    ...(fields.priority !== 0 && { priority: fields.priority }),
    ...(fields.assigneeId && { assigneeId: fields.assigneeId }),
    ...(fields.projectId && { projectId: fields.projectId }),
    ...(fields.estimate != null && { estimate: fields.estimate }),
    ...(fields.labelIds.length > 0 && { labelIds: fields.labelIds }),
    ...(fields.cycleId && { cycleId: fields.cycleId }),
    ...(fields.dueDate && { dueDate: fields.dueDate }),
    ...(fields.parent && { parentId: fields.parent.id }),
  }
}
