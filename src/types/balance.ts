export type BalancePool = 'sales' | 'expenses' | 'treasury'

export interface TreasuryTransfer {
  id: string
  branch_id: string
  amount: number
  date: string
  source: BalancePool
  destination: BalancePool
  notes: string | null
  added_by: string | null
  created_at: string
  branch?: { id: string; name: string } | null
  adder?: { id: string; full_name: string | null } | null
}

export interface BranchBalance {
  branchId: string
  branchName: string
  sales: number
  expenses: number
  salesBalance: number
  expenseBalance: number
  remaining: number
}

export interface BalanceSummary {
  totalSales: number
  totalExpenses: number
  salesBalance: number
  expenseBalance: number
  mainTreasury: number
  totalRemaining: number
}
