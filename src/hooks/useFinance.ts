import { useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { calculateEarnedSalary } from "@/lib/attendance"
import type {
  FinanceRecord,
  FinanceRecordType,
  FinanceSummary,
  OwnerPayout,
  OwnerTotalPayout,
} from "@/types/finance"
import { useBranchOwnership, useAllBranchOwnership } from "@/hooks/useBranchOwnership"

// Returns net payroll payout per branch_id for the given date range
async function fetchPayrollByBranch(
  from: string,
  to: string,
  month: number,
  year: number,
  branchId?: string,
  branchIds?: string[],
  accountId?: string,
): Promise<Map<string, number>> {
  const [membersRes, salariesRes, attRes, payrollRes] = await Promise.all([
    (() => {
      // staff is the account anchor — account_id filter belongs only here
      let q = supabase.from("staff").select("branch_id, profile_id").eq("is_active", true)
      if (accountId) q = q.eq("account_id", accountId)
      if (branchId) q = q.eq("branch_id", branchId)
      else if (branchIds?.length) q = q.in("branch_id", branchIds)
      return q
    })(),
    (() => {
      // scoped by branch_id; org isolation comes from the staff filter above
      let q = supabase.from("salary_structures").select("branch_id, profile_id, monthly_salary, paid_days_off")
      if (branchId) q = q.eq("branch_id", branchId)
      else if (branchIds?.length) q = q.in("branch_id", branchIds)
      return q
    })(),
    (() => {
      let q = supabase.from("attendance_logs").select("branch_id, profile_id, day_value")
        .gte("date", from).lte("date", to).not("day_value", "is", null)
      if (branchId) q = q.eq("branch_id", branchId)
      else if (branchIds?.length) q = q.in("branch_id", branchIds)
      return q
    })(),
    (() => {
      let q = supabase.from("payroll_records")
        .select("branch_id, profile_id, total_bonuses, total_deductions, total_debts")
        .eq("month", month).eq("year", year)
      if (branchId) q = q.eq("branch_id", branchId)
      else if (branchIds?.length) q = q.in("branch_id", branchIds)
      return q
    })(),
  ])

  if (membersRes.error)  throw membersRes.error
  if (salariesRes.error) throw salariesRes.error
  if (attRes.error)      throw attRes.error
  if (payrollRes.error)  throw payrollRes.error

  const activeMemberKeys = new Set(
    (membersRes.data ?? []).map((m) => `${m.branch_id}:${m.profile_id}`),
  )

  const daysMap = new Map<string, number>()
  for (const log of attRes.data ?? []) {
    const k = `${log.branch_id}:${log.profile_id}`
    daysMap.set(k, (daysMap.get(k) ?? 0) + (Number(log.day_value) || 0))
  }

  type PayrollRow = { branch_id: string; profile_id: string; total_bonuses: number | null; total_deductions: number | null; total_debts: number | null }
  const payrollMap = new Map<string, PayrollRow>(
    (payrollRes.data ?? []).map((r) => {
      const row = r as unknown as PayrollRow
      return [`${row.branch_id}:${row.profile_id}`, row]
    }),
  )

  const result = new Map<string, number>()
  for (const s of salariesRes.data ?? []) {
    const k = `${s.branch_id}:${s.profile_id}`
    if (!activeMemberKeys.has(k)) continue
    const base       = Number(s.monthly_salary) || 0
    const paidDaysOff = Number(s.paid_days_off) || 0
    const earned     = calculateEarnedSalary(base, (daysMap.get(k) ?? 0) + paidDaysOff)
    const pr         = payrollMap.get(k)
    const net        = earned + (Number(pr?.total_bonuses ?? 0)) - (Number(pr?.total_deductions ?? 0)) - (Number(pr?.total_debts ?? 0))
    result.set(s.branch_id, (result.get(s.branch_id) ?? 0) + net)
  }
  return result
}

// ── Finance records for a branch/month ───────────────────────

export function useFinanceRecords(
  branchId: string | undefined,
  month: number,
  year: number,
  branchIds?: string[],
) {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["finance-records", branchId ?? "all", month, year, branchIds, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const from = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
      const to   = format(new Date(year, month,     0), "yyyy-MM-dd")

      let q = supabase
        .from("finance_records")
        .select(`
          id, branch_id, amount, type, is_visa, is_rent, description, date, added_by, created_at,
          adder:profiles!added_by(id, full_name),
          branch:branches(id, name)
        `)
        .eq("account_id", accountId!)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })

      if (branchId) q = q.eq("branch_id", branchId)
      else if (branchIds?.length) q = q.in("branch_id", branchIds)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as FinanceRecord[]
    },
  })
}

