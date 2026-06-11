import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { calculateEarnedSalary } from "@/lib/attendance"
import type { PayrollAdjustment, PayrollSummary, StaffPayrollRow } from "@/types/attendance"

// Row types for Supabase responses
type StaffRow = { branch_id: string; profile_id: string; profile?: any; role?: any }
type SalaryRow = { branch_id: string; profile_id: string; monthly_salary?: number | null; paid_days_off?: number | null; currency?: string }
type AttLogRow = { branch_id: string; profile_id: string; day_value?: number | null }
type PayrollRecordRow = { branch_id: string; profile_id: string; total_bonuses?: number | null; total_deductions?: number | null; total_debts?: number | null; id?: string | null; is_finalized?: boolean | null }

// ── Shared: month date-range strings ─────────────────────────

function monthRange(month: number, year: number) {
  const pad = String(month).padStart(2, "0")
  const lastDay = new Date(year, month, 0).getDate()
  return {
    start: `${year}-${pad}-01`,
    end:   `${year}-${pad}-${String(lastDay).padStart(2, "0")}`,
  }
}

// ── Payroll Summary Cards ──────────────────────────────────────

export function usePayrollSummary(
  branchId: string | undefined,
  branchIds: string[] | undefined,
  month: number,
  year: number
) {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["payroll", "summary", branchId ?? branchIds ?? "all", month, year, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { start, end } = monthRange(month, year)

      // 1. Active staff — account_id is the org anchor here
      let membersQ = supabase
        .from("staff")
        .select("branch_id, profile_id")
        .eq("is_active", true)
        .eq("account_id", accountId!)
      if (branchId) membersQ = membersQ.eq("branch_id", branchId)
      else if (branchIds?.length) membersQ = membersQ.in("branch_id", branchIds)
      const { data: activeMembers, error: membersErr } = await membersQ
      if (membersErr) throw membersErr
      const activeMembersTyped = (activeMembers ?? []) as StaffRow[]
      const activeMemberKeys = new Set(activeMembersTyped.map((m) => `${m.branch_id}:${m.profile_id}`))

      // 2. Salary structures — scoped by branch_id (already org-scoped via staff query above)
      let salaryQ = supabase
        .from("salary_structures")
        .select("branch_id, profile_id, monthly_salary, paid_days_off")
      if (branchId) salaryQ = salaryQ.eq("branch_id", branchId)
      else if (branchIds?.length) salaryQ = salaryQ.in("branch_id", branchIds)
      const { data: allSalaries, error: salaryErr } = await salaryQ
      if (salaryErr) throw salaryErr
      const salariesTyped = (allSalaries ?? []) as SalaryRow[]
      // Filter to only active staff in this account
      const salaries = salariesTyped.filter((s) => activeMemberKeys.has(`${s.branch_id}:${s.profile_id}`))

      // 3. Attendance day_value sums for the month — scoped by branch_id
      let attQ = supabase
        .from("attendance_logs")
        .select("branch_id, profile_id, day_value")
        .gte("date", start)
        .lte("date", end)
        .not("day_value", "is", null)
      if (branchId) attQ = attQ.eq("branch_id", branchId)
      else if (branchIds?.length) attQ = attQ.in("branch_id", branchIds)
      const { data: attLogs, error: attErr } = await attQ
      if (attErr) throw attErr
      const attLogsTyped = (attLogs ?? []) as AttLogRow[]

      // 4. Adjustment totals from payroll_records — scoped by branch_id
      let payrollQ = supabase
        .from("payroll_records")
        .select("total_bonuses, total_deductions, total_debts")
        .eq("month", month)
        .eq("year", year)
      if (branchId) payrollQ = payrollQ.eq("branch_id", branchId)
      else if (branchIds?.length) payrollQ = payrollQ.in("branch_id", branchIds)
      const { data: records, error: payrollErr } = await payrollQ
      if (payrollErr) throw payrollErr
      const recordsTyped = (records ?? []) as PayrollRecordRow[]

      // Build attendance map: "branch_id:profile_id" → total day_value
      const daysMap = new Map<string, number>()
      for (const log of attLogsTyped) {
        const k = `${log.branch_id}:${log.profile_id}`
        daysMap.set(k, (daysMap.get(k) ?? 0) + (Number(log.day_value) || 0))
      }

      const totalSalaryBudget = salaries.reduce((sum, s) => sum + (Number(s.monthly_salary) || 0), 0)

      // totalEarned = base/30 * (days_present + paid_days_off) per staff
      const totalEarned = salaries.reduce((sum, s) => {
        const k          = `${s.branch_id}:${s.profile_id}`
        const base       = Number(s.monthly_salary) || 0
        const paidDaysOff = Number(s.paid_days_off) || 0
        return sum + calculateEarnedSalary(base, (daysMap.get(k) ?? 0) + paidDaysOff)
      }, 0)

      const totalBonuses = recordsTyped.reduce((sum, r) => sum + (Number(r.total_bonuses) || 0), 0)
      const totalDeductions = recordsTyped.reduce((sum, r) => sum + (Number(r.total_deductions) || 0), 0)
      const totalDebts = recordsTyped.reduce((sum, r) => sum + (Number(r.total_debts) || 0), 0)

      return {
        totalSalaryBudget,
        totalBonuses,
        totalDeductions,
        totalDebts,
        projectedNetPayout: totalEarned + totalBonuses - totalDeductions - totalDebts,
      } satisfies PayrollSummary
    },
  })
}

