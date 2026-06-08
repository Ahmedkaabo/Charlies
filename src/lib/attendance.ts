/** Calendar days used as the salary divisor. daily_rate = baseSalary / 30 */
export const WORKING_DAYS_PER_MONTH = 30

/**
 * Attendance-based earned salary.
 * daily_rate = baseSalary / 30
 * earned     = daily_rate × daysPresent  (daysPresent is sum of day_value + paid_days_off)
 */
export function calculateEarnedSalary(
  baseSalary: number,
  daysPresent: number,
  workingDaysPerMonth = WORKING_DAYS_PER_MONTH
): number {
  if (workingDaysPerMonth <= 0) return 0
  return (baseSalary / workingDaysPerMonth) * daysPresent
}

/** Haversine distance between two lat/lon points — returns metres. */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6_371_000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** (salary / 30) × paid_days_off — fixed monthly leave pay regardless of attendance. */
export function calculatePaidLeave(baseSalary: number, paidDaysOff: number): number {
  if (paidDaysOff <= 0 || baseSalary <= 0) return 0
  return (baseSalary / 30) * paidDaysOff
}

/**
 * 0 for < fullDay · 1.0 for ≥ fullDay · 1.5 for ≥ overtime
 */
export function calculateDayValue(
  totalHours: number,
  config: { fullDay?: number; overtime?: number } = {}
): number {
  const { fullDay = 8, overtime = 12 } = config
  if (totalHours < fullDay) return 0
  if (totalHours >= overtime) return 1.5
  return 1.0
}

/**
 * Returns the number of hours to deduct due to lateness (never negative).
 * Grace period is respected: minutes within the grace window are not penalised.
 * Caller divides by full_day_hours to convert to fractional days.
 */
export function calculateLateDeductedHours(
  lateMinutes: number,
  shift: {
    late_deduction_enabled: boolean
    late_grace_minutes: number
    late_per_minutes: number | null
    late_deduct_hours: number | null
  } | null
): number {
  if (!shift?.late_deduction_enabled) return 0
  if (!shift.late_per_minutes || !shift.late_deduct_hours) return 0
  const penaltyMinutes = Math.max(0, lateMinutes - shift.late_grace_minutes)
  if (penaltyMinutes === 0) return 0
  return Math.floor(penaltyMinutes / shift.late_per_minutes) * shift.late_deduct_hours
}

/**
 * Find the shift whose check-in window contains the given time.
 * Returns the closest matching shift, or null if none match.
 */
export function findMatchingShift<
  T extends { shift_start: string; checkin_window_minutes: number; is_active: boolean }
>(now: Date, shifts: T[]): T | null {
  const active = shifts.filter((s) => s.is_active)
  if (active.length === 0) return null

  const matching = active.filter((s) =>
    isWithinCheckInWindow(now, s.shift_start, s.checkin_window_minutes)
  )
  if (matching.length === 0) return null

  const nowMins = now.getHours() * 60 + now.getMinutes()
  return matching.reduce((best, s) => {
    const [sh, sm] = s.shift_start.split(":").map(Number)
    const [bh, bm] = best.shift_start.split(":").map(Number)
    return Math.abs(sh * 60 + sm - nowMins) < Math.abs(bh * 60 + bm - nowMins)
      ? s
      : best
  })
}

export function calculateNetSalary(
  base: number,
  bonuses: number,
  deductions: number,
  debts: number
): number {
  return base + bonuses - deductions - debts
}

/**
 * Returns true if `now` falls within ±windowMinutes of the shift start time.
 * shiftTime is a Postgres TIME string: "HH:MM" or "HH:MM:SS".
 */
export function isWithinCheckInWindow(
  now: Date,
  shiftTime: string,
  windowMinutes = 15
): boolean {
  const [hStr, mStr] = shiftTime.split(":")
  const shiftMinutes = Number(hStr) * 60 + Number(mStr)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return Math.abs(nowMinutes - shiftMinutes) <= windowMinutes
}

/** Format a Postgres TIME ("HH:MM:SS") for display as "h:mm AM/PM". */
export function formatShiftTime(t: string | null | undefined): string {
  if (!t) return "--"
  const [hStr, mStr] = t.split(":")
  const h = Number(hStr)
  const m = Number(mStr)
  if (isNaN(h) || isNaN(m)) return "--"
  const period = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

export function exportLogsToCSV(
  logs: Array<{
    profile?: { full_name?: string | null } | null
    branch?: { check_in_time?: string | null; check_out_time?: string | null } | null
    check_in_at?: string | null
    check_out_at?: string | null
    is_late?: boolean
    total_hours?: number | null
    day_value?: number | null
    selfie_url?: string | null
    status?: string
    notes?: string | null
  }>,
  filename: string
) {
  const headers = [
    "Staff Name",
    "Shift Time",
    "Check-in Time",
    "Late?",
    "Check-out Time",
    "Total Hours",
    "Day Value",
    "Selfie",
    "Status",
    "Notes",
  ]
  const rows = logs.map((l) => [
    l.profile?.full_name ?? "Unknown",
    `${formatShiftTime(l.branch?.check_in_time)} – ${formatShiftTime(l.branch?.check_out_time)}`,
    l.check_in_at ? new Date(l.check_in_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : "-",
    l.is_late ? "Yes" : "No",
    l.check_out_at ? new Date(l.check_out_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : "-",
    l.total_hours != null ? l.total_hours.toFixed(2) : "-",
    l.day_value != null ? l.day_value.toFixed(1) : "-",
    l.selfie_url ?? "-",
    l.status ?? "-",
    l.notes ?? "",
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
