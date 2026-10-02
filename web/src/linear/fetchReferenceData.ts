import {
  CyclesQuery,
  IssueLabelsQuery,
  ProjectsQuery,
  TeamMembershipsQuery,
  TeamsQuery,
  UsersQuery,
  ViewerAndOrganizationQuery,
  WorkflowStatesQuery,
} from './documents'
import type { LinearClient } from './LinearClient'
import { isEstimationType, isStateType, type ReferenceData, type WorkflowStateRecord } from './model'

/** Loads everything the pickers need, every page of it, and flattens it into plain records. */
export async function fetchReferenceData(client: LinearClient): Promise<ReferenceData> {
  const [viewerAndOrganization, teams, states, labels, users, projects, cycles, memberships] = await Promise.all([
    client.request(ViewerAndOrganizationQuery, {}),
    fetchAllPages(async (after) => (await client.request(TeamsQuery, { after })).teams),
    fetchAllPages(async (after) => (await client.request(WorkflowStatesQuery, { after })).workflowStates),
    fetchAllPages(async (after) => (await client.request(IssueLabelsQuery, { after })).issueLabels),
    fetchAllPages(async (after) => (await client.request(UsersQuery, { after })).users),
    fetchAllPages(async (after) => (await client.request(ProjectsQuery, { after })).projects),
    fetchAllPages(async (after) => (await client.request(CyclesQuery, { after })).cycles),
    fetchAllPages(async (after) => (await client.request(TeamMembershipsQuery, { after })).teamMemberships),
  ])

  const teamMemberIds: Record<string, string[]> = {}
  for (const membership of memberships) {
    const memberIds = teamMemberIds[membership.team.id] ?? []
    memberIds.push(membership.user.id)
    teamMemberIds[membership.team.id] = memberIds
  }

  return {
    viewer: { id: viewerAndOrganization.viewer.id, name: viewerAndOrganization.viewer.name },
    organization: viewerAndOrganization.organization,
    teams: teams.map((team) => ({
      id: team.id,
      key: team.key,
      name: team.name,
      color: team.color ?? null,
      icon: team.icon ?? null,
      cyclesEnabled: team.cyclesEnabled,
      estimation: {
        // Linear may add scales we don't know yet; treating them as unused hides the picker instead of guessing values.
        type: isEstimationType(team.issueEstimationType) ? team.issueEstimationType : 'notUsed',
        allowZero: team.issueEstimationAllowZero,
        extended: team.issueEstimationExtended,
      },
      defaultStateId: team.defaultIssueState?.id ?? null,
      activeCycleId: team.activeCycle?.id ?? null,
    })),
    states: states.flatMap((state): WorkflowStateRecord[] => {
      if (!isStateType(state.type)) return []
      return [{ id: state.id, teamId: state.team.id, name: state.name, type: state.type, color: state.color, position: state.position }]
    }),
    labels: labels
      .filter((label) => label.retiredAt == null)
      .map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color,
        isGroup: label.isGroup,
        parentId: label.parent?.id ?? null,
        teamId: label.team?.id ?? null,
      })),
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      isMe: user.isMe,
    })),
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      icon: project.icon ?? null,
      color: project.color,
      teamIds: project.teams.nodes.map((team) => team.id),
    })),
    cycles: cycles.map((cycle) => ({
      id: cycle.id,
      teamId: cycle.team.id,
      number: cycle.number,
      name: cycle.name ?? null,
      startsAt: cycle.startsAt,
      endsAt: cycle.endsAt,
      isActive: cycle.isActive,
    })),
    teamMemberIds,
  }
}

type Page<Node> = { nodes: Node[]; pageInfo: { hasNextPage: boolean; endCursor?: string | null } }

// 50 pages × 250 nodes is far beyond any workspace we expect; the cap stops a cursor bug from looping forever.
const MAX_PAGES = 50

export async function fetchAllPages<Node>(fetchPage: (after: string | null) => Promise<Page<Node>>): Promise<Node[]> {
  const nodes: Node[] = []
  let after: string | null = null
  for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber++) {
    const page: Page<Node> = await fetchPage(after)
    nodes.push(...page.nodes)
    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) return nodes
    after = page.pageInfo.endCursor
  }
  throw new Error(`Stopped paginating after ${MAX_PAGES} pages`)
}
