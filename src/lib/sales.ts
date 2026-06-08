import {
  format,
  startOfDay,
  subDays,
  isAfter,
  getDaysInMonth,
} from "date-fns"
import type { SalesRecord } from "@/types/sales"

/**
 * Sales day runs 09:00 → 04:00 next morning.
 * Between 00:00–04:00 we're still in yesterday's sales period.
 */
export function getCurrentSalesDate(): Date {
  const now = new Date()
  if (now.getHours() < 4) {
    return startOfDay(subDays(now, 1))
  }
  return startOfDay(now)
}

/**
 * Returns true if the given calendar date can be opened for editing.
 * - Future dates: always false
 * - Locked records: false unless canEdit is true (user has sales update permission)
 */
export function isDayEditable(
  date: Date,
  record?: SalesRecord | null,
  canEdit = false,
): boolean {
  const currentSalesDate = getCurrentSalesDate()
  const dayStart = startOfDay(date)
  if (isAfter(dayStart, currentSalesDate)) return false
  if (record?.status === 'locked' && !canEdit) return false
  return true
}

/**
 * Returns all past/current days in the given month that have no sales record.
 */
export function getMissingDays(
  records: SalesRecord[],
  month: number,
  year: number,
): Date[] {
  const currentSalesDate = getCurrentSalesDate()
  const recordDates = new Set(records.map((r) => r.date))
  const missing: Date[] = []
  const total = getDaysInMonth(new Date(year, month - 1))

  for (let d = 1; d <= total; d++) {
    const date = new Date(year, month - 1, d)
    if (isAfter(startOfDay(date), currentSalesDate)) break
    const dateStr = format(date, "yyyy-MM-dd")
    if (!recordDates.has(dateStr)) {
      missing.push(date)
    }
  }

  return missing
}

/** "Monday, June 5" */
export function formatSalesDate(date: Date): string {
  return format(date, "EEEE, MMMM d")
}
