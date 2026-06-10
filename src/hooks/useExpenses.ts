import { useQuery } from "@tanstack/react-query"
import { format, startOfWeek, startOfMonth } from "date-fns"

import { supabase } from "@/lib/supabase"
import type { Expense, ExpenseCategory, ExpenseEdit, ExpenseFilters } from "@/types/expense"

function getDateRange(filters: ExpenseFilters): { from: string; to: string } {
  const today = new Date()
  if (filters.dateFilter === "this_week") {
    return {
      from: format(startOfWeek(today, { weekStartsOn: 0 }), "yyyy-MM-dd"),
      to: format(today, "yyyy-MM-dd"),
    }
  }
  if (filters.dateFilter === "this_month") {
    return {
      from: format(startOfMonth(today), "yyyy-MM-dd"),
      to: format(today, "yyyy-MM-dd"),
    }
  }
  return {
    from: filters.dateFrom || format(startOfMonth(today), "yyyy-MM-dd"),
    to: filters.dateTo || format(today, "yyyy-MM-dd"),
  }
}

export function useGetExpenses(filters: ExpenseFilters) {
  return useQuery({
    queryKey: ["expenses", filters],
    queryFn: async () => {
      const { from, to } = getDateRange(filters)

      let query = supabase
        .from("expenses")
        .select(`
          id, branch_id, category_id, amount, currency, description, date,
          added_by, receipt_url, created_at, edited_at, edited_by,
          branch:branches(id, name),
          category:expense_categories(id, name, icon)
        `)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })

      if (filters.branchId) {
        query = query.eq("branch_id", filters.branchId)
      } else if (filters.branchIds?.length) {
        query = query.in("branch_id", filters.branchIds)
      }
      if (filters.categoryIds?.length) {
        query = query.in("category_id", filters.categoryIds)
      } else if (filters.categoryId) {
        query = query.eq("category_id", filters.categoryId)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as unknown as Expense[]
    },
  })
}

function sortCategories(cats: ExpenseCategory[]): ExpenseCategory[] {
  return [...cats].sort((a, b) => {
    const aName = a.name.toLowerCase()
    const bName = b.name.toLowerCase()
    if (aName === "employee debt") return -1
    if (bName === "employee debt") return 1
    if (aName === "other") return 1
    if (bName === "other") return -1
    return a.name.localeCompare(b.name)
  })
}

export function useGetExpenseCategories() {
  return useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("id, name, icon")
      if (error) throw error
      return sortCategories((data ?? []) as ExpenseCategory[])
    },
  })
}

export function useGetExpenseSummaryByCategory(
  month: number,
  year: number,
  branchId?: string,
) {
  return useQuery({
    queryKey: ["expenses", "summary-by-category", month, year, branchId],
    queryFn: async () => {
      const from = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
      const to = format(new Date(year, month, 0), "yyyy-MM-dd")

      let query = supabase
        .from("expenses")
        .select(`amount, category:expense_categories(id, name, icon)`)
        .gte("date", from)
        .lte("date", to)

      if (branchId) {
        query = query.eq("branch_id", branchId)
      }

      const { data, error } = await query
      if (error) throw error

      const map = new Map<string, { name: string; icon: string | null; total: number }>()
      for (const row of data ?? []) {
        const cat = (row.category as unknown) as { id: string; name: string; icon: string | null } | null
        const key = cat?.id ?? "__uncategorized__"
        const cur = map.get(key) ?? { name: cat?.name ?? "Uncategorized", icon: cat?.icon ?? null, total: 0 }
        map.set(key, { ...cur, total: cur.total + (row.amount as number) })
      }

      return Array.from(map.values()).sort((a, b) => b.total - a.total)
    },
  })
}

export function useGetExpenseSummaryByBranch(month: number, year: number) {
  return useQuery({
    queryKey: ["expenses", "summary-by-branch", month, year],
    queryFn: async () => {
      const from = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
      const to   = format(new Date(year, month, 0), "yyyy-MM-dd")

      const { data, error } = await supabase
        .from("expenses")
        .select(`amount, branch:branches(id, name)`)
        .gte("date", from)
        .lte("date", to)
      if (error) throw error

      const map = new Map<string, { name: string; total: number }>()
      for (const row of data ?? []) {
        const branch = (row.branch as unknown) as { id: string; name: string } | null
        const key = branch?.id ?? "__unknown__"
        const cur = map.get(key) ?? { name: branch?.name ?? "Unknown", total: 0 }
        map.set(key, { ...cur, total: cur.total + (row.amount as number) })
      }

      return Array.from(map.values()).sort((a, b) => b.total - a.total)
    },
  })
}

export function useGetExpenseEdits(expenseId: string, enabled = false) {
  return useQuery({
    queryKey: ["expense-edits", expenseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_edits")
        .select(`
          id, expense_id, edited_by, edited_at, changes,
          editor:profiles(id, full_name)
        `)
        .eq("expense_id", expenseId)
        .order("edited_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as ExpenseEdit[]
    },
    enabled: !!expenseId && enabled,
  })
}
