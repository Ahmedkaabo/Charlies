import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

interface CategoryPayload {
  name: string
  name_ar?: string | null
  icon: string | null
  is_cogs: boolean
}

export function useCreateExpenseCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CategoryPayload) => {
      const { data, error } = await supabase
        .from("expense_categories")
        .insert(payload)
        .select("id, name, name_ar, icon, is_cogs")
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expense-categories"] }),
  })
}

export function useUpdateExpenseCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & CategoryPayload) => {
      const { data, error } = await supabase
        .from("expense_categories")
        .update(payload)
        .eq("id", id)
        .select("id, name, name_ar, icon, is_cogs")
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expense-categories"] }),
  })
}

export function useDeleteExpenseCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("expense_categories")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expense-categories"] }),
  })
}
