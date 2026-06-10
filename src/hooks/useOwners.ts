import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import type { Owner } from "@/types/owner"

// ── Read — queries the `owners` table ────────────────────────

export function useGetOwners() {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["owners", accountId],
    queryFn: async () => {
      if (!accountId) return []

      // All owners are tracked in the owners table.
      const ownersRes = await supabase
        .from("owners")
        .select(`
          id, profile_id, branch_id, is_active, joined_at,
          role_id, role_ids,
          role:roles(id, name, level),
          profile:profiles(id, full_name, name_ar, avatar_url, phone, is_fee_manager),
          branch:branches(id, name, city)
        `)
        .order("joined_at", { ascending: false })

      let ownerRows = ownersRes.data ?? []
      if (ownersRes.error) {
        const plain = await supabase
          .from("owners")
          .select(`
            id, profile_id, branch_id, is_active, joined_at,
            profile:profiles(id, full_name, name_ar, avatar_url, phone, is_fee_manager),
            branch:branches(id, name, city)
          `)
          .order("joined_at", { ascending: false })
        if (plain.error) throw plain.error
        ownerRows = (plain.data ?? []).map((r) => ({ ...r, role_id: null, role_ids: [], role: null })) as typeof ownerRows
      }

      const map = new Map<string, Owner>()

      for (const row of ownerRows) {
        const profile = (row as { profile?: unknown }).profile as {
          id: string; full_name: string | null; name_ar: string | null
          avatar_url: string | null; phone: string | null; is_fee_manager: boolean | null
        } | null
        const role    = (row as { role?: unknown }).role   as { id: string; name: string; level: number } | null
        const roleId  = (row as { role_id?: string | null }).role_id ?? null
        const roleIds = ((row as { role_ids?: string[] | null }).role_ids ?? [])

        if (!map.has(row.profile_id)) {
          map.set(row.profile_id, {
            profile_id:     row.profile_id,
            full_name:      profile?.full_name      ?? null,
            name_ar:        profile?.name_ar        ?? null,
            avatar_url:     profile?.avatar_url     ?? null,
            phone:          profile?.phone          ?? null,
            is_fee_manager: profile?.is_fee_manager ?? false,
            is_master:      false,
            role_ids:       roleIds.length > 0 ? roleIds : (roleId ? [roleId] : []),
            branches:       [],
          })
        } else {
          // Merge role_ids from all rows for this profile
          const existing = map.get(row.profile_id)!
          const merged = [...new Set([...existing.role_ids, ...(roleIds.length > 0 ? roleIds : (roleId ? [roleId] : []))])]
          existing.role_ids = merged
        }

        if (row.is_active) {
          const branch = (row as { branch?: unknown }).branch as { id: string; name: string; city: string | null } | null
          if (branch) {
            map.get(row.profile_id)!.branches.push({
              assignment_id: row.id,
              branch_id:     branch.id,
              branch_name:   branch.name,
              city:          branch.city,
              joined_at:     row.joined_at,
              role_ids:      roleIds.length > 0 ? roleIds : (roleId ? [roleId] : []),
              role_id:       roleId,
              role_name:     role?.name  ?? null,
              role_level:    role?.level ?? null,
            })
          }
        }
      }

      // Always ensure the account admin appears as master owner with no roles
      const adminRes = await supabase
        .from("profiles")
        .select("id, full_name, name_ar, avatar_url, phone, is_fee_manager")
        .eq("account_id", accountId)
        .eq("is_admin", true)
        .maybeSingle()

      if (adminRes.data) {
        const admin = adminRes.data
        if (map.has(admin.id)) {
          map.get(admin.id)!.is_master = true
          map.get(admin.id)!.role_ids  = []
        } else {
          map.set(admin.id, {
            profile_id:     admin.id,
            full_name:      admin.full_name      ?? null,
            name_ar:        admin.name_ar        ?? null,
            avatar_url:     admin.avatar_url     ?? null,
            phone:          admin.phone          ?? null,
            is_fee_manager: admin.is_fee_manager ?? false,
            is_master:      true,
            role_ids:       [],
            branches:       [],
          })
        }
      }

      const all = Array.from(map.values())
      all.sort((a, b) => (b.is_master ? 1 : 0) - (a.is_master ? 1 : 0))
      return all
    },
  })
}

// ── Read: all active owner-branch assignments (flat, no is_fee_manager) ──

export interface OwnerAssignment {
  profile_id: string
  branch_id:  string
  full_name:  string | null
}

export function useAllOwnerAssignments() {
  return useQuery({
    queryKey: ["owner-assignments-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("owners")
        .select("profile_id, branch_id, profile:profiles(id, full_name)")
        .eq("is_active", true)
      if (error) throw error
      return (data ?? []).map((row) => ({
        profile_id: row.profile_id,
        branch_id:  row.branch_id,
        full_name:  (row.profile as { full_name?: string | null } | null)?.full_name ?? null,
      })) as OwnerAssignment[]
    },
  })
}

// ── Read: owners for a specific branch (read-only view) ───────

