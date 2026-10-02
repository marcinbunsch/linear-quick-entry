import { makeAutoObservable, runInAction } from 'mobx'
import { IssueByIdentifierQuery, MyOpenIssuesQuery, SearchParentIssuesQuery } from '../linear/documents'
import type { LinearClient } from '../linear/LinearClient'
import type { ParentIssue } from '../linear/model'
import { describeError } from './describeError'

export type SearchState = { kind: 'idle' } | { kind: 'searching' } | { kind: 'failed'; message: string }

// 250ms: Linear allows 30 searchIssues calls a minute, so we wait for a pause in typing
// instead of searching on every keystroke.
export const PARENT_SEARCH_DEBOUNCE_MS = 250

// Search is limited to open issues; the same rule applies to exact identifier matches.
const CLOSED_STATE_TYPES = ['completed', 'canceled']

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9]*-\d+$/i

type IssueNode = {
  id: string
  identifier: string
  title: string
  team: { id: string }
  project?: { id: string } | null
  state: { name: string; type: string; color: string }
}

/**
 * Finds possible parent issues. With no search text it suggests recently used parents and your own
 * open issues; with text it asks Linear, matching an exact identifier like "ENG-12" first.
 */
export class ParentSearchController {
  query = ''
  results: ParentIssue[] = []
  myOpenIssues: ParentIssue[] = []
  searchState: SearchState = { kind: 'idle' }

  private readonly _client: LinearClient
  private readonly _cachedResults = new Map<string, ParentIssue[]>()
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null
  /** Increments on every new search so late responses for older text are ignored. */
  private _searchGeneration = 0

  constructor(client: LinearClient) {
    this._client = client
    makeAutoObservable<this, '_client' | '_cachedResults' | '_debounceTimer' | '_searchGeneration'>(this, {
      _client: false,
      _cachedResults: false,
      _debounceTimer: false,
      _searchGeneration: false,
    })
  }

  dispose(): void {
    this.cancelPendingSearch()
  }

  /** Called when the parent picker opens. Never throws; suggestions are a nicety. */
  async loadSuggestions(): Promise<void> {
    try {
      const response = await this._client.request(MyOpenIssuesQuery, {})
      runInAction(() => {
        this.myOpenIssues = response.viewer.assignedIssues.nodes.map(toParentIssue)
      })
    } catch {
      // The picker still works without suggestions, and typing searches anyway.
    }
  }

  setQuery(query: string): void {
    this.query = query
    this.cancelPendingSearch()
    const term = query.trim()
    if (term === '') {
      this.results = []
      this.searchState = { kind: 'idle' }
      return
    }

    const cached = this._cachedResults.get(term.toLowerCase())
    if (cached) {
      this.results = cached
      this.searchState = { kind: 'idle' }
      return
    }

    this.searchState = { kind: 'searching' }
    this._debounceTimer = setTimeout(() => {
      void this.search(term)
    }, PARENT_SEARCH_DEBOUNCE_MS)
  }

  reset(): void {
    this.cancelPendingSearch()
    this.query = ''
    this.results = []
    this.searchState = { kind: 'idle' }
  }

  private async search(term: string): Promise<void> {
    this._searchGeneration += 1
    const generation = this._searchGeneration

    try {
      const isIdentifier = IDENTIFIER_PATTERN.test(term)
      const [exactMatch, searchMatches] = await Promise.all([
        isIdentifier ? this.fetchByIdentifier(term) : Promise.resolve(null),
        this._client.request(SearchParentIssuesQuery, { term }),
      ])
      const matches = searchMatches.searchIssues.nodes.map(toParentIssue)
      const results = exactMatch ? [exactMatch, ...matches.filter((match) => match.id !== exactMatch.id)] : matches

      if (generation !== this._searchGeneration) return
      this._cachedResults.set(term.toLowerCase(), results)
      runInAction(() => {
        this.results = results
        this.searchState = { kind: 'idle' }
      })
    } catch (error) {
      if (generation !== this._searchGeneration) return
      runInAction(() => {
        this.searchState = { kind: 'failed', message: describeError(error) }
      })
    }
  }

  /** Linear's `issue(id:)` accepts identifiers; an unknown one is an error, which here just means "no exact match". */
  private async fetchByIdentifier(identifier: string): Promise<ParentIssue | null> {
    try {
      const response = await this._client.request(IssueByIdentifierQuery, { id: identifier.toUpperCase() })
      const isClosed = CLOSED_STATE_TYPES.includes(response.issue.state.type)
      if (isClosed) return null
      return toParentIssue(response.issue)
    } catch {
      return null
    }
  }

  private cancelPendingSearch(): void {
    if (this._debounceTimer) clearTimeout(this._debounceTimer)
    this._debounceTimer = null
    this._searchGeneration += 1
  }
}

function toParentIssue(issue: IssueNode): ParentIssue {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    teamId: issue.team.id,
    projectId: issue.project?.id ?? null,
    state: { name: issue.state.name, type: issue.state.type, color: issue.state.color },
  }
}
