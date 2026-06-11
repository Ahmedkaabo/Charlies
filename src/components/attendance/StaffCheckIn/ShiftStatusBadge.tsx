import { Badge } from "@/components/ui/badge"
import { isWithinCheckInWindow } from "@/lib/attendance"
import { useLanguage } from "@/contexts/LanguageContext"
import type { ShiftStatus } from "./types"

export function getShiftStatus(
  shift: {
    shift_start: string
    shift_end: string
    checkin_window_minutes: number
    is_active: boolean
  },
  now: Date
): ShiftStatus {
  if (!shift.is_active) return "inactive"

  if (isWithinCheckInWindow(now, shift.shift_start, shift.checkin_window_minutes))
    return "open"

  const nowMins = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = shift.shift_start.split(":").map(Number)
  const [eh, em] = shift.shift_end.split(":").map(Number)
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em

  if (nowMins < startMins - shift.checkin_window_minutes) return "upcoming"
  if (nowMins > endMins) return "ended"
  return "in_progress"
}

export function ShiftStatusBadge({
  status,
  shift,
}: {
  status: ShiftStatus
  shift: { shift_start: string; checkin_window_minutes: number }
}) {
  const { t } = useLanguage()

  if (status === "open") {
    return (
      <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white shrink-0">
        {t("Open now")}
      </Badge>
    )
  }

  if (status === "upcoming") {
    const [h, m] = shift.shift_start.split(":").map(Number)
    const windowStart = ((h * 60 + m) - shift.checkin_window_minutes + 1440) % 1440
    const wh = Math.floor(windowStart / 60)
    const wm = windowStart % 60
    const period = wh >= 12 ? "PM" : "AM"
    const hour12 = wh % 12 || 12
    return (
      <Badge variant="secondary" className="shrink-0">
        {t("Opens")} {hour12}:{String(wm).padStart(2, "0")} {period}
      </Badge>
    )
  }

  if (status === "in_progress") {
    return <Badge variant="outline" className="shrink-0">{t("In progress")}</Badge>
  }

  return <Badge variant="secondary" className="shrink-0 opacity-60">{t("Ended")}</Badge>
}
