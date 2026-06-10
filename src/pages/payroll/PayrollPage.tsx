import { useState, useMemo } from "react"
import { format } from "date-fns"
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
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { useUserPermissions } from "@/hooks/usePermissions"
import { useGetBranches } from "@/hooks/useBranches"
import { useMyBranches } from "@/hooks/useAttendance"
import { usePayrollSummary, usePayrollRecords } from "@/hooks/usePayroll"
import { PayrollAdjustmentDialog } from "@/components/attendance/PayrollAdjustmentDialog"
import { StaffPayrollSheet } from "@/components/attendance/StaffPayrollSheet"
import type { StaffPayrollRow } from "@/types/attendance"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MultiSelect } from "@/components/ui/multi-select"

// ── Helpers ───────────────────────────────────────────────────

function currency(amount: number | null, curr = "EGP") {
  if (amount == null) return "—"
  return `${Number(amount).toLocaleString("en-EG", { minimumFractionDigits: 0 })} ${curr}`
}

function initials(name: string | null) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase()
}

function generateMonthOptions() {
  const start = new Date(2026, 5, 1) // June 2026
  const now   = new Date()
  const opts: { month: number; year: number; label: string; value: string }[] = []
  // Walk forward from start to current month (inclusive)
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
  const { profile } = useAuth()
  const { canCreate, canUpdate } = useUserPermissions()

  // can_create("payroll") = "View all staff payroll & financial analytics"
  // Without it, the user only sees their own payroll record and no analytics cards.
  const canViewAllStaff  = canCreate("payroll")
  const canViewAnalytics = canViewAllStaff
  // can_update("payroll") = "Add bonuses, deductions & adjustments"
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

  // ── Sheet / dialog state ──────────────────────────────────
  const [detailRow,    setDetailRow]    = useState<StaffPayrollRow | null>(null)
  const [adjustTarget, setAdjustTarget] = useState<StaffPayrollRow | null>(null)

  // Every user scoped to their own branches; system admins with no branches see all
  const { data: myBranches = [] } = useMyBranches(profile?.id)
  const myBranchIds = myBranches.map((b) => b.id)

  const { data: allBranches } = useGetBranches()
  const branchDropdownList = myBranchIds.length > 0 ? myBranches : (allBranches ?? [])

  const selectedBranchId = branchFilters.length === 1 ? branchFilters[0] : undefined
  const scopeBranchIds   = branchFilters.length > 1 ? branchFilters : (myBranchIds.length > 0 && !selectedBranchId ? myBranchIds : undefined)

  // Profile filter: own record only when user lacks can_create("payroll")
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
          <h1 className="text-xl font-semibold">Payroll</h1>
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
          {/* Search */}
          <div className="relative w-full sm:w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search staff…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Branch */}
          <MultiSelect
            options={branchDropdownList.map((b) => ({ value: b.id, label: b.name }))}
            selected={branchFilters}
            onChange={setBranchFilters}
            placeholder="All Branches"
            className="w-[160px]"
          />

          {/* Role */}
          <MultiSelect
            options={roleOptions.map((r) => ({ value: r.id, label: r.name.replace(/_/g, " ") }))}
            selected={roleFilters}
            onChange={setRoleFilters}
            placeholder="All Roles"
            className="w-[140px]"
          />
        </div>
      </div>

      {/* ── Summary cards (analytics — can_create("payroll")) ── */}

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
                    { label: "Salary Budget", value: currency(summary?.totalSalaryBudget ?? 0), muted: true  },
                    { label: "Bonuses",       value: currency(summary?.totalBonuses       ?? 0), muted: false },
                    { label: "Deductions",    value: currency(summary?.totalDeductions    ?? 0), muted: true  },
                    { label: "Debts",         value: currency(summary?.totalDebts         ?? 0), muted: true  },
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
                    <span className="text-sm font-semibold">Net Payout</span>
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
                <SummaryCard label="Salary Budget" value={currency(summary?.totalSalaryBudget ?? 0)} icon={BadgeDollarSign} />
                <SummaryCard label="Bonuses"       value={currency(summary?.totalBonuses       ?? 0)} icon={TrendingUp} />
                <SummaryCard label="Deductions"    value={currency(summary?.totalDeductions    ?? 0)} icon={TrendingDown} muted />
                <SummaryCard label="Debts"         value={currency(summary?.totalDebts         ?? 0)} icon={Wallet} muted />
                <SummaryCard label="Net Payout"    value={currency(summary?.projectedNetPayout ?? 0)} icon={Users} />
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
              <th className="sticky left-0 z-10 bg-muted/40 px-4 py-3 text-left font-medium text-muted-foreground relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']">Staff</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Base</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Attendance</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Leave</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Earned</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Bonus</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Deduction</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Debt</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Net</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {payrollLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j} className={j === 0 ? "sticky left-0 z-10 bg-background px-4 py-3" : "px-4 py-3"}>
                      <Skeleton className="h-3 w-full" />
                    </td>
                  ))}
                </tr>
              ))}

            {!payrollLoading && filteredRows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  No staff records for this period
                </td>
              </tr>
            )}

            {filteredRows.map((row) => (
              <tr
                key={`${row.branch_id}:${row.profile_id}`}
                className="hover:bg-muted/30 cursor-pointer group"
                onClick={() => setDetailRow(row)}
              >
                <td className="sticky left-0 z-10 bg-background sm:group-hover:bg-muted/30 px-4 py-3 relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']">
                  <div className="flex items-center gap-2">
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
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {currency(row.base_salary, row.currency)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.days_present.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {row.paid_days_off > 0 ? row.paid_days_off.toFixed(1) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {currency(row.earned_salary, row.currency)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                  {row.total_bonuses > 0 ? `+${currency(row.total_bonuses, row.currency)}` : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-destructive">
                  {row.total_deductions > 0 ? `−${currency(row.total_deductions, row.currency)}` : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {row.total_debts > 0 ? currency(row.total_debts, row.currency) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">
                  {currency(row.net_salary, row.currency)}
                </td>
                <td className="px-4 py-3 text-right">
                  {canAdjust && (
                    <Button
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); setAdjustTarget(row) }}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Adjust
                    </Button>
                  )}
                </td>
              </tr>
            ))}
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
