import type { JSONContent } from '@tiptap/core'
import { makeAutoObservable } from 'mobx'
import { estimateOptionsFor, type ParentIssue, type Priority } from '../linear/model'
import type { Preferences } from './PreferencesController'
import type { ReferenceDataController } from './ReferenceDataController'

export type DraftFields = {
  teamId: string | null
  title: string
  /** Tiptap document; media nodes point at attachments by id. */
  description: JSONContent | null
  stateId: string | null
  priority: Priority
  assigneeId: string | null
  projectId: string | null
  estimate: number | null
  labelIds: string[]
  cycleId: string | null
  /** yyyy-mm-dd, Linear's TimelessDate. */
  dueDate: string | null
  parent: ParentIssue | null
  /** Attachments dropped outside the description; appended to it on submit. */
  trayAttachmentIds: string[]
}

const BLANK_FIELDS: DraftFields = {
  teamId: null,
  title: '',
  description: null,
  stateId: null,
  priority: 0,
  assigneeId: null,
  projectId: null,
  estimate: null,
  labelIds: [],
  cycleId: null,
  dueDate: null,
  parent: null,
  trayAttachmentIds: [],
}

/**
 * The issue being written, plus the rules that keep its fields consistent with each other:
 * every field must be valid for the selected team, and team-specific defaults follow the team.
 */
export class DraftController {
  fields: DraftFields = BLANK_FIELDS

  private readonly _referenceData: ReferenceDataController

  constructor(referenceData: ReferenceDataController) {
    this._referenceData = referenceData
    makeAutoObservable<this, '_referenceData'>(this, { _referenceData: false })
  }

  /** True when there's nothing the user typed or attached; picked fields alone don't count as work to keep. */
  get hasContent(): boolean {
    const hasDescription = descriptionHasContent(this.fields.description)
    return this.fields.title.trim() !== '' || hasDescription || this.fields.trayAttachmentIds.length > 0
  }

  restore(fields: DraftFields): void {
    this.fields = fields
  }

  /** Starts a fresh draft in the sticky team and project from the last created issue. */
  startFresh(preferences: Preferences): void {
    this.fields = { ...BLANK_FIELDS }
    const lastTeam = this._referenceData.team(preferences.lastTeamId)
    const teamId = lastTeam?.id ?? this._referenceData.teams[0]?.id ?? null
    if (!teamId) return
    this.setTeam(teamId)
    this.setProject(preferences.lastProjectId)
  }

  /**
   * Fills in team-dependent fields once workspace data is available, and repairs a draft whose
   * team or values disappeared from the workspace since it was saved.
   */
  ensureValidForWorkspace(preferences: Preferences): void {
    if (!this._referenceData.data) return
    const team = this._referenceData.team(this.fields.teamId)
    if (!team) {
      const lastTeam = this._referenceData.team(preferences.lastTeamId)
      const teamId = lastTeam?.id ?? this._referenceData.teams[0]?.id
      if (teamId) this.setTeam(teamId)
      return
    }
    this.applyTeamRules(team.id, { cycle: 'keepUnlessInvalid' })
  }

  setTitle(title: string): void {
    this.fields.title = title
  }

  setDescription(description: JSONContent | null): void {
    this.fields.description = description
  }

  /** Switching team resets team-specific fields to the new team's defaults and drops values the team doesn't have. */
  setTeam(teamId: string): void {
    const isSameTeam = this.fields.teamId === teamId
    this.fields.teamId = teamId
    this.applyTeamRules(teamId, { cycle: isSameTeam ? 'keepUnlessInvalid' : 'useActiveCycle' })
  }

  setStatus(stateId: string): void {
    this.fields.stateId = stateId
  }

  setPriority(priority: Priority): void {
    this.fields.priority = priority
  }

  setAssignee(assigneeId: string | null): void {
    this.fields.assigneeId = assigneeId
  }

  setProject(projectId: string | null): void {
    const teamId = this.fields.teamId
    const isAvailable = projectId != null && teamId != null && this._referenceData.projectsForTeam(teamId).some((project) => project.id === projectId)
    this.fields.projectId = isAvailable ? projectId : null
  }