// ── Per-staff Payroll Table ───────────────────────────────────

export function usePayrollRecords(
  branchId: string | undefined,
  branchIds: string[] | undefined,
  profileId: string | undefined,
  month: number,
  year: number
) {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["payroll", "records", branchId ?? branchIds ?? "all", profileId ?? "all", month, year, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { start, end } = monthRange(month, year)

      // 1. Active staff — account_id is the org anchor here
      let membersQ = supabase
        .from("staff")
        .select(`
          profile_id, branch_id,
          profile:profiles(id, full_name, avatar_url),
          role:roles(id, name, name_ar, level)
        `)
        .eq("is_active", true)
        .eq("account_id", accountId!)
      if (branchId) membersQ = membersQ.eq("branch_id", branchId)
      else if (branchIds?.length) membersQ = membersQ.in("branch_id", branchIds)
      if (profileId) membersQ = membersQ.eq("profile_id", profileId)
      const { data: members, error: membersErr } = await membersQ
      if (membersErr) throw membersErr
      const membersTyped = (members ?? []) as StaffRow[]

      // 2. Salary structures — scoped by branch_id (org-scoped via staff query)
      let salaryQ = supabase
        .from("salary_structures")
        .select("branch_id, profile_id, monthly_salary, currency, paid_days_off")
      if (branchId) salaryQ = salaryQ.eq("branch_id", branchId)
      else if (branchIds?.length) salaryQ = salaryQ.in("branch_id", branchIds)
      if (profileId) salaryQ = salaryQ.eq("profile_id", profileId)
      const { data: salaries, error: salaryErr } = await salaryQ
      if (salaryErr) throw salaryErr
      const salariesTyped = (salaries ?? []) as SalaryRow[]

      // 3. Payroll records (adjustments) — scoped by branch_id
      let payrollQ = supabase
        .from("payroll_records")
        .select("*")
        .eq("month", month)
        .eq("year", year)
      if (branchId) payrollQ = payrollQ.eq("branch_id", branchId)
      else if (branchIds?.length) payrollQ = payrollQ.in("branch_id", branchIds)
      if (profileId) payrollQ = payrollQ.eq("profile_id", profileId)
      const { data: payrollRecs, error: payrollErr } = await payrollQ
      if (payrollErr) throw payrollErr
      const payrollRecsTyped = (payrollRecs ?? []) as PayrollRecordRow[]

      // 4. Attendance day_value sums for the month — scoped by branch_id
      let attQ = supabase
        .from("attendance_logs")
        .select("branch_id, profile_id, day_value")
        .gte("date", start)
        .lte("date", end)
        .not("day_value", "is", null)
      if (branchId) attQ = attQ.eq("branch_id", branchId)
      else if (branchIds?.length) attQ = attQ.in("branch_id", branchIds)
      if (profileId) attQ = attQ.eq("profile_id", profileId)
      const { data: attLogs, error: attErr } = await attQ
      if (attErr) throw attErr
      const attLogsTyped = (attLogs ?? []) as AttLogRow[]

      // Build lookup maps
      const salaryMap = new Map(salariesTyped.map((s) => [`${s.branch_id}:${s.profile_id}`, s]))
      const payrollMap = new Map(payrollRecsTyped.map((r) => [`${r.branch_id}:${r.profile_id}`, r]))
      const daysMap = new Map<string, number>()
      for (const log of attLogsTyped) {
        const k = `${log.branch_id}:${log.profile_id}`
        daysMap.set(k, (daysMap.get(k) ?? 0) + (Number(log.day_value) || 0))
      }

      // Merge — deduplicate by branch+profile
      const seen = new Set<string>()
      const rows: StaffPayrollRow[] = []

      for (const m of membersTyped) {
        const key = `${m.branch_id}:${m.profile_id}`
        if (seen.has(key)) continue
        seen.add(key)

        const salary  = salaryMap.get(key)
        const payroll = payrollMap.get(key)
        const profile = (Array.isArray(m.profile) ? m.profile[0] : m.profile) as
          | { id: string; full_name: string | null; avatar_url: string | null }
          | null

        const baseSalary  = Number(salary?.monthly_salary ?? 0)
        const paidDaysOff = Number(salary?.paid_days_off  ?? 0)
        const daysPresent = daysMap.get(key) ?? 0
        const earnedSalary = calculateEarnedSalary(baseSalary, daysPresent + paidDaysOff)
        const bonuses     = Number(payroll?.total_bonuses    ?? 0)
        const deductions  = Number(payroll?.total_deductions ?? 0)
        const debts       = Number(payroll?.total_debts      ?? 0)

        rows.push({
          profile_id:        m.profile_id,
          branch_id:         m.branch_id,
          full_name:         profile?.full_name  ?? null,
          role:              (Array.isArray(m.role) ? m.role[0] : m.role) as { id: string; name: string; name_ar?: string | null; level: number } | null ?? null,
          avatar_url:        profile?.avatar_url ?? null,
          base_salary:       salary?.monthly_salary ?? null,
          currency:          salary?.currency ?? "EGP",
          payroll_record_id: payroll?.id ?? null,
          total_bonuses:     bonuses,
          total_deductions:  deductions,
          total_debts:       debts,
          days_present:      daysPresent,
          paid_days_off:     paidDaysOff,
          earned_salary:     earnedSalary,
          net_salary:        earnedSalary + bonuses - deductions - debts,
          is_finalized:      payroll?.is_finalized ?? false,
        })
      }

      // Exclude anyone with no salary record or a zero/null salary
      // (owners, area managers, and any unsalaried role)
      return rows.filter((r) => r.base_salary != null && r.base_salary > 0)
    },
  })
}