// Returns branch_ids that have a rent-marked debit for this period
export function useRentPaidBranches(month: number, year: number) {
  const { accountId } = useAuth()
  const from = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
  const to   = format(new Date(year, month,     0), "yyyy-MM-dd")

  return useQuery({
    queryKey: ["rent-paid-branches", month, year, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_records")
        .select("branch_id")
        .eq("account_id", accountId!)
        .eq("type", "debit")
        .eq("is_rent", true)
        .gte("date", from)
        .lte("date", to)
      if (error) throw error
      return new Set((data ?? []).map((r) => r.branch_id as string))
    },
  })
}

// ── Finance summary ───────────────────────────────────────────

export function useFinanceSummary(
  branchId: string | undefined,
  month: number,
  year: number,
  branchIds?: string[],
) {
  const { accountId } = useAuth()
  const from = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
  const to   = format(new Date(year, month,     0), "yyyy-MM-dd")

  const salesQ = useQuery({
    queryKey: ["finance-revenue", branchId ?? "all", month, year, branchIds, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      let q = supabase
        .from("sales_records")
        .select("revenue")
        .eq("account_id", accountId!)
        .gte("date", from)
        .lte("date", to)
      if (branchId) q = q.eq("branch_id", branchId)
      else if (branchIds?.length) q = q.in("branch_id", branchIds)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).reduce((s, r) => s + (r.revenue as number), 0)
    },
  })

  const expensesQ = useQuery({
    queryKey: ["finance-expenses", branchId ?? "all", month, year, branchIds, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      let q = supabase
        .from("expenses")
        .select("amount")
        .eq("account_id", accountId!)
        .gte("date", from)
        .lte("date", to)
      if (branchId) q = q.eq("branch_id", branchId)
      else if (branchIds?.length) q = q.in("branch_id", branchIds)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).reduce((s, r) => s + (r.amount as number), 0)
    },
  })

  const adjQ = useFinanceRecords(branchId, month, year, branchIds)

  const payrollQ = useQuery({
    queryKey: ["finance-payroll", branchId ?? "all", month, year, branchIds, accountId],
    enabled: !!accountId,
    queryFn: () => fetchPayrollByBranch(from, to, month, year, branchId, branchIds, accountId ?? undefined),
  })

  const summary: FinanceSummary = useMemo(() => {
    const salesRaw     = salesQ.data    ?? 0
    const expenses     = expensesQ.data ?? 0
    const records      = adjQ.data      ?? []
    const payrollMap   = payrollQ.data  ?? new Map<string, number>()
    const payrollTotal = Array.from(payrollMap.values()).reduce((s, v) => s + v, 0)

    // Visa credits are collected sales (card payments) — added to revenue, not adjustments
    const visaTotal       = records.filter((r) => r.type === "credit" &&  r.is_visa).reduce((s, r) => s + r.amount, 0)
    const nonVisaCredits  = records.filter((r) => r.type === "credit" && !r.is_visa).reduce((s, r) => s + r.amount, 0)
    const debits          = records.filter((r) => r.type === "debit").reduce((s, r) => s + r.amount, 0)
    const credits         = nonVisaCredits + visaTotal   // total credits (for reference)

    const revenue        = salesRaw + visaTotal          // sales includes visa card payments
    const adjustments    = nonVisaCredits - debits       // only non-visa manual adjustments
    const netProfit      = revenue - expenses - payrollTotal
    const adjustedProfit = netProfit + adjustments

    return { revenue, expenses, payrollTotal, netProfit, credits, debits, adjustments, visaTotal, adjustedProfit }
  }, [salesQ.data, expensesQ.data, adjQ.data, payrollQ.data])

  return {
    summary,
    isLoading: salesQ.isLoading || expensesQ.isLoading || adjQ.isLoading || payrollQ.isLoading,
  }
}

// ── All-branch financials (for payout wizard) ────────────────
// Returns per-branch financials for the payout wizard.
// netProfit      = sales - expenses - payroll  (before finance-record adjustments)
// adjustedProfit = netProfit + adjustments     (what deductions are based on)

export interface BranchFinancials {
  sales:          number
  expenses:       number
  payrollTotal:   number
  adjustments:    number   // finance records (credits − debits)
  netProfit:      number   // before adjustments
  adjustedProfit: number   // after adjustments — use this as deduction basis
}

