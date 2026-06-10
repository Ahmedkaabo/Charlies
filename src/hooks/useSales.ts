import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { format, startOfDay, isAfter, getDaysInMonth } from "date-fns"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import type { SalesRecord, SalesEditHistory } from "@/types/sales"
import { getCurrentSalesDate } from "@/lib/sales"

// ── Records for a branch/month ────────────────────────────────

export function useSalesRecords(
  branchId: string | undefined,
  month: number,
  year: number,
  branchIds?: string[],
) {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["sales-records", branchId ?? "all", month, year, branchIds, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const from = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
      const to   = format(new Date(year, month,     0), "yyyy-MM-dd")

      let q = supabase
        .from("sales_records")
        .select(`
          id, branch_id, date, revenue, notes, status, receipt_url,
          submitted_by, submitted_at, created_at, updated_at,
          branch:branches(id, name),
          submitter:profiles!submitted_by(id, full_name),
          edit_history:sales_edit_history(id)
        `)
        .eq("account_id", accountId!)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true })

      if (branchId) q = q.eq("branch_id", branchId)
      else if (branchIds?.length) q = q.in("branch_id", branchIds)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as SalesRecord[]
    },
  })
}

// ── Single record for a branch + date ────────────────────────

export function useSalesRecord(
  branchId: string | undefined,
  date: string | undefined,
) {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["sales-record", branchId, date, accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_records")
        .select(`
          id, branch_id, date, revenue, notes, status, receipt_url,
          submitted_by, submitted_at, created_at, updated_at,
          branch:branches(id, name),
          submitter:profiles!submitted_by(id, full_name),
          edit_history:sales_edit_history(id)
        `)
        .eq("account_id", accountId!)
        .eq("branch_id", branchId!)
        .eq("date", date!)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as unknown as SalesRecord | null
    },
    enabled: !!branchId && !!date && !!accountId,
  })
}

// ── Edit history for a record ─────────────────────────────────

export function useSalesEditHistory(
  salesRecordId: string | undefined,
  enabled = false,
) {
  return useQuery({
    queryKey: ["sales-edit-history", salesRecordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_edit_history")
        .select(`
          id, sales_record_id, branch_id, date,
          previous_revenue, new_revenue,
          previous_notes, new_notes,
          previous_status, new_status,
          edited_by, edited_at, reason,
          editor:profiles!edited_by(id, full_name)
        `)
        .eq("sales_record_id", salesRecordId!)
        .order("edited_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as SalesEditHistory[]
    },
    enabled: !!salesRecordId && enabled,
  })
}

// ── Summary for the management view ──────────────────────────

export interface SalesSummary {
  totalRevenue: number
  daysFilled: number
  totalDaysSoFar: number
  daysMissing: number
  avgDailyRevenue: number
}

export function useSalesSummary(
  branchId: string | undefined,
  month: number,
  year: number,
  branchIds?: string[],
) {
  const query = useSalesRecords(branchId, month, year, branchIds)

  const summary: SalesSummary = useMemo(() => {
    const records = query.data ?? []
    const currentSalesDate = getCurrentSalesDate()
    const firstOfMonth = startOfDay(new Date(year, month - 1, 1))
    const total = getDaysInMonth(new Date(year, month - 1))

    // Count days so far this month (≤ currentSalesDate)
    let totalDaysSoFar = 0
    for (let d = 1; d <= total; d++) {
      const day = startOfDay(new Date(year, month - 1, d))
      if (isAfter(day, currentSalesDate)) break
      if (isAfter(firstOfMonth, currentSalesDate)) break
      totalDaysSoFar++
    }

    const daysFilled    = records.length
    const totalRevenue  = records.reduce((s, r) => s + r.revenue, 0)
    const daysMissing   = Math.max(0, totalDaysSoFar - daysFilled)
    const avgDailyRevenue = daysFilled > 0 ? totalRevenue / daysFilled : 0

    return { totalRevenue, daysFilled, totalDaysSoFar, daysMissing, avgDailyRevenue }
  }, [query.data, month, year])

  return { ...query, summary }
}
