import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import type { BranchShift } from "@/types/branch"

export function useGetBranchShifts(branchId: string) {
  return useQuery({
    queryKey: ["branches", branchId, "shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_shifts")
        .select("*")
        .eq("branch_id", branchId)
        .order("shift_start", { ascending: true })
      if (error) throw error
      return (data ?? []) as BranchShift[]
    },
    enabled: !!branchId,
    retry: false,
  })
}

export interface ShiftInput {
  branch_id: string
  name: string
  shift_start: string
  shift_end: string
  checkin_window_minutes: number
  full_day_hours: number
  overtime_hours: number
  late_grace_minutes: number
  late_deduction_enabled: boolean
  late_per_minutes: number | null
  late_deduct_hours: number | null
  is_active: boolean
}

export function useCreateShift() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (input: ShiftInput) => {
      const { data, error } = await supabase
        .from("branch_shifts")
        .insert({ ...input, account_id: accountId ?? undefined })
        .select("*")
      if (error) throw error
      if (!data?.length) throw new Error("Failed to create shift")
      return data[0] as BranchShift
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["branches", vars.branch_id, "shifts"] })
      qc.invalidateQueries({ queryKey: ["my-branch"] })
    },
  })
}

export function useUpdateShift(id: string, branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<ShiftInput>) => {
      const { data, error } = await supabase
        .from("branch_shifts")
        .update(input)
        .eq("id", id)
        .select("*")
      if (error) throw error
      if (!data?.length) throw new Error("Shift not found or access denied")
      return data[0] as BranchShift
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches", branchId, "shifts"] })
      qc.invalidateQueries({ queryKey: ["my-branch"] })
    },
  })
}

export function useDeleteShift(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("branch_shifts")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches", branchId, "shifts"] })
      qc.invalidateQueries({ queryKey: ["my-branch"] })
    },
  })
}
