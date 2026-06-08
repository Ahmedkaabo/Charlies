import { useState, useMemo } from "react"
import { format, parseISO, isValid } from "date-fns"
import {
  ArrowRightLeft,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Vault,
  Wallet,
  Plus,
  Trash2,
  Pencil,
  CalendarIcon,
  Building2,
} from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/hooks/useAuth"
import { useIsMobile } from "@/hooks/use-mobile"
import { useUserPermissions } from "@/hooks/usePermissions"
import { useGetBranches } from "@/hooks/useBranches"
import { useMyBranches } from "@/hooks/useAttendance"
import {
  useBalanceSummary,
  useAllBranchBalances,
  useTreasuryTransfers,
  useCreateTreasuryTransfer,
  useUpdateTreasuryTransfer,
  useDeleteTreasuryTransfer,
} from "@/hooks/useBalance"
import { cn } from "@/lib/utils"
import type { TreasuryTransfer } from "@/types/balance"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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

// ── Types ──────────────────────────────────────────────────────

type BalancePool = "sales" | "expenses" | "treasury"

type TransferDrawerState =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit"; transfer: TreasuryTransfer }

// ── Helpers ────────────────────────────────────────────────────

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

const POOL_LABELS: Record<BalancePool, string> = {
  sales:    "Sales Pool",
  expenses: "Expense Pool",
  treasury: "Main Treasury",
}

const POOLS: BalancePool[] = ["sales", "expenses", "treasury"]

