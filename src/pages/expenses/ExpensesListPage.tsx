import { useState, useMemo } from "react"
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, subDays, subMonths } from "date-fns"
import type { DateRange } from "react-day-picker"
import {
  Plus,
  Receipt,
  Trash2,
  MoreHorizontal,
  TrendingDown,
  Pencil,
  Search,
  ChevronDown,
  CalendarDays,
} from "lucide-react"
import { toast } from "sonner"

import { useIsMobile } from "@/hooks/use-mobile"
import { useAuth } from "@/hooks/useAuth"
import { useUserPermissions } from "@/hooks/usePermissions"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useGetBranches } from "@/hooks/useBranches"
import { useMyBranches } from "@/hooks/useAttendance"
import { useQueryClient } from "@tanstack/react-query"
import { useGetExpenses, useGetExpenseCategories } from "@/hooks/useExpenses"
import { useDeleteExpense } from "@/hooks/useExpenseMutations"
import { supabase } from "@/lib/supabase"
import { getCategoryIcon } from "@/components/expenses/AddExpenseSheet"
import { AddExpenseSheet } from "@/components/expenses/AddExpenseSheet"
import { ExpenseDetailSheet } from "@/components/expenses/ExpenseDetailSheet"
import { ExpenseSummaryChart } from "@/components/expenses/ExpenseSummaryChart"
import { ExpenseBranchChart } from "@/components/expenses/ExpenseBranchChart"
import type { Expense, ExpenseFilters } from "@/types/expense"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { MultiSelect } from "@/components/ui/multi-select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
// ── Drawer state ───────────────────────────────────────────

type DrawerState =
  | { type: "none" }
  | { type: "create" }
  | { type: "view"; expense: Expense }
  | { type: "edit"; expense: Expense }

// ── Helpers ────────────────────────────────────────────────

