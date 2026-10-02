import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LinearClient } from '../linear/LinearClient'
import { FakeNativeBridge } from '../test/FakeNativeBridge'
import { flushMicrotasks, ids, respondToGraphQL } from '../test/fixtures'
import { PARENT_SEARCH_DEBOUNCE_MS, ParentSearchController } from './ParentSearchController'

const checkoutIssue = {
  id: 'ba5e0000-0000-4000-8000-000000000101',
  identifier: 'ENG-101',
  title: 'Checkout v2 rollout',
  team: { id: ids.engineering },
  project: { id: ids.checkoutProject },
  state: { name: 'In Progress', type: 'started', color: '#f2c94c' },
}

const paymentsIssue = {
  id: 'ba5e0000-0000-4000-8000-000000000102',
  identifier: 'ENG-102',
  title: 'Payment retries for declined cards',
  team: { id: ids.engineering },
  project: null,
  state: { name: 'Todo', type: 'unstarted', color: '#e2e2e2' },
}

describe('ParentSearchController', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('typing quickly -> one search after the pause, not one per keystroke', async () => {
    const bridge = new FakeNativeBridge()
    const searchedTerms: unknown[] = []
    respondToGraphQL(bridge, {
      SearchParentIssues: (variables) => {
        searchedTerms.push(variables.term)
        return { searchIssues: { nodes: [checkoutIssue] } }
      },
    })
    const search = new ParentSearchController(new LinearClient(bridge))

    search.setQuery('che')
    search.setQuery('check')
    search.setQuery('checkout')
    expect(search.searchState.kind).toBe('searching')

    await vi.advanceTimersByTimeAsync(PARENT_SEARCH_DEBOUNCE_MS)
    await flushMicrotasks()

    expect(searchedTerms).toEqual(['checkout'])
    expect(search.results.map((issue) => issue.identifier)).toEqual(['ENG-101'])
    expect(search.searchState.kind).toBe('idle')
  })

  it('identifier typed -> exact match listed first, without duplicates', async () => {
    const bridge = new FakeNativeBridge()
    respondToGraphQL(bridge, {
      IssueByIdentifier: () => ({ issue: paymentsIssue }),
      SearchParentIssues: () => ({ searchIssues: { nodes: [checkoutIssue, paymentsIssue] } }),
    })
    const search = new ParentSearchController(new LinearClient(bridge))

    search.setQuery('eng-102')
    await vi.advanceTimersByTimeAsync(PARENT_SEARCH_DEBOUNCE_MS)
    await flushMicrotasks()

    expect(search.results.map((issue) => issue.identifier)).toEqual(['ENG-102', 'ENG-101'])
  })

  it('identifier of a completed issue -> not offered as a parent', async () => {
    const bridge = new FakeNativeBridge()
    respondToGraphQL(bridge, {
      IssueByIdentifier: () => ({ issue: { ...paymentsIssue, state: { name: 'Done', type: 'completed', color: '#5e6ad2' } } }),
      SearchParentIssues: () => ({ searchIssues: { nodes: [] } }),
    })
    const search = new ParentSearchController(new LinearClient(bridge))

    search.setQuery('ENG-102')
    await vi.advanceTimersByTimeAsync(PARENT_SEARCH_DEBOUNCE_MS)
    await flushMicrotasks()

    expect(search.results).toEqual([])
  })

  it('same text searched again -> answered from the cache, sparing the rate limit', async () => {
    const bridge = new FakeNativeBridge()
    let searchCount = 0
    respondToGraphQL(bridge, {
      SearchParentIssues: () => {
        searchCount += 1
        return { searchIssues: { nodes: [checkoutIssue] } }
      },
    })
    const search = new ParentSearchController(new LinearClient(bridge))

    search.setQuery('checkout')
    await vi.advanceTimersByTimeAsync(PARENT_SEARCH_DEBOUNCE_MS)
    await flushMicrotasks()
    search.setQuery('')
    search.setQuery('Checkout')

    expect(searchCount).toBe(1)
    expect(search.results).toHaveLength(1)
  })

  it('Linear rate limits the search -> failure shown in the search state', async () => {
    const bridge = new FakeNativeBridge()
    bridge.handle('graphql', async () => ({
      status: 400,
      body: JSON.stringify({ errors: [{ message: 'Rate limit exceeded', extensions: { code: 'RATELIMITED' } }] }),
    }))
    const search = new ParentSearchController(new LinearClient(bridge))

    search.setQuery('checkout')
    await vi.advanceTimersByTimeAsync(PARENT_SEARCH_DEBOUNCE_MS)
    await flushMicrotasks()

    expect(search.searchState).toEqual({ kind: 'failed', message: 'Linear is rate limiting requests. Wait a moment and try again.' })
  })
})