export function useAllBranchFinancials(month: number, year: number) {
  const { accountId } = useAuth()
  const from = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
  const to   = format(new Date(year, month,     0), "yyyy-MM-dd")

  const revenueQ = useQuery({
    queryKey: ["all-branch-revenues", month, year, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_records")
        .select("branch_id, revenue")
        .eq("account_id", accountId!)
        .gte("date", from).lte("date", to)
      if (error) throw error
      const m = new Map<string, number>()
      for (const r of data ?? []) m.set(r.branch_id, (m.get(r.branch_id) ?? 0) + (r.revenue as number))
      return m
    },
  })

  const expensesQ = useQuery({
    queryKey: ["all-branch-expenses", month, year, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("branch_id, amount")
        .eq("account_id", accountId!)
        .gte("date", from).lte("date", to)
      if (error) throw error
      const m = new Map<string, number>()
      for (const r of data ?? []) m.set(r.branch_id, (m.get(r.branch_id) ?? 0) + (r.amount as number))
      return m
    },
  })

  const payrollQ = useQuery({
    queryKey: ["all-branch-payroll", month, year, accountId],
    enabled: !!accountId,
    queryFn: () => fetchPayrollByBranch(from, to, month, year, undefined, undefined, accountId ?? undefined),
  })

  const adjQ = useQuery({
    queryKey: ["all-branch-adj", month, year, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_records")
        .select("branch_id, amount, type, is_visa")
        .eq("account_id", accountId!)
        .gte("date", from).lte("date", to)
      if (error) throw error
      // Visa credits go into sales; non-visa credits/debits stay as adjustments
      const visaMap = new Map<string, number>()
      const adjMap  = new Map<string, number>()
      for (const r of data ?? []) {
        const amount = r.amount as number
        if (r.type === "credit" && (r.is_visa as boolean)) {
          visaMap.set(r.branch_id, (visaMap.get(r.branch_id) ?? 0) + amount)
        } else {
          const delta = (r.type === "credit" ? 1 : -1) * amount
          adjMap.set(r.branch_id, (adjMap.get(r.branch_id) ?? 0) + delta)
        }
      }
      return { visaMap, adjMap }
    },
  })

  const data = useMemo((): Map<string, BranchFinancials> => {
    const result = new Map<string, BranchFinancials>()
    if (!revenueQ.data || !expensesQ.data || !adjQ.data) return result
    const allBranchIds = new Set([
      ...revenueQ.data.keys(),
      ...expensesQ.data.keys(),
      ...(payrollQ.data?.keys() ?? []),
      ...adjQ.data.adjMap.keys(),
      ...adjQ.data.visaMap.keys(),
    ])
    for (const bid of allBranchIds) {
      const salesRaw    = revenueQ.data.get(bid)          ?? 0
      const expenses    = expensesQ.data.get(bid)         ?? 0
      const payrollTotal = payrollQ.data?.get(bid)        ?? 0
      const visa        = adjQ.data.visaMap.get(bid)      ?? 0
      const adjustments = adjQ.data.adjMap.get(bid)       ?? 0
      const sales          = salesRaw + visa               // visa card payments are sales
      const netProfit      = sales - expenses - payrollTotal
      const adjustedProfit = netProfit + adjustments
      result.set(bid, { sales, expenses, payrollTotal, adjustments, netProfit, adjustedProfit })
    }
    return result
  }, [revenueQ.data, expensesQ.data, payrollQ.data, adjQ.data])

  return {
    data,
    isLoading: revenueQ.isLoading || expensesQ.isLoading || payrollQ.isLoading || adjQ.isLoading,
  }
}

// ── Owner payouts ─────────────────────────────────────────────

export function useOwnerPayouts(
  branchId: string | undefined,
  adjustedProfit: number,
) {
  const { data: ownerships } = useBranchOwnership(branchId)

  return useMemo((): OwnerPayout[] => {
    if (!ownerships?.length) return []
    const totalStocks = ownerships.reduce((s, o) => s + o.stocks, 0)
    return ownerships.map((o) => ({
      ownership:   o,
      totalStocks,
      percentage:  totalStocks > 0 ? (o.stocks / totalStocks) * 100 : 0,
      payout:      totalStocks > 0 ? (o.stocks / totalStocks) * adjustedProfit : 0,
    }))
  }, [ownerships, adjustedProfit])
}

// ── All-branches owner payouts ────────────────────────────────
// One hook, four flat queries, zero cascading.
// Groups every ownership row by profile → sums payouts across branches.

