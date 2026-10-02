import { observer } from 'mobx-react-lite'
import { useState } from 'react'
import { strings } from '../i18n/strings'
import { cycleLabel, estimateOptionsFor, PRIORITIES, type Priority } from '../linear/model'
import type { AppController } from '../state/AppController'
import { dueDatePresets, formatDueDate, parseDueDate } from '../state/dueDate'
import { pickerShortcutLabel, type PickerName } from '../state/shortcuts'
import {
  Avatar,
  CalendarIcon,
  ColorDot,
  CycleIcon,
  EstimateIcon,
  MoreIcon,
  ParentIcon,
  PersonIcon,
  PriorityIcon,
  ProjectIcon,
  StatusIcon,
  TagIcon,
} from './Icons'
import { Chip, Picker, type PickerItem } from './Picker'

/** Item id for "no value" entries such as "No assignee". Linear ids are UUIDs, so this can't collide. */
const NONE_ID = 'none'

type FieldProps = { app: AppController; onPickerClosed: () => void }

export const FieldChips = observer(function FieldChips(props: FieldProps) {
  const team = props.app.referenceData.team(props.app.draft.fields.teamId)
  if (!team) return null
  const usesEstimates = estimateOptionsFor(team).length > 0

  // Like Linear, less-used fields stay behind "…" until they have a value or their picker is open.
  const { fields } = props.app.draft
  const showsDueDate = fields.dueDate != null || props.app.openPicker === 'dueDate'

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="field-chips">
      <StatusChip {...props} />
      <PriorityChip {...props} />
      <AssigneeChip {...props} />
      <ProjectChip {...props} />
      {usesEstimates && <EstimateChip {...props} />}
      <LabelsChip {...props} />
      {team.cyclesEnabled && <CycleChip {...props} />}
      {showsDueDate && <DueDateChip {...props} />}
      <MoreMenu {...props} />
    </div>
  )
})

/** Shared wiring: the picker is open when the app says so, and closing it hands focus back to the form. */
function pickerState(app: AppController, picker: PickerName, onPickerClosed: () => void) {
  return {
    open: app.openPicker === picker,
    onOpenChange: (open: boolean) => app.setOpenPicker(open ? picker : null),
    onClosed: onPickerClosed,
    testId: `picker-${picker}`,
  }
}

const StatusChip = observer(function StatusChip({ app, onPickerClosed }: FieldProps) {
  const { draft, referenceData } = app
  const teamId = draft.fields.teamId
  if (!teamId) return null
  const current = referenceData.state(draft.fields.stateId)
  const items: PickerItem[] = referenceData.statesForTeam(teamId).map((state) => ({
    id: state.id,
    label: state.name,
    icon: <StatusIcon type={state.type} color={state.color} />,
  }))

  return (
    <Picker
      {...pickerState(app, 'status', onPickerClosed)}
      trigger={
        <Chip
          icon={current ? <StatusIcon type={current.type} color={current.color} /> : <StatusIcon type="backlog" color="currentColor" />}
          label={current?.name ?? strings.fields.status}
          shortcut={pickerShortcutLabel('status')}
        />
      }
      placeholder={strings.pickers.searchPlaceholder(strings.fields.status)}
      items={items}
      selectedIds={current ? [current.id] : []}
      onSelect={(stateId) => draft.setStatus(stateId)}
    />
  )
})

const PriorityChip = observer(function PriorityChip({ app, onPickerClosed }: FieldProps) {
  const { draft } = app
  const current = PRIORITIES.find((priority) => priority.value === draft.fields.priority) ?? PRIORITIES[0]
  const items: PickerItem[] = PRIORITIES.map((priority) => ({
    id: String(priority.value),
    label: priority.label,
    icon: <PriorityIcon priority={priority.value} />,
  }))

  return (
    <Picker
      {...pickerState(app, 'priority', onPickerClosed)}
      trigger={
        <Chip
          icon={<PriorityIcon priority={current.value} />}
          label={current.value === 0 ? strings.fields.priority : current.label}
          shortcut={pickerShortcutLabel('priority')}
        />
      }
      placeholder={strings.pickers.searchPlaceholder(strings.fields.priority)}
      items={items}
      selectedIds={[String(current.value)]}
      onSelect={(id) => {
        const priority = PRIORITIES.find((option) => String(option.value) === id)
        if (priority) draft.setPriority(priority.value satisfies Priority)
      }}
    />
  )
})

