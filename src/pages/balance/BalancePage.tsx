import { useState, useMemo } from "react"
import { format, parseISO, isValid } from "date-fns"
import {
  TrendingUp,
  TrendingDown,
  ArrowUpFromLine,
  ArrowDownToLine,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  Landmark,
  Plus,
  Pencil,
  Trash2,
  CalendarIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/hooks/useAuth"
import { useIsMobile } from "@/hooks/use-mobile"
import { useGetBranches } from "@/hooks/useBranches"
import { useMyBranches } from "@/hooks/useAttendance"
import { useUserPermissions } from "@/hooks/usePermissions"
import {
  useTreasuryTransfers,
  usePoolTransfers,
  useExpensesPoolCredit,
  useBalanceSummary,
  useAllBranchBalances,
  useBalanceRealtime,
  useCreateTreasuryTransfer,
  useUpdateTreasuryTransfer,
  useDeleteTreasuryTransfer,
  useCreatePoolTransfer,
  useUpdatePoolTransfer,
  useDeletePoolTransfer,
} from "@/hooks/useBalance"
import { useLanguage } from "@/contexts/LanguageContext"
import { cn } from "@/lib/utils"
import { MultiSelect } from "@/components/ui/multi-select"
import type { Branch } from "@/types/branch"
import type { TreasuryTransfer, PoolTransfer, BalanceSummary, BranchBalance } from "@/types/balance"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

// ── Balance overview cards ────────────────────────────────────

interface OverviewRow {
  label: string
  value: number
  bold?: boolean
  red?: boolean
  separator?: boolean
  hidden?: boolean
}

function OverviewCard({
  icon: Icon,
  title,
  rows,
  loading,
}: {
  icon: React.ElementType
  title: string
  rows: OverviewRow[]
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row, i) => (
          <div key={i}>
            {row.separator && <div className="border-t my-1" />}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{row.label}</span>
              {loading ? (
                <Skeleton className="h-4 w-20" />
              ) : row.hidden ? (
                <span className="text-sm text-muted-foreground select-none">—</span>
              ) : (
                <span className={cn(
                  "tabular-nums text-sm",
                  row.bold ? "font-bold text-base" : "font-semibold",
                  (row.red || row.value < 0) ? "text-destructive" : "text-foreground",
                )}>
                  {egp(row.value)}
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function BalanceOverview({
  summary,
  poolCredit,
  canTreasuryRead,
  canPoolRead,
  loading,
}: {
  summary: BalanceSummary
  poolCredit: number
  canTreasuryRead: boolean
  canPoolRead: boolean
  loading: boolean
}) {
  const { t } = useLanguage()
  const { totalSales, totalExpenses, totalTransferred, totalRemaining } = summary
  const poolRemaining = poolCredit - totalExpenses

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* Sales group — treasury row always shown, value hidden if no permission */}
      <OverviewCard
        icon={TrendingUp}
        title={t("Sales")}
        loading={loading}
        rows={[
          { label: t("Total Revenue"),           value: totalSales,       hidden: !canTreasuryRead },
          { label: t("Transferred to Treasury"), value: totalTransferred, hidden: !canTreasuryRead },
          { label: t("Remaining in Sales"),      value: totalRemaining,   bold: true, separator: true },
        ]}
      />

      {/* Expenses group */}
      <OverviewCard
        icon={TrendingDown}
        title={t("Expenses")}
        loading={loading}
        rows={[
          ...(canPoolRead ? [{ label: t("Budget"),            value: poolCredit }] : []),
          {                  label: t("Spent"),               value: totalExpenses, red: true },
          ...(canPoolRead ? [{ label: t("Remaining in Pool"), value: poolRemaining, separator: true, bold: true }] : []),
        ]}
      />
    </div>
  )
}

// ── Treasury transfer sheet ───────────────────────────────────

function TransferSheet({
  open,
  onOpenChange,
  selectedBranchId,
  selectedBranchName,
  branches,
  month,
  year,
  editTransfer,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  selectedBranchId: string | undefined
  selectedBranchName: string | undefined
  branches: Branch[]
  month: number
  year: number
  editTransfer: TreasuryTransfer | null
}) {
  const { t } = useLanguage()
  const isMobile = useIsMobile()
  const { profile } = useAuth()
  const create = useCreateTreasuryTransfer()
  const update = useUpdateTreasuryTransfer()

  const isEditing = !!editTransfer

  const defaultDate = format(
    new Date(Math.min(new Date(year, month - 1, new Date().getDate()).getTime(), new Date(year, month, 0).getTime())),
    "yyyy-MM-dd",
  )

  const [branchId,  setBranchId]  = useState(selectedBranchId ?? "")
  const [direction, setDirection] = useState<"outflow" | "inflow">("outflow")
  const [amount,    setAmount]    = useState("")
  const [date,      setDate]      = useState(defaultDate)
  const [notes,     setNotes]     = useState("")

  const { summary: branchSummary } = useBalanceSummary(branchId || undefined, month, year)

  const [lastEditId, setLastEditId] = useState(editTransfer?.id)
  if (editTransfer?.id !== lastEditId) {
    setLastEditId(editTransfer?.id)
    if (editTransfer) {
      setAmount(String(editTransfer.amount))
      setDate(editTransfer.date)
      setNotes(editTransfer.notes ?? "")
      setDirection(editTransfer.direction ?? "outflow")
      setBranchId((editTransfer.branch as { id: string } | null)?.id ?? editTransfer.branch_id)
    }
  }

  const [lastSelected, setLastSelected] = useState(selectedBranchId)
  if (selectedBranchId !== lastSelected) {
    setLastSelected(selectedBranchId)
    if (!isEditing) setBranchId(selectedBranchId ?? "")
  }

  function reset() {
    setAmount(""); setNotes(""); setDate(defaultDate)
    setBranchId(selectedBranchId ?? ""); setDirection("outflow")
  }

  async function handleSave() {
    if (!branchId) { toast.error(t("Select a branch")); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error(t("Enter a valid amount")); return }
    try {
      if (isEditing && editTransfer) {
        await update.mutateAsync({ id: editTransfer.id, amount: amt, direction, date, notes: notes.trim() || null })
        toast.success(t("Transfer updated"))
      } else {
        await create.mutateAsync({ branch_id: branchId, amount: amt, direction, date, notes: notes.trim() || null, added_by: profile?.id ?? null })
        toast.success(t("Transfer added"))
      }
      reset(); onOpenChange(false)
    } catch { toast.error(t("Failed to save")) }
  }

  const isPending = create.isPending || update.isPending

  const activeBranchName = selectedBranchName
    ?? branches.find(b => b.id === branchId)?.name
    ?? (editTransfer?.branch as { id: string; name: string } | null)?.name

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { reset(); onOpenChange(false) } }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn("flex flex-col gap-0 overflow-hidden p-0", isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-md")}
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle>{isEditing ? t("Edit Transfer") : t("Add Treasury Transfer")}</SheetTitle>
          <SheetDescription>
            {activeBranchName
              ? `${t("Branch")}: ${activeBranchName}`
              : t("Select a branch to record a treasury transfer")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Branch selector — only when no branch is pre-selected */}
          {!selectedBranchId && !isEditing && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("Branch")}</p>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue placeholder={t("Select branch…")} /></SelectTrigger>
                <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          {/* Direction */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("Direction")}</p>
            <Select value={direction} onValueChange={(v) => setDirection(v as "outflow" | "inflow")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="outflow">
                  <span className="flex items-center gap-2">
                    <ArrowUpFromLine className="h-3.5 w-3.5 text-emerald-600" />
                    {t("Branch → Treasury (outflow)")}
                  </span>
                </SelectItem>
                <SelectItem value="inflow">
                  <span className="flex items-center gap-2">
                    <ArrowDownToLine className="h-3.5 w-3.5 text-blue-500" />
                    {t("Treasury → Branch (inflow)")}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("Amount")}</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">EGP</span>
              <Input type="number" inputMode="decimal" min={0} step="0.01" placeholder="0.00" className="pl-12" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            {branchId && direction === "outflow" && (
              <p className={cn("text-xs pl-1", branchSummary.totalRemaining <= 0 ? "text-destructive" : "text-muted-foreground")}>
                {t("Branch balance")}: <span className="font-medium">{egp(branchSummary.totalRemaining)}</span>
              </p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("Date")}</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {date && isValid(parseISO(date)) ? format(parseISO(date), "d MMM yyyy") : t("Pick a date")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date && isValid(parseISO(date)) ? parseISO(date) : undefined} onSelect={(d) => d && setDate(format(d, "yyyy-MM-dd"))} />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("Notes")} <span className="font-normal text-muted-foreground">({t("optional")})</span></p>
            <Textarea placeholder={direction === "outflow" ? t("Why was this transferred?") : t("What is this money for?")} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={isPending}>{t("Cancel")}</Button>
          <Button onClick={handleSave} disabled={isPending}>{isPending ? t("Saving…") : t("Save")}</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Pool transfer sheet ───────────────────────────────────────

function PoolTransferSheet({
  open,
  onOpenChange,
  selectedBranchId,
  selectedBranchName,
  branches,
  month,
  year,
  editTransfer,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  selectedBranchId: string | undefined
  selectedBranchName: string | undefined
  branches: Branch[]
  month: number
  year: number
  editTransfer: PoolTransfer | null
}) {
  const { t } = useLanguage()
  const isMobile = useIsMobile()
  const { profile } = useAuth()
  const create = useCreatePoolTransfer()
  const update = useUpdatePoolTransfer()

  const isEditing = !!editTransfer

  const defaultDate = format(
    new Date(Math.min(new Date(year, month - 1, new Date().getDate()).getTime(), new Date(year, month, 0).getTime())),
    "yyyy-MM-dd",
  )

  const [branchId,  setBranchId]  = useState(selectedBranchId ?? "")
  const [direction, setDirection] = useState<"sales_to_expenses" | "expenses_to_sales">("sales_to_expenses")
  const [amount,    setAmount]    = useState("")
  const [date,      setDate]      = useState(defaultDate)
  const [notes,     setNotes]     = useState("")

  const from = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
  const to   = format(new Date(year, month, 0), "yyyy-MM-dd")
  const { summary: branchSummary } = useBalanceSummary(branchId || undefined, month, year)
  const { data: poolCredit = 0 }   = useExpensesPoolCredit(branchId || undefined, from, to)

  const [lastEditId, setLastEditId] = useState(editTransfer?.id)
  if (editTransfer?.id !== lastEditId) {
    setLastEditId(editTransfer?.id)
    if (editTransfer) {
      setAmount(String(editTransfer.amount))
      setDate(editTransfer.date)
      setNotes(editTransfer.notes ?? "")
      setBranchId((editTransfer.branch as { id: string } | null)?.id ?? editTransfer.branch_id)
      setDirection(editTransfer.from_pool === "sales" ? "sales_to_expenses" : "expenses_to_sales")
    }
  }

  const [lastSelected, setLastSelected] = useState(selectedBranchId)
  if (selectedBranchId !== lastSelected) {
    setLastSelected(selectedBranchId)
    if (!isEditing) setBranchId(selectedBranchId ?? "")
  }

  function reset() {
    setAmount(""); setNotes(""); setDate(defaultDate)
    setBranchId(selectedBranchId ?? ""); setDirection("sales_to_expenses")
  }

  async function handleSave() {
    if (!branchId) { toast.error(t("Select a branch")); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error(t("Enter a valid amount")); return }

    // For edits, the original amount is already reflected in the current balances,
    // so add it back to get the true available headroom.
    const originalAmt = isEditing && editTransfer && editTransfer.from_pool === (direction === "sales_to_expenses" ? "sales" : "expenses")
      ? editTransfer.amount
      : 0
    const limit = availableBalance + originalAmt
    if (amt > limit) {
      const label = direction === "sales_to_expenses" ? t("branch balance") : t("pool credit")
      toast.error(`${t("Amount exceeds available")} ${label} (${egp(limit)})`)
      return
    }

    const from_pool: "sales" | "expenses" = direction === "sales_to_expenses" ? "sales" : "expenses"
    const to_pool:   "sales" | "expenses" = direction === "sales_to_expenses" ? "expenses" : "sales"
    try {
      if (isEditing && editTransfer) {
        await update.mutateAsync({ id: editTransfer.id, amount: amt, from_pool, to_pool, date, notes: notes.trim() || null })
        toast.success(t("Pool transfer updated"))
      } else {
        await create.mutateAsync({ branch_id: branchId, amount: amt, from_pool, to_pool, date, notes: notes.trim() || null, added_by: profile?.id ?? null })
        toast.success(t("Pool transfer added"))
      }
      reset(); onOpenChange(false)
    } catch { toast.error(t("Failed to save")) }
  }

  const isPending = create.isPending || update.isPending

  const activeBranchName = selectedBranchName
    ?? branches.find(b => b.id === branchId)?.name
    ?? (editTransfer?.branch as { id: string; name: string } | null)?.name

  const availableBalance  = direction === "sales_to_expenses" ? branchSummary.totalRemaining : poolCredit
  const availableLabel    = direction === "sales_to_expenses" ? t("Branch balance") : t("Expenses pool credit")
  const enteredAmt        = parseFloat(amount) || 0
  const exceedsLimit      = !!branchId && enteredAmt > 0 && enteredAmt > availableBalance

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { reset(); onOpenChange(false) } }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn("flex flex-col gap-0 overflow-hidden p-0", isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-md")}
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle>{isEditing ? t("Edit Pool Transfer") : t("Add Pool Transfer")}</SheetTitle>
          <SheetDescription>
            {activeBranchName
              ? `${t("Branch")}: ${activeBranchName}`
              : t("Select a branch to record a pool transfer")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Branch */}
          {!selectedBranchId && !isEditing && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("Branch")}</p>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue placeholder={t("Select branch…")} /></SelectTrigger>
                <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          {/* Direction */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("Direction")}</p>
            <Select value={direction} onValueChange={(v) => setDirection(v as "sales_to_expenses" | "expenses_to_sales")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sales_to_expenses">
                  <span className="flex items-center gap-2">
                    <ArrowRight className="h-3.5 w-3.5 text-indigo-500" />
                    {t("Sales → Expenses (allocate)")}
                  </span>
                </SelectItem>
                <SelectItem value="expenses_to_sales">
                  <span className="flex items-center gap-2">
                    <ArrowLeft className="h-3.5 w-3.5 text-amber-500" />
                    {t("Expenses → Sales (return)")}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("Amount")}</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">EGP</span>
              <Input type="number" inputMode="decimal" min={0} step="0.01" placeholder="0.00" className="pl-12" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            {branchId && (
              <p className={cn("text-xs pl-1", exceedsLimit ? "text-destructive" : availableBalance <= 0 ? "text-destructive" : "text-muted-foreground")}>
                {availableLabel}: <span className="font-medium">{egp(availableBalance)}</span>
                {exceedsLimit && <span className="ml-1 font-semibold"> — {t("exceeds limit")}</span>}
              </p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("Date")}</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {date && isValid(parseISO(date)) ? format(parseISO(date), "d MMM yyyy") : t("Pick a date")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date && isValid(parseISO(date)) ? parseISO(date) : undefined} onSelect={(d) => d && setDate(format(d, "yyyy-MM-dd"))} />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("Notes")} <span className="font-normal text-muted-foreground">({t("optional")})</span></p>
            <Textarea placeholder={t("Reason for this transfer…")} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={isPending}>{t("Cancel")}</Button>
          <Button onClick={handleSave} disabled={isPending || exceedsLimit}>{isPending ? t("Saving…") : t("Save")}</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Shared table sticky-column classes ───────────────────────

const STICKY_HEAD = "px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap sticky left-0 z-10 bg-muted/40 relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']"
const STICKY_CELL = "px-4 py-3 sticky left-0 z-10 bg-background relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']"
const TH = "px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap"

// ── Branch breakdown section ──────────────────────────────────


function BranchBreakdownSection({
  balances,
  summary,
  isLoading,
  canPoolRead,
}: {
  balances: BranchBalance[]
  summary: BalanceSummary
  isLoading: boolean
  canPoolRead: boolean
}) {
  const { t } = useLanguage()

  if (isLoading) {
    return (
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className={STICKY_HEAD}>{t("Branch")}</th>
              <th className={`${TH} text-right`}>{t("Sales")}</th>
              <th className={`${TH} text-right`}>{t("Expenses")}</th>
              <th className={`${TH} text-right`}>{t("Transferred")}</th>
              {canPoolRead && <th className={`${TH} text-right`}>{t("Pool Credit")}</th>}
              <th className={`${TH} text-right`}>{t("Remaining")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}>
                <td className={STICKY_CELL}><Skeleton className="h-4 w-28" /></td>
                <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                {canPoolRead && <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>}
                <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (!balances.length) return null

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{t("Branch Breakdown")}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t("Per-branch summary for the selected period")}</p>
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className={STICKY_HEAD}>{t("Branch")}</th>
              <th className={`${TH} text-right`}>{t("Sales")}</th>
              <th className={`${TH} text-right`}>{t("Expenses")}</th>
              <th className={`${TH} text-right`}>{t("Transferred")}</th>
              {canPoolRead && <th className={`${TH} text-right`}>{t("Pool Credit")}</th>}
              <th className={`${TH} text-right`}>{t("Remaining")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {balances.map((b) => (
              <tr key={b.branchId}>
                <td className={cn(STICKY_CELL, "font-medium whitespace-nowrap")}>{b.branchName}</td>
                <td className="px-4 py-3 text-right tabular-nums">{egp(b.sales)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-destructive">{egp(b.expenses)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{egp(b.transferred)}</td>
                {canPoolRead && <td className="px-4 py-3 text-right tabular-nums">{egp(b.poolCredit)}</td>}
                <td className={cn("px-4 py-3 text-right tabular-nums font-semibold", b.remaining < 0 && "text-destructive")}>{egp(b.remaining)}</td>
              </tr>
            ))}
            <tr className="border-t-2 bg-muted/20">
              <td className={cn(STICKY_CELL, "font-bold bg-muted/20")}>{t("Total")}</td>
              <td className="px-4 py-3 text-right tabular-nums font-bold">{egp(summary.totalSales)}</td>
              <td className="px-4 py-3 text-right tabular-nums font-bold text-destructive">{egp(summary.totalExpenses)}</td>
              <td className="px-4 py-3 text-right tabular-nums font-bold">{egp(summary.totalTransferred)}</td>
              {canPoolRead && <td className="px-4 py-3 text-right tabular-nums font-bold">—</td>}
              <td className={cn("px-4 py-3 text-right tabular-nums font-bold", summary.totalRemaining < 0 && "text-destructive")}>{egp(summary.totalRemaining)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Balance content ───────────────────────────────────────────

function BalanceContent({
  branchId,
  branchName,
  branchIds,
  month,
  year,
  branches,
  canTreasuryRead,
  canTreasuryCreate,
  canTreasuryUpdate,
  canTreasuryDelete,
  canPoolRead,
  canPoolCreate,
  canPoolUpdate,
  canPoolDelete,
  canBreakdownRead,
}: {
  branchId: string | undefined
  branchName: string | undefined
  branchIds: string[]
  month: number
  year: number
  branches: Branch[]
  canTreasuryRead: boolean
  canTreasuryCreate: boolean
  canTreasuryUpdate: boolean
  canTreasuryDelete: boolean
  canPoolRead: boolean
  canPoolCreate: boolean
  canPoolUpdate: boolean
  canPoolDelete: boolean
  canBreakdownRead: boolean
}) {
  const { t } = useLanguage()
  const [transferOpen,  setTransferOpen]  = useState(false)
  const [editTransfer,  setEditTransfer]  = useState<TreasuryTransfer | null>(null)
  const [delTransferId, setDelTransferId] = useState<string | null>(null)
  const [poolOpen,      setPoolOpen]      = useState(false)
  const [editPool,      setEditPool]      = useState<PoolTransfer | null>(null)
  const [delPoolId,     setDelPoolId]     = useState<string | null>(null)

  useBalanceRealtime()

  const isAllBranches = !branchId
  const from = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
  const to   = format(new Date(year, month, 0), "yyyy-MM-dd")

  const { summary, isLoading: summaryLoading }   = useBalanceSummary(branchId, month, year, branchIds)
  const { balances, isLoading: balancesLoading } = useAllBranchBalances(month, year, canBreakdownRead, branchIds)
  const { data: transfers = [], isPending: transfersLoading }         = useTreasuryTransfers(branchId, month, year)
  const { data: poolTransfers = [], isPending: poolTransfersLoading } = usePoolTransfers(branchId, from, to)
  const { data: poolCredit = 0, isPending: poolCreditLoading }        = useExpensesPoolCredit(branchId, from, to)

  const deleteTreasuryTransfer = useDeleteTreasuryTransfer()
  const deletePoolTransfer     = useDeletePoolTransfer()

  function handleTreasurySheetClose(v: boolean) {
    if (!v) { setTransferOpen(false); setTimeout(() => setEditTransfer(null), 300) }
  }
  function handlePoolSheetClose(v: boolean) {
    if (!v) { setPoolOpen(false); setTimeout(() => setEditPool(null), 300) }
  }

  return (
    <div className="space-y-8">

      {/* ── Overview cards ───────────────────────────────── */}
      <BalanceOverview
        summary={summary}
        poolCredit={poolCredit}
        canTreasuryRead={canTreasuryRead}
        canPoolRead={canPoolRead}
        loading={summaryLoading || poolCreditLoading}
      />

      {/* ── Branch breakdown ─────────────────────────────── */}
      {canBreakdownRead && (
        <>
          <Separator />
          <BranchBreakdownSection
            balances={balances}
            summary={summary}
            isLoading={balancesLoading}
            canPoolRead={canPoolRead}
          />
        </>
      )}


      {/* ── Treasury transfers ────────────────────────────── */}
      {canTreasuryRead && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">{t("Treasury Transfers")}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{t("Money moved between branches and main treasury")}</p>
              </div>
              {canTreasuryCreate && transfers.length > 0 && !transfersLoading && (
                <Button onClick={() => { setEditTransfer(null); setTransferOpen(true) }}>
                  <Plus className="h-4 w-4" /> {t("Add Transfer")}
                </Button>
              )}
            </div>

            {transfersLoading ? (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40"><tr><th className={STICKY_HEAD}>{t("Date")}</th>{isAllBranches && <th className={TH}>{t("Branch")}</th>}<th className={`${TH} text-right`}>{t("Amount")}</th><th className={TH}>{t("Notes")}</th><th className={TH}>{t("Added by")}</th></tr></thead>
                  <tbody className="divide-y">{Array.from({ length: 4 }).map((_, i) => <tr key={i}><td className={STICKY_CELL}><Skeleton className="h-4 w-24" /></td>{isAllBranches && <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>}<td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td><td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td><td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td></tr>)}</tbody>
                </table>
              </div>
            ) : transfers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center">
                <Landmark className="h-8 w-8 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium">{t("No treasury transfers this period")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("Record money moved between branches and the main treasury")}</p>
                </div>
                {canTreasuryCreate && (
                  <Button onClick={() => { setEditTransfer(null); setTransferOpen(true) }}>
                    <Plus className="h-4 w-4" /> {t("Add Transfer")}
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className={STICKY_HEAD}>{t("Date")}</th>
                      {isAllBranches && <th className={TH}>{t("Branch")}</th>}
                      <th className={`${TH} text-right`}>{t("Amount")}</th>
                      <th className={TH}>{t("Notes")}</th>
                      <th className={TH}>{t("Added by")}</th>
                      {(canTreasuryUpdate || canTreasuryDelete) && <th className="px-4 py-3 w-10" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {transfers.map((t) => {
                      const branchObj = t.branch as { id: string; name: string } | null
                      const adderObj  = t.adder  as { id: string; full_name: string | null } | null
                      const isInflow  = t.direction === "inflow"
                      return (
                        <tr key={t.id} className="hover:bg-muted/30">
                          <td className={cn(STICKY_CELL, "whitespace-nowrap text-muted-foreground")}>{format(new Date(t.date), "MMM d, yyyy")}</td>
                          {isAllBranches && <td className="px-4 py-3 font-medium whitespace-nowrap">{branchObj?.name ?? "—"}</td>}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {isInflow ? <ArrowDownToLine className="h-3.5 w-3.5 text-blue-500" /> : <ArrowUpFromLine className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                              <span className={cn("tabular-nums font-medium", isInflow ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400")}>{egp(t.amount)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{t.notes || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{adderObj?.full_name ?? "—"}</td>
                          {(canTreasuryUpdate || canTreasuryDelete) && (
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                {canTreasuryUpdate && <Button size="icon" variant="ghost" onClick={() => { setEditTransfer(t); setTransferOpen(true) }}><Pencil className="h-4 w-4" /></Button>}
                                {canTreasuryDelete && <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDelTransferId(t.id)}><Trash2 className="h-4 w-4" /></Button>}
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Pool transfers ────────────────────────────────── */}
      {canPoolRead && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">{t("Pool Transfers")}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{t("Money moved between sales and expenses pools")}</p>
              </div>
              {canPoolCreate && poolTransfers.length > 0 && !poolTransfersLoading && (
                <Button onClick={() => { setEditPool(null); setPoolOpen(true) }}>
                  <Plus className="h-4 w-4" /> {t("Add Pool Transfer")}
                </Button>
              )}
            </div>

            {poolTransfersLoading ? (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40"><tr><th className={STICKY_HEAD}>{t("Date")}</th>{isAllBranches && <th className={TH}>{t("Branch")}</th>}<th className={TH}>{t("Type")}</th><th className={`${TH} text-right`}>{t("Amount")}</th><th className={TH}>{t("Notes")}</th><th className={TH}>{t("Added by")}</th></tr></thead>
                  <tbody className="divide-y">{Array.from({ length: 3 }).map((_, i) => <tr key={i}><td className={STICKY_CELL}><Skeleton className="h-4 w-24" /></td>{isAllBranches && <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>}<td className="px-4 py-3"><Skeleton className="h-5 w-28 rounded-full" /></td><td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td><td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td><td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td></tr>)}</tbody>
                </table>
              </div>
            ) : poolTransfers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center">
                <ArrowLeftRight className="h-8 w-8 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium">{t("No pool transfers this period")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("Pool transfers allocate money between sales and expenses pools")}</p>
                </div>
                {canPoolCreate && (
                  <Button onClick={() => { setEditPool(null); setPoolOpen(true) }}>
                    <Plus className="h-4 w-4" /> {t("Add Pool Transfer")}
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className={STICKY_HEAD}>{t("Date")}</th>
                      {isAllBranches && <th className={TH}>{t("Branch")}</th>}
                      <th className={TH}>{t("Type")}</th>
                      <th className={`${TH} text-right`}>{t("Amount")}</th>
                      <th className={TH}>{t("Notes")}</th>
                      <th className={TH}>{t("Added by")}</th>
                      {(canPoolUpdate || canPoolDelete) && <th className="px-4 py-3 w-10" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {poolTransfers.map((pt) => {
                      const branchObj  = pt.branch as { id: string; name: string } | null
                      const adderObj   = pt.adder  as { id: string; full_name: string | null } | null
                      const toExpenses = pt.from_pool === "sales"
                      return (
                        <tr key={pt.id} className="hover:bg-muted/30">
                          <td className={cn(STICKY_CELL, "whitespace-nowrap text-muted-foreground")}>{format(new Date(pt.date), "MMM d, yyyy")}</td>
                          {isAllBranches && <td className="px-4 py-3 font-medium whitespace-nowrap">{branchObj?.name ?? "—"}</td>}
                          <td className="px-4 py-3">
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                              toExpenses ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400" : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
                            )}>
                              {toExpenses ? <><ArrowRight className="h-3 w-3" />{t("Sales → Exp.")}</> : <><ArrowLeft className="h-3 w-3" />{t("Exp. → Sales")}</>}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium whitespace-nowrap">{egp(pt.amount)}</td>
                          <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{pt.notes || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{adderObj?.full_name ?? "—"}</td>
                          {(canPoolUpdate || canPoolDelete) && (
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                {canPoolUpdate && <Button size="icon" variant="ghost" onClick={() => { setEditPool(pt); setPoolOpen(true) }}><Pencil className="h-4 w-4" /></Button>}
                                {canPoolDelete && <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDelPoolId(pt.id)}><Trash2 className="h-4 w-4" /></Button>}
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Sheets ────────────────────────────────────────── */}
      <TransferSheet
        open={transferOpen} onOpenChange={handleTreasurySheetClose}
        selectedBranchId={branchId} selectedBranchName={branchName}
        branches={branches} month={month} year={year}
        editTransfer={editTransfer}
      />
      <PoolTransferSheet
        open={poolOpen} onOpenChange={handlePoolSheetClose}
        selectedBranchId={branchId} selectedBranchName={branchName}
        branches={branches} month={month} year={year}
        editTransfer={editPool}
      />

      {/* ── Delete dialogs ────────────────────────────────── */}
      <AlertDialog open={!!delTransferId} onOpenChange={(v) => { if (!v) setDelTransferId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete treasury transfer?")}</AlertDialogTitle>
            <AlertDialogDescription>{t("This transfer record will be permanently removed.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!delTransferId) return
                try { await deleteTreasuryTransfer.mutateAsync(delTransferId); toast.success(t("Deleted")) }
                catch { toast.error(t("Failed to delete")) }
                finally { setDelTransferId(null) }
              }}>{t("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!delPoolId} onOpenChange={(v) => { if (!v) setDelPoolId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete pool transfer?")}</AlertDialogTitle>
            <AlertDialogDescription>{t("This pool transfer record will be permanently removed.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!delPoolId) return
                try { await deletePoolTransfer.mutateAsync(delPoolId); toast.success(t("Deleted")) }
                catch { toast.error(t("Failed to delete")) }
                finally { setDelPoolId(null) }
              }}>{t("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function BalancePage() {
  const { t } = useLanguage()
  const { profile, isAdmin, isOwner } = useAuth()
  const { canRead, canCreate, canUpdate, canDelete } = useUserPermissions()

  const isManagement = isAdmin || isOwner

  const [selectedMonth,     setSelectedMonth]     = useState(MONTH_OPTIONS[0]?.value ?? "")
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])

  const { month, year } = useMemo(() => {
    const opt = MONTH_OPTIONS.find((o) => o.value === selectedMonth) ?? MONTH_OPTIONS[0]
    return { month: opt?.month ?? new Date().getMonth() + 1, year: opt?.year ?? new Date().getFullYear() }
  }, [selectedMonth])

  const { data: allBranches = [] }                       = useGetBranches()
  const { data: myBranches = [], isLoading: branchLoad } = useMyBranches(profile?.id)

  const branchList = isManagement ? allBranches : myBranches

  const activeBranchId   = selectedBranchIds.length === 1 ? selectedBranchIds[0] : undefined
  const activeBranchName = activeBranchId ? branchList.find(b => b.id === activeBranchId)?.name : undefined
  const activeBranchIds  = selectedBranchIds.length > 0 ? selectedBranchIds : branchList.map(b => b.id)

  if (!isManagement && branchLoad) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-56" /><Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!isManagement && myBranches.length === 0) {
    return (
      <div className="p-4 md:p-6 flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
        <Landmark className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t("Not assigned to any branch yet.")}</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold mr-1">{t("Balance")}</h1>

        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[150px] h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTH_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <MultiSelect
          options={branchList.map(b => ({ value: b.id, label: b.name }))}
          selected={selectedBranchIds}
          onChange={setSelectedBranchIds}
          placeholder={t("All Branches")}
          className="h-8 text-sm w-[160px]"
        />
      </div>

      <BalanceContent
        branchId={activeBranchId}
        branchName={activeBranchName}
        branchIds={activeBranchIds}
        month={month}
        year={year}
        branches={branchList}
        canTreasuryRead={canRead("treasury")}
        canTreasuryCreate={canCreate("treasury")}
        canTreasuryUpdate={canUpdate("treasury")}
        canTreasuryDelete={canDelete("treasury")}
        canPoolRead={canRead("pool_transfers")}
        canPoolCreate={canCreate("pool_transfers")}
        canPoolUpdate={canUpdate("pool_transfers")}
        canPoolDelete={canDelete("pool_transfers")}
        canBreakdownRead={canRead("branch_breakdown")}
      />
    </div>
  )
}
