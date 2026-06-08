import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import type { Branch, BranchMember } from "@/types/branch"
import type { BranchFormValues } from "@/pages/branches/BranchForm"

// ── Read ──────────────────────────────────────────────────────

export function useGetBranches() {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["branches", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, name_ar, address, city, phone, is_active, created_at, latitude, longitude, location_radius_meters")
        .eq("account_id", accountId!)
        .order("name", { ascending: true })
      if (error) throw error
      return (data ?? []) as Branch[]
    },
    enabled: !!accountId,
  })
}

export function useGetBranch(id: string | undefined) {
  return useQuery({
    queryKey: ["branch", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, name_ar, address, city, phone, is_active, created_at, owner_id, latitude, longitude, location_radius_meters, shift_start, shift_end, checkin_window_minutes, min_shift_hours, max_shift_hours")
        .eq("id", id!)
        .single()
      if (error) throw error
      return data as Branch
    },
    enabled: !!id,
  })
}

export function useGetBranchMembers(branchId: string | undefined) {
  return useQuery({
    queryKey: ["branches", branchId, "members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select(`
          id, branch_id, profile_id, role_id, joined_at, is_active,
          profile:profiles(id, full_name, avatar_url, phone),
          role:roles(id, name, level)
        `)
        .eq("branch_id", branchId!)
        .eq("is_active", true)
        .order("joined_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as BranchMember[]
    },
    enabled: !!branchId,
  })
}

export function useGetBranchCounts() {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["branches", "counts", accountId],
    queryFn: async () => {
      const [shiftsRes, ownersRes, membersRes] = await Promise.all([
        supabase.from("branch_shifts").select("branch_id").eq("is_active", true),
        supabase.from("owners").select("branch_id").eq("is_active", true),
        supabase.from("staff").select("branch_id").eq("is_active", true),
      ])

      const counts = new Map<string, { shifts: number; owners: number; members: number }>()

      const increment = (rows: { branch_id: string }[] | null, key: "shifts" | "owners" | "members") => {
        for (const r of rows ?? []) {
          const existing = counts.get(r.branch_id) ?? { shifts: 0, owners: 0, members: 0 }
          existing[key]++
          counts.set(r.branch_id, existing)
        }
      }

      increment(shiftsRes.data, "shifts")
      increment(ownersRes.data, "owners")
      increment(membersRes.data, "members")

      return counts
    },
    enabled: !!accountId,
  })
}

// ── Mutations ─────────────────────────────────────────────────

export function useCreateBranch() {
  const { accountId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: BranchFormValues & { owner_id: string }) => {
      const { data, error } = await supabase
        .from("branches")
        .insert({ ...values, account_id: accountId })
        .select("id, name")
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] })
    },
  })
}

export function useUpdateBranch(id: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: BranchFormValues) => {
      const { data, error } = await supabase
        .from("branches")
        .update(values)
        .eq("id", id!)
        .select("id, name")
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] })
      qc.invalidateQueries({ queryKey: ["branch", id] })
    },
  })
}

export function useDeleteBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("branches")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] })
    },
  })
}

export function useDuplicateBranch() {
  const { accountId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: src, error: fetchErr } = await supabase
        .from("branches")
        .select("name, name_ar, address, city, phone, latitude, longitude, location_radius_meters, shift_start, shift_end, checkin_window_minutes, min_shift_hours, max_shift_hours")
        .eq("id", id)
        .single()
      if (fetchErr) throw fetchErr

      const { data, error } = await supabase
        .from("branches")
        .insert({ ...src, name: `Copy of ${src.name}`, is_active: false, account_id: accountId })
        .select("id, name")
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] })
    },
  })
}
