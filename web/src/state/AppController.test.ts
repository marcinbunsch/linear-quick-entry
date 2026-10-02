import { afterEach, describe, expect, it, vi } from 'vitest'
import { FakeNativeBridge } from '../test/FakeNativeBridge'
import { brandRefresh, checkoutEpic, flushPromises, ids, respondToGraphQL, screenshotFile, seedReferenceDataCache } from '../test/fixtures'
import { AppController } from './AppController'
import type { Preferences } from './PreferencesController'

const createdIssue = { id: 'ba5e0000-0000-4000-8000-000000000150', identifier: 'ENG-150', title: 'Card form loses focus', url: 'https://linear.app/acme/issue/ENG-150' }

function savePreferences(bridge: FakeNativeBridge, preferences: Preferences) {
  bridge.storage.set('preferences', JSON.stringify({ version: 1, value: preferences }))
}

async function startedApp(options: { preferences?: Partial<Preferences>; prefillLastParent?: boolean } = {}) {
  const bridge = new FakeNativeBridge()
  seedReferenceDataCache(bridge, Date.now())
  savePreferences(bridge, {
    lastTeamId: ids.engineering,
    lastProjectId: ids.checkoutProject,
    lastParent: checkoutEpic,
    recentParents: [checkoutEpic],
    ...options.preferences,
  })
  bridge.handle('settings.get', async () => ({ prefillLastParent: options.prefillLastParent ?? false }))
  bridge.handle('upload.start', async ({ name }) => ({ assetUrl: `https://uploads.linear.app/acme/f1/${name}` }))
  const createInputs: unknown[] = []
  respondToGraphQL(bridge, {
    CreateIssue: (variables) => {
      createInputs.push(variables.input)
      return { issueCreate: { success: true, issue: createdIssue } }
    },
  })
  const app = new AppController(bridge)
  await app.start()
  return { app, bridge, createInputs }
}