// ── Summary card ───────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  highlight,
  loading,
}: {
  label:      string
  value:      string
  icon:       React.ElementType
  highlight?: "positive" | "negative" | "neutral"
  loading?:   boolean
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
        {loading ? (
          <Skeleton className="h-7 w-28" />
        ) : (
          <p className={cn(
            "text-xl font-bold",
            highlight === "positive" && "text-emerald-600 dark:text-emerald-400",
            highlight === "negative" && "text-destructive",
          )}>
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Transfer sheet (create / edit) ─────────────────────────────

function TransferSheet({
  open,
  onOpenChange,
  state,
  branchId: defaultBranchId,
  month,
  year,
  canUseTreasury,
}: {
  open:            boolean
  onOpenChange:    (v: boolean) => void
  state:           TransferDrawerState
  branchId:        string | undefined
  month:           number
  year:            number
  canUseTreasury:  boolean
}) {
  const isMobile  = useIsMobile()
  const { profile } = useAuth()
  const { data: allBranches = [] } = useGetBranches()
  const { data: myBranches  = [] } = useMyBranches(profile?.id)
  const branches = myBranches.length > 0 ? myBranches : allBranches

  const isEdit = state.type === "edit"

  const defaultDate = format(
    new Date(Math.min(
      new Date(year, month - 1, new Date().getDate()).getTime(),
      new Date(year, month, 0).getTime(),
    )),
    "yyyy-MM-dd",
  )

  const [branchId,     setBranchId]     = useState(isEdit ? state.transfer.branch_id : defaultBranchId ?? "")
  const [amount,       setAmount]       = useState(isEdit ? String(state.transfer.amount) : "")
  const [date,         setDate]         = useState(isEdit ? state.transfer.date : defaultDate)
  const availablePools: BalancePool[] = canUseTreasury ? POOLS : ["sales", "expenses"]

  const [source,       setSource]       = useState<BalancePool>(isEdit ? state.transfer.source as BalancePool : "sales")
  const [destination,  setDestination]  = useState<BalancePool>(isEdit ? state.transfer.destination as BalancePool : (canUseTreasury ? "treasury" : "expenses"))
  const [notes,        setNotes]        = useState(isEdit ? (state.transfer.notes ?? "") : "")

  const create = useCreateTreasuryTransfer()
  const update = useUpdateTreasuryTransfer()

  function reset() {
    setBranchId(defaultBranchId ?? "")
    setAmount("")
    setDate(defaultDate)
    setSource("sales")
    setDestination("treasury")
    setNotes("")
  }

  async function handleSave() {
    if (!branchId) { toast.error("Select a branch"); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return }
    if (source === destination) { toast.error("Source and destination must differ"); return }
    try {
      if (isEdit) {
        await update.mutateAsync({
          id:          state.transfer.id,
          amount:      amt,
          date,
          source,
          destination,
          notes:       notes.trim() || null,
        })
        toast.success("Transfer updated")
      } else {
        await create.mutateAsync({
          branch_id:   branchId,
          amount:      amt,
          date,
          source,
          destination,
          notes:       notes.trim() || null,
          added_by:    profile?.id ?? null,
        })
        toast.success("Transfer recorded")
      }
      reset()
      onOpenChange(false)
    } catch {
      toast.error("Failed to save")
    }
  }

  const isPending = create.isPending || update.isPending

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
          <SheetTitle>{isEdit ? "Edit Transfer" : "Record Transfer"}</SheetTitle>
          <SheetDescription>Move funds between pools for a branch</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Branch — only when not already scoped */}
          {!defaultBranchId && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Branch</p>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue placeholder="Select branch…" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Source → swap → Destination */}
          <div className="space-y-1.5">
            <div className="space-y-2">
              <p className="text-sm font-medium">From</p>
              <Select
                value={source}
                onValueChange={(v) => {
                  const s = v as BalancePool
                  setSource(s)
                  // expenses always pairs with sales
                  if (s === "expenses") setDestination("sales")
                  // prevent same source/destination
                  else if (s === destination) setDestination(source)
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availablePools.map((p) => (
                    <SelectItem key={p} value={p}>{POOL_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-center py-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => { const tmp = source; setSource(destination); setDestination(tmp) }}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">To</p>
              <Select value={destination} onValueChange={(v) => setDestination(v as BalancePool)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availablePools.map((p) => (
                    <SelectItem key={p} value={p}>{POOL_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Amount</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">EGP</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                className="pl-12"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

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

          {/* Notes */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </p>
            <Textarea
              placeholder="What is this transfer for?"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Balance page content ───────────────────────────────────────

function BalanceContent({
  branchId,
  branchIds,
  month,
  year,
  isManagement,
}: {
  branchId:     string | undefined
  branchIds?:   string[]
  month:        number
  year:         number
  isManagement: boolean
}) {
  const [drawer,    setDrawer]    = useState<TransferDrawerState>({ type: "none" })
  const [deleteId,  setDeleteId]  = useState<string | null>(null)

  const { isAdmin } = useAuth()
  const { canCreate, canUpdate, canDelete, canMoveTreasury, canSeeTreasury } = useUserPermissions()
  const canCreateTransfer = isAdmin || canCreate("balance")
  const canEditTransfer   = isAdmin || canUpdate("balance")
  const canDeleteTransfer = isAdmin || canDelete("balance")
  const canUseTreasury    = isAdmin || canMoveTreasury()
  const canViewTreasury   = isAdmin || canSeeTreasury()

  const { summary, isLoading: summaryLoading } = useBalanceSummary(branchId, month, year, branchIds)
  const { balances, isLoading: balancesLoading } = useAllBranchBalances(month, year, isManagement && !branchId, branchIds)
  const { data: transfers = [], isLoading: transfersLoading } = useTreasuryTransfers(branchId, month, year, branchIds)
  const deleteTransfer = useDeleteTreasuryTransfer()

  const filteredBalances = branchId
    ? balances.filter((b) => b.branchId === branchId)
    : balances

  return (
    <div className="space-y-8">

      {/* ── Summary — mobile collapsible card ─────────── */}
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
              {([
                { label: "Total Sales",    value: egp(summary.totalSales),    positive: true  },
                { label: "Total Expenses", value: egp(summary.totalExpenses), positive: false },
                { label: "Sales Pool",     value: egp(summary.salesBalance),  positive: summary.salesBalance   >= 0 },
                { label: "Expense Pool",   value: egp(summary.expenseBalance), positive: summary.expenseBalance >= 0 },
                ...(canViewTreasury ? [{ label: "Main Treasury", value: egp(summary.mainTreasury), positive: summary.mainTreasury >= 0 }] : []),
              ] as { label: string; value: string; positive: boolean }[]).map(({ label, value, positive }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className={cn(
                    "tabular-nums text-sm font-medium",
                    positive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                  )}>
                    {value}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between bg-muted/40 px-4 py-3">
                <span className="text-sm font-semibold">Total Remaining</span>
                <span className={cn(
                  "text-base font-bold tabular-nums",
                  summary.totalRemaining >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive",
                )}>
                  {egp(summary.totalRemaining)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Summary — desktop grid ─────────────────────── */}
      {/* 5 cards (no treasury): 2-col → last spans both → lg: 5-col single row */}
      {/* 6 cards (treasury):    2-col → lg: 3-col → xl: 6-col single row       */}
      <div className={cn(
        "hidden sm:grid gap-4",
        canViewTreasury
          ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
          : "sm:grid-cols-2 lg:grid-cols-5",
      )}>
        <SummaryCard label="Total Sales"    value={egp(summary.totalSales)}    icon={TrendingUp}   highlight="positive" loading={summaryLoading} />
        <SummaryCard label="Total Expenses" value={egp(summary.totalExpenses)} icon={TrendingDown} highlight="negative" loading={summaryLoading} />
        <SummaryCard label="Sales Pool"     value={egp(summary.salesBalance)}  icon={Wallet}
          highlight={summary.salesBalance   >= 0 ? "positive" : "negative"} loading={summaryLoading} />
        <SummaryCard label="Expense Pool"   value={egp(summary.expenseBalance)} icon={Wallet}
          highlight={summary.expenseBalance >= 0 ? "positive" : "negative"} loading={summaryLoading} />
        {canViewTreasury && (
          <SummaryCard label="Main Treasury" value={egp(summary.mainTreasury)} icon={Vault}
            highlight={summary.mainTreasury >= 0 ? "positive" : "negative"} loading={summaryLoading} />
        )}
        {/* Last card: span 2 at sm so it fills the row when treasury is hidden */}
        <div className={cn(!canViewTreasury && "sm:col-span-2 lg:col-span-1")}>
          <SummaryCard label="Total Remaining" value={egp(summary.totalRemaining)} icon={Wallet}
            highlight={summary.totalRemaining >= 0 ? "positive" : "negative"} loading={summaryLoading} />
        </div>
      </div>

      {/* ── Per-branch breakdown (management + all-branches view) ── */}
      {isManagement && !branchId && (
        <>
          <Separator />
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Branch Breakdown</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Balance by branch for this period</p>
            </div>

            {balancesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : filteredBalances.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                No branch data for this period
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                {/* Desktop header */}
                <div className="hidden sm:grid grid-cols-[1fr_repeat(5,_minmax(0,_1fr))] bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
                  <span>Branch</span>
                  <span className="text-right">Sales</span>
                  <span className="text-right">Expenses</span>
                  <span className="text-right">Sales Pool</span>
                  <span className="text-right">Expense Pool</span>
                  <span className="text-right">Remaining</span>
                </div>
                <div className="divide-y">
                  {filteredBalances.map((b) => (
                    <div key={b.branchId} className="grid grid-cols-2 sm:grid-cols-[1fr_repeat(5,_minmax(0,_1fr))] gap-2 px-4 py-3 items-center">
                      <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{b.branchName}</span>
                      </div>
                      <div className="sm:text-right">
                        <span className="sm:hidden text-xs text-muted-foreground mr-1">Sales:</span>
                        <span className="text-sm tabular-nums text-emerald-600 dark:text-emerald-400">{egp(b.sales)}</span>
                      </div>
                      <div className="sm:text-right">
                        <span className="sm:hidden text-xs text-muted-foreground mr-1">Expenses:</span>
                        <span className="text-sm tabular-nums text-destructive">{egp(b.expenses)}</span>
                      </div>
                      <div className="sm:text-right">
                        <span className="sm:hidden text-xs text-muted-foreground mr-1">Sales Pool:</span>
                        <span className={cn("text-sm tabular-nums font-medium", b.salesBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                          {egp(b.salesBalance)}
                        </span>
                      </div>
                      <div className="sm:text-right">
                        <span className="sm:hidden text-xs text-muted-foreground mr-1">Expense Pool:</span>
                        <span className={cn("text-sm tabular-nums font-medium", b.expenseBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                          {egp(b.expenseBalance)}
                        </span>
                      </div>
                      <div className="sm:text-right">
                        <span className="sm:hidden text-xs text-muted-foreground mr-1">Remaining:</span>
                        <span className={cn("text-sm tabular-nums font-bold", b.remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                          {egp(b.remaining)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Treasury transfers ─────────────────────────── */}
      <Separator />
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Treasury Transfers</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Funds moved between pools this period</p>
          </div>
          {canCreateTransfer && (
            <Button onClick={() => setDrawer({ type: "create" })}>
              <Plus className="h-4 w-4" />
              Add Transfer
            </Button>
          )}
        </div>

        {transfersLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : transfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-10 text-center">
            <ArrowRightLeft className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium">No transfers this period</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Record a transfer to move funds between the sales pool, expense pool, and main treasury.
              </p>
            </div>
            {canCreateTransfer && (
              <Button onClick={() => setDrawer({ type: "create" })}>
                <Plus className="h-4 w-4" />
                Add Transfer
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border divide-y">
            {transfers.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {POOL_LABELS[t.source as BalancePool] ?? t.source}
                    {" → "}
                    {POOL_LABELS[t.destination as BalancePool] ?? t.destination}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.date}
                    {(t.branch as { name?: string } | null)?.name && !branchId
                      ? ` · ${(t.branch as { name: string }).name}`
                      : ""}
                    {" · "}{(t.adder as { full_name?: string | null } | null)?.full_name ?? "—"}
                    {t.notes && <span className="italic"> · {t.notes}</span>}
                  </p>
                </div>
                <span className="tabular-nums font-semibold text-sm shrink-0">
                  {egp(t.amount)}
                </span>
                {(canEditTransfer || canDeleteTransfer) && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {canEditTransfer && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => setDrawer({ type: "edit", transfer: t })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canDeleteTransfer && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Transfer sheet ─────────────────────────────── */}
      <TransferSheet
        open={
          (drawer.type === "create" && canCreateTransfer) ||
          (drawer.type === "edit"   && canEditTransfer)
        }
        onOpenChange={(v) => { if (!v) setDrawer({ type: "none" }) }}
        state={drawer}
        branchId={branchId}
        month={month}
        year={year}
        canUseTreasury={canUseTreasury}
      />

      {/* ── Delete confirmation ────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transfer?</AlertDialogTitle>
            <AlertDialogDescription>This transfer record will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteId) return
                try { await deleteTransfer.mutateAsync(deleteId); toast.success("Transfer deleted") }
                catch { toast.error("Failed to delete") }
                finally { setDeleteId(null) }
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

// ── Page ───────────────────────────────────────────────────────

export function BalancePage() {
  const { profile } = useAuth()

  const [selectedMonth,    setSelectedMonth]    = useState(MONTH_OPTIONS[0].value)
  const [selectedBranchId, setSelectedBranchId] = useState<string | "all">("all")

  const { month, year } = useMemo(() => {
    const opt = MONTH_OPTIONS.find((o) => o.value === selectedMonth) ?? MONTH_OPTIONS[0]
    return { month: opt.month, year: opt.year }
  }, [selectedMonth])

  const { data: allBranches = [], isLoading: allBranchesLoading } = useGetBranches()
  const { data: myBranches  = [], isLoading: myBranchesLoading  } = useMyBranches(profile?.id)

  const branchList    = myBranches.length > 0 ? myBranches : allBranches
  const isMultiBranch = branchList.length > 1

  // "all" → aggregate all accessible branches; specific id → that branch only
  const activeBranchId: string | undefined =
    selectedBranchId === "all" ? undefined : selectedBranchId || undefined

  if (myBranchesLoading || allBranchesLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (branchList.length === 0) {
    return (
      <div className="p-4 md:p-6 flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
        <Vault className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Not assigned to any branch yet.</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Balance</h1>
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
        </div>

        {isMultiBranch && (
          <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branchList.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── Content ────────────────────────────────────── */}
      <BalanceContent
        branchId={activeBranchId}
        branchIds={myBranches.length > 0 && !activeBranchId ? myBranches.map((b) => b.id) : undefined}
        month={month}
        year={year}
        isManagement={isMultiBranch}
      />
    </div>
  )
}
