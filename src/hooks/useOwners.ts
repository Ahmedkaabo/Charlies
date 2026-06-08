import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { useAuth } from "@/hooks/useAuth"
import type { Owner } from "@/types/owner"

export function useGetOwners() {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["owners", accountId],
    queryFn: async () => {
      const [ownersRes, accountRes] = await Promise.all([
        supabase
          .from("owners")
          .select(`
            id, branch_id, joined_at, role_id, is_active,
            profile:profiles(id, full_name, name_ar, avatar_url, phone, is_fee_manager),
            branch:branches(id, name, city),
            role:roles(id, name, level)
          `)
          .eq("account_id", accountId!)
          .eq("is_active", true),
        supabase
          .from("accounts")
          .select("owner_id")
          .eq("id", accountId!)
          .single(),
      ])

      if (ownersRes.error) throw ownersRes.error

      type Row = typeof ownersRes.data extends (infer R)[] | null ? R : never
      const rows = (ownersRes.data ?? []) as Row[]

      const map = new Map<string, Owner>()
      for (const row of rows) {
        const p = row.profile as unknown as { id: string; full_name: string | null; name_ar: string | null; avatar_url: string | null; phone: string | null; is_fee_manager: boolean } | null
        const b = row.branch as unknown as { id: string; name: string; city: string | null } | null
        const r = row.role as unknown as { id: string; name: string; level: number } | null
        if (!p || !b) continue

        if (!map.has(p.id)) {
          map.set(p.id, {
            profile_id:     p.id,
            full_name:      p.full_name,
            name_ar:        p.name_ar,
            avatar_url:     p.avatar_url,
            phone:          p.phone,
            is_fee_manager: p.is_fee_manager ?? false,
            is_master:      false,
            branches:       [],
          })
        }

        map.get(p.id)!.branches.push({
          assignment_id: row.id as string,
          branch_id:     b.id,
          branch_name:   b.name,
          city:          b.city,
          joined_at:     row.joined_at as string,
          role_id:       (row.role_id as string | null) ?? null,
          role_name:     r?.name ?? null,
          role_level:    r?.level ?? null,
        })
      }

      // Resolve the account's master owner (the person who created the org).
      // If they already appear via branch assignments, mark them in-place.
      // If they have no branches yet, fetch their profile and prepend them.
      const masterProfileId = accountRes.data?.owner_id as string | null | undefined
      if (masterProfileId) {
        if (map.has(masterProfileId)) {
          map.get(masterProfileId)!.is_master = true
        } else {
          const { data: mp } = await supabase
            .from("profiles")
            .select("id, full_name, name_ar, avatar_url, phone, is_fee_manager")
            .eq("id", masterProfileId)
            .single()
          if (mp) {
            const masterEntry: Owner = {
              profile_id:     mp.id as string,
              full_name:      mp.full_name as string | null,
              name_ar:        mp.name_ar as string | null,
              avatar_url:     mp.avatar_url as string | null,
              phone:          mp.phone as string | null,
              is_fee_manager: (mp.is_fee_manager as boolean) ?? false,
              is_master:      true,
              branches:       [],
            }
            // Prepend so master always appears first
            const entries = Array.from(map.entries())
            map.clear()
            map.set(masterProfileId, masterEntry)
            for (const [k, v] of entries) map.set(k, v)
          }
        }
      }

      return Array.from(map.values()) as Owner[]
    },
    enabled: !!accountId,
  })
}

interface CreateOwnerInput {
  full_name: string
  name_ar: string | null
  phone: string
  password: string
  branchIds: string[]
  systemRole: string
}

export function useCreateOwner() {
  const { accountId } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateOwnerInput) => {
      const email = `${input.phone.replace(/\D/g, "")}@charlies.internal`
      const client = supabaseAdmin ?? supabase
      const { data: authData, error: authError } = await (supabaseAdmin
        ? supabaseAdmin.auth.admin.createUser({
            email,
            password: input.password,
            email_confirm: true,
            user_metadata: {
              full_name:            input.full_name,
              phone:                input.phone,
              system_role:          input.systemRole,
              must_change_password: true,
            },
          })
        : supabase.auth.signUp({
            email,
            password: input.password,
            options: { data: { full_name: input.full_name, phone: input.phone, system_role: input.systemRole, must_change_password: true } },
          }))

      if (authError) throw authError
      const userId = authData.user?.id
      if (!userId) throw new Error("User creation failed")

      await client
        .from("profiles")
        .update({ account_id: accountId, name_ar: input.name_ar })
        .eq("id", userId)

      if (input.branchIds.length > 0) {
        const rows = input.branchIds.map((branch_id) => ({
          profile_id: userId,
          branch_id,
          account_id: accountId,
          is_active: true,
        }))
        const { error } = await client.from("owners").insert(rows)
        if (error) throw error
      }

      return userId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owners"] })
    },
  })
}

export function useAddOwnerToBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ profileId, branchId, stocks }: { profileId: string; branchId: string; stocks: number }) => {
      const { error: ownerErr } = await supabase
        .from("owners")
        .upsert({ profile_id: profileId, branch_id: branchId, is_active: true }, { onConflict: "profile_id,branch_id" })
      if (ownerErr) throw ownerErr

      const { error: ownershipErr } = await supabase
        .from("branch_ownership")
        .upsert({ profile_id: profileId, branch_id: branchId, stocks }, { onConflict: "branch_id,profile_id" })
      if (ownershipErr) throw ownershipErr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owners"] })
      qc.invalidateQueries({ queryKey: ["branch-ownership"] })
    },
  })
}

export function useRemoveOwnerFromBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ assignmentId, branchId, profileId }: { assignmentId: string; branchId: string; profileId: string }) => {
      const { error: ownerErr } = await supabase
        .from("owners")
        .update({ is_active: false })
        .eq("id", assignmentId)
      if (ownerErr) throw ownerErr

      await supabase
        .from("branch_ownership")
        .delete()
        .eq("branch_id", branchId)
        .eq("profile_id", profileId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owners"] })
      qc.invalidateQueries({ queryKey: ["branch-ownership"] })
    },
  })
}

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
    },
  })
}

export function useAllOwnerAssignments() {
  return useQuery({
    queryKey: ["owners", "all-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("owners")
        .select("profile_id, branch_id, profile:profiles(full_name)")
        .eq("is_active", true)
      if (error) throw error
      return (data ?? []).map((row) => ({
        profile_id: row.profile_id as string,
        branch_id:  row.branch_id as string,
        full_name:  (row.profile as unknown as { full_name: string | null } | null)?.full_name ?? null,
      }))
    },
  })
}

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
    },
  })
}
