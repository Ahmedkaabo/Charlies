export interface BranchOwnership {
  id: string
  branch_id: string
  profile_id: string
  stocks: number
  note: string | null
  created_at: string
  profile?: { id: string; full_name: string | null; avatar_url: string | null } | null
}

export type FinanceRecordType = 'credit' | 'debit'

export interface FinanceRecord {
  id: string
  branch_id: string
  amount: number
  type: FinanceRecordType
  is_visa: boolean
  is_rent: boolean
  description: string | null
  date: string
  added_by: string | null
  created_at: string
  adder?: { id: string; full_name: string | null } | null
  branch?: { id: string; name: string } | null
}

export interface FinanceSummary {
  revenue: number
  expenses: number
  payrollTotal: number
  netProfit: number
  credits: number
  debits: number
  adjustments: number
  visaTotal: number
  adjustedProfit: number
}

export interface OwnerPayout {
  ownership: BranchOwnership
  totalStocks: number
  percentage: number
  payout: number
}

export interface BranchPayout {
  branchId: string
  branchName: string
  stocks: number
  totalStocks: number
  percentage: number
  payout: number
}

export interface OwnerTotalPayout {
  profileId: string
  fullName: string | null
  branchPayouts: BranchPayout[]
  totalPayout: number
}

// ── Payout runs ───────────────────────────────────────────────

export type DeductionType = 'fixed' | 'percentage'

export interface PayoutRun {
  id: string
  month: number
  year: number
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface PayoutRunBranch {
  id: string
  payout_run_id: string
  branch_id: string
  branch_name: string
  rent_type: DeductionType
  rent_value: number
  favor_type: DeductionType
  favor_value: number
  company_share_type: DeductionType
  company_share_value: number
  mgmt_fee_type: DeductionType
  mgmt_fee_value: number
  snapshot_sales: number
  snapshot_net_profit: number
  rent_amount: number
  favor_amount: number
  company_share_amount: number
  mgmt_fee_amount: number
  distributable_profit: number
}

export interface PayoutRunOwner {
  id: string
  payout_run_id: string
  branch_id: string
  branch_name: string
  profile_id: string
  full_name: string | null
  stocks: number
  total_stocks: number
  percentage: number
  payout_amount: number
}

export interface PayoutRunFull extends PayoutRun {
  branches: PayoutRunBranch[]
  owners: PayoutRunOwner[]
}
