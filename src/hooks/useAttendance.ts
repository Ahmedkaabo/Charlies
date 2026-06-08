import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import type { AttendanceLog, AttendanceLogWithProfile } from "@/types/attendance"
import type { BranchShift } from "@/types/branch"

// ── StaffBranch ───────────────────────────────────────────────

export interface StaffBranch {
  id: string
  branch_id: string
  name: string
  check_in_time: string | null
  check_out_time: string | null
  latitude: number | null
  longitude: number | null
  location_radius_meters: number
  min_shift_hours: number
  max_shift_hours: number
  shifts: BranchShift[]
}

// ── useMyBranch ───────────────────────────────────────────────

const BRANCH_FIELDS = `
  id, name, check_in_time, check_out_time,
  latitude, longitude, location_radius_meters,
  min_shift_hours, max_shift_hours
`

type BranchRow = {
  id: string; name: string; check_in_time: string | null; check_out_time: string | null
  latitude: number | null; longitude: number | null; location_radius_meters: number
  min_shift_hours: number; max_shift_hours: number
}

async function resolveBranch(b: BranchRow, branchId: string): Promise<StaffBranch> {
  const { data: shifts } = await supabase
    .from("branch_shifts")
    .select("*")
    .eq("branch_id", b.id)
    .eq("is_active", true)
    .order("shift_start", { ascending: true })

  return {
    id: b.id,
    branch_id: branchId,
    name: b.name,
    check_in_time: b.check_in_time,
    check_out_time: b.check_out_time,
    latitude: b.latitude,
    longitude: b.longitude,
    location_radius_meters: b.location_radius_meters,
    min_shift_hours: b.min_shift_hours,
    max_shift_hours: b.max_shift_hours,
    shifts: (shifts ?? []) as BranchShift[],
  }
}

export function useMyBranch(profileId: string | undefined) {
  return useQuery({
    queryKey: ["my-branch", profileId],
    queryFn: async () => {
      // Check staff table first
      const { data: staffRow, error: staffErr } = await supabase
        .from("staff")
        .select(`branch_id, branch:branches(${BRANCH_FIELDS})`)
        .eq("profile_id", profileId!)
        .eq("is_active", true)
        .maybeSingle()
      if (staffErr) throw staffErr

      if (staffRow) {
        const b = staffRow.branch as unknown as BranchRow
        return resolveBranch(b, staffRow.branch_id as string)
      }

      // Fall back to owners table (branch_owner role users)
      const { data: ownerRow, error: ownerErr } = await supabase
        .from("owners")
        .select(`branch_id, branch:branches(${BRANCH_FIELDS})`)
        .eq("profile_id", profileId!)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()
      if (ownerErr) throw ownerErr

      if (ownerRow) {
        const b = ownerRow.branch as unknown as BranchRow
        return resolveBranch(b, ownerRow.branch_id as string)
      }

      return null
    },
    enabled: !!profileId,
  })
}

// ── useMyBranches ─────────────────────────────────────────────

export function useMyBranches(profileId: string | undefined) {
  return useQuery({
    queryKey: ["my-branches", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("branch:branches(id, name, name_ar, address, city, phone, is_active, created_at, owner_id, latitude, longitude, location_radius_meters, shift_start, shift_end, checkin_window_minutes, min_shift_hours, max_shift_hours)")
        .eq("profile_id", profileId!)
        .eq("is_active", true)
      if (error) throw error
      return (data ?? []).map((row) => row.branch as unknown as import("@/types/branch").Branch)
    },
    enabled: !!profileId,
  })
}

// ── useMyAttendance ───────────────────────────────────────────

export function useMyAttendance(profileId: string | undefined) {
  return useQuery({
    queryKey: ["attendance", "mine", profileId],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd")

      const { data: todayData } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("profile_id", profileId!)
        .eq("date", today)
        .maybeSingle()

      const { data: history } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("profile_id", profileId!)
        .order("date", { ascending: false })
        .limit(30)

      return {
        todayLog: (todayData ?? null) as AttendanceLog | null,
        history:  (history ?? []) as AttendanceLog[],
      }
    },
    enabled: !!profileId,
    refetchInterval: 60_000,
  })
}

// ── useAttendanceLogs ─────────────────────────────────────────

interface AttendanceLogsFilters {
  branchId?:  string
  branchIds?: string[]
  profileId?: string
  date?:      string
}

export function useAttendanceLogs(filters: AttendanceLogsFilters) {
  const { branchId, branchIds, profileId, date } = filters
  return useQuery({
    queryKey: ["attendance-logs", branchId, branchIds, profileId, date],
    queryFn: async () => {
      let q = supabase
        .from("attendance_logs")
        .select(`
          *,
          profile:profiles(id, full_name, avatar_url),
          branch:branches(id, name, check_in_time, check_out_time, min_shift_hours, max_shift_hours),
          shift:branch_shifts(id, name, shift_start, shift_end, full_day_hours, overtime_hours)
        `)
        .order("check_in_at", { ascending: false })

      if (branchId)            q = q.eq("branch_id", branchId)
      else if (branchIds?.length) q = q.in("branch_id", branchIds)
      if (profileId)           q = q.eq("profile_id", profileId)
      if (date)                q = q.eq("date", date)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as AttendanceLogWithProfile[]
    },
  })
}
