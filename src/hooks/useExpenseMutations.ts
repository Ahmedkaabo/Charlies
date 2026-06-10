import { useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import type { Expense } from "@/types/expense"

// ── Update ─────────────────────────────────────────────────

export interface UpdateExpenseInput {
  id: string
  data: {
    branch_id: string
    category_id: string | null
    amount: number
    description: string
    receipt_url: string | null
  }
  changes: Record<string, { from: string; to: string }>
  edited_by: string
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data, changes, edited_by }: UpdateExpenseInput) => {
      const editedAt = new Date().toISOString()

      const { error } = await supabase
        .from("expenses")
        .update({ ...data, edited_at: editedAt, edited_by })
        .eq("id", id)
      if (error) throw error

      const { error: editErr } = await supabase
        .from("expense_edits")
        .insert({ expense_id: id, edited_by, edited_at: editedAt, changes })
      if (editErr) throw editErr
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["expenses"] })
      qc.invalidateQueries({ queryKey: ["expense-edits", vars.id] })
    },
  })
}

export interface ExpenseInput {
  branch_id: string
  category_id: string | null
  amount: number
  currency: string
  description: string | null
  date: string
  receipt_url: string | null
  added_by: string | null
}

export function useCreateExpense() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (input: ExpenseInput) => {
      const { error } = await supabase
        .from("expenses")
        .insert({ ...input, account_id: accountId ?? undefined })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] })
    },
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] })
    },
  })
}
