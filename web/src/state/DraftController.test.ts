import { beforeEach, describe, expect, it } from 'vitest'
import { FakeNativeBridge } from '../test/FakeNativeBridge'
import { brandRefresh, checkoutEpic, ids, loadedReferenceData } from '../test/fixtures'
import { DraftController } from './DraftController'
import type { Preferences } from './PreferencesController'

const noPreferences: Preferences = { lastTeamId: null, lastProjectId: null, lastParent: null, recentParents: [] }

describe('DraftController', () => {
  let draft: DraftController

  beforeEach(async () => {
    const referenceData = await loadedReferenceData(new FakeNativeBridge())
    draft = new DraftController(referenceData)
  })

  describe('startFresh', () => {
    it('no remembered team -> first team alphabetically, with its default status and active cycle', () => {
      draft.startFresh(noPreferences)

      expect(draft.fields.teamId).toBe(ids.design)
      expect(draft.fields.stateId).toBe(ids.designTodo)
      expect(draft.fields.cycleId).toBeNull()
    })

    it('remembered team and project -> both restored, status and cycle from that team', () => {
      draft.startFresh({ ...noPreferences, lastTeamId: ids.engineering, lastProjectId: ids.checkoutProject })

      expect(draft.fields.teamId).toBe(ids.engineering)
      expect(draft.fields.projectId).toBe(ids.checkoutProject)
      expect(draft.fields.stateId).toBe(ids.engBacklog)
      expect(draft.fields.cycleId).toBe(ids.cycle41)
    })

    it('remembered project not in the remembered team -> project dropped', () => {
      draft.startFresh({ ...noPreferences, lastTeamId: ids.design, lastProjectId: ids.checkoutProject })

      expect(draft.fields.projectId).toBeNull()
    })
  })

  describe('setTeam', () => {
    beforeEach(() => {
      draft.startFresh({ ...noPreferences, lastTeamId: ids.engineering })
      draft.setStatus(ids.engInProgress)
      draft.setProject(ids.rebrandProject)
      draft.setEstimate(5)
      draft.toggleLabel(ids.bugLabel)
      draft.toggleLabel(ids.regressionLabel)
      draft.setAssignee(ids.priya)
    })

    it('switching team -> status reset to the new default, team-only labels and estimate dropped', () => {
      draft.setTeam(ids.design)

      expect(draft.fields.stateId).toBe(ids.designTodo)
      expect(draft.fields.labelIds).toEqual([ids.bugLabel])
      expect(draft.fields.estimate).toBeNull()
      expect(draft.fields.cycleId).toBeNull()
    })

    it('switching team -> shared project and assignee kept', () => {
      draft.setTeam(ids.design)

      expect(draft.fields.projectId).toBe(ids.rebrandProject)
      expect(draft.fields.assigneeId).toBe(ids.priya)
    })

    it('picking the same team again -> chosen values untouched', () => {
      draft.setCycle(ids.cycle42)
      draft.setTeam(ids.engineering)

      expect(draft.fields.stateId).toBe(ids.engInProgress)
      expect(draft.fields.cycleId).toBe(ids.cycle42)
      expect(draft.fields.estimate).toBe(5)
    })
  })

  describe('toggleLabel', () => {
    beforeEach(() => draft.startFresh({ ...noPreferences, lastTeamId: ids.engineering }))

    it('second label from the same group -> replaces the first', () => {
      draft.toggleLabel(ids.bugLabel)
      draft.toggleLabel(ids.featureLabel)

      expect(draft.fields.labelIds).toEqual([ids.featureLabel])
    })

    it('labels outside a group -> combine freely', () => {
      draft.toggleLabel(ids.bugLabel)
      draft.toggleLabel(ids.regressionLabel)

      expect(draft.fields.labelIds).toEqual([ids.bugLabel, ids.regressionLabel])
    })

    it('selected label toggled again -> removed', () => {
      draft.toggleLabel(ids.bugLabel)
      draft.toggleLabel(ids.bugLabel)

      expect(draft.fields.labelIds).toEqual([])
    })

    it('label group itself -> not selectable', () => {
      draft.toggleLabel(ids.typeGroup)

      expect(draft.fields.labelIds).toEqual([])
    })
  })

  describe('setParent', () => {
    it('parent in another team -> team and project follow the parent', () => {
      draft.startFresh({ ...noPreferences, lastTeamId: ids.engineering })

      draft.setParent(brandRefresh)

      expect(draft.fields.parent).toEqual(brandRefresh)
      expect(draft.fields.teamId).toBe(ids.design)
      expect(draft.fields.projectId).toBe(ids.rebrandProject)
      expect(draft.fields.stateId).toBe(ids.designTodo)
    })

    it('parent in the same team -> status and cycle kept', () => {
      draft.startFresh({ ...noPreferences, lastTeamId: ids.engineering })
      draft.setStatus(ids.engTodo)
      draft.setCycle(ids.cycle42)

      draft.setParent(checkoutEpic)

      expect(draft.fields.stateId).toBe(ids.engTodo)
      expect(draft.fields.cycleId).toBe(ids.cycle42)
      expect(draft.fields.projectId).toBe(ids.checkoutProject)
    })
  })

  describe('resetAfterCreate', () => {
    beforeEach(() => {
      draft.startFresh({ ...noPreferences, lastTeamId: ids.engineering })
      draft.setParent(checkoutEpic)
      draft.setTitle('Card form loses focus on 3DS redirect')
      draft.setPriority(2)
      draft.setAssignee(ids.me)
      draft.toggleLabel(ids.bugLabel)
      draft.setEstimate(3)
      draft.setDueDate('2026-10-09')
      draft.setCycle(ids.cycle42)
    })

    it('closing after create -> team and project kept, everything else back to defaults', () => {
      draft.resetAfterCreate({ keepParent: false })

      expect(draft.fields).toMatchObject({
        teamId: ids.engineering,
        projectId: ids.checkoutProject,
        title: '',
        priority: 0,
        assigneeId: null,
        labelIds: [],
        estimate: null,
        dueDate: null,
        parent: null,
        stateId: ids.engBacklog,
        cycleId: ids.cycle41,
      })
    })

    it('create another -> parent kept as well', () => {
      draft.resetAfterCreate({ keepParent: true })

      expect(draft.fields.parent?.identifier).toBe('ENG-101')
      expect(draft.fields.title).toBe('')
    })
  })

  describe('ensureValidForWorkspace', () => {
    it('cycle cleared by the user -> stays cleared when workspace data refreshes', () => {
      draft.startFresh({ ...noPreferences, lastTeamId: ids.engineering })
      draft.setCycle(null)

      draft.ensureValidForWorkspace(noPreferences)

      expect(draft.fields.cycleId).toBeNull()
    })

    it('restored draft whose team no longer exists -> moved to the remembered team', () => {
      draft.restore({ ...draft.fields, teamId: 'deleted-team', title: 'Keep me' })

      draft.ensureValidForWorkspace({ ...noPreferences, lastTeamId: ids.engineering })

      expect(draft.fields.teamId).toBe(ids.engineering)
      expect(draft.fields.title).toBe('Keep me')
    })
  })

  describe('hasContent', () => {
    it('only fields picked -> no content', () => {
      draft.startFresh(noPreferences)
      draft.setPriority(1)

      expect(draft.hasContent).toBe(false)
    })

    it('whitespace-only title -> no content', () => {
      draft.setTitle('   ')

      expect(draft.hasContent).toBe(false)
    })

    it('description with only an image -> has content', () => {
      draft.setDescription({ type: 'doc', content: [{ type: 'media', attrs: { attachmentId: 'a1', kind: 'image', name: 'shot.png' } }] })

      expect(draft.hasContent).toBe(true)
    })
  })
})