export function useAllOwnerPayouts(month: number, year: number) {
  const { accountId } = useAuth()
  const from = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
  const to   = format(new Date(year, month,     0), "yyyy-MM-dd")

  const ownershipsQ = useAllBranchOwnership()

  // Revenue per branch for the period
  const revenueQ = useQuery({
    queryKey: ["all-branch-revenues", month, year, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_records")
        .select("branch_id, revenue")
        .eq("account_id", accountId!)
        .gte("date", from)
        .lte("date", to)
      if (error) throw error
      const m = new Map<string, number>()
      for (const r of data ?? []) m.set(r.branch_id, (m.get(r.branch_id) ?? 0) + (r.revenue as number))
      return m
    },
  })

  // Expenses per branch
  const expensesQ = useQuery({
    queryKey: ["all-branch-expenses", month, year, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("branch_id, amount")
        .eq("account_id", accountId!)
        .gte("date", from)
        .lte("date", to)
      if (error) throw error
      const m = new Map<string, number>()
      for (const r of data ?? []) m.set(r.branch_id, (m.get(r.branch_id) ?? 0) + (r.amount as number))
      return m
    },
  })

  // Payroll net payout per branch
  const payrollQ = useQuery({
    queryKey: ["all-branch-payroll", month, year, accountId],
    enabled: !!accountId,
    queryFn: () => fetchPayrollByBranch(from, to, month, year, undefined, undefined, accountId ?? undefined),
  })

  // Finance adjustments (net credit − debit) per branch
  const adjQ = useQuery({
    queryKey: ["all-branch-adj", month, year, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_records")
        .select("branch_id, amount, type")
        .eq("account_id", accountId!)
        .gte("date", from)
        .lte("date", to)
      if (error) throw error
      const m = new Map<string, number>()
      for (const r of data ?? []) {
        const delta = (r.type === "credit" ? 1 : -1) * (r.amount as number)
        m.set(r.branch_id, (m.get(r.branch_id) ?? 0) + delta)
      }
      return m
    },
  })

  // Branch names (for display)
  const branchNamesQ = useQuery({
    queryKey: ["branch-names", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .eq("account_id", accountId!)
      if (error) throw error
      return new Map<string, string>((data ?? []).map((b) => [b.id as string, b.name as string]))
    },
    staleTime: 5 * 60_000,
  })

  const payouts = useMemo((): OwnerTotalPayout[] => {
    const ownerships = ownershipsQ.data
    if (!ownerships?.length || !revenueQ.data || !expensesQ.data || !adjQ.data) return []

    const branchNames = branchNamesQ.data ?? new Map<string, string>()

    // Group ownerships by branch_id
    const byBranch = new Map<string, typeof ownerships>()
    for (const o of ownerships) {
      const list = byBranch.get(o.branch_id) ?? []
      list.push(o)
      byBranch.set(o.branch_id, list)
    }

    // Build per-owner aggregation
    const ownerMap = new Map<string, OwnerTotalPayout>()

    for (const [branchId, bOwnerships] of byBranch) {
      const revenue    = revenueQ.data.get(branchId)   ?? 0
      const expenses   = expensesQ.data.get(branchId)  ?? 0
      const adj        = adjQ.data.get(branchId)       ?? 0
      const payroll    = payrollQ.data?.get(branchId)  ?? 0
      const profit     = revenue - expenses - payroll + adj
      const totalStocks = bOwnerships.reduce((s, o) => s + o.stocks, 0)
      const branchName  = branchNames.get(branchId) ?? branchId

      for (const o of bOwnerships) {
        const pct    = totalStocks > 0 ? (o.stocks / totalStocks) * 100 : 0
        const payout = totalStocks > 0 ? (o.stocks / totalStocks) * profit  : 0
        const profile = o.profile as { full_name?: string | null } | null

        const existing = ownerMap.get(o.profile_id) ?? {
          profileId:     o.profile_id,
          fullName:      profile?.full_name ?? null,
          branchPayouts: [],
          totalPayout:   0,
        }
        existing.branchPayouts.push({ branchId, branchName, stocks: o.stocks, totalStocks, percentage: pct, payout })
        existing.totalPayout += payout
        ownerMap.set(o.profile_id, existing)
      }
    }

    return Array.from(ownerMap.values()).sort((a, b) => b.totalPayout - a.totalPayout)
  }, [ownershipsQ.data, revenueQ.data, expensesQ.data, adjQ.data, branchNamesQ.data])

  return {
    payouts,
    isLoading:
      ownershipsQ.isLoading ||
      revenueQ.isLoading    ||
      expensesQ.isLoading   ||
      adjQ.isLoading        ||
      payrollQ.isLoading,
  }
}

// ── Mutations ─────────────────────────────────────────────────

export interface CreateFinanceRecordInput {
  branch_id:   string
  amount:      number
  type:        FinanceRecordType
  is_visa:     boolean
  is_rent:     boolean
  description: string | null
  date:        string
  added_by:    string | null
}

export function useCreateFinanceRecord() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (input: CreateFinanceRecordInput) => {
      const { error } = await supabase
        .from("finance_records")
        .insert({ ...input, account_id: accountId ?? undefined })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-records"] })
      qc.invalidateQueries({ queryKey: ["finance-revenue"] })
    },
  })
}

export function useDeleteFinanceRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_records").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-records"] })
    },
  })
}
