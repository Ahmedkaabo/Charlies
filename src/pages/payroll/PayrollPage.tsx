import { useState, useMemo } from "react"
import { format, parseISO } from "date-fns"
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  BadgeDollarSign,
  SlidersHorizontal,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { useUserPermissions } from "@/hooks/usePermissions"
import { useGetBranches } from "@/hooks/useBranches"
import { useMyBranches } from "@/hooks/useAttendance"
import { usePayrollSummary, usePayrollRecords, useStaffMonthlyAttendance } from "@/hooks/usePayroll"
import { calculateEarnedSalary } from "@/lib/attendance"
import { PayrollAdjustmentDialog } from "@/components/attendance/PayrollAdjustmentDialog"
import { StaffPayrollSheet } from "@/components/attendance/StaffPayrollSheet"
import type { StaffPayrollRow } from "@/types/attendance"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/LanguageContext"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MultiSelect } from "@/components/ui/multi-select"
import { useFormatters } from "@/lib/format"

// ── Helpers ───────────────────────────────────────────────────

function initials(name: string | null) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase()
}

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "present") return "default"
  if (s === "late")    return "secondary"
  return "destructive"
}

function generateMonthOptions() {
  const start = new Date(2026, 5, 1) // June 2026
  const now   = new Date()
  const opts: { month: number; year: number; label: string; value: string }[] = []
  for (let d = new Date(now.getFullYear(), now.getMonth(), 1); d >= start; d.setMonth(d.getMonth() - 1)) {
    opts.push({
      month: d.getMonth() + 1,
      year:  d.getFullYear(),
      label: format(new Date(d), "MMMM yyyy"),
      value: `${d.getFullYear()}-${d.getMonth() + 1}`,
    })
  }
  return opts
}

const MONTH_OPTIONS = generateMonthOptions()

// ── Attendance breakdown (expanded row) ───────────────────────

function AttendanceBreakdown({
  profileId,
  branchId,
  month,
  year,
  curr,
  baseSalary,
  paidDaysOff,
}: {
  profileId: string
  branchId: string
  month: number
  year: number
  curr: string
  baseSalary: number | null
  paidDaysOff: number
}) {
  const { t } = useLanguage()
  const fmt = useFormatters()
  const currency = (amount: number | null, curr = "EGP") =>
    amount == null ? "—" : fmt.money(amount, curr)
  const { data: logs, isLoading } = useStaffMonthlyAttendance(profileId, branchId, month, year)

  if (isLoading) {
    return (
      <div className="px-10 py-3 bg-muted/30 space-y-2 border-b">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
      </div>
    )
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="px-10 py-4 bg-muted/30 border-b text-sm text-muted-foreground">
        {t("No attendance records this month.")}
      </div>
    )
  }

  const totalDayValue = logs.reduce((s, l) => s + (l.day_value ?? 0), 0)
  const totalHours    = logs.reduce((s, l) => s + (l.total_hours ?? 0), 0)
  const dailyRate     = baseSalary != null ? baseSalary / 30 : null
  const earnedTotal   = baseSalary != null
    ? calculateEarnedSalary(baseSalary, totalDayValue + paidDaysOff)
    : null

  return (
    <div className="bg-muted/30 border-b px-10 py-3">
      <div className="rounded-lg border text-xs overflow-x-auto">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_80px_60px_60px_80px] bg-muted/50 px-3 py-2 font-medium text-muted-foreground">
          <span>{t("Date")}</span>
          <span className="text-end">{t("Check-in")}</span>
          <span className="text-end">{t("Check-out")}</span>
          <span className="text-end">{t("Hours")}</span>
          <span className="text-end">{t("Day")}</span>
          <span className="text-end">{t("Status")}</span>
        </div>

        {/* Log rows */}
        <div className="divide-y">
          {logs.map((log) => (
            <div
              key={log.id}
              className="grid grid-cols-[1fr_80px_80px_60px_60px_80px] items-center px-3 py-2"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-medium">{format(parseISO(log.date), "EEE, d MMM")}</span>
                {log.is_late && log.late_minutes > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">+{log.late_minutes}m</span>
                )}
              </div>
              <span className="tabular-nums text-end text-muted-foreground">
                {log.check_in_at ? format(parseISO(log.check_in_at), "h:mm a") : "—"}
              </span>
              <span className="tabular-nums text-end text-muted-foreground">
                {log.check_out_at ? format(parseISO(log.check_out_at), "h:mm a") : "—"}
              </span>
              <span className="tabular-nums text-end">
                {log.total_hours != null ? `${log.total_hours.toFixed(1)}h` : "—"}
              </span>
              <span className="tabular-nums text-end font-medium">
                {log.day_value != null ? log.day_value.toFixed(2) : "—"}
              </span>
              <div className="flex justify-end">
                <Badge variant={statusVariant(log.status)} className="capitalize text-[10px] px-1.5 py-0">
                  {log.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Totals row */}
        <div className="grid grid-cols-[1fr_80px_80px_60px_60px_80px] items-center bg-muted/50 border-t px-3 py-2 font-semibold">
          <span>{logs.length} {t("days attended")}</span>
          <span />
          <span />
          <span className="tabular-nums text-end">{totalHours.toFixed(1)}h</span>
          <span className="tabular-nums text-end">{totalDayValue.toFixed(2)}</span>
          <span />
        </div>
      </div>

      {/* Earning formula */}
      {dailyRate != null && earnedTotal != null && (
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          {t("Earned:")}{"  "}
          <span className="font-medium text-foreground">
            {totalDayValue.toFixed(2)} {t("days attended")}
          </span>
          {paidDaysOff > 0 && (
            <> + <span className="font-medium text-foreground">{paidDaysOff} {t("paid leave")}</span></>
          )}
          {" "}&times;{" "}
          <span className="font-medium text-foreground">{currency(dailyRate, curr)}{t("/day")}</span>
          {" "}={" "}
          <span className="font-semibold text-foreground">{currency(earnedTotal, curr)}</span>
        </p>
      )}
    </div>
  )
}

