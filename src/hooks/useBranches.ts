import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import type { Branch, BranchMember } from "@/types/branch"

export function useGetBranches() {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["branches", accountId],
    queryFn: async () => {
      if (!accountId) return []
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as Branch[]
    },
    enabled: !!accountId,
  })
}

export function useGetBranch(id: string) {
  return useQuery({
    queryKey: ["branches", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .eq("id", id)
        .maybeSingle()
      if (error) throw error
      return data as Branch | null
    },
    enabled: !!id,
  })
}

export function useGetBranchMembers(branchId: string) {
  return useQuery({
    queryKey: ["branches", branchId, "members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select(`
          id, branch_id, profile_id, role_id, joined_at, is_active,
          profile:profiles(id, full_name, avatar_url, phone, is_admin),
          role:roles(id, name, level)
        `)
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .order("joined_at", { ascending: true })
      if (error) throw error
      return (data ?? []) as BranchMember[]
    },
    enabled: !!branchId,
  })
}

export interface BranchCounts {
  shifts: number
  members: number
  owners: number
}

/** Returns a Map<branchId, BranchCounts> for all branches in one round-trip. */
export function useGetBranchCounts() {
  return useQuery({
    queryKey: ["branches", "counts"],
    queryFn: async () => {
      const [
        { data: shiftRows,  error: shiftErr  },
        { data: staffRows,  error: staffErr  },
        { data: ownerRows,  error: ownerErr  },
      ] = await Promise.all([
        supabase.from("branch_shifts").select("branch_id").eq("is_active", true),
        supabase.from("staff").select("branch_id, profile_id").eq("is_active", true),
        supabase.from("owners").select("branch_id, profile_id").eq("is_active", true),
      ])
      if (shiftErr) throw shiftErr
      if (staffErr) throw staffErr
      if (ownerErr) throw ownerErr

      // Build a lookup set of "branchId:profileId" for all owners so we can
      // exclude them from the staff count — any owner (admin or not) belongs
      // in the Owners column only.
      const ownerKeys = new Set(
        (ownerRows ?? []).map((r) => `${r.branch_id}:${r.profile_id}`)
      )

      const map = new Map<string, BranchCounts>()
      for (const { branch_id } of shiftRows ?? []) {
        const cur = map.get(branch_id) ?? { shifts: 0, members: 0, owners: 0 }
        map.set(branch_id, { ...cur, shifts: cur.shifts + 1 })
      }
      for (const { branch_id, profile_id } of staffRows ?? []) {
        if (ownerKeys.has(`${branch_id}:${profile_id}`)) continue  // owner — skip
        const cur = map.get(branch_id) ?? { shifts: 0, members: 0, owners: 0 }
        map.set(branch_id, { ...cur, members: cur.members + 1 })
      }
      for (const { branch_id } of ownerRows ?? []) {
        const cur = map.get(branch_id) ?? { shifts: 0, members: 0, owners: 0 }
        map.set(branch_id, { ...cur, owners: cur.owners + 1 })
      }
      return map
    },
  })
}

export interface BranchInput {
  name: string
  name_ar?: string | null
  address?: string | null
  city?: string | null
  phone?: string | null
  is_active?: boolean
  latitude?: number | null
  longitude?: number | null
  location_radius_meters?: number
  shift_start?: string
  shift_end?: string
  checkin_window_minutes?: number
  min_shift_hours?: number
  max_shift_hours?: number
}

export function useCreateBranch() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (input: BranchInput & { owner_id: string }) => {
      const { data, error } = await supabase
        .from("branches")
        .insert({ ...input, account_id: accountId ?? undefined })
        .select("*")
      if (error) throw error
      if (!data?.length) throw new Error("Failed to create branch")
      return data[0] as Branch
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] })
    },
  })
}

export function useUpdateBranch(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<BranchInput>) => {
      const { data, error } = await supabase
        .from("branches")
        .update(input)
        .eq("id", id)
        .select("*")
      if (error) throw error
      if (!data?.length) throw new Error("Branch not found or access denied")
      return data[0] as Branch
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] })
      qc.invalidateQueries({ queryKey: ["branches", id] })
      qc.invalidateQueries({ queryKey: ["my-branch"] })
    },
  })
}

export function useDuplicateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sourceBranchId: string) => {
      // Fetch source branch and its shifts in parallel
      const [{ data: source, error: branchErr }, { data: shifts, error: shiftsErr }] =
        await Promise.all([
          supabase.from("branches").select("*").eq("id", sourceBranchId).single(),
          supabase.from("branch_shifts").select("*").eq("branch_id", sourceBranchId),
        ])
      if (branchErr) throw branchErr
      if (shiftsErr) throw shiftsErr

      // Create the duplicate branch (inactive by default so it can be reviewed)
      const { id: _id, created_at: _ca, owner_id, ...rest } = source as Branch & { created_at: string }
      const { data: newBranchRows, error: insertErr } = await supabase
        .from("branches")
        .insert({ ...rest, name: `${source.name} (Copy)`, is_active: false, owner_id })
        .select("id, name")
      if (insertErr) throw insertErr
      if (!newBranchRows?.length) throw new Error("Failed to duplicate branch")
      const newBranch = newBranchRows[0]

      // Duplicate each shift for the new branch (inactive)
      if (shifts && shifts.length > 0) {
        const shiftInserts = shifts.map(({ id: _sid, created_at: _sca, branch_id: _bid, ...s }: Record<string, unknown>) => ({
          ...s,
          branch_id: newBranch.id,
          is_active: false,
        }))
        const { error: shiftErr } = await supabase.from("branch_shifts").insert(shiftInserts)
        if (shiftErr) throw shiftErr
      }

      return newBranch as Branch
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] })
      qc.invalidateQueries({ queryKey: ["branches", "counts"] })
    },
  })
}

export function useDeleteBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("branches").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] })
      qc.invalidateQueries({ queryKey: ["members"] })
    },
  })
}
