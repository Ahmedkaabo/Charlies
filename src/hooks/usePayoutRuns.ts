import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import type { PayoutRunFull, PayoutRunBranch, PayoutRunOwner, DeductionType } from "@/types/finance"

// ── Payout runs ───────────────────────────────────────────────

export function usePayoutRuns(month: number, year: number) {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["payout-runs", month, year, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data: runs, error: runsErr } = await supabase
        .from("payout_runs")
        .select("id, month, year, notes, created_by, created_at")
        .eq("account_id", accountId!)
        .eq("month", month)
        .eq("year", year)
        .order("created_at", { ascending: false })
      if (runsErr) throw runsErr
      if (!runs?.length) return []

      const runIds = runs.map((r) => r.id as string)

      const [{ data: branches, error: brErr }, { data: owners, error: owErr }] =
        await Promise.all([
          supabase.from("payout_run_branches").select("*").in("payout_run_id", runIds),
          supabase.from("payout_run_owners").select("*").in("payout_run_id", runIds),
        ])

      if (brErr) throw brErr
      if (owErr) throw owErr

      return runs.map((run): PayoutRunFull => ({
        id:         run.id         as string,
        month:      run.month      as number,
        year:       run.year       as number,
        notes:      run.notes      as string | null,
        created_by: run.created_by as string | null,
        created_at: run.created_at as string,
        branches:   (branches ?? []).filter((b) => b.payout_run_id === run.id) as unknown as PayoutRunBranch[],
        owners:     (owners   ?? []).filter((o) => o.payout_run_id === run.id) as unknown as PayoutRunOwner[],
      }))
    },
  })
}

// ── Last-used settings per branch ─────────────────────────────

export interface PayoutSettingsRow {
  branch_id:           string
  rent_type:           DeductionType
  rent_value:          number
  favor_type:          DeductionType
  favor_value:         number
  company_share_type:  DeductionType
  company_share_value: number
  mgmt_fee_type:       DeductionType
  mgmt_fee_value:      number
  updated_at:          string
}

export function usePayoutSettings() {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["payout-settings", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_settings")
        .select("branch_id, rent_type, rent_value, favor_type, favor_value, company_share_type, company_share_value, mgmt_fee_type, mgmt_fee_value, updated_at")
        .eq("account_id", accountId!)
      if (error) throw error
      const m = new Map<string, PayoutSettingsRow>()
      for (const r of (data ?? []) as unknown as PayoutSettingsRow[]) m.set(r.branch_id, r)
      return m
    },
  })
}

// ── Shared helper: upsert last-used settings ──────────────────

async function upsertPayoutSettings(branches: PayoutRunInput["branches"], accountId: string | null) {
  const { error } = await supabase.from("payout_settings").upsert(
    branches.map((b) => ({
      branch_id:           b.branch_id,
      account_id:          accountId ?? undefined,
      rent_type:           b.rent_type,
      rent_value:          b.rent_value,
      favor_type:          b.favor_type,
      favor_value:         b.favor_value,
      company_share_type:  b.company_share_type,
      company_share_value: b.company_share_value,
      mgmt_fee_type:       b.mgmt_fee_type,
      mgmt_fee_value:      b.mgmt_fee_value,
      updated_at:          new Date().toISOString(),
    })),
    { onConflict: "branch_id" },
  )
  if (error) throw error
}

// ── Mutations ─────────────────────────────────────────────────

export interface PayoutRunInput {
  month:      number
  year:       number
  notes?:     string | null
  created_by: string | null
  branches: Omit<PayoutRunBranch, "id" | "payout_run_id">[]
  owners:   Omit<PayoutRunOwner,  "id" | "payout_run_id">[]
}

export function useCreatePayoutRun() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (input: PayoutRunInput) => {
      const { data: run, error: runErr } = await supabase
        .from("payout_runs")
        .insert({ month: input.month, year: input.year, notes: input.notes ?? null, created_by: input.created_by, account_id: accountId ?? undefined })
        .select("id")
        .single()
      if (runErr) throw runErr

      const runId = run.id as string

      const [{ error: brErr }, { error: owErr }] = await Promise.all([
        supabase.from("payout_run_branches").insert(input.branches.map((b) => ({ ...b, payout_run_id: runId }))),
        supabase.from("payout_run_owners").insert(input.owners.map((o) => ({ ...o, payout_run_id: runId }))),
      ])
      if (brErr) throw brErr
      if (owErr) throw owErr

      await upsertPayoutSettings(input.branches, accountId)
      return runId
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["payout-runs", vars.month, vars.year] })
      qc.invalidateQueries({ queryKey: ["payout-settings"] })
    },
  })
}

export function useUpdatePayoutRun() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PayoutRunInput }) => {
      const { error: runErr } = await supabase
        .from("payout_runs").update({ notes: input.notes ?? null }).eq("id", id)
      if (runErr) throw runErr

      const { error: delBrErr } = await supabase.from("payout_run_branches").delete().eq("payout_run_id", id)
      if (delBrErr) throw delBrErr
      const { error: delOwErr } = await supabase.from("payout_run_owners").delete().eq("payout_run_id", id)
      if (delOwErr) throw delOwErr

      const [{ error: brErr }, { error: owErr }] = await Promise.all([
        supabase.from("payout_run_branches").insert(input.branches.map((b) => ({ ...b, payout_run_id: id }))),
        supabase.from("payout_run_owners").insert(input.owners.map((o) => ({ ...o, payout_run_id: id }))),
      ])
      if (brErr) throw brErr
      if (owErr) throw owErr

      await upsertPayoutSettings(input.branches, accountId)
    },
    onSuccess: (_v, { input }) => {
      qc.invalidateQueries({ queryKey: ["payout-runs", input.month, input.year] })
      qc.invalidateQueries({ queryKey: ["payout-settings"] })
    },
  })
}

export function useDeletePayoutRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; month: number; year: number }) => {
      const { error } = await supabase.from("payout_runs").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: (_v, { month, year }) => {
      qc.invalidateQueries({ queryKey: ["payout-runs", month, year] })
    },
  })
}
