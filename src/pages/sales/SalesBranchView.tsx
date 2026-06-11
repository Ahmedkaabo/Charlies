import { useState, useMemo } from "react"
import {
  format,
  startOfDay,
  getDay,
  getDaysInMonth,
  isAfter,
  isSameDay,
} from "date-fns"
import { CalendarDays, ImageIcon, Lock, Plus, Table2 } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { useUserPermissions } from "@/hooks/usePermissions"
import { useSalesRecords } from "@/hooks/useSales"
import { getCurrentSalesDate, isDayEditable } from "@/lib/sales"
import { SalesRecordSheet } from "@/components/sales/SalesRecordSheet"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/LanguageContext"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { SalesRecord } from "@/types/sales"

// ── Helpers ───────────────────────────────────────────────────

function fmtRevenue(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000)    return `${Math.round(n / 1_000)}K`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ── Props ─────────────────────────────────────────────────────

interface SalesBranchViewProps {
  branchId: string
  branchName: string
  month: number
  year: number
}

// ── Component ─────────────────────────────────────────────────

export function SalesBranchView({ branchId, branchName, month, year }: SalesBranchViewProps) {
  const { t } = useLanguage()
  const { isAdmin } = useAuth()
  const { canCreate, canUpdate } = useUserPermissions()
  const canCreateSales = isAdmin || canCreate("sales")
  const canUpdateSales = isAdmin || canUpdate("sales")

  const currentSalesDate = getCurrentSalesDate()

  const [view, setView]           = useState<"calendar" | "table">("calendar")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data: records, isLoading } = useSalesRecords(branchId, month, year)

  const recordMap = useMemo(() => {
    const m = new Map<string, SalesRecord>()
    for (const r of records ?? []) m.set(r.date, r)
    return m
  }, [records])

  function openDay(date: Date) {
    const record   = recordMap.get(format(date, "yyyy-MM-dd"))
    const canEdit  = record ? canUpdateSales : canCreateSales
    if (!isDayEditable(date, record, canEdit) && !record) return
    setSelectedDate(date)
    setSheetOpen(true)
  }

  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined
  const selectedRecord  = selectedDateStr ? (recordMap.get(selectedDateStr) ?? null) : null
  const canEditSelected = selectedRecord ? canUpdateSales : canCreateSales

  // All days of the month for both views
  const allDays = useMemo(() => {
    const days: Date[] = []
    const total = getDaysInMonth(new Date(year, month - 1))
    for (let d = 1; d <= total; d++) days.push(new Date(year, month - 1, d))
    return days
  }, [month, year])

  // ── Toggle ────────────────────────────────────────────────

  const toggle = (
    <div className="flex items-center gap-1 rounded-md border p-0.5">
      <Button
        size="icon"
        variant={view === "calendar" ? "secondary" : "ghost"}
        className="h-7 w-7"
        onClick={() => setView("calendar")}
      >
        <CalendarDays className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="icon"
        variant={view === "table" ? "secondary" : "ghost"}
        className="h-7 w-7"
        onClick={() => setView("table")}
      >
        <Table2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )

  // ── Calendar view ─────────────────────────────────────────

  const firstDayOfWeek = getDay(new Date(year, month - 1, 1))
  const daysInMonth    = getDaysInMonth(new Date(year, month - 1))
  const totalCells     = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7

  const calendarView = (
    <div className="space-y-1">
      <div className="grid grid-cols-7 text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wide pb-1">
        {[t("Sun"), t("Mon"), t("Tue"), t("Wed"), t("Thu"), t("Fri"), t("Sat")].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-md" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: totalCells }).map((_, i) => {
            const day = i - firstDayOfWeek + 1
            if (day < 1 || day > daysInMonth) return <div key={i} />

            const date     = new Date(year, month - 1, day)
            const dateStr  = format(date, "yyyy-MM-dd")
            const record   = recordMap.get(dateStr)
            const isLocked = record?.status === "locked"
            const editable = isDayEditable(date, record, record ? canUpdateSales : canCreateSales)
            const isToday  = isSameDay(date, currentSalesDate)
            const isFuture = isAfter(startOfDay(date), currentSalesDate)
            const hasEdits = (record?.edit_history?.length ?? 0) > 0
            const clickable = editable || !!record

            return (
              <button
                key={i}
                type="button"
                disabled={!clickable}
                onClick={() => openDay(date)}
                className={cn(
                  "relative flex flex-col justify-between rounded-md border p-1.5 text-left transition-colors",
                  "h-14 md:h-[72px]",
                  isFuture && "bg-muted/30 border-transparent cursor-not-allowed",
                  isLocked && !editable && !isFuture && "bg-muted/20 cursor-not-allowed",
                  record && !isFuture && (editable || record) && "bg-card hover:bg-accent cursor-pointer",
                  !record && editable && [
                    "border-dashed border-muted-foreground/25",
                    "hover:border-primary/40 hover:bg-accent/40 cursor-pointer",
                  ],
                  isToday && "ring-1 ring-inset ring-primary",
                )}
              >
                <span
                  className={cn(
                    "text-[11px] font-medium leading-none",
                    isToday && "font-bold text-primary",
                    isFuture && "text-muted-foreground/40",
                    isLocked && !editable && !isFuture && "text-muted-foreground",
                    // Orange if edited (overrides other non-primary colours)
                    hasEdits && !isFuture && !isToday && "text-orange-500 font-semibold",
                  )}
                >
                  {day}
                </span>

                {record ? (
                  <span
                    className={cn(
                      "text-[11px] font-semibold leading-none tabular-nums",
                      isLocked && !editable ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {fmtRevenue(record.revenue)}
                  </span>
                ) : !isFuture && editable ? (
                  <Plus className="h-3 w-3 text-muted-foreground/40 self-end" />
                ) : null}

                {isLocked && (
                  <Lock className="absolute top-1 right-1 h-2.5 w-2.5 text-muted-foreground/40" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── Table view ────────────────────────────────────────────

  const tableView = (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            <th className={stickyHead}>{t("Date")}</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">{t("Revenue")}</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("Notes")}</th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t("Receipt")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading
            ? Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>
                  {[1, 2, 3, 4].map((j) => (
                    <td key={j} className={j === 1 ? stickyCell("") : "px-4 py-3"}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            : allDays.map((date) => {
                const dateStr  = format(date, "yyyy-MM-dd")
                const record   = recordMap.get(dateStr)
                const isFuture = isAfter(startOfDay(date), currentSalesDate)
                const isToday  = isSameDay(date, currentSalesDate)
                const editable = isDayEditable(date, record, record ? canUpdateSales : canCreateSales)
                const hasEdits = (record?.edit_history?.length ?? 0) > 0
                const clickable = (editable || !!record) && !isFuture

                return (
                  <tr
                    key={dateStr}
                    onClick={() => clickable && openDay(date)}
                    className={cn(
                      "transition-colors",
                      clickable && "cursor-pointer hover:bg-muted/40",
                      isFuture && "opacity-40",
                    )}
                  >
                    {/* Date — sticky */}
                    <td className={stickyCell(cn(isFuture && "bg-background"))}>
                      <span
                        className={cn(
                          "font-medium whitespace-nowrap",
                          isToday && "text-primary",
                          hasEdits && !isFuture && "text-orange-500",
                        )}
                      >
                        {format(date, "EEE, MMM d")}
                      </span>
                    </td>

                    {/* Revenue */}
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                      {record
                        ? <span className="font-semibold">EGP {record.revenue.toLocaleString()}</span>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3 max-w-[200px]">
                      {record?.notes
                        ? <span className="truncate block text-muted-foreground">{record.notes}</span>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </td>

                    {/* Receipt */}
                    <td className="px-4 py-3 text-center">
                      {record?.receipt_url
                        ? <ImageIcon className="h-4 w-4 text-muted-foreground mx-auto" />
                        : <span className="text-muted-foreground">—</span>
                      }
                    </td>
                  </tr>
                )
              })
          }
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex justify-end">{toggle}</div>

      {view === "calendar" ? calendarView : tableView}

      <SalesRecordSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        branchId={branchId}
        branchName={branchName}
        date={selectedDate}
        record={selectedRecord}
        canEdit={canEditSelected}
      />
    </div>
  )
}

// ── Sticky column helpers ─────────────────────────────────────

const stickyBase =
  "sticky left-0 z-10 bg-background px-4 py-3 " +
  "after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']"

function stickyCell(extra: string) {
  return cn(stickyBase, extra)
}

const stickyHead =
  "sticky left-0 z-10 bg-muted/40 px-4 py-3 text-left font-medium text-muted-foreground " +
  "after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']"