function formatAmount(amount: number) {
  return `EGP ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(dateStr: string) {
  return format(parseISO(dateStr), "MMM d, yyyy")
}

// ── Receipt image viewer ───────────────────────────────────

function ReceiptDialog({ url, open, onOpenChange }: { url: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Receipt</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <img
            src={url}
            alt="Receipt"
            className="max-h-[60vh] w-full rounded-lg object-contain"
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Open in new tab
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Skeleton loaders ───────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          <td className="px-4 py-3 sticky left-0 z-10 bg-background relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']"><Skeleton className="h-4 w-24" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
          <td className="px-4 py-3"><Skeleton className="h-10 w-10 rounded" /></td>
          <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
          <td className="px-4 py-3"><Skeleton className="h-6 w-6 ml-auto" /></td>
        </tr>
      ))}
    </>
  )
}

function CardSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3 border-b last:border-0">
          <Skeleton className="h-10 w-10 rounded shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </>
  )
}

// ── Mobile card ────────────────────────────────────────────

function ExpenseCard({
  expense,
  onView,
}: {
  expense: Expense
  onView: (e: Expense) => void
}) {
  const Icon = getCategoryIcon(expense.category?.icon ?? null)

  return (
    <button
      className="w-full px-4 py-3 border-b last:border-0 text-left hover:bg-muted/40 transition-colors"
      onClick={() => onView(expense)}
    >
      <div className="flex items-start gap-3">
        {expense.receipt_url ? (
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded border">
            <img src={expense.receipt_url} alt="Receipt" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {expense.category?.name ?? "Uncategorized"}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>{expense.branch?.name}</span>
            <span className="opacity-40">·</span>
            <span>{formatDate(expense.date)}</span>
            {expense.edited_at && <Pencil className="h-2.5 w-2.5 text-amber-500 fill-amber-500 shrink-0" />}
          </p>
          {expense.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{expense.description}</p>
          )}
        </div>

        <span className="text-sm font-semibold tabular-nums shrink-0">{formatAmount(expense.amount)}</span>
      </div>
    </button>
  )
}

// ── Main page ──────────────────────────────────────────────

const APP_START = new Date(2026, 5, 1) // June 2026 — first month of operation

// ── Date-range label ───────────────────────────────────────

function formatDateRangeTrigger(range: DateRange | undefined) {
  if (!range?.from) return "Pick dates"
  if (!range.to || range.from.toDateString() === range.to.toDateString())
    return format(range.from, "MMM d, yyyy")
  if (
    range.from.getFullYear() === range.to.getFullYear() &&
    range.from.getMonth()    === range.to.getMonth()
  )
    return `${format(range.from, "MMM d")} – ${format(range.to, "d, yyyy")}`
  return `${format(range.from, "MMM d")} – ${format(range.to, "MMM d, yyyy")}`
}

// ── Page ───────────────────────────────────────────────────

export function ExpensesListPage() {
  const isMobile = useIsMobile()
  const { isAdmin, profile } = useAuth()
  const { canCreate, canUpdate, canDelete } = useUserPermissions()

  // can_create("expenses") = "Submit new expenses"
  const canSubmit      = isAdmin || canCreate("expenses")
  // can_update("expenses") = "Edit expenses & view analytics charts"
  const canEdit        = isAdmin || canUpdate("expenses")
  // can_delete("expenses") = "Delete expenses"
  const canDeleteEntry = isAdmin || canDelete("expenses")
  const [drawer, setDrawer]             = useState<DrawerState>({ type: "none" })
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [chartsOpen, setChartsOpen]     = useState(false)
  const qc = useQueryClient()
  const [viewingImage, setViewingImage] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to:   endOfMonth(new Date()),
  })
  const [branchFilters,  setBranchFilters]  = useState<string[]>([])
  const [categoryFilters, setCategoryFilters] = useState<string[]>([])
  const [search,         setSearch]         = useState("")

  const chartMonth = (dateRange.from ?? new Date()).getMonth() + 1
  const chartYear  = (dateRange.from ?? new Date()).getFullYear()

  // Branch scoping: non-admins only see their assigned branches
  const { data: allBranches = [] } = useGetBranches()
  const { data: myBranches  = [] } = useMyBranches(profile?.id)
  const branchList  = myBranches.length > 0 ? myBranches : allBranches
  const myBranchIds = myBranches.length > 0 ? myBranches.map((b) => b.id) : undefined

  const singleBranchId = branchFilters.length === 1 ? branchFilters[0] : undefined

  const filters: ExpenseFilters = useMemo(() => ({
    branchIds:    branchFilters.length > 0 ? branchFilters : myBranchIds,
    categoryIds:  categoryFilters.length > 0 ? categoryFilters : undefined,
    dateFilter: "custom",
    dateFrom:   format(dateRange.from ?? startOfMonth(new Date()), "yyyy-MM-dd"),
    dateTo:     format(dateRange.to   ?? endOfMonth(new Date()),   "yyyy-MM-dd"),
  }), [branchFilters, myBranchIds, categoryFilters, dateRange])

  const { data: categories = [] } = useGetExpenseCategories()
  const { data: expenses = [], isLoading, error } = useGetExpenses(filters)
  const deleteExpense = useDeleteExpense()

  const filteredExpenses = useMemo(() => {
    if (!search.trim()) return expenses
    const q = search.toLowerCase()
    return expenses.filter(
      (e) =>
        e.description?.toLowerCase().includes(q) ||
        e.category?.name.toLowerCase().includes(q) ||
        e.branch?.name.toLowerCase().includes(q),
    )
  }, [expenses, search])

  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0)


  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteExpense.mutateAsync(deleteTarget.id)

      // If this was an Employee Debt, also remove the linked payroll adjustment
      if (deleteTarget.category?.name?.toLowerCase() === "employee debt") {
        const d = parseISO(deleteTarget.date)
        const month = d.getMonth() + 1
        const year  = d.getFullYear()

        const { data: adj } = await supabase
          .from("payroll_adjustments")
          .select("id, payroll_record_id")
          .eq("branch_id",  deleteTarget.branch_id)
          .eq("amount",     deleteTarget.amount)
          .eq("reason",     deleteTarget.description ?? "")
          .eq("month",      month)
          .eq("year",       year)
          .eq("type",       "debt")
          .maybeSingle()

        if (adj) {
          await supabase.from("payroll_adjustments").delete().eq("id", adj.id)

          if (adj.payroll_record_id) {
            const { data: record } = await supabase
              .from("payroll_records")
              .select("base_salary, days_present")
              .eq("id", adj.payroll_record_id)
              .maybeSingle()

            const { data: remaining } = await supabase
              .from("payroll_adjustments")
              .select("type, amount")
              .eq("payroll_record_id", adj.payroll_record_id)

            let bonuses = 0, deductions = 0, debts = 0
            for (const a of remaining ?? []) {
              const amt = Number(a.amount)
              if      (a.type === "bonus")     bonuses    += amt
              else if (a.type === "deduction") deductions += amt
              else if (a.type === "debt")      debts      += amt
            }
            const base   = (record?.base_salary as number | null) ?? null
            const days   = (record?.days_present as number) ?? 0
            const earned = base ? (base / 30) * days : 0

            await supabase
              .from("payroll_records")
              .update({
                total_bonuses:    bonuses,
                total_deductions: deductions,
                total_debts:      debts,
                net_salary:       earned + bonuses - deductions - debts,
              })
              .eq("id", adj.payroll_record_id)

            qc.invalidateQueries({ queryKey: ["payroll"] })
          }
        }
      }

      toast.success("Expense deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete expense")
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Expenses</h1>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-8 gap-1.5 text-sm font-normal">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                {formatDateRangeTrigger(dateRange)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex flex-wrap gap-1 border-b px-3 py-2">
                {([
                  { label: "Today",      from: new Date(),                                     to: new Date() },
                  { label: "Yesterday",  from: subDays(new Date(), 1),                         to: subDays(new Date(), 1) },
                  { label: "This week",  from: startOfWeek(new Date(), { weekStartsOn: 6 }),   to: new Date() },
                  { label: "This month", from: startOfMonth(new Date()),                       to: new Date() },
                  { label: "Last month", from: startOfMonth(subMonths(new Date(), 1)),         to: endOfMonth(subMonths(new Date(), 1)) },
                ] as { label: string; from: Date; to: Date }[])
                  .filter(({ to }) => to >= APP_START)
                  .map(({ label, from, to }) => (
                    <button
                      key={label}
                      onClick={() => setDateRange({ from: from < APP_START ? APP_START : from, to })}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {label}
                    </button>
                  ))}
              </div>
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range) => range && setDateRange(range)}
                defaultMonth={new Date()}
                startMonth={APP_START}
                disabled={(d) => d > new Date() || d < APP_START}
                numberOfMonths={isMobile ? 1 : 2}
                showOutsideDays={false}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-full sm:w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search expenses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Branch */}
          <MultiSelect
            options={branchList.map(b => ({ value: b.id, label: b.name }))}
            selected={branchFilters}
            onChange={setBranchFilters}
            placeholder="All branches"
            className="w-[160px]"
          />

          {/* Category */}
          <MultiSelect
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            selected={categoryFilters}
            onChange={setCategoryFilters}
            placeholder="All categories"
            className="w-[160px]"
          />

          {!isMobile && canSubmit && (
            <Button onClick={() => setDrawer({ type: "create" })}>
              <Plus className="h-4 w-4" />
              Add Expense
            </Button>
          )}
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────── */}
      <div className="grid gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingDown className="h-4 w-4" />
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums">{formatAmount(totalAmount)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filteredExpenses.length} {filteredExpenses.length === 1 ? "entry" : "entries"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts (analytics — can_update("expenses")) ── */}
      {canEdit && (isMobile ? (
        <Collapsible open={chartsOpen} onOpenChange={setChartsOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/40">
              <span>Charts</span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${chartsOpen ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">By Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ExpenseSummaryChart
                  month={chartMonth}
                  year={chartYear}
                  branchId={singleBranchId}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">By Branch</CardTitle>
              </CardHeader>
              <CardContent>
                <ExpenseBranchChart month={chartMonth} year={chartYear} />
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">By Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ExpenseSummaryChart
                month={chartMonth}
                year={chartYear}
                branchId={singleBranchId}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">By Branch</CardTitle>
            </CardHeader>
            <CardContent>
              <ExpenseBranchChart month={chartMonth} year={chartYear} />
            </CardContent>
          </Card>
        </div>
      ))}

      {/* ── Expense list ───────────────────────────────── */}
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load expenses. Please try again.
        </div>
      ) : isMobile ? (
        /* ─ Mobile cards ─ */
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <CardSkeleton />
            ) : filteredExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">No expenses found</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Adjust your filters or add your first expense
                  </p>
                </div>
                {canSubmit && (
                  <Button onClick={() => setDrawer({ type: "create" })}>
                    <Plus className="h-4 w-4" />
                    Add Expense
                  </Button>
                )}
              </div>
            ) : (
              filteredExpenses.map((expense) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  onView={(e) => setDrawer({ type: "view", expense: e })}
                />
              ))
            )}
          </CardContent>
        </Card>
      ) : (
        /* ─ Desktop table ─ */
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap sticky left-0 z-10 bg-muted/40 relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Branch</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Category</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Description</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap w-14">Receipt</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <TableSkeleton />
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-3">
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Receipt className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">No expenses found</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Adjust your filters or add your first expense
                        </p>
                      </div>
                      {canSubmit && (
                        <Button onClick={() => setDrawer({ type: "create" })}>
                          <Plus className="h-4 w-4" />
                          Add Expense
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => {
                  const Icon = getCategoryIcon(expense.category?.icon ?? null)
                  return (
                    <tr
                      key={expense.id}
                      className="hover:bg-muted/30 cursor-pointer group"
                      onClick={() => setDrawer({ type: "view", expense })}
                    >
                      {/* Date — orange Pencil when edited */}
                      <td className="px-4 py-3 sticky left-0 z-10 bg-background sm:group-hover:bg-muted/30 whitespace-nowrap relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']">
                        <span className="flex items-center gap-1.5">
                          {formatDate(expense.date)}
                          {expense.edited_at && (
                            <Pencil className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-3">{expense.branch?.name ?? "—"}</td>

                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          {expense.category?.name ?? (
                            <span className="text-muted-foreground">Uncategorized</span>
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground max-w-[240px]">
                        <span className="truncate block">{expense.description ?? "—"}</span>
                      </td>

                      {/* Receipt thumbnail */}
                      <td className="px-4 py-3">
                        {expense.receipt_url ? (
                          <button
                            className="block h-10 w-10 overflow-hidden rounded border hover:opacity-80 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); setViewingImage(expense.receipt_url!) }}
                          >
                            <img src={expense.receipt_url} alt="Receipt" className="h-full w-full object-cover" />
                          </button>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded border bg-muted">
                            <Receipt className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                        {formatAmount(expense.amount)}
                      </td>

                      {(canEdit || canDeleteEntry) && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canEdit && (
                                <DropdownMenuItem onClick={() => setDrawer({ type: "edit", expense })}>
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {canEdit && canDeleteEntry && <DropdownMenuSeparator />}
                              {canDeleteEntry && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(expense)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Mobile FAB ─────────────────────────────────── */}
      {isMobile && canSubmit && (
        <Button
          className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
          size="icon"
          onClick={() => setDrawer({ type: "create" })}
        >
          <Plus className="h-6 w-6" />
          <span className="sr-only">Add Expense</span>
        </Button>
      )}

      {/* ── Detail sheet ────────────────────────────────── */}
      <ExpenseDetailSheet
        open={drawer.type === "view"}
        expense={drawer.type === "view" ? drawer.expense : undefined}
        onEdit={canEdit ? (e) => setDrawer({ type: "edit", expense: e }) : undefined}
        onDelete={canDeleteEntry ? (expense) => { setDrawer({ type: "none" }); setDeleteTarget(expense) } : undefined}
        onClose={() => setDrawer({ type: "none" })}
      />

      {/* ── Add / Edit sheet ────────────────────────────── */}
      <AddExpenseSheet
        open={drawer.type === "create" || drawer.type === "edit"}
        onOpenChange={(o) => { if (!o) setDrawer({ type: "none" }) }}
        defaultBranchId={singleBranchId}
        expense={drawer.type === "edit" ? drawer.expense : undefined}
      />

      {/* ── Receipt image viewer ────────────────────────── */}
      {viewingImage && (
        <ReceiptDialog
          url={viewingImage}
          open={!!viewingImage}
          onOpenChange={(o) => { if (!o) setViewingImage(null) }}
        />
      )}

      {/* ── Delete confirmation ─────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The expense record will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
