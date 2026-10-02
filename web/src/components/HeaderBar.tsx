import { observer } from 'mobx-react-lite'
import { strings } from '../i18n/strings'
import { isStateType, type ParentIssue } from '../linear/model'
import type { AppController } from '../state/AppController'
import { pickerShortcutLabel } from '../state/shortcuts'
import { ChevronRightIcon, CloseIcon, ParentIcon, StatusIcon, TeamIcon } from './Icons'
import { Chip, Picker, type PickerItem } from './Picker'

type HeaderBarProps = { app: AppController; onPickerClosed: () => void }

export const HeaderBar = observer(function HeaderBar({ app, onPickerClosed }: HeaderBarProps) {
  const isSubIssue = app.draft.fields.parent != null
  return (
    <div className="flex h-12 items-center gap-1.5 pl-3 pr-2.5 pt-1" data-drag-area>
      <TeamPicker app={app} onPickerClosed={onPickerClosed} />
      <ChevronRightIcon className="shrink-0 text-[var(--color-text-faint)]" />
      <ParentPicker app={app} onPickerClosed={onPickerClosed} />
      <span className="shrink-0 text-[14px] text-[var(--color-text)]">{isSubIssue ? strings.header.newSubIssue : strings.header.newIssue}</span>
      <ParentSuggestion app={app} />
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => app.hide()}
        title={`${strings.header.close} (Esc)`}
        aria-label={strings.header.close}
        className="flex size-8 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-chip-hover)] hover:text-[var(--color-text)] [&_svg]:size-4"
        data-testid="close-panel"
      >
        <CloseIcon />
      </button>
    </div>
  )
})

const TeamPicker = observer(function TeamPicker({ app, onPickerClosed }: HeaderBarProps) {
  const { draft, referenceData } = app
  const current = referenceData.team(draft.fields.teamId)
  const items: PickerItem[] = referenceData.teams.map((team) => ({
    id: team.id,
    label: team.name,
    hint: team.key,
    keywords: [team.key],
    icon: <TeamIcon color={team.color ?? '#8a8f98'} />,
  }))

  return (
    <Picker
      open={app.openPicker === 'team'}
      onOpenChange={(open) => app.setOpenPicker(open ? 'team' : null)}
      onClosed={onPickerClosed}
      testId="picker-team"
      trigger={
        <Chip
          icon={<TeamIcon color={current?.color ?? '#8a8f98'} />}
          label={current?.key ?? strings.fields.team}
          shortcut={pickerShortcutLabel('team')}
        />
      }
      placeholder={strings.pickers.searchPlaceholder(strings.fields.team)}
      items={items}
      selectedIds={current ? [current.id] : []}
      onSelect={(teamId) => draft.setTeam(teamId)}
    />
  )
})

const ParentPicker = observer(function ParentPicker({ app, onPickerClosed }: HeaderBarProps) {
  const { draft, parentSearch, preferences } = app
  const parent = draft.fields.parent
  const hasQuery = parentSearch.query.trim() !== ''

  const candidates: ParentIssue[] = hasQuery
    ? parentSearch.results
    : uniqueById([...preferences.preferences.recentParents, ...parentSearch.myOpenIssues])
  const recentIds = new Set(preferences.preferences.recentParents.map((recent) => recent.id))
  const parentGroup = (issue: ParentIssue) => {
    if (hasQuery) return strings.pickers.searchResults
    if (recentIds.has(issue.id)) return strings.pickers.recentParents
    return strings.pickers.myIssues
  }
  const items: PickerItem[] = candidates.map((issue) => ({
    id: issue.id,
    label: issue.title,
    hint: issue.identifier,
    icon: <ParentStateIcon issue={issue} />,
    group: parentGroup(issue),
  }))
  const searchError = parentSearch.searchState.kind === 'failed' ? parentSearch.searchState.message : null

  // Shown as a breadcrumb step when the issue has a parent, and while its picker is open; otherwise it lives under "…".
  const isVisible = parent != null || app.openPicker === 'parent'
  if (!isVisible) return null

  return (
    <div className="group flex min-w-0 items-center gap-1">
      <Picker
        open={app.openPicker === 'parent'}
        onOpenChange={(open) => app.setOpenPicker(open ? 'parent' : null)}
        onClosed={onPickerClosed}
        testId="picker-parent"
        size="wide"
        trigger={
          <Chip
            icon={parent ? <ParentStateIcon issue={parent} /> : <ParentIcon />}
            label={parent ? `${parent.identifier} ${parent.title}` : strings.fields.setParent}
            shortcut={pickerShortcutLabel('parent')}
          />
        }
        placeholder={strings.pickers.parentSearchPlaceholder}
        items={items}
        selectedIds={parent ? [parent.id] : []}
        onSelect={(issueId) => {
          const selected = candidates.find((issue) => issue.id === issueId)
          if (selected) app.selectParent(selected)
        }}
        search={{
          value: parentSearch.query,
          onChange: (query) => parentSearch.setQuery(query),
          isLoading: parentSearch.searchState.kind === 'searching',
          errorMessage: searchError,
        }}
      />
      {parent && (
        <button
          type="button"
          onClick={() => draft.clearParent()}
          title={strings.header.removeParent}
          aria-label={strings.header.removeParent}
          className="hidden rounded-full p-0.5 text-[var(--color-text-faint)] group-hover:block hover:text-[var(--color-text)]"
          data-testid="clear-parent"
        >
          <CloseIcon />
        </button>
      )}
      <ChevronRightIcon className="shrink-0 text-[var(--color-text-faint)]" />
    </div>
  )
})

/** "Sub-issue of ENG-123? ⌘P": the last parent, one keystroke away but never applied silently. */
const ParentSuggestion = observer(function ParentSuggestion({ app }: { app: AppController }) {
  const suggestion = app.parentSuggestion
  if (!suggestion) return null
  return (
    <button
      type="button"
      onClick={() => app.acceptParentSuggestion()}
      title={suggestion.title}
      className="ml-1.5 flex h-7 items-center gap-1.5 rounded-full border border-dashed border-[var(--color-border-strong)] px-2.5 text-[12px] text-[var(--color-text-muted)] hover:bg-[var(--color-chip-hover)] hover:text-[var(--color-text)]"
      data-testid="parent-suggestion"
    >
      {strings.header.suggestParent(suggestion.identifier)}
      <kbd className="font-sans text-[11px] text-[var(--color-text-faint)]">⌘P</kbd>
    </button>
  )
})

function ParentStateIcon({ issue }: { issue: ParentIssue }) {
  const state = issue.state
  if (!state || !isStateType(state.type)) return <ParentIcon />
  return <StatusIcon type={state.type} color={state.color} />
}

function uniqueById(issues: ParentIssue[]): ParentIssue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    if (seen.has(issue.id)) return false
    seen.add(issue.id)
    return true
  })
}
