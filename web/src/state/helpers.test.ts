import { describe, expect, it } from 'vitest'
import { parseNativeError } from '../bridge/NativeBridge'
import { fetchAllPages } from '../linear/fetchReferenceData'
import { estimateOptionsFor, type TeamRecord } from '../linear/model'
import { workspace } from '../test/fixtures'
import { dueDatePresets, formatDueDate, parseDueDate } from './dueDate'
import { shortcutForKeyEvent } from './shortcuts'

function key(keyName: string, modifiers: { meta?: boolean; shift?: boolean; alt?: boolean; ctrl?: boolean } = {}) {
  return { key: keyName, metaKey: modifiers.meta ?? false, shiftKey: modifiers.shift ?? false, altKey: modifiers.alt ?? false, ctrlKey: modifiers.ctrl ?? false }
}

describe('shortcutForKeyEvent', () => {
  it('⌘↩ -> submit, ⌥⌘↩ -> submit and create another', () => {
    expect(shortcutForKeyEvent(key('Enter', { meta: true }))).toEqual({ kind: 'submit' })
    expect(shortcutForKeyEvent(key('Enter', { meta: true, alt: true }))).toEqual({ kind: 'submitAndCreateAnother' })
  })

  it('⌘⇧ + field letter -> that field picker, whatever the shifted key reports', () => {
    expect(shortcutForKeyEvent(key('S', { meta: true, shift: true }))).toEqual({ kind: 'openPicker', picker: 'status' })
    expect(shortcutForKeyEvent(key('i', { meta: true, shift: true }))).toEqual({ kind: 'openPicker', picker: 'parent' })
    expect(shortcutForKeyEvent(key('J', { meta: true, shift: true }))).toEqual({ kind: 'openPicker', picker: 'project' })
  })

  it('⌘P -> accept the parent suggestion, ⌘⇧⌫ -> clear the draft', () => {
    expect(shortcutForKeyEvent(key('p', { meta: true }))).toEqual({ kind: 'acceptParentSuggestion' })
    expect(shortcutForKeyEvent(key('Backspace', { meta: true, shift: true }))).toEqual({ kind: 'clearDraft' })
  })

  it('plain typing and text-editing chords -> left alone', () => {
    expect(shortcutForKeyEvent(key('s'))).toBeNull()
    expect(shortcutForKeyEvent(key('S', { shift: true }))).toBeNull()
    expect(shortcutForKeyEvent(key('Backspace', { meta: true }))).toBeNull()
    expect(shortcutForKeyEvent(key('b', { meta: true }))).toBeNull()
    expect(shortcutForKeyEvent(key('s', { meta: true, shift: true, ctrl: true }))).toBeNull()
  })
})

describe('estimateOptionsFor', () => {
  const engineering = workspace.teams[0]
  if (!engineering) throw new Error('fixture team missing')

  it('fibonacci -> 1, 2, 3, 5, 8 points', () => {
    expect(estimateOptionsFor(engineering).map((option) => option.label)).toEqual(['1 point', '2 points', '3 points', '5 points', '8 points'])
  })

  it('t-shirt sizes with zero and extended -> - to XXXL', () => {
    const team: TeamRecord = { ...engineering, estimation: { type: 'tShirt', allowZero: true, extended: true } }
    expect(estimateOptionsFor(team).map((option) => option.label)).toEqual(['-', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'])
  })

  it('estimates turned off -> no options', () => {
    const team: TeamRecord = { ...engineering, estimation: { type: 'notUsed', allowZero: false, extended: false } }
    expect(estimateOptionsFor(team)).toEqual([])
  })
})

describe('due dates', () => {
  // Thursday, 1 October 2026, mid-afternoon.
  const now = new Date(2026, 9, 1, 15, 30)

  it('"friday" -> the coming Friday', () => {
    expect(parseDueDate('friday', now)).toBe('2026-10-02')
  })

  it('"in 2 weeks" -> fourteen days out', () => {
    expect(parseDueDate('in 2 weeks', now)).toBe('2026-10-15')
  })

  it('gibberish -> no date', () => {
    expect(parseDueDate('whenever', now)).toBeNull()
  })

  it('presets -> today, tomorrow, Friday, a week out', () => {
    expect(dueDatePresets(now).map((preset) => preset.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-02', '2026-10-08'])
  })

  it('formatting -> weekday and date, year only when different', () => {
    expect(formatDueDate('2026-10-09', now)).toBe('Fri, Oct 9')
    expect(formatDueDate('2027-01-15', now)).toBe('Fri, Jan 15, 2027')
  })
})

describe('fetchAllPages', () => {
  it('several pages -> every node, following the cursor', async () => {
    const pages: Record<string, { nodes: string[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }> = {
      start: { nodes: ['Engineering', 'Design'], pageInfo: { hasNextPage: true, endCursor: 'cursor-2' } },
      'cursor-2': { nodes: ['Platform'], pageInfo: { hasNextPage: false, endCursor: null } },
    }
    const requestedCursors: Array<string | null> = []

    const nodes = await fetchAllPages(async (after) => {
      requestedCursors.push(after)
      const page = pages[after ?? 'start']
      if (!page) throw new Error(`unexpected cursor ${after}`)
      return page
    })

    expect(nodes).toEqual(['Engineering', 'Design', 'Platform'])
    expect(requestedCursors).toEqual([null, 'cursor-2'])
  })
})

describe('parseNativeError', () => {
  it('"code: message" from Swift -> typed error', () => {
    expect(parseNativeError(new Error('missingApiKey: No API key is stored'))).toMatchObject({ code: 'missingApiKey', message: 'No API key is stored' })
  })

  it('unknown code -> internal error keeping the whole text', () => {
    expect(parseNativeError(new Error('Something odd: happened'))).toMatchObject({ code: 'internal', message: 'Something odd: happened' })
  })
})