export function useGetOwnersByBranch(branchId: string | undefined) {
  return useQuery({
    queryKey: ["owners", "branch", branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("owners")
        .select(`
          id, profile_id, branch_id, joined_at,
          profile:profiles(id, full_name, avatar_url, phone)
        `)
        .eq("branch_id", branchId!)
        .eq("is_active", true)
        .order("joined_at", { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!branchId,
  })
}

// ── Create: new auth account + owner branch assignments ───────

export interface CreateOwnerInput {
  full_name:  string
  name_ar?:  string | null
  phone:      string
  password:   string
  branchIds:  string[]
  roleIds:    string[]
}

async function createUserAuthAccount(
  phone: string,
  password: string,
  fullName: string,
): Promise<string> {
  const email = `${phone.replace(/\D/g, "")}@charlies.internal`
  const noopStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  const temp = createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storage: noopStorage } },
  )
  const { data, error } = await temp.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone, must_change_password: true } },
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error("Failed to create account")
  return data.user.id
}

export function useCreateOwner() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (input: CreateOwnerInput) => {
      const profileId = await createUserAuthAccount(
        input.phone.trim(),
        input.password,
        input.full_name.trim(),
      )

      await supabase
        .from("profiles")
        .update({
          account_id: accountId ?? undefined,
          ...(input.name_ar ? { name_ar: input.name_ar.trim() } : {}),
        })
        .eq("id", profileId)

      for (const branchId of input.branchIds) {
        const { error } = await supabase
          .from("owners")
          .upsert(
            { branch_id: branchId, profile_id: profileId, is_active: true, account_id: accountId ?? undefined, role_ids: input.roleIds, role_id: null },
            { onConflict: "branch_id,profile_id" },
          )
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owners"] })
      qc.invalidateQueries({ queryKey: ["branches", "counts"] })
    },
  })
}

// ── Add owner to a single branch + set their equity stocks ───

export function useAddOwnerToBranch() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async ({ profileId, branchId, stocks, roleIds = [] }: { profileId: string; branchId: string; stocks: number; roleIds?: string[] }) => {
      const { error } = await supabase
        .from("owners")
        .upsert(
          { branch_id: branchId, profile_id: profileId, is_active: true, account_id: accountId ?? undefined, role_ids: roleIds, role_id: null },
          { onConflict: "branch_id,profile_id" },
        )
      if (error) throw error
      const { error: ownerErr } = await supabase
        .from("branch_ownership")
        .upsert(
          { branch_id: branchId, profile_id: profileId, stocks },
          { onConflict: "branch_id,profile_id" },
        )
      if (ownerErr) throw ownerErr
    },
    onSuccess: (_, { branchId }) => {
      qc.invalidateQueries({ queryKey: ["owners"] })
      qc.invalidateQueries({ queryKey: ["branch-ownership", branchId] })
      qc.invalidateQueries({ queryKey: ["branch-ownership-all"] })
      qc.invalidateQueries({ queryKey: ["branch-ownership", "profile"] })
      qc.invalidateQueries({ queryKey: ["branches", "counts"] })
    },
  })
}

// ── Remove owner from a single branch + clean up equity ──────

export function useRemoveOwnerFromBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ assignmentId, branchId, profileId }: { assignmentId: string; branchId: string; profileId: string }) => {
      // Remove equity record (ignore if none exists)
      await supabase.from("branch_ownership").delete().eq("branch_id", branchId).eq("profile_id", profileId)
      // Deactivate branch access
      const { error } = await supabase.from("owners").update({ is_active: false }).eq("id", assignmentId)
      if (error) throw error
    },
    onSuccess: (_, { branchId }) => {
      qc.invalidateQueries({ queryKey: ["owners"] })
      qc.invalidateQueries({ queryKey: ["branch-ownership", branchId] })
      qc.invalidateQueries({ queryKey: ["branch-ownership-all"] })
      qc.invalidateQueries({ queryKey: ["branch-ownership", "profile"] })
      qc.invalidateQueries({ queryKey: ["branches", "counts"] })
      qc.invalidateQueries({ queryKey: ["members"] })
    },
  })
}

// ── Update roles: set role_ids across ALL branch rows for a profile ──

export function useUpdateOwnerRoles() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ profileId, roleIds }: { profileId: string; roleIds: string[] }) => {
      const { error } = await supabase
        .from("owners")
        .update({ role_ids: roleIds, role_id: null })
        .eq("profile_id", profileId)
        .eq("is_active", true)
      if (error) throw error
    },
    onSuccess: (_, { profileId }) => {
      qc.invalidateQueries({ queryKey: ["owners"] })
      qc.invalidateQueries({ queryKey: ["my-branch-roles", profileId] })
    },
  })
}

// ── Toggle manager status (receives management fee share) ────

export function useSetOwnerManagerStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ profileId, isFeeManager }: { profileId: string; isFeeManager: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_fee_manager: isFeeManager })
        .eq("id", profileId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owners"] })
      qc.invalidateQueries({ queryKey: ["branch-ownership-all"] })
      qc.invalidateQueries({ queryKey: ["branch-ownership"] })
    },
  })
}

// ── Delete owner: deactivate all branch assignments ───────────

export function useDeleteOwner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from("owners")
        .update({ is_active: false })
        .eq("profile_id", profileId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owners"] })
      qc.invalidateQueries({ queryKey: ["branches", "counts"] })
      qc.invalidateQueries({ queryKey: ["members"] })
    },
  })
}