describe('AppController', () => {
  let appToDispose: AppController | null = null
  afterEach(() => appToDispose?.dispose())

  describe('opening the panel', () => {
    it('first start without a saved draft -> fresh draft in the remembered team and project', async () => {
      const { app } = await startedApp()
      appToDispose = app

      expect(app.lifecycle).toBe('ready')
      expect(app.draft.fields.teamId).toBe(ids.engineering)
      expect(app.draft.fields.projectId).toBe(ids.checkoutProject)
      expect(app.draft.fields.parent).toBeNull()
    })

    it('normal hotkey -> last parent only suggested, accepted with ⌘P', async () => {
      const { app, bridge } = await startedApp()
      appToDispose = app

      bridge.emit('panel.shown', { mode: 'newIssue' })
      expect(app.draft.fields.parent).toBeNull()
      expect(app.parentSuggestion?.identifier).toBe('ENG-101')

      app.runShortcut({ kind: 'acceptParentSuggestion' })
      expect(app.draft.fields.parent?.identifier).toBe('ENG-101')
      expect(app.parentSuggestion).toBeNull()
    })

    it('sub-issue hotkey -> last parent applied, moving team and project to the parent', async () => {
      const { app, bridge } = await startedApp({ preferences: { lastParent: brandRefresh } })
      appToDispose = app

      bridge.emit('panel.shown', { mode: 'subIssueOfLastParent' })

      expect(app.draft.fields.parent?.identifier).toBe('DES-7')
      expect(app.draft.fields.teamId).toBe(ids.design)
      expect(app.draft.fields.projectId).toBe(ids.rebrandProject)
    })

    it('pre-fill setting on and draft empty -> last parent applied on open', async () => {
      const { app, bridge } = await startedApp({ prefillLastParent: true })
      appToDispose = app

      bridge.emit('panel.shown', { mode: 'newIssue' })

      expect(app.draft.fields.parent?.identifier).toBe('ENG-101')
    })

    it('pre-fill setting on but the user already started typing -> parent left alone', async () => {
      const { app, bridge } = await startedApp({ prefillLastParent: true })
      appToDispose = app
      app.draft.setTitle('Apple Pay sheet never closes')

      bridge.emit('panel.shown', { mode: 'newIssue' })

      expect(app.draft.fields.parent).toBeNull()
    })

    it('setting changed in the menu bar app -> applies to the next open', async () => {
      const { app, bridge } = await startedApp()
      appToDispose = app

      bridge.emit('settings.changed', { prefillLastParent: true })
      bridge.emit('panel.shown', { mode: 'newIssue' })

      expect(app.draft.fields.parent?.identifier).toBe('ENG-101')
    })
  })

  describe('submitting', () => {
    it('⌘↩ -> issue created, link handed to the native side, panel hidden, draft reset to sticky fields', async () => {
      const { app, bridge, createInputs } = await startedApp()
      appToDispose = app
      app.draft.setParent(brandRefresh)
      app.draft.setTitle('Card form loses focus')
      app.draft.setPriority(1)

      await app.submit({ createAnother: false })

      expect(createInputs).toHaveLength(1)
      expect(bridge.callsTo('issue.created')).toEqual([{ identifier: 'ENG-150', title: 'Card form loses focus', url: 'https://linear.app/acme/issue/ENG-150' }])
      expect(bridge.callsTo('panel.hide')).toHaveLength(1)
      expect(app.draft.fields).toMatchObject({ teamId: ids.design, projectId: ids.rebrandProject, title: '', priority: 0, parent: null })
      expect(app.preferences.preferences.lastParent?.identifier).toBe('DES-7')
      expect(app.preferences.preferences.recentParents.map((parent) => parent.identifier)).toEqual(['DES-7', 'ENG-101'])
    })

    it('⌥⌘↩ -> issue created, panel stays open with the same parent for the next one', async () => {
      const { app, bridge } = await startedApp()
      appToDispose = app
      app.draft.setParent(checkoutEpic)
      app.draft.setTitle('Card form loses focus')

      await app.submit({ createAnother: true })

      expect(bridge.callsTo('panel.hide')).toEqual([])
      expect(app.draft.fields.parent?.identifier).toBe('ENG-101')
      expect(app.draft.fields.title).toBe('')
    })

    it('Linear rejects the request -> panel stays open and the draft is kept', async () => {
      const { app, bridge } = await startedApp()
      appToDispose = app
      bridge.handle('graphql', async () => ({ status: 500, body: JSON.stringify({ errors: [{ message: 'Internal server error' }] }) }))
      app.draft.setTitle('Card form loses focus')

      await app.submit({ createAnother: false })

      expect(bridge.callsTo('panel.hide')).toEqual([])
      expect(app.draft.fields.title).toBe('Card form loses focus')
      expect(app.submitter.state).toEqual({ kind: 'failed', message: 'Internal server error' })
    })
  })

  describe('attachments', () => {
    it('files dropped outside the description -> added to the tray and uploaded', async () => {
      const { app, bridge } = await startedApp()
      appToDispose = app

      bridge.emit('files.dropped', { files: [screenshotFile()], rejected: [], x: 5, y: 5 })
      await flushPromises()

      const [attachmentId] = app.draft.fields.trayAttachmentIds
      expect(attachmentId).toBeDefined()
      expect(app.attachments.assetUrl(attachmentId ?? '')).toBe('https://uploads.linear.app/acme/f1/Screenshot 2026-10-02 at 14.31.07.png')
    })

    it('unsupported files in the drop -> skipped with a notice naming them', async () => {
      const { app, bridge } = await startedApp()
      appToDispose = app

      bridge.emit('files.dropped', { files: [], rejected: ['invoice.pdf', 'notes.txt'], x: 5, y: 5 })

      expect(app.notice?.message).toBe('Skipped invoice.pdf and notes.txt: only images and videos can be attached')
    })

    it('screenshot taken while typing the title -> goes to the tray', async () => {
      const { app, bridge } = await startedApp()
      appToDispose = app
      bridge.handle('screenshot.capture', async () => ({ file: screenshotFile(), needsPermission: false }))

      app.setLastFocusedField('title')
      await app.captureScreenshot()

      expect(app.draft.fields.trayAttachmentIds).toHaveLength(1)
    })

    it('screenshot cancelled -> nothing added', async () => {
      const { app, bridge } = await startedApp()
      appToDispose = app
      bridge.handle('screenshot.capture', async () => ({ file: null, needsPermission: false }))

      await app.captureScreenshot()

      expect(app.attachments.attachments.size).toBe(0)
      expect(app.notice).toBeNull()
    })

    it('no Screen Recording permission -> nothing added, a lasting notice explains the restart', async () => {
      const { app, bridge } = await startedApp()
      appToDispose = app
      bridge.handle('screenshot.capture', async () => ({ file: null, needsPermission: true }))

      await app.captureScreenshot()

      expect(app.attachments.attachments.size).toBe(0)
      expect(app.notice?.kind).toBe('screenRecordingNeeded')
      expect(app.notice?.message).toContain('quit and reopen')
    })

    it('Open Settings on that notice -> native side opens Screen Recording settings, notice cleared', async () => {
      const { app, bridge } = await startedApp()
      appToDispose = app
      bridge.handle('screenshot.capture', async () => ({ file: null, needsPermission: true }))
      await app.captureScreenshot()

      app.openScreenRecordingSettings()

      expect(bridge.callsTo('screenRecording.openSettings')).toHaveLength(1)
      expect(app.notice).toBeNull()
    })
  })

  describe('draft persistence', () => {
    it('draft edited -> saved shortly after, and restored by the next start', async () => {
      const { app, bridge } = await startedApp()
      app.draft.setTitle('Apple Pay sheet never closes')
      app.draft.toggleLabel(ids.bugLabel)

      await vi.waitFor(() => expect(bridge.storage.get('draft')).toContain('Apple Pay sheet never closes'))
      app.dispose()

      const restarted = new AppController(bridge)
      appToDispose = restarted
      await restarted.start()

      expect(restarted.draft.fields.title).toBe('Apple Pay sheet never closes')
      expect(restarted.draft.fields.labelIds).toEqual([ids.bugLabel])
    })

    it('⌘⇧⌫ -> draft cleared back to the sticky team and project', async () => {
      const { app } = await startedApp()
      appToDispose = app
      app.draft.setTitle('Apple Pay sheet never closes')
      app.draft.setPriority(2)

      app.runShortcut({ kind: 'clearDraft' })

      expect(app.draft.fields).toMatchObject({ title: '', priority: 0, teamId: ids.engineering, projectId: ids.checkoutProject })
    })
  })
})
