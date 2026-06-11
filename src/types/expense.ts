export interface Supplier {
  id: string
  account_id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string
}

export interface ExpenseCategory {
  id: string
  name: string
  icon: string | null
  is_cogs: boolean
}

export interface Expense {
  id: string
  branch_id: string
  category_id: string | null
  supplier_id: string | null
  amount: number
  currency: string
  description: string | null
  date: string
  added_by: string | null
  receipt_url: string | null
  created_at: string
  edited_at: string | null
  edited_by: string | null
  branch: { id: string; name: string } | null
  category: ExpenseCategory | null
  supplier: { id: string; name: string } | null
}

export interface ExpenseEdit {
  id: string
  expense_id: string
  edited_by: string | null
  edited_at: string
  changes: Record<string, { from: string; to: string }>
  editor: { id: string; full_name: string | null } | null
}

export type ExpenseDateFilter = "this_week" | "this_month" | "custom"

export interface ExpenseFilters {
  branchId?: string
  branchIds?: string[]   // scope to multiple branches when no single branchId selected
  categoryId?: string
  categoryIds?: string[]
  dateFilter: ExpenseDateFilter
  dateFrom: string
  dateTo: string
}