// ── Attendance logs for one staff member in a given month ────

export function useStaffMonthlyAttendance(
  profileId: string | undefined,
  branchId: string | undefined,
  month: number,
  year: number
) {
  const { accountId } = useAuth()
  const { start, end } = monthRange(month, year)
  return useQuery({
    queryKey: ["payroll", "attendance", profileId, branchId, month, year, accountId],
    queryFn: async () => {
      // Scoped by profile_id + branch_id — no account_id needed since branch is org-specific
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("id, date, check_in_at, check_out_at, status, is_late, late_minutes, total_hours, day_value, shift_id")
        .eq("profile_id", profileId!)
        .eq("branch_id", branchId!)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!profileId && !!branchId && !!accountId,
  })
}

// ── Adjustments for a staff member ───────────────────────────

export function usePayrollAdjustments(
  profileId: string | undefined,
  month: number,
  year: number
) {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["payroll", "adjustments", profileId, month, year, accountId],
    queryFn: async () => {
      // Scoped by profile_id + month + year — no account_id needed
      let q = supabase
        .from("payroll_adjustments")
        .select("*")
        .eq("month", month)
        .eq("year", year)
        .order("created_at", { ascending: false })

      if (profileId) q = q.eq("profile_id", profileId)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as PayrollAdjustment[]
    },
    enabled: !!profileId && !!accountId,
  })
}
