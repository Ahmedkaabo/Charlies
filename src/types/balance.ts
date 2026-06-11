export interface TreasuryTransfer {
  id: string
  branch_id: string
  amount: number
  direction: "outflow" | "inflow"
  date: string
  notes: string | null
  added_by: string | null
  created_at: string
  branch?: { id: string; name: string; name_ar?: string | null } | null
  adder?: { id: string; full_name: string | null } | null
}

export interface PoolTransfer {
  id: string
  branch_id: string
  from_pool: "sales" | "expenses"
  to_pool: "sales" | "expenses"
  amount: number
  date: string
  notes: string | null
  added_by: string | null
  created_at: string
  branch?: { id: string; name: string; name_ar?: string | null } | null
  adder?: { id: string; full_name: string | null } | null
}

export interface BranchBalance {
  branchId: string
  branchName: string
  branchNameAr: string | null
  sales: number
  expenses: number
  transferred: number
  remaining: number
  poolCredit: number
}

export interface BalanceSummary {
  totalSales: number
  totalExpenses: number
  totalTransferred: number
  mainTreasury: number
  totalRemaining: number
}
