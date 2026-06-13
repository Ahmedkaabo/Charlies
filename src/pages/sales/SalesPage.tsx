import { useState, useMemo } from "react"
import { format } from "date-fns"
import { ChevronLeft, TrendingUp, CheckCircle2, XCircle, Loader2, ClipboardCheck, RotateCcw, X, AlertCircle } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { useGetBranches } from "@/hooks/useBranches"
import { useMyBranches } from "@/hooks/useAttendance"
import { useUserPermissions } from "@/hooks/usePermissions"
import { useSalesSummary } from "@/hooks/useSales"
import { useSheetsCheck } from "@/hooks/useSheetsCheck"
import { SalesManagementView } from "@/pages/sales/SalesManagementView"
import { SalesBranchView } from "@/pages/sales/SalesBranchView"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useLanguage } from "@/contexts/LanguageContext"
import { useLocalName, useFormatters } from "@/lib/format"
import { cn } from "@/lib/utils"

// ── Month options ─────────────────────────────────────────────

function generateMonthOptions() {
  const start = new Date(2026, 5, 1)
  const now   = new Date()
  const opts: { month: number; year: number; label: string; value: string }[] = []
  for (
    let d = new Date(now.getFullYear(), now.getMonth(), 1);
    d >= start;
    d.setMonth(d.getMonth() - 1)
  ) {
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

// ── Check button ──────────────────────────────────────────────

interface CheckButtonProps {
  month: number
  year: number
  branchId?: string
  branchIds?: string[]
}

function CheckButton({ month, year, branchId, branchIds }: CheckButtonProps) {
  const { t } = useLanguage()
  const fmt = useFormatters()
  const { summary } = useSalesSummary(branchId, month, year, branchIds)
  const { state, run, reset } = useSheetsCheck(summary.totalRevenue)

  const isIdle    = state.status === "idle"
  const isLoading = state.status === "loading"
  const isMatch   = state.status === "match"
  const isOver    = state.status === "mismatch" && state.diff > 0
  const isUnder   = state.status === "mismatch" && state.diff < 0
  const isGood    = isMatch || isOver
  const isBad     = isUnder
  const isError   = state.status === "error"
  const isOpen    = isMatch || state.status === "mismatch" || isError

  const result = (isMatch || state.status === "mismatch") ? state as { appTotal: number; sheetValue: number; diff: number; status: string } : null

  const StatusIcon = isLoading ? Loader2
    : isGood    ? CheckCircle2
    : isBad     ? XCircle
    : isError   ? AlertCircle
    : ClipboardCheck

  const label = isLoading ? t("Checking…")
    : isMatch   ? t("Matched")
    : isOver    ? t("Above Sheet")
    : isUnder   ? t("Below Sheet")
    : isError   ? t("Check Failed")
    : t("Check Sheet")

  // Popover header colour token
  const headerCls = isGood
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
    : isBad
    ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
    : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"

  return (
    <Popover open={isOpen} onOpenChange={(o) => { if (!o) reset() }}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={isLoading}
          onClick={() => { if (isIdle) run() }}
          className={cn(
            "h-8 gap-1.5 text-xs font-medium transition-all duration-200",
            isGood  && "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
            isBad   && "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-950 dark:text-red-300",
            isError && "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300",
            (isIdle || isLoading) && "text-muted-foreground hover:text-foreground",
          )}
        >
          <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", isLoading && "animate-spin")} />
          {label}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={6}
        className="w-52 overflow-hidden p-0"
      >
        {/* ── Status header ── */}
        <div className={cn("flex items-center gap-2 px-3 py-2.5 text-xs font-semibold", headerCls)}>
          <StatusIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{label}</span>
          {isMatch && result && Math.abs(result.diff) > 0 && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400">
              ±300
            </span>
          )}
          <button
            onClick={reset}
            className="ms-1 rounded-sm opacity-40 transition-opacity hover:opacity-100"
            aria-label={t("Close")}
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* ── Comparison rows ── */}
        {result && (
          <div className="space-y-1.5 px-3 py-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("System Total")}</span>
              <span className="font-medium tabular-nums">{fmt.egp(result.appTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("Sheet Value")}</span>
              <span className="font-medium tabular-nums">{fmt.egp(result.sheetValue)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-1.5">
              <span className="text-muted-foreground">{t("Difference")}</span>
              <span className={cn(
                "font-semibold tabular-nums",
                result.diff > 0 ? "text-emerald-600 dark:text-emerald-400"
                : result.diff < 0 ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground",
              )}>
                {result.diff > 0 ? "+" : ""}{fmt.egp(result.diff)}
              </span>
            </div>
          </div>
        )}

        {/* ── Error message ── */}
        {isError && (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            {(state as { status: "error"; message: string }).message}
          </p>
        )}

        {/* ── Recheck / Retry footer ── */}
        {(state.status === "mismatch" || isError) && (
          <div className="border-t px-3 pb-3 pt-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-full gap-1.5 text-xs"
              onClick={() => run()}
            >
              <RotateCcw className="h-3 w-3" />
              {isError ? t("Retry") : t("Recheck")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function SalesPage() {
  const { t } = useLanguage()
  const ln = useLocalName()
  const { profile } = useAuth()

  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[0].value)
  const [drillBranchId, setDrillBranchId] = useState<string | null>(null)

  const { month, year } = useMemo(() => {
    const opt = MONTH_OPTIONS.find((o) => o.value === selectedMonth) ?? MONTH_OPTIONS[0]
    return { month: opt.month, year: opt.year }
  }, [selectedMonth])

  const { data: allBranches = [], isLoading: allBranchesLoading } = useGetBranches()
  const { data: myBranches  = [], isLoading: myBranchesLoading  } = useMyBranches(profile?.id)
  const { canRead } = useUserPermissions()
  const canTreasuryRead = canRead("treasury")

  // The branches this user can access: their assignments, or all branches if none (admin/owner)
  const branchList = myBranches.length > 0 ? myBranches : allBranches
  const myBranchIds = myBranches.length > 0 ? myBranches.map((b) => b.id) : undefined

  // ── Loading ────────────────────────────────────────────────

  if (myBranchesLoading || allBranchesLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // ── No branches assigned ───────────────────────────────────

  if (branchList.length === 0) {
    return (
      <div className="p-4 md:p-6 flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
        <TrendingUp className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t("You're not assigned to any branch yet.")}</p>
      </div>
    )
  }

  // ── Shared month selector ──────────────────────────────────

  const monthSelect = (
    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
      <SelectTrigger className="w-[150px] h-8 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MONTH_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  // ── Single branch → go straight to branch view ─────────────

  if (branchList.length === 1) {
    const branch = branchList[0]
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{ln(branch.name, branch.name_ar)}</h1>
          {monthSelect}
          {canTreasuryRead && (
            <div className="ms-auto">
              <CheckButton month={month} year={year} branchId={branch.id} />
            </div>
          )}
        </div>
        <SalesBranchView branchId={branch.id} branchName={ln(branch.name, branch.name_ar)} month={month} year={year} />
      </div>
    )
  }

  // ── Multi-branch: drilled into a specific branch ───────────

  const drilledBranch = drillBranchId
    ? (branchList.find((b) => b.id === drillBranchId) ?? null)
    : null

  if (drilledBranch) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => setDrillBranchId(null)}>
            <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
          </Button>
          <h1 className="text-xl font-semibold">{ln(drilledBranch.name, drilledBranch.name_ar)}</h1>
          {monthSelect}
          {canTreasuryRead && (
            <div className="ms-auto">
              <CheckButton month={month} year={year} branchId={drilledBranch.id} />
            </div>
          )}
        </div>
        <SalesBranchView
          branchId={drilledBranch.id}
          branchName={ln(drilledBranch.name, drilledBranch.name_ar)}
          month={month}
          year={year}
        />
      </div>
    )
  }

  // ── Multi-branch: management overview ──────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{t("Sales")}</h1>
        {monthSelect}
        {canTreasuryRead && (
          <div className="ms-auto">
            <CheckButton month={month} year={year} branchIds={myBranchIds} />
          </div>
        )}
      </div>
      <SalesManagementView
        month={month}
        year={year}
        onSelectBranch={setDrillBranchId}
        branchIds={myBranchIds}
        canTreasuryRead={canTreasuryRead}
      />
    </div>
  )
}
