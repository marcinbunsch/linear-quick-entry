import * as Popover from '@radix-ui/react-popover'
import { Command } from 'cmdk'
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { strings } from '../i18n/strings'
import { CheckIcon } from './Icons'

export type PickerItem = {
  id: string
  label: string
  icon?: ReactNode
  /** Extra words the filter should match, e.g. a team key or an issue identifier. */
  keywords?: string[]
  /** Items with the same group are listed under one heading, in first-seen order. */
  group?: string
  /** Muted text on the right, e.g. a parent issue's identifier. */
  hint?: string
}

/** When set, the picker shows `items` as-is and leaves searching to the caller (used for parent search). */
export type PickerSearch = {
  value: string
  onChange: (value: string) => void
  isLoading: boolean
  errorMessage: string | null
}

type PickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after the picker closes, instead of Radix moving focus back to the chip. */
  onClosed: () => void
  trigger: ReactNode
  placeholder: string
  items: PickerItem[]
  selectedIds: string[]
  onSelect: (id: string) => void
  /** Multi-select pickers (labels) stay open so several items can be toggled. */
  closeOnSelect?: boolean
  search?: PickerSearch
  /** Wide pickers fit long items like issue titles. */
  size?: 'regular' | 'wide'
  testId: string
}

export function Picker({
  open,
  onOpenChange,
  onClosed,
  trigger,
  placeholder,
  items,
  selectedIds,
  onSelect,
  closeOnSelect = true,
  search,
  size = 'regular',
  testId,
}: PickerProps) {
  const groups = groupItems(items)
  // Wide pickers are capped by the window, so they never overflow the panel on either side.
  const widthClass = size === 'wide' ? 'w-[min(520px,calc(100vw-48px))]' : 'w-64'

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            onClosed()
          }}
          className={`z-50 ${widthClass} overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-[0_12px_32px_-8px_rgb(0_0_0/0.2),0_2px_6px_rgb(0_0_0/0.06)]`}
          data-testid={`${testId}-popover`}
        >
          <Command shouldFilter={search === undefined} loop>
            <Command.Input
              autoFocus
              placeholder={placeholder}
              value={search?.value}
              onValueChange={search?.onChange}
              className="w-full border-b border-[var(--color-border)] bg-transparent px-3.5 py-3 text-[13px] outline-none placeholder:text-[var(--color-text-faint)]"
            />
            <Command.List className="max-h-[min(300px,calc(var(--radix-popover-content-available-height)-48px))] overflow-y-auto p-1">
              {search?.isLoading && (
                <Command.Loading>
                  <PickerNote>{strings.pickers.searching}</PickerNote>
                </Command.Loading>
              )}
              {search?.errorMessage && <PickerNote>{search.errorMessage}</PickerNote>}
              {!search?.isLoading && (
                <Command.Empty>
                  <PickerNote>{strings.pickers.noResults}</PickerNote>
                </Command.Empty>
              )}
              {groups.map(({ heading, items: groupItems }) => (
                <Command.Group
                  key={heading ?? 'ungrouped'}
                  heading={heading}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-[var(--color-text-faint)]"
                >
                  {groupItems.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={`${item.label} ${item.id}`}
                      keywords={item.keywords}
                      onSelect={() => {
                        onSelect(item.id)
                        if (closeOnSelect) onOpenChange(false)
                      }}
                      className="flex h-8 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-[var(--color-text-secondary)]"
                      data-testid={`${testId}-item-${item.id}`}
                    >
                      {item.icon && <span className="flex w-4 shrink-0 justify-center text-[var(--color-icon)]">{item.icon}</span>}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.hint && <span className="shrink-0 text-[12px] text-[var(--color-text-faint)]">{item.hint}</span>}
                      {selectedIds.includes(item.id) && <CheckIcon className="shrink-0 text-[var(--color-text-muted)]" />}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function PickerNote({ children }: { children: ReactNode }) {
  return <div className="px-2 py-2 text-[12px] text-[var(--color-text-muted)]">{children}</div>
}

function groupItems(items: PickerItem[]): Array<{ heading: string | undefined; items: PickerItem[] }> {
  const groups: Array<{ heading: string | undefined; items: PickerItem[] }> = []
  for (const item of items) {
    const existing = groups.find((group) => group.heading === item.group)
    if (existing) existing.items.push(item)
    else groups.push({ heading: item.group, items: [item] })
  }
  return groups
}

type ChipProps = ComponentPropsWithoutRef<'button'> & {
  icon: ReactNode
  label: string
  shortcut?: string
  /** Icon-only chips (Linear's cycle and "…" buttons) keep the label as their tooltip. */
  iconOnly?: boolean
}

/** A field button in the chip row: Linear's white pill. Forwards its ref so Radix can anchor the popover to it. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip({ icon, label, shortcut, iconOnly = false, ...buttonProps }, ref) {
  const shape = iconOnly ? 'w-7 justify-center' : 'max-w-[240px] gap-1.5 pl-2 pr-2.5'
  return (
    <button
      ref={ref}
      type="button"
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={iconOnly ? label : undefined}
      className={`inline-flex h-7 shrink-0 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-chip)] text-[13px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-chip-hover)] data-[state=open]:bg-[var(--color-chip-hover)] ${shape}`}
      {...buttonProps}
    >
      <span className="flex shrink-0 items-center text-[var(--color-icon)]">{icon}</span>
      {!iconOnly && <span className="truncate">{label}</span>}
    </button>
  )
})
