import type { LocalFile } from '../bridge/protocol'
import type { ParentIssue, ReferenceData } from '../linear/model'
import { LinearClient } from '../linear/LinearClient'
import { ReferenceDataController } from '../state/ReferenceDataController'
import type { FakeNativeBridge } from './FakeNativeBridge'

// A small but realistic workspace: an engineering team with Fibonacci estimates and cycles,
// and a design team that uses neither.

export const ids = {
  engineering: 'b1c3a2f0-0000-4000-8000-000000000001',
  design: 'b1c3a2f0-0000-4000-8000-000000000002',
  engBacklog: 'c0ffee00-0000-4000-8000-000000000001',
  engTodo: 'c0ffee00-0000-4000-8000-000000000002',
  engInProgress: 'c0ffee00-0000-4000-8000-000000000003',
  engDone: 'c0ffee00-0000-4000-8000-000000000004',
  designBacklog: 'c0ffee00-0000-4000-8000-000000000011',
  designTodo: 'c0ffee00-0000-4000-8000-000000000012',
  typeGroup: '1abe1000-0000-4000-8000-000000000001',
  bugLabel: '1abe1000-0000-4000-8000-000000000002',
  featureLabel: '1abe1000-0000-4000-8000-000000000003',
  regressionLabel: '1abe1000-0000-4000-8000-000000000004',
  brandLabel: '1abe1000-0000-4000-8000-000000000005',
  me: 'a5e10000-0000-4000-8000-000000000001',
  priya: 'a5e10000-0000-4000-8000-000000000002',
  tomasz: 'a5e10000-0000-4000-8000-000000000003',
  checkoutProject: 'b0b00000-0000-4000-8000-000000000001',
  rebrandProject: 'b0b00000-0000-4000-8000-000000000002',
  cycle41: 'c1c1e000-0000-4000-8000-000000000041',
  cycle42: 'c1c1e000-0000-4000-8000-000000000042',
} as const

export const workspace: ReferenceData = {
  viewer: { id: ids.me, name: 'marcin' },
  organization: { id: 'f0f00000-0000-4000-8000-000000000001', name: 'Acme', urlKey: 'acme' },
  teams: [
    {
      id: ids.engineering,
      key: 'ENG',
      name: 'Engineering',
      color: '#5e6ad2',
      icon: null,
      cyclesEnabled: true,
      estimation: { type: 'fibonacci', allowZero: false, extended: false },
      defaultStateId: ids.engBacklog,
      activeCycleId: ids.cycle41,
    },
    {
      id: ids.design,
      key: 'DES',
      name: 'Design',
      color: '#f2994a',
      icon: null,
      cyclesEnabled: false,
      estimation: { type: 'notUsed', allowZero: false, extended: false },
      defaultStateId: ids.designTodo,
      activeCycleId: null,
    },
  ],
  states: [
    { id: ids.engDone, teamId: ids.engineering, name: 'Done', type: 'completed', color: '#5e6ad2', position: 4 },
    { id: ids.engBacklog, teamId: ids.engineering, name: 'Backlog', type: 'backlog', color: '#bec2c8', position: 0 },
    { id: ids.engInProgress, teamId: ids.engineering, name: 'In Progress', type: 'started', color: '#f2c94c', position: 2 },
    { id: ids.engTodo, teamId: ids.engineering, name: 'Todo', type: 'unstarted', color: '#e2e2e2', position: 1 },
    { id: ids.designBacklog, teamId: ids.design, name: 'Backlog', type: 'backlog', color: '#bec2c8', position: 0 },
    { id: ids.designTodo, teamId: ids.design, name: 'Todo', type: 'unstarted', color: '#e2e2e2', position: 1 },
  ],
  labels: [
    { id: ids.typeGroup, name: 'Type', color: '#95a2b3', isGroup: true, parentId: null, teamId: null },
    { id: ids.bugLabel, name: 'Bug', color: '#eb5757', isGroup: false, parentId: ids.typeGroup, teamId: null },
    { id: ids.featureLabel, name: 'Feature', color: '#bb87fc', isGroup: false, parentId: ids.typeGroup, teamId: null },
    { id: ids.regressionLabel, name: 'Regression', color: '#f2994a', isGroup: false, parentId: null, teamId: ids.engineering },
    { id: ids.brandLabel, name: 'Brand', color: '#4cb782', isGroup: false, parentId: null, teamId: ids.design },
  ],
  users: [
    { id: ids.tomasz, name: 'Tomasz Nowak', displayName: 'tomasz', avatarUrl: null, isMe: false },
    { id: ids.priya, name: 'Priya Raman', displayName: 'priya', avatarUrl: null, isMe: false },
    { id: ids.me, name: 'Marcin Bunsch', displayName: 'marcin', avatarUrl: null, isMe: true },
  ],
  projects: [
    { id: ids.checkoutProject, name: 'Checkout v2', icon: null, color: '#5e6ad2', teamIds: [ids.engineering] },
    { id: ids.rebrandProject, name: 'Rebrand', icon: null, color: '#f2994a', teamIds: [ids.design, ids.engineering] },
  ],
  cycles: [
    { id: ids.cycle42, teamId: ids.engineering, number: 42, name: null, startsAt: '2026-10-13T00:00:00.000Z', endsAt: '2026-10-27T00:00:00.000Z', isActive: false },
    { id: ids.cycle41, teamId: ids.engineering, number: 41, name: null, startsAt: '2026-09-29T00:00:00.000Z', endsAt: '2026-10-13T00:00:00.000Z', isActive: true },
  ],
  teamMemberIds: { [ids.engineering]: [ids.me, ids.priya], [ids.design]: [ids.tomasz] },
}

