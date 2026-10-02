// Plain records the panel works with. They are decoupled from query shapes so the on-disk cache
// survives query changes (bump REFERENCE_DATA_VERSION when a record shape changes).

export type EstimationType = 'notUsed' | 'exponential' | 'fibonacci' | 'linear' | 'tShirt'

export type TeamRecord = {
  id: string
  key: string
  name: string
  color: string | null
  icon: string | null
  cyclesEnabled: boolean
  estimation: { type: EstimationType; allowZero: boolean; extended: boolean }
  defaultStateId: string | null
  activeCycleId: string | null
}

/** Linear's workflow state categories, in the order Linear lists them. */
export const STATE_TYPES = ['triage', 'backlog', 'unstarted', 'started', 'completed', 'canceled'] as const
export type StateType = (typeof STATE_TYPES)[number]

export type WorkflowStateRecord = {
  id: string
  teamId: string
  name: string
  type: StateType
  color: string
  position: number
}

export type LabelRecord = {
  id: string
  name: string
  color: string
  isGroup: boolean
  parentId: string | null
  /** Null for workspace labels, which every team can use. */
  teamId: string | null
}

export type UserRecord = {
  id: string
  /** Full name, e.g. "Marcin Bunsch"; what the panel shows. */
  name: string
  /** Linear handle, e.g. "marcin"; only used for searching. */
  displayName: string
  avatarUrl: string | null
  isMe: boolean
}

export type ProjectRecord = {
  id: string
  name: string
  icon: string | null
  color: string
  teamIds: string[]
}

export type CycleRecord = {
  id: string
  teamId: string
  number: number
  name: string | null
  startsAt: string
  endsAt: string
  isActive: boolean
}

export type ReferenceData = {
  viewer: { id: string; name: string }
  organization: { id: string; name: string; urlKey: string }
  teams: TeamRecord[]
  states: WorkflowStateRecord[]
  labels: LabelRecord[]
  users: UserRecord[]
  projects: ProjectRecord[]
  cycles: CycleRecord[]
  /** teamId → member user ids, used to list a team's members first in the assignee picker. */
  teamMemberIds: Record<string, string[]>
}

/** The bits of a possible parent issue the panel needs to show it and to apply it to the draft. */
export type ParentIssue = {
  id: string
  identifier: string
  title: string
  teamId: string
  projectId: string | null
  state: { name: string; type: string; color: string } | null
}

/** Linear's priority numbers; 0 means no priority. */
export const PRIORITIES = [
  { value: 0, label: 'No priority' },
  { value: 1, label: 'Urgent' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Low' },
] as const
export type Priority = (typeof PRIORITIES)[number]['value']

export type EstimateOption = { value: number; label: string }

// Point scales from Linear's team estimate settings. The extended flag adds the last two values.
const ESTIMATE_SCALES: Record<Exclude<EstimationType, 'notUsed'>, { base: number[]; extended: number[] }> = {
  exponential: { base: [1, 2, 4, 8, 16], extended: [32, 64] },
  fibonacci: { base: [1, 2, 3, 5, 8], extended: [13, 21] },
  linear: { base: [1, 2, 3, 4, 5], extended: [6, 7] },
  tShirt: { base: [1, 2, 3, 5, 8], extended: [13, 21] },
}

const T_SHIRT_LABELS: Record<number, string> = { 0: '-', 1: 'XS', 2: 'S', 3: 'M', 5: 'L', 8: 'XL', 13: 'XXL', 21: 'XXXL' }

/** The estimate values a team accepts, or an empty list when the team doesn't use estimates. */
export function estimateOptionsFor(team: TeamRecord): EstimateOption[] {
  const { type, allowZero, extended } = team.estimation
  if (type === 'notUsed') return []

  const scale = ESTIMATE_SCALES[type]
  const values = [...(allowZero ? [0] : []), ...scale.base, ...(extended ? scale.extended : [])]
  return values.map((value) => ({ value, label: estimateLabel(type, value) }))
}

function estimateLabel(type: EstimationType, value: number): string {
  if (type === 'tShirt') return T_SHIRT_LABELS[value] ?? String(value)
  return value === 1 ? '1 point' : `${value} points`
}

export function isEstimationType(value: string): value is EstimationType {
  return value === 'notUsed' || value === 'exponential' || value === 'fibonacci' || value === 'linear' || value === 'tShirt'
}

export function isStateType(value: string): value is StateType {
  return STATE_TYPES.some((stateType) => stateType === value)
}

/** "Cycle 42" or the cycle's own name when it has one. */
export function cycleLabel(cycle: CycleRecord): string {
  return cycle.name ? cycle.name : `Cycle ${cycle.number}`
}
