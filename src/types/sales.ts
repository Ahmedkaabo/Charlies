export type SalesStatus = 'draft' | 'submitted' | 'locked'

export interface SalesRecord {
  id: string
  branch_id: string
  date: string
  revenue: number
  notes: string | null
  status: SalesStatus
  receipt_url: string | null
  submitted_by: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
  branch?: { id: string; name: string } | null
  submitter?: { id: string; full_name: string | null } | null
  /** Embedded to detect edits — non-empty means date number shows orange */
  edit_history?: { id: string }[] | null
}

export interface SalesEditHistory {
  id: string
  sales_record_id: string
  branch_id: string
  date: string
  previous_revenue: number | null
  new_revenue: number | null
  previous_notes: string | null
  new_notes: string | null
  previous_status: string | null
  new_status: string | null
  edited_by: string | null
  edited_at: string
  reason: string | null
  editor?: { id: string; full_name: string | null } | null
}
