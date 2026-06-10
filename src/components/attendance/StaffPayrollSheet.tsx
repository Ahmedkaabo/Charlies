import { useState } from "react"
import { format, parseISO } from "date-fns"
import { SlidersHorizontal, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { usePayrollAdjustments, useStaffMonthlyAttendance } from "@/hooks/usePayroll"
import { useDeleteAdjustment } from "@/hooks/useAttendanceMutations"
import { useUserPermissions } from "@/hooks/usePermissions"
import type { StaffPayrollRow, PayrollAdjustment } from "@/types/attendance"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"

// ── Helpers ───────────────────────────────────────────────────

function currency(n: number, curr = "EGP") {
  return `${Number(n).toLocaleString("en-EG", { minimumFractionDigits: 0 })} ${curr}`
}

function initials(name: string | null) {
  if (!name) return "?"
  const p = name.trim().split(/\s+/)
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0].slice(0, 2).toUpperCase()
}

function typeColor(type: string) {
  if (type === "bonus")     return "text-emerald-600 dark:text-emerald-400"
  if (type === "deduction") return "text-destructive"
  return "text-muted-foreground"
}

function typeSign(type: string) {
  if (type === "bonus")     return "+"
  if (type === "deduction") return "−"
  return ""
}

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "present") return "default"
  if (s === "late")    return "secondary"
  return "destructive"
}

// ── Adjustment list (reused across tabs) ─────────────────────

