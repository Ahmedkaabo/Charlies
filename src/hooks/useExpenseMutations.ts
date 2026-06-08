import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] })
    },
  })
}

interface CreateExpenseInput {
  branch_id:   string
  category_id: string | null
  amount:      number
  currency:    string
  description: string
  date:        string
  receipt_url: string | null
  added_by:    string | null
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      const { data, error } = await supabase
        .from("expenses")
        .insert(input)
        .select("id")
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] })
    },
  })
}

interface UpdateExpenseInput {
  id:       string
  data:     Partial<CreateExpenseInput>
  changes:  Record<string, { from: string; to: string }>
  edited_by: string
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data, changes, edited_by }: UpdateExpenseInput) => {
      const { error } = await supabase
        .from("expenses")
        .update({ ...data, edited_at: new Date().toISOString(), edited_by })
        .eq("id", id)
      if (error) throw error

      if (Object.keys(changes).length > 0) {
        await supabase
          .from("expense_edits")
          .insert({ expense_id: id, edited_by, edited_at: new Date().toISOString(), changes })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] })
    },
  })
}
