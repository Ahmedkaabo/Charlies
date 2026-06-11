export interface AttendanceLog {
  id: string
  branch_id: string
  profile_id: string
  date: string
  check_in_at: string | null
  check_out_at: string | null
  check_in_latitude: number | null
  check_in_longitude: number | null
  check_out_latitude: number | null
  check_out_longitude: number | null
  check_in_distance_meters: number | null
  check_out_distance_meters: number | null
  selfie_url: string | null
  is_late: boolean
  early_minutes: number
  late_minutes: number
  total_hours: number | null
  day_value: number | null
  shift_id: string | null
  status: "present" | "late" | "absent" | "rejected"
  notes: string | null
  created_at: string
}

export interface AttendanceLogWithProfile extends AttendanceLog {
  profile: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
  branch: {
    id: string
    name: string
    check_in_time: string | null
    check_out_time: string | null
    min_shift_hours: number
    max_shift_hours: number
  } | null
  shift: {
    id: string
    name: string
    shift_start: string
    shift_end: string
    full_day_hours: number
    overtime_hours: number
  } | null
}

export interface PayrollRecord {
  id: string
  branch_id: string
  profile_id: string
  month: number
  year: number
  base_salary: number | null
  total_bonuses: number
  total_deductions: number
  total_debts: number
  days_present: number
  net_salary: number | null
  currency: string
  is_finalized: boolean
  created_at: string
}

export interface PayrollAdjustment {
  id: string
  payroll_record_id: string | null
  branch_id: string
  profile_id: string
  type: "bonus" | "deduction" | "debt"
  amount: number
  reason: string | null
  month: number
  year: number
  created_by: string | null
  created_at: string
}

export interface PayrollSummary {
  totalSalaryBudget: number
  totalBonuses: number
  totalDeductions: number
  totalDebts: number
  projectedNetPayout: number
}

// Merged row used in the payroll table: one entry per staff member
export interface StaffPayrollRow {
  profile_id: string
  branch_id: string
  full_name: string | null
  avatar_url: string | null
  role: { id: string; name: string; name_ar?: string | null; level: number } | null
  base_salary: number | null
  currency: string
  payroll_record_id: string | null
  total_bonuses: number
  total_deductions: number
  total_debts: number
  /** Sum of attendance_logs.day_value for the month (computed live from logs). */
  days_present: number
  /** Monthly paid-leave days from salary_structures. */
  paid_days_off: number
  /** (base_salary / 30) * (days_present + paid_days_off) */
  earned_salary: number
  net_salary: number
  is_finalized: boolean
}

export interface CheckInData {
  branch_id: string
  profile_id: string
  date: string
  check_in_at: string
  check_in_latitude: number
  check_in_longitude: number
  check_in_distance_meters: number
  selfie_url: string | null
  is_late: boolean
  late_minutes: number
  status: "present" | "late"
  shift_id?: string | null
}

export interface CheckOutData {
  check_out_at: string
  check_out_latitude: number
  check_out_longitude: number
  check_out_distance_meters: number
  total_hours: number
  day_value: number
}
