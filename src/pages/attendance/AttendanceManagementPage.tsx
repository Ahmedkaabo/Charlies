import { useState, useMemo } from "react"
import { format, parseISO, addDays, subDays } from "date-fns"
import { ChevronLeft, ChevronRight, Download, Image, CalendarDays, Search } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { useUserPermissions } from "@/hooks/usePermissions"
import { useGetBranches } from "@/hooks/useBranches"
import { useGetMembers } from "@/hooks/useMembers"
import { useAttendanceLogs, useMyBranches } from "@/hooks/useAttendance"
import { exportLogsToCSV, formatShiftTime, calculateDayValue } from "@/lib/attendance"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import type { AttendanceLogWithProfile } from "@/types/attendance"
import { useLanguage } from "@/contexts/LanguageContext"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { MultiSelect } from "@/components/ui/multi-select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// ── Helpers ───────────────────────────────────────────────────

function initials(name: string | null) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase()
}

const APP_START = new Date(2026, 5, 1) // June 2026 — first month of operation

// ── Page ──────────────────────────────────────────────────────

export function AttendanceManagementPage() {
  const { t } = useLanguage()
  const { isAdmin, profile } = useAuth()
  const { canCreate, canUpdate } = useUserPermissions()
  const today = new Date()

  // can_create("attendance") = "View all staff records in assigned branches"
  // Without it the user only sees their own records.
  const canViewAllStaff = isAdmin || canCreate("attendance")
  // can_update("attendance") = "Export attendance to CSV"
  const canExport = isAdmin || canUpdate("attendance")

  const isMobile = useIsMobile()

  const [branchFilters, setBranchFilters] = useState<string[]>([])
  const [staffFilters, setStaffFilters] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState(format(today, "yyyy-MM-dd"))
  const [selfieUrl,    setSelfieUrl]    = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [search,       setSearch]       = useState("")
  const [detailLog,    setDetailLog]    = useState<AttendanceLogWithProfile | null>(null)

  // Every user is scoped to their own branches; system admins with no branches see all
  const { data: myBranches = [] } = useMyBranches(profile?.id)
  const myBranchIds = myBranches.map((b) => b.id)

  const { data: allBranches } = useGetBranches()
  const branchDropdownList = myBranchIds.length > 0 ? myBranches : (allBranches ?? [])

  const selectedBranchId = branchFilters.length === 1 ? branchFilters[0] : undefined
  const scopeBranchIds = branchFilters.length > 1 ? branchFilters : (myBranchIds.length > 0 && !selectedBranchId ? myBranchIds : undefined)

  // Staff members for the staff dropdown — scoped to the same branch(es)
  const { data: members } = useGetMembers(
    selectedBranchId,
    myBranchIds.length > 0 && !selectedBranchId ? myBranchIds : undefined
  )

  // Profile filter: own records only when user lacks can_create("attendance")
  const queryProfileId = canViewAllStaff
    ? (staffFilters.length === 1 ? staffFilters[0] : undefined)
    : profile?.id

  const { data: attendanceLogs, isLoading: logsLoading } = useAttendanceLogs({
    branchId:  selectedBranchId,
    branchIds: scopeBranchIds,
    profileId: queryProfileId,
    date:      selectedDate,
  })

  const filteredLogs = useMemo(() => {
    const logs = attendanceLogs ?? []
    if (!search.trim()) return logs
    const q = search.toLowerCase()
    return logs.filter((l) => l.profile?.full_name?.toLowerCase().includes(q))
  }, [attendanceLogs, search])

  function prevDay() {
    const prev = subDays(parseISO(selectedDate), 1)
    if (prev >= APP_START) setSelectedDate(format(prev, "yyyy-MM-dd"))
  }

  function nextDay() {
    const next = addDays(parseISO(selectedDate), 1)
    if (next <= today) setSelectedDate(format(next, "yyyy-MM-dd"))
  }

  function handleExport() {
    exportLogsToCSV(attendanceLogs ?? [], `attendance-${selectedDate}.csv`)
  }

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{t("Attendance")}</h1>
          {/* Day navigation */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <div className="flex items-center rounded-lg border bg-card">
              <Button size="icon" variant="ghost" onClick={prevDay} disabled={parseISO(selectedDate) <= APP_START} className="h-8 w-8 rounded-r-none border-r">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <PopoverTrigger asChild>
                <button className="flex h-8 items-center gap-1.5 px-3 text-sm font-medium hover:bg-muted/50 transition-colors">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {format(parseISO(selectedDate), "EEE d MMM")}
                </button>
              </PopoverTrigger>
              <Button
                size="icon"
                variant="ghost"
                onClick={nextDay}
                disabled={selectedDate === format(today, "yyyy-MM-dd")}
                className="h-8 w-8 rounded-l-none border-l"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parseISO(selectedDate)}
                defaultMonth={parseISO(selectedDate)}
                onSelect={(d) => {
                  if (d) {
                    setSelectedDate(format(d, "yyyy-MM-dd"))
                    setCalendarOpen(false)
                  }
                }}
                startMonth={APP_START}
                disabled={(d) => d > today || d < APP_START}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-full sm:w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t("Search staff…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Branch filter — non-admins only see their assigned branches */}
          <MultiSelect
            options={branchDropdownList.map((b) => ({ value: b.id, label: b.name }))}
            selected={branchFilters}
            onChange={setBranchFilters}
            placeholder={t("All Branches")}
            className="w-[160px]"
          />

          {/* Staff filter — only shown when user can view all staff records */}
          {canViewAllStaff && (
            <MultiSelect
              options={(members ?? []).map((m) => ({ value: m.profile_id, label: m.profile?.full_name ?? "—" }))}
              selected={staffFilters}
              onChange={setStaffFilters}
              placeholder={t("All Staff")}
              className="w-[160px]"
            />
          )}

          {canExport && (
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" />
              {t("Export CSV")}
            </Button>
          )}
        </div>
      </div>

      {/* ── Attendance table ─────────────────────────────── */}
      {/* Columns: Staff | Branch | Shift | Check In | Late? | Check Out | Hours | Selfie */}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap sticky left-0 z-10 bg-muted/40 relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']">{t("Staff")}</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{t("Branch")}</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{t("Shift")}</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{t("Check In")}</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{t("Late?")}</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{t("Check Out")}</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("Hours")}</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("Days")}</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t("Selfie")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logsLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className={j === 0 ? "px-4 py-3 sticky left-0 z-10 bg-background relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']" : "px-4 py-3"}>
                      <Skeleton className="h-3 w-full" />
                    </td>
                  ))}
                </tr>
              ))}

            {!logsLoading && filteredLogs.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  {search.trim() ? t("No staff match your search") : t("No attendance records for this day")}
                </td>
              </tr>
            )}

            {filteredLogs.map((log) => {
              const hrs = log.total_hours ?? null
              // Use per-shift thresholds when available, fall back to branch-level
              const fullDayH  = log.shift?.full_day_hours  ?? log.branch?.min_shift_hours ?? 8
              const overtimeH = log.shift?.overtime_hours  ?? log.branch?.max_shift_hours ?? 12
              const underMin = hrs !== null && hrs < fullDayH
              const overMax  = hrs !== null && hrs >= overtimeH

              // Compute the base day value (before late deduction) to show the deduction delta
              const baseDayValue = hrs != null
                ? calculateDayValue(hrs, { fullDay: fullDayH, overtime: overtimeH })
                : null
              const storedDayValue = log.day_value ?? null
              const dayDeduction = baseDayValue != null && storedDayValue != null
                ? Math.round((baseDayValue - storedDayValue) * 100) / 100
                : 0
              return (
                <tr key={log.id} className="hover:bg-muted/30 cursor-pointer group" onClick={() => setDetailLog(log)}>
                  {/* Staff */}
                  <td className="px-4 py-3 sticky left-0 z-10 bg-background sm:group-hover:bg-muted/30 relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {initials(log.profile?.full_name ?? null)}
                      </div>
                      <span className="font-medium whitespace-nowrap">
                        {log.profile?.full_name ?? "—"}
                      </span>
                    </div>
                  </td>

                  {/* Branch */}
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {log.branch?.name ?? "—"}
                  </td>

                  {/* Shift */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {log.shift ? (
                      <div>
                        <p className="text-sm font-medium">{log.shift.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatShiftTime(log.shift.shift_start)} –{" "}
                          {formatShiftTime(log.shift.shift_end)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        {formatShiftTime(log.branch?.check_in_time)} –{" "}
                        {formatShiftTime(log.branch?.check_out_time)}
                      </span>
                    )}
                  </td>

                  {/* Check In */}
                  <td className="px-4 py-3 tabular-nums">
                    {log.check_in_at ? format(parseISO(log.check_in_at), "h:mm a") : "—"}
                  </td>

                  {/* Late? */}
                  <td className="px-4 py-3">
                    {log.is_late ? (
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        +{log.late_minutes} min
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Check Out */}
                  <td className="px-4 py-3 tabular-nums">
                    {log.check_out_at ? format(parseISO(log.check_out_at), "h:mm a") : "—"}
                  </td>

                  {/* Hours — coloured when outside shift range */}
                  <td className={`px-4 py-3 text-right tabular-nums font-medium ${
                    underMin ? "text-destructive" : overMax ? "text-amber-600 dark:text-amber-400" : ""
                  }`}>
                    {hrs !== null ? `${hrs.toFixed(1)} h` : "—"}
                  </td>

                  {/* Days — credited day value after any late deduction */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {storedDayValue != null ? (
                      <div className="flex flex-col items-end leading-tight">
                        <span className="font-medium">{storedDayValue.toFixed(2)}</span>
                        {dayDeduction > 0 && (
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            −{dayDeduction.toFixed(2)}
                          </span>
                        )}
                      </div>
                    ) : "—"}
                  </td>

                  {/* Selfie */}
                  <td className="px-4 py-3 text-center">
                    {log.selfie_url ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelfieUrl(log.selfie_url) }}
                        className="inline-block"
                        title={t("View selfie")}
                      >
                        <img
                          src={log.selfie_url}
                          alt={t("Selfie")}
                          className="h-8 w-8 rounded-md object-cover border hover:ring-2 hover:ring-primary transition-all"
                        />
                      </button>
                    ) : (
                      <Image className="mx-auto h-4 w-4 text-muted-foreground/40" />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Attendance detail sheet ─────────────────────── */}
      {detailLog && (() => {
        const log = detailLog
        const hrs = log.total_hours ?? null
        const fullDayH  = log.shift?.full_day_hours  ?? log.branch?.min_shift_hours ?? 8
        const overtimeH = log.shift?.overtime_hours  ?? log.branch?.max_shift_hours ?? 12
        const underMin = hrs !== null && hrs < fullDayH
        const overMax  = hrs !== null && hrs >= overtimeH
        const baseDayValue = hrs != null ? calculateDayValue(hrs, { fullDay: fullDayH, overtime: overtimeH }) : null
        const storedDayValue = log.day_value ?? null
        const dayDeduction = baseDayValue != null && storedDayValue != null
          ? Math.round((baseDayValue - storedDayValue) * 100) / 100
          : 0

        return (
          <Sheet open={!!detailLog} onOpenChange={(open) => { if (!open) setDetailLog(null) }}>
            <SheetContent
              side={isMobile ? "bottom" : "right"}
              className={cn("flex flex-col gap-0 overflow-hidden p-0", isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-md")}
            >
              <SheetHeader className="border-b px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {initials(log.profile?.full_name ?? null)}
                  </div>
                  <div>
                    <SheetTitle className="text-left">{log.profile?.full_name ?? "—"}</SheetTitle>
                    <SheetDescription className="text-left">
                      {format(parseISO(log.date), "EEEE, d MMMM yyyy")}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                {/* Branch & Shift */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Location & Shift")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-muted/30 px-4 py-3">
                      <p className="text-xs text-muted-foreground mb-0.5">{t("Branch")}</p>
                      <p className="text-sm font-medium">{log.branch?.name ?? "—"}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-4 py-3">
                      <p className="text-xs text-muted-foreground mb-0.5">{t("Shift")}</p>
                      {log.shift ? (
                        <>
                          <p className="text-sm font-medium">{log.shift.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatShiftTime(log.shift.shift_start)} – {formatShiftTime(log.shift.shift_end)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm font-medium">
                          {formatShiftTime(log.branch?.check_in_time)} – {formatShiftTime(log.branch?.check_out_time)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Timing */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Timing")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-muted/30 px-4 py-3">
                      <p className="text-xs text-muted-foreground mb-0.5">{t("Check In")}</p>
                      <p className="text-sm font-medium tabular-nums">
                        {log.check_in_at ? format(parseISO(log.check_in_at), "h:mm a") : "—"}
                      </p>
                      {log.is_late && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          +{log.late_minutes} {t("min late")}
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-4 py-3">
                      <p className="text-xs text-muted-foreground mb-0.5">{t("Check Out")}</p>
                      <p className="text-sm font-medium tabular-nums">
                        {log.check_out_at ? format(parseISO(log.check_out_at), "h:mm a") : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Performance */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Performance")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-muted/30 px-4 py-3">
                      <p className="text-xs text-muted-foreground mb-0.5">{t("Hours Worked")}</p>
                      <p className={cn("text-sm font-medium tabular-nums", underMin ? "text-destructive" : overMax ? "text-amber-600 dark:text-amber-400" : "")}>
                        {hrs !== null ? `${hrs.toFixed(1)} h` : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-4 py-3">
                      <p className="text-xs text-muted-foreground mb-0.5">{t("Day Value")}</p>
                      {storedDayValue != null ? (
                        <>
                          <p className="text-sm font-medium">{storedDayValue.toFixed(2)}</p>
                          {dayDeduction > 0 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                              −{dayDeduction.toFixed(2)} {t("late deduction")}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm font-medium">—</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Selfie */}
                {log.selfie_url && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Selfie")}</p>
                      <button
                        className="w-full overflow-hidden rounded-lg border hover:opacity-90 transition-opacity"
                        onClick={() => setSelfieUrl(log.selfie_url)}
                      >
                        <img src={log.selfie_url} alt={t("Attendance selfie")} className="w-full object-cover max-h-64" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        )
      })()}

      {/* ── Selfie lightbox ──────────────────────────────── */}
      <Dialog open={!!selfieUrl} onOpenChange={(open) => { if (!open) setSelfieUrl(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Attendance Selfie")}</DialogTitle>
          </DialogHeader>
          {selfieUrl && (
            <img src={selfieUrl} alt={t("Attendance selfie")} className="w-full rounded-lg object-cover" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
