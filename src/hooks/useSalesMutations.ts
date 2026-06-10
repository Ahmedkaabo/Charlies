import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import type { SalesRecord, SalesStatus } from "@/types/sales"

export interface UpsertSalesRecordInput {
  branch_id: string
  date: string
  revenue: number
  notes: string | null
  status: SalesStatus
  receipt_url: string | null
  submitted_by?: string | null
  submitted_at?: string | null
}

export function useUpsertSalesRecord() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (input: UpsertSalesRecordInput) => {
      const { error } = await supabase
        .from("sales_records")
        .upsert({ ...input, account_id: accountId ?? undefined }, { onConflict: "branch_id,date" })
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sales-records"] })
      qc.invalidateQueries({
        queryKey: ["sales-record", vars.branch_id, vars.date],
      })
    },
  })
}

export function useLockSalesRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sales_records")
        .update({ status: "locked" })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-records"] })
      qc.invalidateQueries({ queryKey: ["sales-edit-history"] })
    },
  })
}

export function useUnlockSalesRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sales_records")
        .update({ status: "submitted" })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-records"] })
      qc.invalidateQueries({ queryKey: ["sales-edit-history"] })
    },
  })
}