export const checkoutEpic: ParentIssue = {
  id: 'ba5e0000-0000-4000-8000-000000000101',
  identifier: 'ENG-101',
  title: 'Checkout v2 rollout',
  teamId: ids.engineering,
  projectId: ids.checkoutProject,
  state: { name: 'In Progress', type: 'started', color: '#f2c94c' },
}

export const brandRefresh: ParentIssue = {
  id: 'ba5e0000-0000-4000-8000-000000000201',
  identifier: 'DES-7',
  title: 'Refresh marketing illustrations',
  teamId: ids.design,
  projectId: ids.rebrandProject,
  state: { name: 'Todo', type: 'unstarted', color: '#e2e2e2' },
}

export function screenshotFile(name = 'Screenshot 2026-10-02 at 14.31.07.png'): LocalFile {
  return {
    path: `/Users/marcin/Library/Caches/pl.bunsch.LinearQuickEntry/Captures/${name}`,
    name,
    size: 482_133,
    contentType: 'image/png',
    kind: 'image',
    previewUrl: `lqe://preview/${encodeURIComponent(name)}`,
  }
}

export function screenRecordingFile(): LocalFile {
  return {
    path: '/Users/marcin/Desktop/checkout-bug.mov',
    name: 'checkout-bug.mov',
    size: 18_204_551,
    contentType: 'video/quicktime',
    kind: 'video',
    previewUrl: 'lqe://preview/checkout-bug',
  }
}

/** A reference data controller already holding the workspace, the way it is after reading the disk cache. */
export async function loadedReferenceData(bridge: FakeNativeBridge, now: () => number = () => Date.now()): Promise<ReferenceDataController> {
  seedReferenceDataCache(bridge, now())
  const controller = new ReferenceDataController(bridge, new LinearClient(bridge), now)
  await controller.loadFromCache()
  return controller
}

export function seedReferenceDataCache(bridge: FakeNativeBridge, fetchedAt: number): void {
  bridge.storage.set('reference-data', JSON.stringify({ version: 1, value: { fetchedAt, data: workspace } }))
}

type GraphQLResponder = (variables: Record<string, unknown>) => unknown

/** Answers GraphQL calls by operation name, like Linear would; unknown operations fail loudly. */
export function respondToGraphQL(bridge: FakeNativeBridge, responders: Record<string, GraphQLResponder>): void {
  bridge.handle('graphql', async ({ query, variables }) => {
    const operationName = /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? ''
    const responder = responders[operationName]
    if (!responder) throw new Error(`No GraphQL responder for ${operationName}`)
    return { status: 200, body: JSON.stringify({ data: responder(variables) }) }
  })
}

/**
 * Resolves after every pending promise callback has run: a macrotask only runs once the microtask queue is empty.
 * Under fake timers, use vi.advanceTimersByTimeAsync instead.
 */
export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

/** For tests under fake timers, where flushPromises' setTimeout never fires. */
export async function flushMicrotasks(): Promise<void> {
  // 20 rounds covers the deepest chain here: bridge → client → controller → MobX action.
  for (let round = 0; round < 20; round++) await Promise.resolve()
}
