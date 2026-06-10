import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { calculateEarnedSalary } from "@/lib/attendance"
import type { CheckInData, CheckOutData } from "@/types/attendance"

// ── Check In ──────────────────────────────────────────────────

export function useCheckIn() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (data: CheckInData) => {
      const { error } = await supabase
        .from("attendance_logs")
        .insert({ ...data, account_id: accountId ?? undefined })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] })
    },
  })
}

// ── Check Out ─────────────────────────────────────────────────

export function useCheckOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ logId, data }: { logId: string; data: CheckOutData }) => {
      const { error } = await supabase
        .from("attendance_logs")
        .update(data)
        .eq("id", logId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] })
    },
  })
}

// ── Upsert Payroll Record ─────────────────────────────────────

export interface UpsertPayrollInput {
  branch_id: string
  profile_id: string
  month: number
  year: number
  base_salary: number | null
  total_bonuses?: number
  total_deductions?: number
  total_debts?: number
  days_present?: number
  paid_days_off?: number
  currency?: string
}

export function useUpsertPayrollRecord() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (input: UpsertPayrollInput) => {
      const base        = input.base_salary ?? 0
      const days        = input.days_present ?? 0
      const paidDaysOff = input.paid_days_off ?? 0
      const bonuses     = input.total_bonuses    ?? 0
      const deductions  = input.total_deductions ?? 0
      const debts       = input.total_debts      ?? 0
      const earned      = calculateEarnedSalary(base, days + paidDaysOff)

      const { error } = await supabase
        .from("payroll_records")
        .upsert(
          {
            branch_id:        input.branch_id,
            profile_id:       input.profile_id,
            month:            input.month,
            year:             input.year,
            base_salary:      input.base_salary,
            total_bonuses:    bonuses,
            total_deductions: deductions,
            total_debts:      debts,
            days_present:     days,
            currency:         input.currency ?? "EGP",
            net_salary:       earned + bonuses - deductions - debts,
            account_id:       accountId ?? undefined,
          },
          { onConflict: "branch_id,profile_id,month,year" }
        )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll"] })
    },
  })
}

// ── Add Adjustment + Recalculate Net ─────────────────────────

export interface AddAdjustmentInput {
  payroll_record_id: string | null
  branch_id: string
  profile_id: string
  type: "bonus" | "deduction" | "debt"
  amount: number
  reason: string
  month: number
  year: number
  created_by: string
  current_base: number | null
  current_days_present: number
  current_paid_days_off: number
}

export function useAddAdjustment() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (input: AddAdjustmentInput) => {
      const { current_base, current_days_present, current_paid_days_off, ...rest } = input

      // 1. Insert the adjustment
      const { error: adjErr } = await supabase
        .from("payroll_adjustments")
        .insert({ ...rest, account_id: accountId ?? undefined })
      if (adjErr) throw adjErr

      // 2. Recalculate totals on the payroll record
      if (input.payroll_record_id) {
        const { data: allAdj } = await supabase
          .from("payroll_adjustments")
          .select("type, amount")
          .eq("payroll_record_id", input.payroll_record_id)

        let bonuses    = 0
        let deductions = 0
        let debts      = 0
        for (const a of allAdj ?? []) {
          const amt = Number(a.amount)
          if      (a.type === "bonus")     bonuses    += amt
          else if (a.type === "deduction") deductions += amt
          else if (a.type === "debt")      debts      += amt
        }

        const earned = calculateEarnedSalary(current_base ?? 0, current_days_present + current_paid_days_off)
        const { error: updateErr } = await supabase
          .from("payroll_records")
          .update({
            total_bonuses:    bonuses,
            total_deductions: deductions,
            total_debts:      debts,
            days_present:     current_days_present,
            net_salary:       earned + bonuses - deductions - debts,
          })
          .eq("id", input.payroll_record_id)
        if (updateErr) throw updateErr
      }

    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll"] })
    },
  })
}

// ── Delete Adjustment ─────────────────────────────────────────

interface DeleteAdjustmentInput {
  id: string
  payroll_record_id: string | null
  current_base: number | null
  current_days_present: number
  current_paid_days_off: number
}

export function useDeleteAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: DeleteAdjustmentInput) => {
      const { error } = await supabase
        .from("payroll_adjustments")
        .delete()
        .eq("id", input.id)
      if (error) throw error

      if (input.payroll_record_id) {
        const { data: remaining } = await supabase
          .from("payroll_adjustments")
          .select("type, amount")
          .eq("payroll_record_id", input.payroll_record_id)

        let bonuses = 0, deductions = 0, debts = 0
        for (const a of remaining ?? []) {
          const amt = Number(a.amount)
          if      (a.type === "bonus")     bonuses    += amt
          else if (a.type === "deduction") deductions += amt
          else if (a.type === "debt")      debts      += amt
        }

        const earned = calculateEarnedSalary(
          input.current_base ?? 0,
          input.current_days_present + input.current_paid_days_off,
        )

        const { error: updateErr } = await supabase
          .from("payroll_records")
          .update({
            total_bonuses:    bonuses,
            total_deductions: deductions,
            total_debts:      debts,
            net_salary:       earned + bonuses - deductions - debts,
          })
          .eq("id", input.payroll_record_id)
        if (updateErr) throw updateErr
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll"] })
    },
  })
}
