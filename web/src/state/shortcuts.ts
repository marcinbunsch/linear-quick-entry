export const PICKER_NAMES = [
  'team',
  'status',
  'priority',
  'assignee',
  'project',
  'estimate',
  'labels',
  'cycle',
  'dueDate',
  'parent',
] as const
export type PickerName = (typeof PICKER_NAMES)[number]
/** Pickers plus the "…" menu that holds the less-used fields. Only one is open at a time. */
export type OpenMenu = PickerName | 'more'

export type Shortcut =
  | { kind: 'submit' }
  | { kind: 'submitAndCreateAnother' }
  | { kind: 'openPicker'; picker: PickerName }
  | { kind: 'acceptParentSuggestion' }
  | { kind: 'clearDraft' }
  | { kind: 'captureScreenshot' }
  | { kind: 'pickFiles' }

/** ⌘⇧ + letter opens a field's picker. Shown next to each chip, so keep in sync with what the chips display. */
export const PICKER_SHORTCUT_KEYS: Record<PickerName, string> = {
  team: 't',
  status: 's',
  priority: 'p',
  assignee: 'a',
  project: 'j',
  estimate: 'e',
  labels: 'l',
  cycle: 'c',
  dueDate: 'd',
  parent: 'i',
}

type KeyEventLike = Pick<KeyboardEvent, 'key' | 'metaKey' | 'shiftKey' | 'altKey' | 'ctrlKey'>

/** Maps a keydown to a panel action. Escape is handled separately because open pickers must see it first. */
export function shortcutForKeyEvent(event: KeyEventLike): Shortcut | null {
  if (!event.metaKey || event.ctrlKey) return null
  const key = event.key.toLowerCase()

  if (key === 'enter') return event.altKey ? { kind: 'submitAndCreateAnother' } : { kind: 'submit' }
  if (event.altKey) return null

  if (!event.shiftKey) {
    if (key === 'p') return { kind: 'acceptParentSuggestion' }
    return null
  }

  if (key === 'backspace') return { kind: 'clearDraft' }
  if (key === 'r') return { kind: 'captureScreenshot' }
  if (key === 'u') return { kind: 'pickFiles' }
  const picker = PICKER_NAMES.find((name) => PICKER_SHORTCUT_KEYS[name] === key)
  return picker ? { kind: 'openPicker', picker } : null
}

/** "⌘⇧S" style label for a picker's shortcut. */
export function pickerShortcutLabel(picker: PickerName): string {
  return `⌘⇧${PICKER_SHORTCUT_KEYS[picker].toUpperCase()}`
}