  setEstimate(estimate: number | null): void {
    this.fields.estimate = estimate
  }

  /** Toggles a label. Label groups allow one label each, so picking a sibling replaces the current one. */
  toggleLabel(labelId: string): void {
    if (this.fields.labelIds.includes(labelId)) {
      this.fields.labelIds = this.fields.labelIds.filter((selectedId) => selectedId !== labelId)
      return
    }
    const label = this._referenceData.label(labelId)
    if (!label || label.isGroup) return
    const siblingsRemoved = this.fields.labelIds.filter((selectedId) => {
      const selected = this._referenceData.label(selectedId)
      const isSameGroup = label.parentId != null && selected?.parentId === label.parentId
      return !isSameGroup
    })
    this.fields.labelIds = [...siblingsRemoved, labelId]
  }

  setCycle(cycleId: string | null): void {
    this.fields.cycleId = cycleId
  }

  setDueDate(dueDate: string | null): void {
    this.fields.dueDate = dueDate
  }

  /** A sub-issue moves to its parent's team and, when the parent has one, its project. */
  setParent(parent: ParentIssue): void {
    this.fields.parent = parent
    if (this._referenceData.team(parent.teamId) && parent.teamId !== this.fields.teamId) {
      this.setTeam(parent.teamId)
    }
    if (parent.projectId) this.setProject(parent.projectId)
  }

  clearParent(): void {
    this.fields.parent = null
  }

  addTrayAttachments(attachmentIds: string[]): void {
    this.fields.trayAttachmentIds = [...this.fields.trayAttachmentIds, ...attachmentIds]
  }

  removeTrayAttachment(attachmentId: string): void {
    this.fields.trayAttachmentIds = this.fields.trayAttachmentIds.filter((trayId) => trayId !== attachmentId)
  }

  /** After creating an issue: keep team and project (and the parent when creating several in a row), reset the rest. */
  resetAfterCreate(options: { keepParent: boolean }): void {
    const { teamId, projectId, parent } = this.fields
    this.fields = { ...BLANK_FIELDS, teamId, parent: options.keepParent ? parent : null }
    if (!teamId) return
    this.applyTeamRules(teamId, { cycle: 'useActiveCycle' })
    this.setProject(projectId)
  }

  /**
   * `cycle`: a new team or a new issue starts in the team's active cycle; re-checking an existing draft
   * keeps whatever cycle the user chose, including none, unless that cycle is gone.
   */
  private applyTeamRules(teamId: string, options: { cycle: 'useActiveCycle' | 'keepUnlessInvalid' }): void {
    const team = this._referenceData.team(teamId)
    if (!team) return

    const teamStates = this._referenceData.statesForTeam(teamId)
    const hasValidState = teamStates.some((state) => state.id === this.fields.stateId)
    if (!hasValidState) this.fields.stateId = team.defaultStateId ?? teamStates[0]?.id ?? null

    const teamLabelIds = new Set(this._referenceData.labelsForTeam(teamId).map((label) => label.id))
    this.fields.labelIds = this.fields.labelIds.filter((labelId) => teamLabelIds.has(labelId))

    const hasValidProject = this._referenceData.projectsForTeam(teamId).some((project) => project.id === this.fields.projectId)
    if (!hasValidProject) this.fields.projectId = null

    const hasValidEstimate = estimateOptionsFor(team).some((option) => option.value === this.fields.estimate)
    if (!hasValidEstimate) this.fields.estimate = null

    const currentCycleId = this.fields.cycleId
    const hasValidCycle = currentCycleId == null || this._referenceData.cyclesForTeam(teamId).some((cycle) => cycle.id === currentCycleId)
    const shouldKeepCycle = options.cycle === 'keepUnlessInvalid' && hasValidCycle
    if (!shouldKeepCycle) this.fields.cycleId = team.cyclesEnabled ? team.activeCycleId : null
  }
}

function descriptionHasContent(description: JSONContent | null): boolean {
  if (!description) return false
  if (description.type === 'text') return (description.text ?? '').trim() !== ''
  if (description.type === 'media') return true
  return (description.content ?? []).some(descriptionHasContent)
}