// ── Summary card ──────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  muted,
}: {
  label: string
  value: string
  icon: React.ElementType
  muted?: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-xl font-bold ${muted ? "text-muted-foreground" : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function PayrollPage() {
  const { t } = useLanguage()
  const fmt = useFormatters()
  const currency = (amount: number | null, curr = "EGP") =>
    amount == null ? "—" : fmt.money(amount, curr)
  const { profile } = useAuth()
  const { canCreate, canUpdate } = useUserPermissions()

  const canViewAllStaff  = canCreate("payroll")
  const canViewAnalytics = canViewAllStaff
  const canAdjust        = canUpdate("payroll")

  // ── Filters ───────────────────────────────────────────────
  const [branchFilters, setBranchFilters] = useState<string[]>([])
  const [roleFilters,   setRoleFilters]   = useState<string[]>([])
  const [search,        setSearch]        = useState<string>("")
  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[0].value)

  const parsed = useMemo(() => {
    const opt = MONTH_OPTIONS.find((o) => o.value === selectedMonth) ?? MONTH_OPTIONS[0]
    return { month: opt.month, year: opt.year }
  }, [selectedMonth])

  const { month, year } = parsed

  // ── Mobile summary expand/collapse ───────────────────────
  const [summaryExpanded, setSummaryExpanded] = useState(false)

  // ── Expanded attendance rows ──────────────────────────────
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  function toggleExpanded(key: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── Sheet / dialog state ──────────────────────────────────
  const [detailRow,    setDetailRow]    = useState<StaffPayrollRow | null>(null)
  const [adjustTarget, setAdjustTarget] = useState<StaffPayrollRow | null>(null)

  const { data: myBranches = [] } = useMyBranches(profile?.id)
  const myBranchIds = myBranches.map((b) => b.id)

  const { data: allBranches } = useGetBranches()
  const branchDropdownList = myBranchIds.length > 0 ? myBranches : (allBranches ?? [])

  const selectedBranchId = branchFilters.length === 1 ? branchFilters[0] : undefined
  const scopeBranchIds   = branchFilters.length > 1 ? branchFilters : (myBranchIds.length > 0 && !selectedBranchId ? myBranchIds : undefined)

  const queryProfileId = canViewAllStaff ? undefined : profile?.id

  const { data: summary,     isLoading: summaryLoading } = usePayrollSummary(selectedBranchId, scopeBranchIds, month, year)
  const { data: payrollRows, isLoading: payrollLoading } = usePayrollRecords(selectedBranchId, scopeBranchIds, queryProfileId, month, year)

  // ── Role options derived from rows ────────────────────────
  const roleOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of payrollRows ?? []) {
      if (r.role && !seen.has(r.role.id)) seen.set(r.role.id, r.role.name)
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [payrollRows])

  // ── Filtered rows ─────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = payrollRows ?? []
    if (roleFilters.length > 0) rows = rows.filter((r) => r.role?.id && roleFilters.includes(r.role.id))
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter((r) => r.full_name?.toLowerCase().includes(q))
    }
    return rows
  }, [payrollRows, roleFilters, search])

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* ── Header ───────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{t("Payroll")}</h1>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[150px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Filter bar ─────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-[160px]">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t("Search staff…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-8"
            />
          </div>

          <MultiSelect
            options={branchDropdownList.map((b) => ({ value: b.id, label: b.name }))}
            selected={branchFilters}
            onChange={setBranchFilters}
            placeholder={t("All Branches")}
            className="w-[160px]"
          />

          <MultiSelect
            options={roleOptions.map((r) => ({ value: r.id, label: r.name.replace(/_/g, " ") }))}
            selected={roleFilters}
            onChange={setRoleFilters}
            placeholder={t("All Roles")}
            className="w-[140px]"
          />
        </div>
      </div>

      {/* ── Summary cards ─────────────────────────────────── */}

      {canViewAnalytics && (
        <>
          {/* Mobile */}
          <Card className="sm:hidden py-0">
            <CardContent className="divide-y p-0">
              {summaryLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))
              ) : (
                <>
                  {summaryExpanded && [
                    { label: t("Salary Budget"), value: currency(summary?.totalSalaryBudget ?? 0), muted: true  },
                    { label: t("Bonuses"),       value: currency(summary?.totalBonuses       ?? 0), muted: false },
                    { label: t("Deductions"),    value: currency(summary?.totalDeductions    ?? 0), muted: true  },
                    { label: t("Debts"),         value: currency(summary?.totalDebts         ?? 0), muted: true  },
                  ].map(({ label, value, muted }) => (
                    <div key={label} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className={`tabular-nums text-sm font-medium ${muted ? "text-muted-foreground" : ""}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                  <button
                    onClick={() => setSummaryExpanded((v) => !v)}
                    className="flex w-full items-center justify-between bg-muted/40 px-4 py-3"
                  >
                    <span className="text-sm font-semibold">{t("Net Payout")}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold tabular-nums">
                        {currency(summary?.projectedNetPayout ?? 0)}
                      </span>
                      {summaryExpanded
                        ? <ChevronUp  className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                  </button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Desktop */}
          <div className="hidden sm:grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {summaryLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Card className="py-4" key={i}>
                  <CardHeader className="pb-1"><Skeleton className="h-3 w-24" /></CardHeader>
                  <CardContent><Skeleton className="h-6 w-20 mt-1" /></CardContent>
                </Card>
              ))
            ) : (
              <>
                <SummaryCard label={t("Salary Budget")} value={currency(summary?.totalSalaryBudget ?? 0)} icon={BadgeDollarSign} />
                <SummaryCard label={t("Bonuses")}       value={currency(summary?.totalBonuses       ?? 0)} icon={TrendingUp} />
                <SummaryCard label={t("Deductions")}    value={currency(summary?.totalDeductions    ?? 0)} icon={TrendingDown} muted />
                <SummaryCard label={t("Debts")}         value={currency(summary?.totalDebts         ?? 0)} icon={Wallet} muted />
                <SummaryCard label={t("Net Payout")}    value={currency(summary?.projectedNetPayout ?? 0)} icon={Users} />
              </>
            )}
          </div>
        </>
      )}

      {/* ── Per-staff table ────────────────────────────── */}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="sticky start-0 z-10 bg-muted/40 px-4 py-3 text-start font-medium text-muted-foreground relative after:pointer-events-none after:absolute after:end-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']">{t("Staff")}</th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground whitespace-nowrap">{t("Base")}</th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground whitespace-nowrap">{t("Attendance")}</th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground whitespace-nowrap">{t("Leave")}</th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground whitespace-nowrap">{t("Earned")}</th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground whitespace-nowrap">{t("Bonus")}</th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground whitespace-nowrap">{t("Deduction")}</th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground whitespace-nowrap">{t("Debt")}</th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground whitespace-nowrap">{t("Net")}</th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground whitespace-nowrap">{t("Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {payrollLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j} className={j === 0 ? "sticky start-0 z-10 bg-background px-4 py-3 text-start" : "px-4 py-3"}>
                      <Skeleton className="h-3 w-full" />
                    </td>
                  ))}
                </tr>
              ))}

            {!payrollLoading && filteredRows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  {t("No staff records for this period")}
                </td>
              </tr>
            )}

            {filteredRows.map((row) => {
              const rowKey = `${row.branch_id}:${row.profile_id}`
              const isExpanded = expandedRows.has(rowKey)

              return (
                <>
                  <tr
                    key={rowKey}
                    className="hover:bg-muted/30 cursor-pointer group"
                    onClick={() => setDetailRow(row)}
                  >
                    <td className="sticky start-0 z-10 bg-background sm:group-hover:bg-muted/30 px-4 py-3 text-start relative after:pointer-events-none after:absolute after:end-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']">
                      <div className="flex items-center gap-2">
                        {/* Expand toggle */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0 text-muted-foreground"
                          onClick={(e) => { e.stopPropagation(); toggleExpanded(rowKey) }}
                        >
                          <ChevronRight className={cn("h-4 w-4 transition-transform duration-150", isExpanded && "rotate-90")} />
                        </Button>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                          {initials(row.full_name)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium whitespace-nowrap">{row.full_name ?? "—"}</span>
                          {row.role && (
                            <span className="rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground capitalize">
                              {row.role.name.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-muted-foreground">
                      {currency(row.base_salary, row.currency)}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {row.days_present.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-muted-foreground">
                      {row.paid_days_off > 0 ? row.paid_days_off.toFixed(1) : "—"}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {currency(row.earned_salary, row.currency)}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-emerald-600 dark:text-emerald-400">
                      {row.total_bonuses > 0 ? `+${currency(row.total_bonuses, row.currency)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-destructive">
                      {row.total_deductions > 0 ? `−${currency(row.total_deductions, row.currency)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-muted-foreground">
                      {row.total_debts > 0 ? currency(row.total_debts, row.currency) : "—"}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums font-semibold">
                      {currency(row.net_salary, row.currency)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {canAdjust && (
                        <Button
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); setAdjustTarget(row) }}
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                          {t("Adjust")}
                        </Button>
                      )}
                    </td>
                  </tr>

                  {/* ── Attendance log expansion ──────── */}
                  {isExpanded && (
                    <tr key={`${rowKey}-att`}>
                      <td colSpan={10} className="p-0">
                        <AttendanceBreakdown
                          profileId={row.profile_id}
                          branchId={row.branch_id}
                          month={month}
                          year={year}
                          curr={row.currency}
                          baseSalary={row.base_salary}
                          paidDaysOff={row.paid_days_off}
                        />
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Member detail sheet ───────────────────────── */}
      {detailRow && (
        <StaffPayrollSheet
          open={!!detailRow}
          onOpenChange={(open) => { if (!open) setDetailRow(null) }}
          row={detailRow}
          month={month}
          year={year}
          onAdjust={() => { setAdjustTarget(detailRow) }}
        />
      )}

      {/* ── Adjustment dialog ─────────────────────────── */}
      {adjustTarget && (
        <PayrollAdjustmentDialog
          open={!!adjustTarget}
          onOpenChange={(open) => { if (!open) setAdjustTarget(null) }}
          staffName={adjustTarget.full_name}
          profileId={adjustTarget.profile_id}
          branchId={adjustTarget.branch_id}
          payrollRecordId={adjustTarget.payroll_record_id}
          baseSalary={adjustTarget.base_salary}
          daysPresent={adjustTarget.days_present}
          paidDaysOff={adjustTarget.paid_days_off}
          currency={adjustTarget.currency}
          month={month}
          year={year}
        />
      )}
    </div>
  )
}
