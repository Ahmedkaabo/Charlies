import { useQuery } from "@tanstack/react-query"
import { format, subDays } from "date-fns"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import type { AttendanceLog, AttendanceLogWithProfile } from "@/types/attendance"
import type { BranchShift } from "@/types/branch"
import type { Branch } from "@/types/branch"

// ── Branches the current user is a member of (management scope) ─

export function useMyBranches(profileId: string | undefined) {
  return useQuery({
    queryKey: ["my-branches", profileId],
    queryFn: async () => {
      // A user may be in staff, owners, or both — union the results
      const [staffRes, ownerRes] = await Promise.all([
        supabase.from("staff").select("branch:branches(*)").eq("profile_id", profileId!).eq("is_active", true),
        supabase.from("owners").select("branch:branches(*)").eq("profile_id", profileId!).eq("is_active", true),
      ])
      if (staffRes.error) throw staffRes.error
      if (ownerRes.error) throw ownerRes.error

      const seen = new Set<string>()
      const branches: Branch[] = []
      for (const row of [...(staffRes.data ?? []), ...(ownerRes.data ?? [])]) {
        const b = row.branch as unknown as Branch
        if (b?.id && !seen.has(b.id)) {
          seen.add(b.id)
          branches.push(b)
        }
      }
      return branches
    },
    enabled: !!profileId,
    staleTime: 60_000,
  })
}

// ── Branch data needed for staff check-in ─────────────────────

export interface StaffBranch {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
  location_radius_meters: number
  check_in_time: string | null
  check_out_time: string | null
  min_shift_hours: number
  max_shift_hours: number
  role_type: "managerial" | "operational"
  shifts: BranchShift[]
}

export function useMyBranch(profileId: string | undefined) {
  return useQuery({
    queryKey: ["my-branch", profileId],
    queryFn: async () => {
      const branchSelect = `
        id, name, latitude, longitude,
        location_radius_meters, check_in_time, check_out_time,
        min_shift_hours, max_shift_hours,
        shifts:branch_shifts(*)
      `
      // Check staff first (has role_type); then fall back to owners (always managerial)
      const staffRes = await supabase
        .from("staff")
        .select(`branch_id, role:roles(role_type), branch:branches(${branchSelect})`)
        .eq("profile_id", profileId!)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()

      if (staffRes.error) throw staffRes.error
      if (staffRes.data) {
        const roleType = ((staffRes.data.role as { role_type?: string } | null)?.role_type ?? "operational") as StaffBranch["role_type"]
        return { ...(staffRes.data.branch as Omit<StaffBranch, "role_type">), role_type: roleType }
      }

      // Not a staff member — check owners table
      const ownerRes = await supabase
        .from("owners")
        .select(`branch_id, branch:branches(${branchSelect})`)
        .eq("profile_id", profileId!)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()

      if (ownerRes.error) throw ownerRes.error
      if (!ownerRes.data) return null
      return { ...(ownerRes.data.branch as Omit<StaffBranch, "role_type">), role_type: "managerial" as const }
    },
    enabled: !!profileId,
    refetchInterval: 60_000,
  })
}

// ── Staff's own attendance (today + last 14 days) ──────────────

export function useMyAttendance(profileId: string | undefined) {
  const today = format(new Date(), "yyyy-MM-dd")
  const from = format(subDays(new Date(), 14), "yyyy-MM-dd")

  return useQuery({
    queryKey: ["attendance", "my", profileId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("profile_id", profileId!)
        .gte("date", from)
        .lte("date", today)
        .order("date", { ascending: false })

      if (error) throw error
      const logs = (data ?? []) as AttendanceLog[]
      return {
        todayLog: logs.find((l) => l.date === today) ?? null,
        history: logs,
      }
    },
    enabled: !!profileId,
    refetchInterval: 30_000,
  })
}

// ── Filtered attendance logs (manager view) ───────────────────

export interface AttendanceFilters {
  branchId?: string
  branchIds?: string[]  // membership-scoped multi-branch filter
  profileId?: string
  date?: string
  dateFrom?: string
  dateTo?: string
}

export function useAttendanceLogs(filters: AttendanceFilters) {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["attendance", "logs", filters, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      let q = supabase
        .from("attendance_logs")
        .select(`
          *,
          profile:profiles(id, full_name, avatar_url),
          branch:branches(id, name, check_in_time, check_out_time, min_shift_hours, max_shift_hours),
          shift:branch_shifts(id, name, shift_start, shift_end, full_day_hours, overtime_hours)
        `)
        .eq("account_id", accountId!)
        .order("date", { ascending: false })
        .order("check_in_at", { ascending: false })

      if (filters.branchId) q = q.eq("branch_id", filters.branchId)
      else if (filters.branchIds?.length) q = q.in("branch_id", filters.branchIds)
      if (filters.profileId) q = q.eq("profile_id", filters.profileId)
      if (filters.date) q = q.eq("date", filters.date)
      if (filters.dateFrom) q = q.gte("date", filters.dateFrom)
      if (filters.dateTo) q = q.lte("date", filters.dateTo)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as AttendanceLogWithProfile[]
    },
  })
}

// ── Today's attendance for all staff (manager view) ───────────

export function useTodayAttendance(branchId?: string) {
  const { accountId } = useAuth()
  const today = format(new Date(), "yyyy-MM-dd")

  return useQuery({
    queryKey: ["attendance", "today", branchId ?? "all", today, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      let q = supabase
        .from("attendance_logs")
        .select(`
          *,
          profile:profiles(id, full_name, avatar_url),
          branch:branches(id, name, check_in_time, check_out_time, min_shift_hours, max_shift_hours),
          shift:branch_shifts(id, name, shift_start, shift_end, full_day_hours, overtime_hours)
        `)
        .eq("account_id", accountId!)
        .eq("date", today)
        .order("check_in_at", { ascending: true })

      if (branchId) q = q.eq("branch_id", branchId)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as AttendanceLogWithProfile[]
    },
    refetchInterval: 60_000,
  })
}
