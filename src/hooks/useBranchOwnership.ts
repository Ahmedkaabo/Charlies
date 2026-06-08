import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { BranchOwnership } from "@/types/finance"

// ── Read ──────────────────────────────────────────────────────

export function useBranchOwnership(branchId: string | undefined) {
  return useQuery({
    queryKey: ["branch-ownership", branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_ownership")
        .select(`
          id, branch_id, profile_id, stocks, note, created_at,
          profile:profiles(id, full_name, avatar_url)
        `)
        .eq("branch_id", branchId!)
        .order("stocks", { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as BranchOwnership[]
    },
    enabled: !!branchId,
  })
}

// ── By profile (for Owners module — all branches for one owner) ──

export function useOwnershipByProfile(profileId: string | undefined) {
  return useQuery({
    queryKey: ["branch-ownership", "profile", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_ownership")
        .select("id, branch_id, profile_id, stocks, note, created_at")
        .eq("profile_id", profileId!)
      if (error) throw error
      return (data ?? []) as BranchOwnership[]
    },
    enabled: !!profileId,
  })
}

// ── All branches (for finance management view) ────────────────

export function useAllBranchOwnership() {
  return useQuery({
    queryKey: ["branch-ownership-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_ownership")
        .select(`
          id, branch_id, profile_id, stocks, note, created_at,
          profile:profiles(id, full_name, avatar_url)
        `)
        .order("stocks", { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as BranchOwnership[]
    },
  })
}

// ── Mutations ─────────────────────────────────────────────────

export interface UpsertOwnershipInput {
  branch_id: string
  profile_id: string
  stocks: number
  note?: string | null
}

export function useUpsertOwnership() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpsertOwnershipInput) => {
      const { data, error } = await supabase
        .from("branch_ownership")
        .upsert(input, { onConflict: "branch_id,profile_id" })
        .select()
        .single()
      if (error) throw error
      return data as BranchOwnership
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["branch-ownership", row.branch_id] })
      qc.invalidateQueries({ queryKey: ["branch-ownership-all"] })
      qc.invalidateQueries({ queryKey: ["branch-ownership", "profile"] })
    },
  })
}

export function useDeleteOwnership() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, branchId, profileId }: { id: string; branchId: string; profileId: string }) => {
      // Remove the financial ownership record
      const { error } = await supabase
        .from("branch_ownership")
        .delete()
        .eq("id", id)
      if (error) throw error

      // Deactivate their owners row for this branch
      const { error: memberErr } = await supabase
        .from("owners")
        .update({ is_active: false })
        .eq("branch_id", branchId)
        .eq("profile_id", profileId)
      if (memberErr) throw memberErr

      return branchId
    },
    onSuccess: (branchId) => {
      qc.invalidateQueries({ queryKey: ["branch-ownership", branchId] })
      qc.invalidateQueries({ queryKey: ["branch-ownership-all"] })
      qc.invalidateQueries({ queryKey: ["owners"] })
      qc.invalidateQueries({ queryKey: ["branches", branchId, "members"] })
      qc.invalidateQueries({ queryKey: ["branches", "counts"] })
      qc.invalidateQueries({ queryKey: ["members"] })
    },
  })
}