const AssigneeChip = observer(function AssigneeChip({ app, onPickerClosed }: FieldProps) {
  const { draft, referenceData } = app
  const teamId = draft.fields.teamId
  if (!teamId) return null
  const current = referenceData.user(draft.fields.assigneeId)
  const items: PickerItem[] = [
    { id: NONE_ID, label: strings.fields.unassigned, icon: <PersonIcon /> },
    ...referenceData.usersForTeam(teamId).map((user) => ({
      id: user.id,
      label: user.name,
      // The Linear handle stays searchable, so typing "marcin" still finds Marcin Bunsch.
      keywords: [user.displayName],
      hint: user.isMe ? strings.fields.you : undefined,
      icon: <Avatar name={user.name} avatarUrl={user.avatarUrl} />,
    })),
  ]

  return (
    <Picker
      {...pickerState(app, 'assignee', onPickerClosed)}
      trigger={
        <Chip
          icon={current ? <Avatar name={current.name} avatarUrl={current.avatarUrl} /> : <PersonIcon />}
          label={current?.name ?? strings.fields.assignee}
          shortcut={pickerShortcutLabel('assignee')}
        />
      }
      placeholder={strings.pickers.searchPlaceholder(strings.fields.assignee)}
      items={items}
      selectedIds={[current?.id ?? NONE_ID]}
      onSelect={(userId) => draft.setAssignee(userId === NONE_ID ? null : userId)}
    />
  )
})

const ProjectChip = observer(function ProjectChip({ app, onPickerClosed }: FieldProps) {
  const { draft, referenceData } = app
  const teamId = draft.fields.teamId
  if (!teamId) return null
  const current = referenceData.project(draft.fields.projectId)
  const items: PickerItem[] = [
    { id: NONE_ID, label: strings.fields.noProject, icon: <ProjectIcon /> },
    ...referenceData.projectsForTeam(teamId).map((project) => ({
      id: project.id,
      label: project.name,
      icon: <ColorDot color={project.color} />,
    })),
  ]

  return (
    <Picker
      {...pickerState(app, 'project', onPickerClosed)}
      trigger={
        <Chip
          icon={current ? <ColorDot color={current.color} /> : <ProjectIcon />}
          label={current?.name ?? strings.fields.project}
          shortcut={pickerShortcutLabel('project')}
        />
      }
      placeholder={strings.pickers.searchPlaceholder(strings.fields.project)}
      items={items}
      selectedIds={[current?.id ?? NONE_ID]}
      onSelect={(projectId) => draft.setProject(projectId === NONE_ID ? null : projectId)}
    />
  )
})

const EstimateChip = observer(function EstimateChip({ app, onPickerClosed }: FieldProps) {
  const { draft, referenceData } = app
  const team = referenceData.team(draft.fields.teamId)
  if (!team) return null
  const options = estimateOptionsFor(team)
  const current = options.find((option) => option.value === draft.fields.estimate) ?? null
  const items: PickerItem[] = [
    { id: NONE_ID, label: strings.fields.noEstimate, icon: <EstimateIcon /> },
    ...options.map((option) => ({ id: String(option.value), label: option.label, icon: <EstimateIcon /> })),
  ]

  return (
    <Picker
      {...pickerState(app, 'estimate', onPickerClosed)}
      trigger={
        <Chip
          icon={<EstimateIcon />}
          label={current?.label ?? strings.fields.estimate}
          shortcut={pickerShortcutLabel('estimate')}
        />
      }
      placeholder={strings.pickers.searchPlaceholder(strings.fields.estimate)}
      items={items}
      selectedIds={[current ? String(current.value) : NONE_ID]}
      onSelect={(id) => draft.setEstimate(id === NONE_ID ? null : Number(id))}
    />
  )
})

const LabelsChip = observer(function LabelsChip({ app, onPickerClosed }: FieldProps) {
  const { draft, referenceData } = app
  const teamId = draft.fields.teamId
  if (!teamId) return null
  const teamLabels = referenceData.labelsForTeam(teamId)
  const groupNames = new Map(teamLabels.filter((label) => label.isGroup).map((label) => [label.id, label.name]))
  // Group headings aren't selectable; their children are listed under the group's name.
  const items: PickerItem[] = teamLabels
    .filter((label) => !label.isGroup)
    .map((label) => ({
      id: label.id,
      label: label.name,
      icon: <ColorDot color={label.color} />,
      group: label.parentId ? groupNames.get(label.parentId) : undefined,
    }))
    .sort((first, second) => (first.group ?? '').localeCompare(second.group ?? ''))
  const selected = draft.fields.labelIds.flatMap((labelId) => referenceData.label(labelId) ?? [])
  const firstSelected = selected[0]

  return (
    <Picker
      {...pickerState(app, 'labels', onPickerClosed)}
      trigger={
        <Chip
          icon={firstSelected ? <ColorDot color={firstSelected.color} /> : <TagIcon />}
          label={selected.length === 0 ? strings.fields.labels : selected.map((label) => label.name).join(', ')}
          shortcut={pickerShortcutLabel('labels')}
        />
      }
      placeholder={strings.pickers.searchPlaceholder(strings.fields.labels)}
      items={items}
      selectedIds={draft.fields.labelIds}
      onSelect={(labelId) => draft.toggleLabel(labelId)}
      closeOnSelect={false}
    />
  )
})

