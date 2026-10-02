import { afterEach, describe, expect, it, vi } from 'vitest'
import { NativeError } from '../bridge/NativeBridge'
import type { NativeMethods } from '../bridge/protocol'
import { DescriptionEditorController } from '../editor/DescriptionEditorController'
import { LinearClient } from '../linear/LinearClient'
import { FakeNativeBridge } from '../test/FakeNativeBridge'
import { checkoutEpic, flushPromises, ids, loadedReferenceData, respondToGraphQL, screenshotFile } from '../test/fixtures'
import { AttachmentsController } from './AttachmentsController'
import { DraftController } from './DraftController'
import { buildIssueCreateInput, SubmitController } from './SubmitController'

type UploadResult = NativeMethods['upload.start']['result']

const createdIssue = { id: 'ba5e0000-0000-4000-8000-000000000150', identifier: 'ENG-150', title: 'Card form loses focus', url: 'https://linear.app/acme/issue/ENG-150' }

async function setup() {
  const bridge = new FakeNativeBridge()
  const inputs: unknown[] = []
  respondToGraphQL(bridge, {
    CreateIssue: (variables) => {
      inputs.push(variables.input)
      return { issueCreate: { success: true, issue: createdIssue } }
    },
  })
  const referenceData = await loadedReferenceData(bridge)
  const draft = new DraftController(referenceData)
  draft.startFresh({ lastTeamId: ids.engineering, lastProjectId: null, lastParent: null, recentParents: [] })
  let nextId = 0
  const attachments = new AttachmentsController(bridge, () => `attachment-${++nextId}`)
  const editor = new DescriptionEditorController(attachments, { onChange: vi.fn(), onPasteFiles: vi.fn(), onFocus: vi.fn() })
  const submitter = new SubmitController({ bridge, client: new LinearClient(bridge), draft, attachments, editor })
  return { bridge, inputs, draft, attachments, editor, submitter }
}

describe('SubmitController', () => {
  let editorToDispose: DescriptionEditorController | null = null
  afterEach(() => editorToDispose?.dispose())

  it('complete draft -> issue created with every chosen field', async () => {
    const { draft, inputs, editor, submitter } = await setup()
    editorToDispose = editor
    draft.setTitle('  Card form loses focus  ')
    draft.setParent(checkoutEpic)
    draft.setPriority(2)
    draft.toggleLabel(ids.bugLabel)
    draft.setEstimate(3)
    draft.setDueDate('2026-10-09')

    const issue = await submitter.submit()

    expect(issue).toEqual(createdIssue)
    expect(inputs).toEqual([
      {
        teamId: ids.engineering,
        title: 'Card form loses focus',
        stateId: ids.engBacklog,
        priority: 2,
        projectId: ids.checkoutProject,
        estimate: 3,
        labelIds: [ids.bugLabel],
        cycleId: ids.cycle41,
        dueDate: '2026-10-09',
        parentId: checkoutEpic.id,
      },
    ])
    expect(submitter.state).toEqual({ kind: 'idle' })
  })

  it('no title -> nothing sent, error shown', async () => {
    const { inputs, editor, submitter } = await setup()
    editorToDispose = editor

    const issue = await submitter.submit()

    expect(issue).toBeNull()
    expect(inputs).toEqual([])
    expect(submitter.state).toEqual({ kind: 'failed', message: 'Give the issue a title.' })
  })

  it('upload still running -> waits, then sends tray files appended to the description', async () => {
    const { bridge, draft, inputs, attachments, editor, submitter } = await setup()
    editorToDispose = editor
    let finishUpload: (result: UploadResult) => void = () => {}
    bridge.handle('upload.start', () => new Promise((resolve) => (finishUpload = resolve)))
    draft.setTitle('Checkout button misaligned on iPad')
    editor.editor.commands.insertContent('Happens in landscape only.')
    draft.addTrayAttachments(attachments.add([screenshotFile()]))

    const submitting = submitter.submit()
    await flushPromises()
    expect(submitter.state).toEqual({ kind: 'waitingForUploads' })

    finishUpload({ assetUrl: 'https://uploads.linear.app/acme/51c0/screenshot.png' })
    await submitting

    expect(inputs).toEqual([
      expect.objectContaining({
        description: 'Happens in landscape only.\n\n![Screenshot 2026-10-02 at 14.31.07.png](https://uploads.linear.app/acme/51c0/screenshot.png)',
      }),
    ])
  })

  it('upload failed -> issue not created, failed file named', async () => {
    const { bridge, draft, inputs, attachments, editor, submitter } = await setup()
    editorToDispose = editor
    bridge.handle('upload.start', async () => {
      throw new NativeError('network', 'The Internet connection appears to be offline.')
    })
    draft.setTitle('Checkout button misaligned on iPad')
    draft.addTrayAttachments(attachments.add([screenshotFile()]))
    await flushPromises()

    const issue = await submitter.submit()

    expect(issue).toBeNull()
    expect(inputs).toEqual([])
    expect(submitter.state).toEqual({
      kind: 'failed',
      message: 'Screenshot 2026-10-02 at 14.31.07.png failed to upload. Retry or remove them.',
    })
  })

  it('no API key -> message pointing to Settings', async () => {
    const { bridge, draft, editor, submitter } = await setup()
    editorToDispose = editor
    bridge.handle('graphql', async () => {
      throw new NativeError('missingApiKey', 'No API key is stored')
    })
    draft.setTitle('Checkout button misaligned on iPad')

    await submitter.submit()

    expect(submitter.state).toEqual({ kind: 'failed', message: 'Add your Linear API key in Settings to create issues.' })
  })
})

describe('buildIssueCreateInput', () => {
  it('nothing chosen beyond the title -> only team and title sent, so Linear applies its defaults', async () => {
    const { draft, editor } = await setup()
    editor.dispose()
    draft.setTeam(ids.design)
    draft.setTitle('Update the 404 illustration')
    draft.restore({ ...draft.fields, stateId: null })

    expect(buildIssueCreateInput(draft.fields, ids.design, '')).toEqual({ teamId: ids.design, title: 'Update the 404 illustration' })
  })
})
