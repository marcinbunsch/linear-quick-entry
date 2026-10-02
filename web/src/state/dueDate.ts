import * as chrono from 'chrono-node'

export type DueDateOption = { date: string; label: string }

/** Reads phrases like "friday", "in 2 weeks" or "Oct 12" as a future date; null when nothing matches. */
export function parseDueDate(text: string, now: Date): string | null {
  if (text.trim() === '') return null
  const parsed = chrono.parseDate(text, now, { forwardDate: true })
  return parsed ? toTimelessDate(parsed) : null
}

/** Quick picks shown before the user types: today, tomorrow, Friday of this week, one week out. */
export function dueDatePresets(now: Date): Array<{ key: 'today' | 'tomorrow' | 'endOfWeek' | 'nextWeek'; date: string }> {
  const daysUntilFriday = (5 - now.getDay() + 7) % 7
  return [
    { key: 'today', date: toTimelessDate(addDays(now, 0)) },
    { key: 'tomorrow', date: toTimelessDate(addDays(now, 1)) },
    { key: 'endOfWeek', date: toTimelessDate(addDays(now, daysUntilFriday)) },
    { key: 'nextWeek', date: toTimelessDate(addDays(now, 7)) },
  ]
}

/** "Fri, Oct 3", with the year only when it isn't the current one. */
export function formatDueDate(date: string, now: Date): string {
  const [year, month, day] = date.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) return date
  const value = new Date(year, month - 1, day)
  const includeYear = year !== now.getFullYear()
  return value.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(includeYear && { year: 'numeric' }),
  })
}

/** yyyy-mm-dd in local time; Linear's due dates have no time zone. */
export function toTimelessDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}
