import { Building2, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { formatShiftTime } from "@/lib/attendance"
import { useLanguage } from "@/contexts/LanguageContext"
import type { StaffBranch } from "@/hooks/useAttendance"
import { getShiftStatus } from "./ShiftStatusBadge"

export function ShiftsPanel({ branch, now }: { branch: StaffBranch; now: Date }) {
  const { t } = useLanguage()
  const openShifts = branch.shifts.filter(
    (s) => s.is_active && getShiftStatus(s, now) === "open"
  )

  return (
    <Card className="py-0">
      <CardContent className="p-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="font-medium text-sm">{branch.name}</span>
        </div>

        {openShifts.length === 0 && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            {branch.shifts.filter((s) => s.is_active).length === 0
              ? t("No shifts configured — contact your manager")
              : t("No check-in window open right now")}
          </div>
        )}

        {openShifts.map((shift, i) => (
          <div
            key={shift.id}
            className={cn(
              "flex items-center justify-between gap-3 px-4 py-3 text-sm bg-emerald-50 dark:bg-emerald-950/20",
              i < openShifts.length - 1 && "border-b"
            )}
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{shift.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatShiftTime(shift.shift_start)} – {formatShiftTime(shift.shift_end)}
                <span className="ml-1.5 opacity-60">
                  · ±{shift.checkin_window_minutes} {t("min window")}
                </span>
              </p>
            </div>
            <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white shrink-0">
              {t("Open now")}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
