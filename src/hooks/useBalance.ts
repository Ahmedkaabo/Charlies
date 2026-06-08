import { useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import type { TreasuryTransfer, BranchBalance, BalanceSummary } from "@/types/balance"

// ── Treasury transfers for a branch/month ─────────────────────

export function useTreasuryTransfers(
  branchId: string | undefined,
  month: number,
  year: number,
  branchIds?: string[],
) {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["treasury-transfers", branchId ?? "all", month, year, accountId, branchIds],
    enabled: !!accountId,
    queryFn: async () => {
      const from = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
      const to   = format(new Date(year, month,     0), "yyyy-MM-dd")

      let q = supabase
        .from("treasury_transfers")
        .select(`
          id, branch_id, amount, date, source, destination, notes, added_by, created_at,
          branch:branches(id, name),
          adder:profiles!added_by(id, full_name)
        `)
        .gte("date", from)
        .lte("date", to)
        .eq("account_id", accountId!)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })

      if (branchId)               q = q.eq("branch_id", branchId)
      else if (branchIds?.length) q = q.in("branch_id", branchIds)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as TreasuryTransfer[]
    },
  })
}

// ── Balance summary for a scope (all branches or single) ──────
// branchId = undefined → aggregate all branches the user can read
// branchId = string    → only that branch

export function useBalanceSummary(
  branchId: string | undefined,
  month: number,
  year: number,
  branchIds?: string[],
) {
  const { accountId } = useAuth()
  const from = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
  const to   = format(new Date(year, month,     0), "yyyy-MM-dd")

  const salesQ = useQuery({
    queryKey: ["balance-revenue", branchId ?? "all", month, year, accountId, branchIds],
    enabled: !!accountId,
    queryFn: async () => {
      let q = supabase
        .from("sales_records")
        .select("revenue")
        .eq("account_id", accountId!)
        .gte("date", from)
        .lte("date", to)
      if (branchId)               q = q.eq("branch_id", branchId)
      else if (branchIds?.length) q = q.in("branch_id", branchIds)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).reduce((s, r) => s + (r.revenue as number), 0)
    },
  })

  const expensesQ = useQuery({
    queryKey: ["balance-expenses", branchId ?? "all", month, year, accountId, branchIds],
    enabled: !!accountId,
    queryFn: async () => {
      let q = supabase
        .from("expenses")
        .select("amount")
        .eq("account_id", accountId!)
        .gte("date", from)
        .lte("date", to)
      if (branchId)               q = q.eq("branch_id", branchId)
      else if (branchIds?.length) q = q.in("branch_id", branchIds)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).reduce((s, r) => s + (r.amount as number), 0)
    },
  })

  const transfersQ = useQuery({
    queryKey: ["balance-transferred", branchId ?? "all", month, year, accountId, branchIds],
    enabled: !!accountId,
    queryFn: async () => {
      let q = supabase
        .from("treasury_transfers")
        .select("amount, source, destination")
        .eq("account_id", accountId!)
        .gte("date", from)
        .lte("date", to)
      if (branchId)               q = q.eq("branch_id", branchId)
      else if (branchIds?.length) q = q.in("branch_id", branchIds)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as { amount: number; source: string; destination: string }[]
    },
  })

  const summary: BalanceSummary = useMemo(() => {
    const totalSales    = salesQ.data    ?? 0
    const totalExpenses = expensesQ.data ?? 0
    const transfers     = transfersQ.data ?? []

    let salesBalance   = totalSales
    let expenseBalance = -totalExpenses
    let mainTreasury   = 0

    for (const t of transfers) {
      const amt = Number(t.amount) || 0
      // Deduct from source
      if (t.source === "sales") salesBalance -= amt
      else if (t.source === "expenses") expenseBalance -= amt
      else if (t.source === "treasury") mainTreasury -= amt

      // Add to destination
      if (t.destination === "sales") salesBalance += amt
      else if (t.destination === "expenses") expenseBalance += amt
      else if (t.destination === "treasury") mainTreasury += amt
    }

    return {
      totalSales,
      totalExpenses,
      salesBalance,
      expenseBalance,
      mainTreasury,
      totalRemaining: salesBalance + expenseBalance,
    }
  }, [salesQ.data, expensesQ.data, transfersQ.data])

  return {
    summary,
    isLoading: salesQ.isLoading || expensesQ.isLoading || transfersQ.isLoading,
  }
}

// ── All-branch balance breakdown (management view only) ───────

