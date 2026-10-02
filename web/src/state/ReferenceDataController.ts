import { makeAutoObservable, runInAction } from 'mobx'
import type { NativeBridge } from '../bridge/NativeBridge'
import { logToNative } from '../bridge/logToNative'
import { fetchReferenceData } from '../linear/fetchReferenceData'
import type { LinearClient } from '../linear/LinearClient'
import {
  STATE_TYPES,
  type CycleRecord,
  type LabelRecord,
  type ProjectRecord,
  type ReferenceData,
  type TeamRecord,
  type UserRecord,
  type WorkflowStateRecord,
} from '../linear/model'
import { describeError } from './describeError'
import { PersistentStore } from './PersistentStore'

type CachedReferenceData = { fetchedAt: number; data: ReferenceData }

export type RefreshState = { kind: 'idle' } | { kind: 'refreshing' } | { kind: 'failed'; message: string }

// 60s: opening the panel refreshes in the background at most once a minute, so rapid open/close
// doesn't spend Linear's rate limit while new projects and labels still show up quickly.
export const REFERENCE_DATA_MAX_AGE_MS = 60_000

// Bump when a record shape in linear/model.ts changes, so old caches are ignored instead of misread.
const REFERENCE_DATA_VERSION = 1

/**
 * Teams, statuses, labels, users, projects and cycles. Served from the disk cache instantly,
 * then refreshed from Linear in the background when the cache is older than a minute.
 */
export class ReferenceDataController {
  data: ReferenceData | null = null
  fetchedAt: number | null = null
  refreshState: RefreshState = { kind: 'idle' }

  private readonly _bridge: NativeBridge
  private readonly _client: LinearClient
  private readonly _store: PersistentStore<CachedReferenceData>
  private readonly _now: () => number

  constructor(bridge: NativeBridge, client: LinearClient, now: () => number = Date.now) {
    this._bridge = bridge
    this._client = client
    this._store = new PersistentStore(bridge, 'reference-data', REFERENCE_DATA_VERSION)
    this._now = now
    makeAutoObservable<this, '_bridge' | '_client' | '_store' | '_now'>(this, {
      _bridge: false,
      _client: false,
      _store: false,
      _now: false,
    })
  }

  async loadFromCache(): Promise<void> {
    const cached = await this._store.read()
    if (!cached) return
    runInAction(() => {
      this.data = cached.data
      this.fetchedAt = cached.fetchedAt
    })
  }

  revalidateIfStale(): void {
    const isFresh = this.fetchedAt != null && this._now() - this.fetchedAt < REFERENCE_DATA_MAX_AGE_MS
    if (isFresh) return
    void this.refresh()
  }

  /** Never throws; failures land in `refreshState` and the cached data stays in place. */
  async refresh(): Promise<void> {
    if (this.refreshState.kind === 'refreshing') return
    this.refreshState = { kind: 'refreshing' }
    void logToNative(this._bridge, 'info', 'reference data refresh started')

    try {
      const data = await fetchReferenceData(this._client)
      const fetchedAt = this._now()
      runInAction(() => {
        this.data = data
        this.fetchedAt = fetchedAt
        this.refreshState = { kind: 'idle' }
      })
      void logToNative(this._bridge, 'info', 'reference data refresh finished', { teams: data.teams.length })
      await this._store.write({ fetchedAt, data })
    } catch (error) {
      const message = describeError(error)
      runInAction(() => {
        this.refreshState = { kind: 'failed', message }
      })
      void logToNative(this._bridge, 'warning', 'reference data refresh failed', { error: message })
    }
  }

  /** The API key changed, so the cached workspace may not even be the same one. */
  async resetForNewApiKey(): Promise<void> {
    this.data = null
    this.fetchedAt = null
    this.refreshState = { kind: 'idle' }
    await this.refresh()
  }

  get teams(): TeamRecord[] {
    return [...(this.data?.teams ?? [])].sort((first, second) => first.name.localeCompare(second.name))
  }

  team(teamId: string | null): TeamRecord | null {
    if (!teamId) return null
    return this.data?.teams.find((team) => team.id === teamId) ?? null
  }

  /** Grouped by category in Linear's order (triage → canceled), then by the team's own ordering. */
  statesForTeam(teamId: string): WorkflowStateRecord[] {
    const states = this.data?.states.filter((state) => state.teamId === teamId) ?? []
    return states.sort((first, second) => {
      const categoryDifference = STATE_TYPES.indexOf(first.type) - STATE_TYPES.indexOf(second.type)
      if (categoryDifference !== 0) return categoryDifference
      return first.position - second.position
    })
  }

  state(stateId: string | null): WorkflowStateRecord | null {
    if (!stateId) return null
    return this.data?.states.find((state) => state.id === stateId) ?? null
  }

  /** The team's own labels plus workspace labels; label groups are included so the picker can show them as headings. */
  labelsForTeam(teamId: string): LabelRecord[] {
    const labels = this.data?.labels.filter((label) => label.teamId === null || label.teamId === teamId) ?? []
    return labels.sort((first, second) => first.name.localeCompare(second.name))
  }

  label(labelId: string): LabelRecord | null {
    return this.data?.labels.find((label) => label.id === labelId) ?? null
  }

  projectsForTeam(teamId: string): ProjectRecord[] {
    const projects = this.data?.projects.filter((project) => project.teamIds.includes(teamId)) ?? []
    return projects.sort((first, second) => first.name.localeCompare(second.name))
  }

  project(projectId: string | null): ProjectRecord | null {
    if (!projectId) return null
    return this.data?.projects.find((project) => project.id === projectId) ?? null
  }

  /** The active cycle and upcoming ones, soonest first. */
  cyclesForTeam(teamId: string): CycleRecord[] {
    const cycles = this.data?.cycles.filter((cycle) => cycle.teamId === teamId) ?? []
    return cycles.sort((first, second) => first.startsAt.localeCompare(second.startsAt))
  }

  cycle(cycleId: string | null): CycleRecord | null {
    if (!cycleId) return null
    return this.data?.cycles.find((cycle) => cycle.id === cycleId) ?? null
  }

  /** You first, then the team's members, then everyone else; each group alphabetical. */
  usersForTeam(teamId: string): UserRecord[] {
    const memberIds = new Set(this.data?.teamMemberIds[teamId] ?? [])
    const rank = (user: UserRecord) => {
      if (user.isMe) return 0
      if (memberIds.has(user.id)) return 1
      return 2
    }
    const users = [...(this.data?.users ?? [])]
    return users.sort((first, second) => rank(first) - rank(second) || first.name.localeCompare(second.name))
  }

  user(userId: string | null): UserRecord | null {
    if (!userId) return null
    return this.data?.users.find((user) => user.id === userId) ?? null
  }
}
