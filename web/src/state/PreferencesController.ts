import { makeAutoObservable } from 'mobx'
import type { NativeBridge } from '../bridge/NativeBridge'
import type { ParentIssue } from '../linear/model'
import { PersistentStore } from './PersistentStore'

export type Preferences = {
  lastTeamId: string | null
  lastProjectId: string | null
  lastParent: ParentIssue | null
  /** Most recent first. */
  recentParents: ParentIssue[]
}

// Five recent parents fit in the picker above the search results without pushing them off screen.
const MAX_RECENT_PARENTS = 5

const EMPTY_PREFERENCES: Preferences = { lastTeamId: null, lastProjectId: null, lastParent: null, recentParents: [] }

/** What the panel remembers between issues: the sticky team and project, and the parents you used. */
export class PreferencesController {
  preferences: Preferences = EMPTY_PREFERENCES

  private readonly _store: PersistentStore<Preferences>

  constructor(bridge: NativeBridge) {
    this._store = new PersistentStore(bridge, 'preferences', 1)
    makeAutoObservable<this, '_store'>(this, { _store: false })
  }

  async load(): Promise<void> {
    const stored = await this._store.read()
    this.setPreferences(stored ?? EMPTY_PREFERENCES)
  }

  /** Called after an issue is created so the next one starts from the same context. */
  rememberCreatedIssue(created: { teamId: string; projectId: string | null; parent: ParentIssue | null }): void {
    const parent = created.parent
    const recentParents = parent
      ? [parent, ...this.preferences.recentParents.filter((recent) => recent.id !== parent.id)].slice(0, MAX_RECENT_PARENTS)
      : this.preferences.recentParents

    this.setPreferences({
      lastTeamId: created.teamId,
      lastProjectId: created.projectId,
      lastParent: parent ?? this.preferences.lastParent,
      recentParents,
    })
    void this._store.write(this.preferences)
  }

  private setPreferences(preferences: Preferences): void {
    this.preferences = preferences
  }
}
