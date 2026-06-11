import { useState, useMemo } from "react"
import { format, parseISO, isValid } from "date-fns"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PiggyBank,
  CreditCard,
  Users,
  Plus,
  Trash2,
  PieChart,
  ChevronDown,
  ChevronUp,
  Play,
  Pencil,
  CalendarIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/hooks/useAuth"
import { useUserPermissions } from "@/hooks/usePermissions"
import { useIsMobile } from "@/hooks/use-mobile"
import { useGetBranches } from "@/hooks/useBranches"
import { useMyBranches } from "@/hooks/useAttendance"
import {
  useFinanceSummary,
  useFinanceRecords,
  useCreateFinanceRecord,
  useDeleteFinanceRecord,
} from "@/hooks/useFinance"
import { usePayoutRuns, useDeletePayoutRun } from "@/hooks/usePayoutRuns"
import { useGetOwners } from "@/hooks/useOwners"
import { cn } from "@/lib/utils"
import type { Branch } from "@/types/branch"
import type { PayoutRunFull, PayoutRunBranch } from "@/types/finance"
import { PayoutWizardSheet } from "@/components/finance/PayoutWizardSheet"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MultiSelect } from "@/components/ui/multi-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// ── Helpers ───────────────────────────────────────────────────

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

function egp(n: number) {
  return `EGP ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?"
  const p = name.trim().split(/\s+/)
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0].slice(0, 2).toUpperCase()
}

// ── Summary card ──────────────────────────────────────────────

function SummaryCard({
  label, value, icon: Icon, highlight, loading, subValue, subHighlight,
}: {
  label:         string
  value:         string
  icon:          React.ElementType
  highlight?:    "positive" | "negative" | "neutral"
  loading?:      boolean
  subValue?:     string
  subHighlight?: "positive" | "negative"
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
        {loading
          ? <Skeleton className="h-7 w-24" />
          : <>
              <p className={cn(
                "text-xl font-bold",
                highlight === "positive" && "text-emerald-600 dark:text-emerald-400",
                highlight === "negative" && "text-destructive",
              )}>{value}</p>
              {subValue && (
                <p className={cn(
                  "text-xs mt-1",
                  subHighlight === "positive" ? "text-emerald-600 dark:text-emerald-400" :
                  subHighlight === "negative" ? "text-destructive" : "text-muted-foreground",
                )}>
                  After payout: {subValue}
                </p>
              )}
            </>
        }
      </CardContent>
    </Card>
  )
}

// ── Adjust sheet (combined credit / debit) ────────────────────

function AdjustSheet({
  open,
  onOpenChange,
  defaultBranchId,
  branches,
  month,
  year,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  defaultBranchId: string | undefined
  branches: Branch[]
  month: number
  year: number
}) {
  const isMobile = useIsMobile()
  const { profile } = useAuth()
  const create = useCreateFinanceRecord()

  const defaultDate = format(
    new Date(Math.min(
      new Date(year, month - 1, new Date().getDate()).getTime(),
      new Date(year, month, 0).getTime(),
    )),
    "yyyy-MM-dd",
  )

  const [branchId, setBranchId]       = useState(defaultBranchId ?? "")
  const [type, setType]               = useState<"credit" | "debit">("credit")
  const [amount, setAmount]           = useState("")
  const [date, setDate]               = useState(defaultDate)
  const [description, setDescription] = useState("")
  const [isVisa, setIsVisa]           = useState(false)
  const [isRent, setIsRent]           = useState(false)

  // Re-sync branch when sheet opens with new default
  const [lastDefault, setLastDefault] = useState(defaultBranchId)
  if (defaultBranchId !== lastDefault) {
    setLastDefault(defaultBranchId)
    setBranchId(defaultBranchId ?? "")
  }

  function reset() {
    setAmount("")
    setDescription("")
    setIsVisa(false)
    setIsRent(false)
    setType("credit")
    setDate(defaultDate)
    setBranchId(defaultBranchId ?? "")
  }

  async function handleSave() {
    if (!branchId) { toast.error("Select a branch"); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return }
    try {
      await create.mutateAsync({
        branch_id:   branchId,
        amount:      amt,
        type,
        is_visa:     type === "credit" ? isVisa : false,
        is_rent:     type === "debit"  ? isRent : false,
        description: description.trim() || null,
        date,
        added_by:    profile?.id ?? null,
      })
      toast.success(type === "credit" ? "Added" : "Withdrawal saved")
      reset()
      onOpenChange(false)
    } catch {
      toast.error("Failed to save")
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { reset(); onOpenChange(false) } }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-md",
        )}
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle>Add Adjustment</SheetTitle>
          <SheetDescription>Record a credit or debit for a branch</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Branch selector (shown when viewing all branches) */}
          {!defaultBranchId && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Branch</p>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch…" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Type selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Type</p>
            <div className="flex rounded-md border overflow-hidden">
              {(["credit", "debit"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setType(t); if (t === "debit") setIsVisa(false); if (t === "credit") setIsRent(false) }}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium transition-colors",
                    type === t
                      ? t === "credit"
                        ? "bg-emerald-600 text-white dark:bg-emerald-700"
                        : "bg-destructive text-white"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {t === "credit" ? "Add" : "Withdrawal"}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Amount</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">EGP</span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0.00"
                className="pl-12"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          {/* Visa toggle — add (credit) only */}
          {type === "credit" && (
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Switch id="is-visa" checked={isVisa} onCheckedChange={setIsVisa} />
              <div className="space-y-0.5 leading-none">
                <Label htmlFor="is-visa" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  Visa payment
                </Label>
                <p className="text-xs text-muted-foreground">Mark if this amount was received via Visa card</p>
              </div>
            </div>
          )}

          {/* Rent toggle — withdrawal (debit) only */}
          {type === "debit" && (
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Switch id="is-rent" checked={isRent} onCheckedChange={setIsRent} />
              <div className="space-y-0.5 leading-none">
                <Label htmlFor="is-rent" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                  Rent payment
                </Label>
                <p className="text-xs text-muted-foreground">Disables the Rent field in payout for this branch</p>
              </div>
            </div>
          )}

          {/* Date */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Date</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {date && isValid(parseISO(date)) ? format(parseISO(date), "d MMM yyyy") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date && isValid(parseISO(date)) ? parseISO(date) : undefined}
                  onSelect={(d) => d && setDate(format(d, "yyyy-MM-dd"))}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </p>
            <Textarea
              placeholder="What is this for?"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Payout run display card ───────────────────────────────────

function PayoutRunDisplay({
  run,
  branchFilter,
  onEdit,
  onDelete,
}: {
  run:          PayoutRunFull
  branchFilter?: string[]
  onEdit?:       () => void
  onDelete?:     () => void
}) {
  const [addMgmtFees, setAddMgmtFees] = useState(false)
  const { data: allOwners = [] } = useGetOwners()

  const feeManagerIds = useMemo(
    () => new Set(allOwners.filter((o) => o.is_fee_manager).map((o) => o.profile_id)),
    [allOwners],
  )

  const branches: PayoutRunBranch[] = branchFilter?.length
    ? run.branches.filter((b) => branchFilter.includes(b.branch_id))
    : run.branches

  const filteredOwners = branchFilter?.length
    ? run.owners.filter((o) => branchFilter.includes(o.branch_id))
    : run.owners

  const ownerMap = new Map<string, {
    fullName: string | null
    totalPayout: number
    branches: Array<{ branchName: string; stocks: number; totalStocks: number; percentage: number; payout: number }>
  }>()
  for (const o of filteredOwners) {
    const ex = ownerMap.get(o.profile_id) ?? { fullName: o.full_name, totalPayout: 0, branches: [] }
    ex.totalPayout += Number(o.payout_amount)
    ex.branches.push({
      branchName:  o.branch_name,
      stocks:      Number(o.stocks),
      totalStocks: Number(o.total_stocks),
      percentage:  Number(o.percentage),
      payout:      Number(o.payout_amount),
    })
    ownerMap.set(o.profile_id, ex)
  }
  const owners = Array.from(ownerMap.entries()).sort((a, b) => b[1].totalPayout - a[1].totalPayout)

  const totals = branches.reduce(
    (acc, b) => ({
      rent:         acc.rent         + Number(b.rent_amount),
      favor:        acc.favor        + Number(b.favor_amount),
      companyShare: acc.companyShare + Number(b.company_share_amount),
      mgmtFee:      acc.mgmtFee      + Number(b.mgmt_fee_amount),
    }),
    { rent: 0, favor: 0, companyShare: 0, mgmtFee: 0 },
  )
  const baseOwnerPayout = owners.reduce((s, [, o]) => s + o.totalPayout, 0)

  // Management fee split — only among owners marked as fee managers
  const managerCount     = owners.filter(([id]) => feeManagerIds.has(id)).length
  const mgmtFeePerOwner  = managerCount > 0 ? totals.mgmtFee / managerCount : 0
  const totalOwnerPayout = baseOwnerPayout + (addMgmtFees ? totals.mgmtFee : 0)

  return (
    <div className="space-y-3">

      {/* Run header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Saved {format(new Date(run.created_at), "d MMM yyyy, HH:mm")}
          {run.notes && <span className="ml-2 italic">· {run.notes}</span>}
        </p>
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-0.5">
            {onEdit && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                size="icon" variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 3-col grid: [owner payouts × 2] [gap] [totals + deductions × 1] */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">

        {/* Cols 1–2 — Owner payouts card */}
        <div className="sm:col-span-2 rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owner Payouts</p>
            {totals.mgmtFee > 0 && owners.length > 0 && (
              <Label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                <Switch checked={addMgmtFees} onCheckedChange={setAddMgmtFees} />
                Add management fees
              </Label>
            )}
          </div>
          {!owners.length ? (
            <p className="text-xs text-muted-foreground italic">No ownership configured.</p>
          ) : (
            <div className="space-y-1">
              {owners.map(([profileId, o]) => {
                const isFeeManager = feeManagerIds.has(profileId)
                const displayed = o.totalPayout + (addMgmtFees && isFeeManager ? mgmtFeePerOwner : 0)
                return (
                  <div key={profileId} className="rounded-lg px-3 py-2 hover:bg-muted/40 transition-colors space-y-1">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {getInitials(o.fullName)}
                      </div>
                      <p className="flex-1 min-w-0 text-sm font-medium truncate">{o.fullName ?? "Unknown"}</p>
                      <p className={cn(
                        "text-sm font-bold tabular-nums shrink-0",
                        displayed >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                      )}>{egp(displayed)}</p>
                    </div>
                    <div className="pl-11 space-y-0.5">
                      {o.branches.map((b, i) => (
                        <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="truncate">
                            {b.branchName}
                            <span className="ml-1 text-muted-foreground/60">· {b.stocks}/{b.totalStocks} ({b.percentage.toFixed(1)}%)</span>
                          </span>
                          <span className="tabular-nums ml-2 shrink-0">{egp(b.payout)}</span>
                        </div>
                      ))}
                      {addMgmtFees && isFeeManager && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Management fee</span>
                          <span className="tabular-nums ml-2 shrink-0 text-emerald-600 dark:text-emerald-400">+{egp(mgmtFeePerOwner)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <Separator className="my-1" />
              <div className="flex items-center gap-3 px-3 py-1">
                <p className="flex-1 text-sm font-semibold text-muted-foreground">Total</p>
                <p className={cn(
                  "text-sm font-bold tabular-nums",
                  totalOwnerPayout >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                )}>{egp(totalOwnerPayout)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Col 3 — Totals card + Deductions card stacked */}
        <div className="space-y-4">

          {/* Totals card */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Totals</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rent</span>
                <span className="tabular-nums font-medium text-destructive">{egp(totals.rent)}</span>
              </div>
              {totals.favor > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Favor</span>
                  <span className="tabular-nums font-medium text-destructive">{egp(totals.favor)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Co. Share</span>
                <span className="tabular-nums font-medium text-destructive">{egp(totals.companyShare)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mgmt Fee</span>
                <span className="tabular-nums font-medium text-destructive">{egp(totals.mgmtFee)}</span>
              </div>
            </div>
          </div>

          {/* Deductions card */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deductions</p>
            <div className="space-y-3">
              {branches.map((b) => (
                <div key={b.id} className="space-y-1">
                  <p className="text-xs font-semibold truncate">{b.branch_name}</p>
                  <div className="space-y-0.5 text-xs pl-1">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Rent</span>
                      <span className="tabular-nums">{egp(Number(b.rent_amount))}</span>
                    </div>
                    {Number(b.favor_amount) > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Favor</span>
                        <span className="tabular-nums">{egp(Number(b.favor_amount))}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Co. Share</span>
                      <span className="tabular-nums">{egp(Number(b.company_share_amount))}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Mgmt Fee</span>
                      <span className="tabular-nums">{egp(Number(b.mgmt_fee_amount))}</span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between font-medium">
                      <span>Distributable</span>
                      <span className={cn(
                        "tabular-nums",
                        Number(b.distributable_profit) >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive",
                      )}>{egp(Number(b.distributable_profit))}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}

// ── Finance content ───────────────────────────────────────────

function FinanceContent({
  branchId,
  branchIds,
  month,
  year,
  branches,
  canRunPayout,
}: {
  branchId:     string | undefined
  branchIds?:   string[]
  month:        number
  year:         number
  branches:     Branch[]
  isManagement: boolean
  canRunPayout: boolean
}) {
  const { canCreate: canCreateFin, canDelete: canDeleteFin } = useUserPermissions()
  const canAdjust    = canCreateFin("finance")   // "Add credit / debit adjustments"
  const canDeleteRec = canDeleteFin("finance")   // "Delete finance adjustments"

  const [adjustOpen,    setAdjustOpen]    = useState(false)
  const [summaryExpanded, setSummaryExpanded] = useState(true)
  const [delRecord,     setDelRecord]     = useState<string | null>(null)
  const [payoutOpen,    setPayoutOpen]    = useState(false)
  const [editRun,       setEditRun]       = useState<PayoutRunFull | undefined>()
  const [delPayoutId,   setDelPayoutId]   = useState<string | null>(null)

  const { summary, isLoading: summaryLoading }      = useFinanceSummary(branchId, month, year, branchIds)
  const { data: records, isLoading: recordsLoading } = useFinanceRecords(branchId, month, year, branchIds)
  const { data: payoutRuns = [], isLoading: payoutRunsLoading } = usePayoutRuns(month, year)
  const deleteRec        = useDeleteFinanceRecord()
  const deletePayoutRun  = useDeletePayoutRun()

  const filterBranchIds = branchId ? [branchId] : branchIds ?? []
  const visiblePayoutRuns = useMemo(
    () => filterBranchIds.length
      ? payoutRuns.filter((r) => r.branches.some((b) => filterBranchIds.includes(b.branch_id)))
      : payoutRuns,
    [payoutRuns, filterBranchIds],
  )

  const wizardBranches = branchId
    ? branches.filter((b) => b.id === branchId)
    : branches


  return (
    <div className="space-y-8">

      {/* ── Summary — mobile (payroll-style collapsible card) ── */}
      <Card className="sm:hidden py-0">
        <CardContent className="divide-y p-0">
          {summaryLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))
          ) : (
            <>
              {summaryExpanded && ([
                { label: "Sales",       value: egp(summary.revenue),       positive: true  },
                { label: "Expenses",    value: egp(summary.expenses),      positive: false },
                { label: "Payroll",     value: egp(summary.payrollTotal),  positive: false },
                { label: "Net Profit",  value: egp(summary.netProfit),     positive: summary.netProfit  >= 0 },
                { label: "Adjustments", value: egp(summary.adjustments),   positive: summary.adjustments >= 0, muted: summary.adjustments === 0 },
                { label: "Visa",        value: egp(summary.visaTotal),     positive: true, muted: true },
              ] as { label: string; value: string; positive: boolean; muted?: boolean }[]).map(({ label, value, positive, muted }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className={cn(
                    "tabular-nums text-sm font-medium",
                    muted
                      ? "text-muted-foreground"
                      : positive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive",
                  )}>
                    {value}
                  </span>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSummaryExpanded((v) => !v)}
                className="flex w-full items-center justify-between bg-muted/40 px-4 py-3"
              >
                <span className="text-sm font-semibold">Adjusted Profit</span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-base font-bold tabular-nums",
                    summary.adjustedProfit >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive",
                  )}>
                    {egp(summary.adjustedProfit)}
                  </span>
                  {summaryExpanded
                    ? <ChevronUp   className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Summary — desktop grid ──────────────────── */}
      <div className="hidden sm:grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <SummaryCard label="Sales"            value={egp(summary.revenue)}        icon={TrendingUp}   highlight="positive" loading={summaryLoading} />
        <SummaryCard label="Expenses"        value={egp(summary.expenses)}       icon={TrendingDown} highlight="negative" loading={summaryLoading} />
        <SummaryCard label="Payroll"         value={egp(summary.payrollTotal)}   icon={Users}        highlight="negative" loading={summaryLoading} />
        <SummaryCard label="Net Profit"      value={egp(summary.netProfit)}      icon={DollarSign}
          highlight={summary.netProfit >= 0 ? "positive" : "negative"} loading={summaryLoading} />
        <SummaryCard label="Adjustments"     value={egp(summary.adjustments)}    icon={PiggyBank}
          highlight={summary.adjustments > 0 ? "positive" : summary.adjustments < 0 ? "negative" : "neutral"} loading={summaryLoading} />
        <SummaryCard label="Visa"            value={egp(summary.visaTotal)}      icon={CreditCard}   highlight="neutral" loading={summaryLoading} />
        <SummaryCard label="Adjusted Profit" value={egp(summary.adjustedProfit)} icon={DollarSign}
          highlight={summary.adjustedProfit >= 0 ? "positive" : "negative"} loading={summaryLoading} />
      </div>

      <Separator />

      {/* ── Adjustments ───────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Adjustments</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Manual credits and debits for this period</p>
          </div>
          {canAdjust && (
            <Button onClick={() => setAdjustOpen(true)}>
              <Plus className="h-4 w-4" />
              Adjust
            </Button>
          )}
        </div>

        {recordsLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : !records?.length ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
            No adjustments this period
          </div>
        ) : (
          <div className="rounded-lg border divide-y">
            {records.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  r.type === "credit"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    : "bg-red-100 text-destructive dark:bg-red-950",
                )}>
                  {r.type === "credit" ? "+" : "−"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium">
                      {r.description ?? (r.type === "credit" ? "Add" : "Withdrawal")}
                    </p>
                    {r.is_visa && (
                      <span className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        <CreditCard className="h-2.5 w-2.5" />
                        Visa
                      </span>
                    )}
                    {r.is_rent && (
                      <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Rent
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.date}
                    {(r.branch as { name?: string } | null)?.name && !branchId
                      ? ` · ${(r.branch as { name: string }).name}`
                      : ""}
                    {" · "}{(r.adder as { full_name?: string | null } | null)?.full_name ?? "—"}
                  </p>
                </div>
                <span className={cn(
                  "tabular-nums font-semibold text-sm shrink-0",
                  r.type === "credit" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                )}>
                  {r.type === "credit" ? "+" : "−"}{egp(r.amount)}
                </span>
                {canDeleteRec && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDelRecord(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Owner Payouts ─────────────────────────── */}
      <Separator />
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Owner Payouts</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {visiblePayoutRuns.length > 0
                ? "Edit or delete the existing payout run to make changes."
                : "Run a payout to distribute profits to owners with custom deductions."}
            </p>
          </div>
          {canRunPayout && visiblePayoutRuns.length > 0 && !payoutRunsLoading && (
            <Button onClick={() => { setEditRun(undefined); setPayoutOpen(true) }}>
              <Play className="h-4 w-4" />
              Run Payout
            </Button>
          )}
        </div>

        {payoutRunsLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
          </div>
        ) : !visiblePayoutRuns.length ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-10 text-center">
            <PieChart className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium">No payout runs yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Run a payout to distribute profits to owners with custom deductions.
              </p>
            </div>
            {canRunPayout && (
              <Button onClick={() => { setEditRun(undefined); setPayoutOpen(true) }}>
                <Play className="h-3.5 w-3.5" />
                Run Payout
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {visiblePayoutRuns.map((run) => (
              <PayoutRunDisplay
                key={run.id}
                run={run}
                branchFilter={filterBranchIds.length ? filterBranchIds : undefined}
                onEdit={canRunPayout ? () => { setEditRun(run); setPayoutOpen(true) } : undefined}
                onDelete={canDeleteRec ? () => setDelPayoutId(run.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Sheets + dialogs ──────────────────────── */}
      <AdjustSheet
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        defaultBranchId={branchId}
        branches={branches}
        month={month}
        year={year}
      />

      <PayoutWizardSheet
        open={payoutOpen}
        onOpenChange={setPayoutOpen}
        month={month}
        year={year}
        branches={wizardBranches}
        editRun={editRun}
      />

      <AlertDialog open={!!delRecord} onOpenChange={(v) => { if (!v) setDelRecord(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete adjustment?</AlertDialogTitle>
            <AlertDialogDescription>This record will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!delRecord) return
                try { await deleteRec.mutateAsync(delRecord); toast.success("Deleted") }
                catch { toast.error("Failed to delete") }
                finally { setDelRecord(null) }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!delPayoutId} onOpenChange={(v) => { if (!v) setDelPayoutId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payout run?</AlertDialogTitle>
            <AlertDialogDescription>
              This payout run and all its records will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!delPayoutId) return
                try {
                  await deletePayoutRun.mutateAsync({ id: delPayoutId, month, year })
                  toast.success("Payout run deleted")
                } catch {
                  toast.error("Failed to delete payout run")
                } finally {
                  setDelPayoutId(null)
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function FinancePage() {
  const { profile, isAdmin } = useAuth()
  const { isOwner, canCreate } = useUserPermissions()

  // isManagement controls data scope: owners/admins see all branches + multi-select.
  // Staff-level users see only their assigned branch.
  const isManagement  = isAdmin || isOwner
  const canRunPayout  = canCreate("finance")

  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[0].value)
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])

  const { month, year } = useMemo(() => {
    const opt = MONTH_OPTIONS.find((o) => o.value === selectedMonth) ?? MONTH_OPTIONS[0]
    return { month: opt.month, year: opt.year }
  }, [selectedMonth])

  const { data: allBranches = [] } = useGetBranches()

  // Every user scoped to their own branches; system admins with no branches see all
  const { data: myBranches, isLoading: branchesLoading } = useMyBranches(profile?.id)

  // For branch-level users, always use their assigned branch
  const primaryBranchId = myBranches?.[0]?.id

  // The branch id passed to FinanceContent:
  //   - management + "all" → undefined (aggregated)
  //   - management + specific → that branch id
  //   - branch-level user → their branch id
  const activeBranchId: string | undefined = isManagement
    ? (selectedBranchIds.length === 1 ? selectedBranchIds[0] : undefined)
    : primaryBranchId
  const activeMultiBranchIds: string[] | undefined = isManagement && selectedBranchIds.length > 1
    ? selectedBranchIds
    : undefined

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

  // Loading state for branch-level users
  if (!isManagement && branchesLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!isManagement && !primaryBranchId) {
    return (
      <div className="p-4 md:p-6 flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
        <DollarSign className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Not assigned to any branch yet.</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* ── Header ─────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Finance</h1>
          {monthSelect}
        </div>

        {/* Branch filter — management users only, scoped to assigned branches */}
        {isManagement && (
          <MultiSelect
            options={((myBranches?.length ?? 0) > 0 ? myBranches! : allBranches).map((b) => ({ value: b.id, label: b.name }))}
            selected={selectedBranchIds}
            onChange={setSelectedBranchIds}
            placeholder="All Branches"
            className="w-[180px]"
          />
        )}
      </div>

      {/* ── Content ────────────────────────────────── */}
      <FinanceContent
        branchId={activeBranchId}
        branchIds={activeMultiBranchIds ?? ((myBranches?.length ?? 0) > 0 && !activeBranchId ? myBranches!.map((b) => b.id) : undefined)}
        month={month}
        year={year}
        branches={(myBranches?.length ?? 0) > 0 ? myBranches! : allBranches}
        isManagement={isManagement}
        canRunPayout={canRunPayout}
      />
    </div>
  )
}
