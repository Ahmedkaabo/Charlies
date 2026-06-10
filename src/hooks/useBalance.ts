import { useEffect, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import type { TreasuryTransfer, PoolTransfer, BranchBalance, BalanceSummary } from "@/types/balance"

// ── Realtime: invalidate balance caches when any permitted user changes data ──

export function useBalanceRealtime() {
  const { accountId } = useAuth()
  const qc = useQueryClient()

  useEffect(() => {
    if (!accountId) return

    const invalidateSummary = () => {
      qc.invalidateQueries({ queryKey: ["balance-summary"] })
      qc.invalidateQueries({ queryKey: ["balance-all-data"] })
    }

    const channel = supabase
      .channel(`balance:${accountId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_records",      filter: `account_id=eq.${accountId}` }, invalidateSummary)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses",            filter: `account_id=eq.${accountId}` }, invalidateSummary)
      .on("postgres_changes", { event: "*", schema: "public", table: "treasury_transfers",  filter: `account_id=eq.${accountId}` }, () => {
        invalidateSummary()
        qc.invalidateQueries({ queryKey: ["treasury-transfers"] })
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pool_transfers",      filter: `account_id=eq.${accountId}` }, () => {
        qc.invalidateQueries({ queryKey: ["pool-transfers"] })
        qc.invalidateQueries({ queryKey: ["pool-credit"] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [accountId, qc])
}

// ── Balance summary (3 tables in one round-trip via Promise.all) ─

export function useBalanceSummary(
  branchId: string | undefined,
  month: number,
  year: number,
  branchIds?: string[],
) {
  const { accountId } = useAuth()
  const from = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
  const to   = format(new Date(year, month,     0), "yyyy-MM-dd")

  const q = useQuery({
    queryKey: ["balance-summary", branchId ?? "all", accountId, month, year, branchIds],
    enabled:  !!accountId,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      // sales_records and expenses: match Finance module pattern (branch filter, no account_id)
      let salesQ = supabase.from("sales_records").select("revenue").gte("date", from).lte("date", to)
      let expQ   = supabase.from("expenses").select("amount").gte("date", from).lte("date", to)
      // treasury_transfers: always has account_id (new table)
      let trfQ   = supabase.from("treasury_transfers").select("amount, direction").eq("account_id", accountId!).gte("date", from).lte("date", to)

      if (branchId) {
        salesQ = salesQ.eq("branch_id", branchId)
        expQ   = expQ.eq("branch_id", branchId)
        trfQ   = trfQ.eq("branch_id", branchId)
      } else if (branchIds?.length) {
        salesQ = salesQ.in("branch_id", branchIds)
        expQ   = expQ.in("branch_id", branchIds)
        trfQ   = trfQ.in("branch_id", branchIds)
      }

      const [salesRes, expRes, trfRes] = await Promise.all([salesQ, expQ, trfQ])
      if (salesRes.error) throw salesRes.error
      if (expRes.error)   throw expRes.error
      if (trfRes.error)   throw trfRes.error

      const totalSales       = (salesRes.data ?? []).reduce((s, r) => s + Number(r.revenue), 0)
      const totalExpenses    = (expRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
      const totalTransferred = (trfRes.data ?? []).reduce((s, r) => {
        const amt = Number(r.amount)
        return (r as { direction: string }).direction === "inflow" ? s - amt : s + amt
      }, 0)

      return { totalSales, totalExpenses, totalTransferred }
    },
  })

  const summary: BalanceSummary = useMemo(() => {
    const { totalSales = 0, totalExpenses = 0, totalTransferred = 0 } = q.data ?? {}
    return {
      totalSales,
      totalExpenses,
      totalTransferred,
      mainTreasury:   totalTransferred,
      totalRemaining: totalSales - totalExpenses - totalTransferred,
    }
  }, [q.data])

  return { summary, isLoading: q.isPending }
}

// ── All-branch balance breakdown (management view) ────────────

export function useAllBranchBalances(month: number, year: number, enabled = true, branchIds?: string[]) {
  const { accountId } = useAuth()
  const from = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
  const to   = format(new Date(year, month,     0), "yyyy-MM-dd")

  const q = useQuery({
    queryKey: ["balance-all-data", month, year, accountId, branchIds],
    enabled: enabled && !!accountId,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let salesQ = supabase.from("sales_records").select("branch_id, revenue").gte("date", from).lte("date", to)
      let expQ   = supabase.from("expenses").select("branch_id, amount").gte("date", from).lte("date", to)
      let trfQ   = supabase.from("treasury_transfers").select("branch_id, amount, direction").eq("account_id", accountId!).gte("date", from).lte("date", to)
      let poolQ  = supabase.from("pool_transfers").select("branch_id, from_pool, to_pool, amount").eq("account_id", accountId!).gte("date", from).lte("date", to)
      const branchQ = supabase.from("branches").select("id, name").eq("account_id", accountId!)

      if (branchIds?.length) {
        salesQ = salesQ.in("branch_id", branchIds)
        expQ   = expQ.in("branch_id", branchIds)
        trfQ   = trfQ.in("branch_id", branchIds)
        poolQ  = poolQ.in("branch_id", branchIds)
      }

      const [salesRes, expRes, trfRes, poolRes, branchRes] = await Promise.all([salesQ, expQ, trfQ, poolQ, branchQ])
      if (salesRes.error)  throw salesRes.error
      if (expRes.error)    throw expRes.error
      if (trfRes.error)    throw trfRes.error
      // pool_transfers may 403 if user lacks permission — degrade gracefully
      if (branchRes.error) throw branchRes.error

      const names    = new Map((branchRes.data ?? []).map((b) => [b.id as string, b.name as string]))
      const salesMap = new Map<string, number>()
      const expMap   = new Map<string, number>()
      const trfMap   = new Map<string, number>()
      const poolMap  = new Map<string, number>()

      for (const r of salesRes.data ?? []) salesMap.set(r.branch_id, (salesMap.get(r.branch_id) ?? 0) + (r.revenue as number))
      for (const r of expRes.data ?? [])   expMap.set(r.branch_id,   (expMap.get(r.branch_id)   ?? 0) + (r.amount  as number))
      for (const r of trfRes.data ?? []) {
        const amt   = r.amount as number
        const delta = (r as { direction: string }).direction === "inflow" ? -amt : amt
        trfMap.set(r.branch_id, (trfMap.get(r.branch_id) ?? 0) + delta)
      }
      for (const r of (!poolRes.error ? poolRes.data : null) ?? []) {
        const amt   = r.amount as number
        const delta = r.to_pool === "expenses" ? amt : -amt
        poolMap.set(r.branch_id, (poolMap.get(r.branch_id) ?? 0) + delta)
      }

      const allIds = new Set([...salesMap.keys(), ...expMap.keys(), ...trfMap.keys()])
      return Array.from(allIds)
        .map((id) => {
          const sales       = salesMap.get(id) ?? 0
          const expenses    = expMap.get(id)   ?? 0
          const transferred = trfMap.get(id)   ?? 0
          const poolCredit  = poolMap.get(id)  ?? 0
          return {
            branchId:   id,
            branchName: names.get(id) ?? id,
            sales,
            expenses,
            transferred,
            poolCredit,
            remaining: sales - expenses - transferred,
          }
        })
        .sort((a, b) => a.branchName.localeCompare(b.branchName))
    },
  })

  return { balances: q.data ?? [], isLoading: q.isPending }
}

// ── Treasury transfers list ───────────────────────────────────

export function useTreasuryTransfers(
  branchId: string | undefined,
  month: number,
  year: number,
) {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["treasury-transfers", branchId ?? "all", accountId, month, year],
    enabled:  !!accountId,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const from = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
      const to   = format(new Date(year, month,     0), "yyyy-MM-dd")

      let q = supabase
        .from("treasury_transfers")
        .select(`
          id, branch_id, amount, direction, date, notes, added_by, created_at,
          branch:branches(id, name),
          adder:profiles!added_by(id, full_name)
        `)
        .eq("account_id", accountId!)
        .gte("date", from)
        .lte("date", to)
        .order("date",       { ascending: false })
        .order("created_at", { ascending: false })

      if (branchId) q = q.eq("branch_id", branchId)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as TreasuryTransfer[]
    },
  })
}

// ── Pool transfers list ───────────────────────────────────────

export function usePoolTransfers(
  branchId: string | undefined,
  from: string,
  to: string,
) {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["pool-transfers", branchId ?? "all", accountId, from, to],
    enabled:  !!accountId,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let q = supabase
        .from("pool_transfers")
        .select(`
          id, branch_id, from_pool, to_pool, amount, date, notes, added_by, created_at,
          branch:branches(id, name),
          adder:profiles!added_by(id, full_name)
        `)
        .eq("account_id", accountId!)
        .gte("date", from)
        .lte("date", to)
        .order("date",       { ascending: false })
        .order("created_at", { ascending: false })

      if (branchId) q = q.eq("branch_id", branchId)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as PoolTransfer[]
    },
  })
}

// ── Expenses pool credit ──────────────────────────────────────
// Net credit = Σ(sales→expenses) − Σ(expenses→sales) in date range

export function useExpensesPoolCredit(
  branchId: string | undefined,
  from: string,
  to: string,
) {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["pool-credit", branchId ?? "all", accountId, from, to],
    enabled:  !!accountId,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let q = supabase
        .from("pool_transfers")
        .select("from_pool, to_pool, amount")
        .eq("account_id", accountId!)
        .gte("date", from)
        .lte("date", to)

      if (branchId) q = q.eq("branch_id", branchId)

      const { data, error } = await q
      if (error) throw error

      return (data ?? []).reduce((net, r) => {
        const amt = Number(r.amount)
        if (r.to_pool   === "expenses") return net + amt
        if (r.from_pool === "expenses") return net - amt
        return net
      }, 0)
    },
  })
}

// ── Treasury transfer mutations ───────────────────────────────

export interface CreateTreasuryTransferInput {
  branch_id: string
  amount:    number
  direction: "outflow" | "inflow"
  date:      string
  notes:     string | null
  added_by:  string | null
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
      qc.invalidateQueries({ queryKey: ["balance-summary"] })
      qc.invalidateQueries({ queryKey: ["balance-all-data"] })
    },
  })
}

export interface UpdateTreasuryTransferInput {
  id:        string
  amount:    number
  direction: "outflow" | "inflow"
  date:      string
  notes:     string | null
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
      qc.invalidateQueries({ queryKey: ["balance-summary"] })
      qc.invalidateQueries({ queryKey: ["balance-all-data"] })
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
      qc.invalidateQueries({ queryKey: ["balance-summary"] })
      qc.invalidateQueries({ queryKey: ["balance-all-data"] })
    },
  })
}

// ── Pool transfer mutations ───────────────────────────────────

export interface CreatePoolTransferInput {
  branch_id: string
  from_pool: "sales" | "expenses"
  to_pool:   "sales" | "expenses"
  amount:    number
  date:      string
  notes:     string | null
  added_by:  string | null
}

export function useCreatePoolTransfer() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (input: CreatePoolTransferInput) => {
      const { error } = await supabase
        .from("pool_transfers")
        .insert({ ...input, account_id: accountId ?? undefined })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pool-transfers"] })
      qc.invalidateQueries({ queryKey: ["pool-credit"] })
    },
  })
}

export interface UpdatePoolTransferInput {
  id:        string
  from_pool: "sales" | "expenses"
  to_pool:   "sales" | "expenses"
  amount:    number
  date:      string
  notes:     string | null
}

export function useUpdatePoolTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdatePoolTransferInput) => {
      const { error } = await supabase
        .from("pool_transfers")
        .update(input)
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pool-transfers"] })
      qc.invalidateQueries({ queryKey: ["pool-credit"] })
    },
  })
}

export function useDeletePoolTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pool_transfers").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pool-transfers"] })
      qc.invalidateQueries({ queryKey: ["pool-credit"] })
    },
  })
}