export function useAllBranchBalances(month: number, year: number, enabled = true, branchIds?: string[]) {
  const { accountId } = useAuth()
  const from = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
  const to   = format(new Date(year, month,     0), "yyyy-MM-dd")

  const salesQ = useQuery({
    queryKey: ["balance-all-revenue", month, year, accountId, branchIds],
    enabled: enabled && !!accountId,
    queryFn: async () => {
      let q = supabase
        .from("sales_records")
        .select("branch_id, revenue")
        .eq("account_id", accountId!)
        .gte("date", from)
        .lte("date", to)
      if (branchIds?.length) q = q.in("branch_id", branchIds)
      const { data, error } = await q
      if (error) throw error
      const m = new Map<string, number>()
      for (const r of data ?? []) m.set(r.branch_id, (m.get(r.branch_id) ?? 0) + (r.revenue as number))
      return m
    },
  })

  const expensesQ = useQuery({
    queryKey: ["balance-all-expenses", month, year, accountId, branchIds],
    enabled: enabled && !!accountId,
    queryFn: async () => {
      let q = supabase
        .from("expenses")
        .select("branch_id, amount")
        .eq("account_id", accountId!)
        .gte("date", from)
        .lte("date", to)
      if (branchIds?.length) q = q.in("branch_id", branchIds)
      const { data, error } = await q
      if (error) throw error
      const m = new Map<string, number>()
      for (const r of data ?? []) m.set(r.branch_id, (m.get(r.branch_id) ?? 0) + (r.amount as number))
      return m
    },
  })

  const transfersQ = useQuery({
    queryKey: ["balance-all-transferred", month, year, accountId, branchIds],
    enabled: enabled && !!accountId,
    queryFn: async () => {
      let q = supabase
        .from("treasury_transfers")
        .select("branch_id, amount, source, destination")
        .eq("account_id", accountId!)
        .gte("date", from)
        .lte("date", to)
      if (branchIds?.length) q = q.in("branch_id", branchIds)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as { branch_id: string; amount: number; source: string; destination: string }[]
    },
  })

  const branchNamesQ = useQuery({
    queryKey: ["branch-names", accountId],
    enabled: enabled && !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches").select("id, name").eq("account_id", accountId!)
      if (error) throw error
      return new Map<string, string>((data ?? []).map((b) => [b.id as string, b.name as string]))
    },
    staleTime: 5 * 60_000,
  })

  const balances = useMemo((): BranchBalance[] => {
    if (!salesQ.data || !expensesQ.data || !transfersQ.data || !branchNamesQ.data) return []

    const allIds = new Set([
      ...salesQ.data.keys(),
      ...expensesQ.data.keys(),
      ...transfersQ.data.map(t => t.branch_id),
    ])

    return Array.from(allIds).map((id) => {
      const sales       = salesQ.data!.get(id) ?? 0
      const expenses    = expensesQ.data!.get(id) ?? 0
      const transfers   = transfersQ.data!.filter(t => t.branch_id === id)

      let salesBalance   = sales
      let expenseBalance = -expenses

      for (const t of transfers) {
        const amt = Number(t.amount) || 0
        if (t.source === "sales") salesBalance -= amt
        else if (t.source === "expenses") expenseBalance -= amt
        if (t.destination === "sales") salesBalance += amt
        else if (t.destination === "expenses") expenseBalance += amt
      }

      return {
        branchId:   id,
        branchName: branchNamesQ.data!.get(id) ?? id,
        sales,
        expenses,
        salesBalance,
        expenseBalance,
        remaining: salesBalance + expenseBalance,
      }
    }).sort((a, b) => a.branchName.localeCompare(b.branchName))
  }, [salesQ.data, expensesQ.data, transfersQ.data, branchNamesQ.data])

  return {
    balances,
    isLoading: salesQ.isLoading || expensesQ.isLoading || transfersQ.isLoading || branchNamesQ.isLoading,
  }
}

// ── Mutations ─────────────────────────────────────────────────

export interface CreateTreasuryTransferInput {
  branch_id:   string
  amount:      number
  date:        string
  source:      string
  destination: string
  notes:       string | null
  added_by:    string | null
}

export function useCreateTreasuryTransfer() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (input: CreateTreasuryTransferInput) => {
      const { error } = await supabase
        .from("treasury_transfers")
        .insert({ ...input, account_id: accountId ?? undefined })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treasury-transfers"] })
      qc.invalidateQueries({ queryKey: ["balance-transferred"] })
      qc.invalidateQueries({ queryKey: ["balance-all-transferred"] })
    },
  })
}

export interface UpdateTreasuryTransferInput {
  id:          string
  amount:      number
  date:        string
  source:      string
  destination: string
  notes:       string | null
}

export function useUpdateTreasuryTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateTreasuryTransferInput) => {
      const { error } = await supabase
        .from("treasury_transfers")
        .update(input)
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treasury-transfers"] })
      qc.invalidateQueries({ queryKey: ["balance-transferred"] })
      qc.invalidateQueries({ queryKey: ["balance-all-transferred"] })
    },
  })
}

export function useDeleteTreasuryTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("treasury_transfers").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treasury-transfers"] })
      qc.invalidateQueries({ queryKey: ["balance-transferred"] })
      qc.invalidateQueries({ queryKey: ["balance-all-transferred"] })
    },
  })
}
