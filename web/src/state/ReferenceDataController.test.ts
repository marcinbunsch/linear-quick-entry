import { describe, expect, it } from 'vitest'
import { LinearClient } from '../linear/LinearClient'
import { FakeNativeBridge } from '../test/FakeNativeBridge'
import { flushPromises, ids, respondToGraphQL, seedReferenceDataCache, workspace } from '../test/fixtures'
import { REFERENCE_DATA_MAX_AGE_MS, ReferenceDataController } from './ReferenceDataController'

const emptyPage = { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } }

function respondWithWorkspace(bridge: FakeNativeBridge, onRequest: () => void = () => {}) {
  const page = <Node,>(nodes: Node[]) => {
    onRequest()
    return { nodes, pageInfo: { hasNextPage: false, endCursor: null } }
  }
  respondToGraphQL(bridge, {
    ViewerAndOrganization: () => ({
      viewer: { id: ids.me, name: 'Marcin Bunsch', displayName: 'marcin', avatarUrl: null },
      organization: workspace.organization,
    }),
    Teams: () => ({
      teams: page([
        {
          id: ids.engineering,
          key: 'ENG',
          name: 'Engineering',
          color: '#5e6ad2',
          icon: null,
          cyclesEnabled: true,
          issueEstimationType: 'fibonacci',
          issueEstimationAllowZero: false,
          issueEstimationExtended: false,
          defaultIssueState: { id: ids.engBacklog },
          activeCycle: { id: ids.cycle41 },
        },
      ]),
    }),
    WorkflowStates: () => ({ workflowStates: page([{ id: ids.engBacklog, name: 'Backlog', type: 'backlog', color: '#bec2c8', position: 0, team: { id: ids.engineering } }]) }),
    IssueLabels: () => ({
      issueLabels: page([
        { id: ids.bugLabel, name: 'Bug', color: '#eb5757', isGroup: false, retiredAt: null, parent: null, team: null },
        { id: 'retired-label', name: 'Old', color: '#999999', isGroup: false, retiredAt: '2026-01-01T00:00:00.000Z', parent: null, team: null },
      ]),
    }),
    Users: () => ({ users: page([{ id: ids.me, name: 'Marcin Bunsch', displayName: 'marcin', avatarUrl: null, isMe: true }]) }),
    Projects: () => ({ projects: emptyPage }),
    Cycles: () => ({ cycles: emptyPage }),
    TeamMemberships: () => ({ teamMemberships: page([{ team: { id: ids.engineering }, user: { id: ids.me } }]) }),
  })
}

describe('ReferenceDataController', () => {
  it('fresh cache -> served without asking Linear', async () => {
    const bridge = new FakeNativeBridge()
    const now = 1_790_000_000_000
    seedReferenceDataCache(bridge, now - 10_000)
    const controller = new ReferenceDataController(bridge, new LinearClient(bridge), () => now)

    await controller.loadFromCache()
    controller.revalidateIfStale()

    expect(controller.teams.map((team) => team.key)).toEqual(['DES', 'ENG'])
    expect(bridge.callsTo('graphql')).toEqual([])
  })

  it('stale cache -> old data shown while fresh data loads, then replaced and saved', async () => {
    const bridge = new FakeNativeBridge()
    const now = 1_790_000_000_000
    seedReferenceDataCache(bridge, now - REFERENCE_DATA_MAX_AGE_MS - 1)
    respondWithWorkspace(bridge)
    const controller = new ReferenceDataController(bridge, new LinearClient(bridge), () => now)
    await controller.loadFromCache()

    controller.revalidateIfStale()
    expect(controller.teams).toHaveLength(2)
    await flushPromises()

    expect(controller.teams.map((team) => team.key)).toEqual(['ENG'])
    expect(controller.data?.labels.map((label) => label.name)).toEqual(['Bug'])
    expect(controller.fetchedAt).toBe(now)
    expect(JSON.parse(bridge.storage.get('reference-data') ?? '{}').value.fetchedAt).toBe(now)
  })

  it('refresh fails -> cached data kept, failure recorded', async () => {
    const bridge = new FakeNativeBridge()
    seedReferenceDataCache(bridge, 0)
    bridge.handle('graphql', async () => ({ status: 503, body: '{}' }))
    const controller = new ReferenceDataController(bridge, new LinearClient(bridge), () => 1_790_000_000_000)
    await controller.loadFromCache()

    await controller.refresh()

    expect(controller.teams).toHaveLength(2)
    expect(controller.refreshState).toEqual({ kind: 'failed', message: 'Linear responded with HTTP 503' })
  })

  it('assignee ordering -> me first, then team members, then everyone else', async () => {
    const bridge = new FakeNativeBridge()
    seedReferenceDataCache(bridge, Date.now())
    const controller = new ReferenceDataController(bridge, new LinearClient(bridge))
    await controller.loadFromCache()

    expect(controller.usersForTeam(ids.engineering).map((user) => user.name)).toEqual(['Marcin Bunsch', 'Priya Raman', 'Tomasz Nowak'])
  })

  it('statuses -> grouped in Linear order, not in the order Linear returned them', async () => {
    const bridge = new FakeNativeBridge()
    seedReferenceDataCache(bridge, Date.now())
    const controller = new ReferenceDataController(bridge, new LinearClient(bridge))
    await controller.loadFromCache()

    expect(controller.statesForTeam(ids.engineering).map((state) => state.name)).toEqual(['Backlog', 'Todo', 'In Progress', 'Done'])
  })
})