function AdjustmentList({
  items,
  loading,
  currency: curr,
  emptyText,
  canDelete,
  onDelete,
}: {
  items: PayrollAdjustment[]
  loading: boolean
  currency: string
  emptyText: string
  canDelete: boolean
  onDelete: (adj: PayrollAdjustment) => void
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">{emptyText}</p>
  }

  const total = items.reduce((s, a) => s + a.amount, 0)

  return (
    <div className="space-y-3">
      <div className="divide-y rounded-lg border text-sm">
        {items.map((adj) => (
          <div key={adj.id} className="flex items-start gap-3 px-4 py-3">
            <div className="flex-1 min-w-0 space-y-0.5">
              {adj.reason && (
                <p className="font-medium leading-snug">{adj.reason}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {format(parseISO(adj.created_at), "d MMM yyyy, h:mm a")}
              </p>
            </div>
            <span className={cn("shrink-0 font-semibold tabular-nums", typeColor(adj.type))}>
              {typeSign(adj.type)}{currency(adj.amount, curr)}
            </span>
            {canDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(adj)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">Total · {items.length} items</span>
          <span className={cn("font-semibold tabular-nums", typeColor(items[0].type))}>
            {typeSign(items[0].type)}{currency(total, curr)}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: StaffPayrollRow
  month: number
  year: number
  onAdjust: () => void
}

// ── Component ─────────────────────────────────────────────────

export function StaffPayrollSheet({ open, onOpenChange, row, month, year, onAdjust }: Props) {
  const isMobile = useIsMobile()
  const { canUpdate, canDelete: canDeletePerm } = useUserPermissions()
  const canAdjust    = canUpdate("payroll")
  const canDeleteAdj = canDeletePerm("payroll")

  const [deleteTarget, setDeleteTarget] = useState<PayrollAdjustment | null>(null)
  const deleteAdjustment = useDeleteAdjustment()

  const { data: adjustments, isLoading: adjLoading } = usePayrollAdjustments(row.profile_id, month, year)
  const { data: attendance,  isLoading: attLoading  } = useStaffMonthlyAttendance(row.profile_id, row.branch_id, month, year)

  const monthLabel = format(new Date(year, month - 1, 1), "MMMM yyyy")

  const bonuses    = (adjustments ?? []).filter((a) => a.type === "bonus")
  const deductions = (adjustments ?? []).filter((a) => a.type === "deduction")
  const debts      = (adjustments ?? []).filter((a) => a.type === "debt")

  async function confirmDeleteAdjustment() {
    if (!deleteTarget) return
    try {
      await deleteAdjustment.mutateAsync({
        id:                   deleteTarget.id,
        payroll_record_id:    deleteTarget.payroll_record_id,
        current_base:         row.base_salary,
        current_days_present: row.days_present,
        current_paid_days_off: row.paid_days_off,
      })
      toast.success("Adjustment deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete adjustment")
    } finally {
      setDeleteTarget(null)
    }
  }

  function TabCount({ n }: { n: number }) {
    if (n === 0) return null
    return (
      <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums leading-none">
        {n}
      </span>
    )
  }

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-xl"
        )}
      >
        {/* ── Header ─────────────────────────────────── */}
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {initials(row.full_name)}
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-left text-base truncate">
                  {row.full_name ?? "—"}
                </SheetTitle>
                <SheetDescription className="text-left flex items-center gap-1.5 mt-0.5">
                  {row.role && (
                    <span className="capitalize">{row.role.name.replace(/_/g, " ")}</span>
                  )}
                  <span className="opacity-40">·</span>
                  <span>{monthLabel}</span>
                </SheetDescription>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* ── Tabs ───────────────────────────────────── */}
        <Tabs defaultValue="overview" className="flex flex-col flex-1 overflow-hidden">

          {/* Tab bar */}
          <div className="shrink-0 px-6 pt-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="bonus">
                Bonus
                <TabCount n={bonuses.length} />
              </TabsTrigger>
              <TabsTrigger value="deductions">
                Deductions
                <TabCount n={deductions.length} />
              </TabsTrigger>
              <TabsTrigger value="debts">
                Debts
                <TabCount n={debts.length} />
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Overview ─────────────────────────────── */}
          <TabsContent value="overview" className="flex-1 overflow-y-auto mt-0 px-6 py-5 space-y-6">

            {/* Salary grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Base Salary", value: currency(row.base_salary ?? 0, row.currency) },
                { label: "Earned",      value: currency(row.earned_salary,    row.currency) },
                { label: "Bonuses",     value: row.total_bonuses    > 0 ? `+${currency(row.total_bonuses,    row.currency)}` : "—" },
                { label: "Deductions",  value: row.total_deductions > 0 ? `−${currency(row.total_deductions, row.currency)}` : "—" },
                { label: "Debts",       value: row.total_debts      > 0 ?    currency(row.total_debts,       row.currency)   : "—" },
                { label: "Net Salary",  value: currency(row.net_salary, row.currency), bold: true },
              ].map(({ label, value, bold }) => (
                <div key={label} className="rounded-lg bg-muted/50 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={cn("mt-0.5 text-sm tabular-nums", bold && "font-semibold")}>{value}</p>
                </div>
              ))}
            </div>

            {/* Attendance table */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">Attendance</p>

              {attLoading && (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                </div>
              )}

              {!attLoading && (!attendance || attendance.length === 0) && (
                <p className="text-sm text-muted-foreground py-2">No attendance records this month.</p>
              )}

              {!attLoading && attendance && attendance.length > 0 && (
                <div className="divide-y rounded-lg border text-xs">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 bg-muted/40 px-3 py-2 font-medium text-muted-foreground">
                    <span>Date</span>
                    <span className="text-right">Hours</span>
                    <span className="text-right">Day</span>
                    <span className="text-right">Status</span>
                  </div>
                  {attendance.map((log) => (
                    <div key={log.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-3 py-2.5">
                      <div>
                        <p className="font-medium">{format(parseISO(log.date), "EEE, d MMM")}</p>
                        {log.check_in_at && (
                          <p className="text-muted-foreground">
                            {format(parseISO(log.check_in_at), "h:mm a")}
                            {log.check_out_at && ` – ${format(parseISO(log.check_out_at), "h:mm a")}`}
                            {log.is_late && log.late_minutes > 0 && (
                              <span className="ml-1 text-amber-600 dark:text-amber-400">
                                +{log.late_minutes}m
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <span className="tabular-nums text-right text-muted-foreground">
                        {log.total_hours != null ? `${log.total_hours.toFixed(1)}h` : "—"}
                      </span>
                      <span className="tabular-nums text-right font-medium">
                        {log.day_value != null ? log.day_value.toFixed(2) : "—"}
                      </span>
                      <div className="flex justify-end">
                        <Badge variant={statusVariant(log.status)} className="capitalize">
                          {log.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center bg-muted/40 px-3 py-2 font-semibold">
                    <span>{attendance.length} days</span>
                    <span className="text-right tabular-nums">
                      {attendance.reduce((s, l) => s + (l.total_hours ?? 0), 0).toFixed(1)}h
                    </span>
                    <span className="text-right tabular-nums">
                      {attendance.reduce((s, l) => s + (l.day_value ?? 0), 0).toFixed(2)}
                    </span>
                    <span />
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Bonus ────────────────────────────────── */}
          <TabsContent value="bonus" className="flex-1 overflow-y-auto mt-0 px-6 py-5">
            <AdjustmentList
              items={bonuses}
              loading={adjLoading}
              currency={row.currency}
              emptyText="No bonuses this month."
              canDelete={canDeleteAdj}
              onDelete={setDeleteTarget}
            />
          </TabsContent>

          {/* ── Deductions ───────────────────────────── */}
          <TabsContent value="deductions" className="flex-1 overflow-y-auto mt-0 px-6 py-5">
            <AdjustmentList
              items={deductions}
              loading={adjLoading}
              currency={row.currency}
              emptyText="No deductions this month."
              canDelete={canDeleteAdj}
              onDelete={setDeleteTarget}
            />
          </TabsContent>

          {/* ── Debts ────────────────────────────────── */}
          <TabsContent value="debts" className="flex-1 overflow-y-auto mt-0 px-6 py-5">
            <AdjustmentList
              items={debts}
              loading={adjLoading}
              currency={row.currency}
              emptyText="No debts this month."
              canDelete={canDeleteAdj}
              onDelete={setDeleteTarget}
            />
          </TabsContent>

        </Tabs>

        {/* ── Footer ─────────────────────────────────── */}
        {canAdjust && (
          <div className="shrink-0 border-t bg-background px-6 py-4">
            <Button className="w-full" onClick={onAdjust}>
              <SlidersHorizontal className="h-4 w-4" />
              Add Adjustment
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>

    <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete adjustment?</AlertDialogTitle>
          <AlertDialogDescription>
            {deleteTarget?.reason
              ? `"${deleteTarget.reason}" will be permanently removed and payroll totals recalculated.`
              : "This adjustment will be permanently removed and payroll totals recalculated."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={confirmDeleteAdjustment}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