const CycleChip = observer(function CycleChip({ app, onPickerClosed }: FieldProps) {
  const { draft, referenceData } = app
  const teamId = draft.fields.teamId
  if (!teamId) return null
  const current = referenceData.cycle(draft.fields.cycleId)
  const items: PickerItem[] = [
    { id: NONE_ID, label: strings.fields.noCycle, icon: <CycleIcon /> },
    ...referenceData.cyclesForTeam(teamId).map((cycle) => ({
      id: cycle.id,
      label: cycleLabel(cycle),
      icon: <CycleIcon />,
      hint: cycle.isActive ? strings.fields.currentCycle : undefined,
    })),
  ]

  return (
    <Picker
      {...pickerState(app, 'cycle', onPickerClosed)}
      trigger={
        <Chip
          icon={<CycleIcon />}
          label={current ? cycleLabel(current) : strings.fields.cycle}
          shortcut={pickerShortcutLabel('cycle')}
          iconOnly={!current}
        />
      }
      placeholder={strings.pickers.searchPlaceholder(strings.fields.cycle)}
      items={items}
      selectedIds={[current?.id ?? NONE_ID]}
      onSelect={(cycleId) => draft.setCycle(cycleId === NONE_ID ? null : cycleId)}
    />
  )
})

const DueDateChip = observer(function DueDateChip({ app, onPickerClosed }: FieldProps) {
  const { draft } = app
  const [query, setQuery] = useState('')
  const now = new Date()
  const parsed = parseDueDate(query, now)
  const presetItems: PickerItem[] = dueDatePresets(now).map((preset) => ({
    id: preset.date,
    label: strings.dueDatePresets[preset.key],
    hint: formatDueDate(preset.date, now),
    icon: <CalendarIcon />,
    group: strings.pickers.dueDatePresets,
  }))
  const parsedItems: PickerItem[] = parsed ? [{ id: parsed, label: formatDueDate(parsed, now), icon: <CalendarIcon /> }] : []
  const clearItem: PickerItem[] = draft.fields.dueDate ? [{ id: NONE_ID, label: strings.fields.noDueDate, icon: <CalendarIcon /> }] : []
  const items = query.trim() === '' ? [...presetItems, ...clearItem] : parsedItems
  const state = pickerState(app, 'dueDate', onPickerClosed)

  return (
    <Picker
      {...state}
      onOpenChange={(open) => {
        setQuery('')
        state.onOpenChange(open)
      }}
      trigger={
        <Chip
          icon={<CalendarIcon />}
          label={draft.fields.dueDate ? formatDueDate(draft.fields.dueDate, now) : strings.fields.dueDate}
          shortcut={pickerShortcutLabel('dueDate')}
        />
      }
      placeholder={strings.pickers.dueDatePlaceholder}
      items={items}
      selectedIds={draft.fields.dueDate ? [draft.fields.dueDate] : []}
      onSelect={(date) => draft.setDueDate(date === NONE_ID ? null : date)}
      search={{ value: query, onChange: setQuery, isLoading: false, errorMessage: null }}
    />
  )
})

/** The "…" button: opens the pickers for fields that have no chip of their own yet. */
const MoreMenu = observer(function MoreMenu({ app, onPickerClosed }: FieldProps) {
  const items: PickerItem[] = [
    { id: 'dueDate', label: strings.fields.dueDate, icon: <CalendarIcon />, hint: pickerShortcutLabel('dueDate') },
    { id: 'parent', label: strings.fields.setParent, icon: <ParentIcon />, hint: pickerShortcutLabel('parent') },
  ]

  return (
    <Picker
      open={app.openPicker === 'more'}
      onOpenChange={(open) => app.setOpenPicker(open ? 'more' : null)}
      onClosed={onPickerClosed}
      testId="picker-more"
      trigger={<Chip icon={<MoreIcon />} label={strings.fields.more} iconOnly />}
      placeholder={strings.pickers.moreFieldsPlaceholder}
      items={items}
      selectedIds={[]}
      // Swapping straight to the chosen field's picker; closing first would hand focus back to the title.
      closeOnSelect={false}
      onSelect={(picker) => {
        if (picker === 'dueDate' || picker === 'parent') app.setOpenPicker(picker)
      }}
    />
  )
})
