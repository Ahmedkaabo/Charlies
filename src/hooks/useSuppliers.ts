import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import type { Supplier } from "@/types/expense"

// ── Queries ────────────────────────────────────────────────────

export function useGetSuppliers() {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["suppliers", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, account_id, name, name_ar, contact_person, phone, email, notes, created_at")
        .eq("account_id", accountId!)
        .order("name")
      if (error) throw error
      return (data ?? []) as Supplier[]
    },
  })
}

export function useGetCategorySuppliers(categoryId: string | null) {
  return useQuery({
    queryKey: ["category-suppliers", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_suppliers")
        .select("supplier_id, supplier:suppliers(id, account_id, name, name_ar, contact_person, phone, email, notes, created_at)")
        .eq("category_id", categoryId!)
      if (error) throw error
      return ((data ?? []).map((r) => r.supplier).filter(Boolean)) as Supplier[]
    },
  })
}

export function useGetSupplierExpenses(supplierId: string | null) {
  return useQuery({
    queryKey: ["supplier-expenses", supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, amount, currency, description, date, branch:branches(id, name), category:expense_categories(id, name, icon)")
        .eq("supplier_id", supplierId!)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
  })
}

// ── Mutations ──────────────────────────────────────────────────

interface SupplierPayload {
  name: string
  name_ar?: string | null
  contact_person: string | null
  phone: string | null
  email: string | null
  notes: string | null
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (payload: SupplierPayload) => {
      const { data, error } = await supabase
        .from("suppliers")
        .insert({ ...payload, account_id: accountId! })
        .select("id, account_id, name, name_ar, contact_person, phone, email, notes, created_at")
        .single()
      if (error) throw error
      return data as Supplier
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  })
}

export function useUpdateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & SupplierPayload) => {
      const { data, error } = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", id)
        .select("id, account_id, name, name_ar, contact_person, phone, email, notes, created_at")
        .single()
      if (error) throw error
      return data as Supplier
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  })
}

export function useDeleteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  })
}

export function useLinkSupplierToCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ categoryId, supplierId }: { categoryId: string; supplierId: string }) => {
      const { error } = await supabase
        .from("category_suppliers")
        .insert({ category_id: categoryId, supplier_id: supplierId })
      if (error) throw error
    },
    onSuccess: (_data, { categoryId }) =>
      qc.invalidateQueries({ queryKey: ["category-suppliers", categoryId] }),
  })
}

export function useUnlinkSupplierFromCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ categoryId, supplierId }: { categoryId: string; supplierId: string }) => {
      const { error } = await supabase
        .from("category_suppliers")
        .delete()
        .eq("category_id", categoryId)
        .eq("supplier_id", supplierId)
      if (error) throw error
    },
    onSuccess: (_data, { categoryId }) =>
      qc.invalidateQueries({ queryKey: ["category-suppliers", categoryId] }),
  })
}
