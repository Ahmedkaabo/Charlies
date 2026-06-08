import { useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { useAuth } from "@/hooks/useAuth"
import type { Member, SalaryCurrency, GroupedMember } from "@/types/member"

// Staff-table writes require bypassing RLS (service role) because the
// RLS INSERT/UPDATE policies on `staff` are restricted by Supabase.
const db = supabaseAdmin ?? supabase

export function useGetMembers(branchId?: string, branchIds?: string[]) {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: branchId
      ? ["members", branchId]
      : branchIds?.length
      ? ["members", "multi", ...branchIds.slice().sort()]
      : ["members", accountId],
    queryFn: async () => {
      if (!accountId) return []
      let q = supabase
        .from("staff")
        .select(`
          id, branch_id, profile_id, role_id, joined_at, is_active,
          profile:profiles(id, full_name, name_ar, avatar_url, phone, email, is_admin, system_role, last_login_at),
          role:roles(id, name, level),
          branch:branches(id, name)
        `)
        .eq("is_active", true)
        .eq("account_id", accountId)
        .order("joined_at", { ascending: false })

      if (branchId) q = q.eq("branch_id", branchId)
      else if (branchIds?.length) q = q.in("branch_id", branchIds)

      const { data: members, error: membersError } = await q
      if (membersError) throw membersError

      let sq = supabase
        .from("salary_structures")
        .select("id, branch_id, profile_id, monthly_salary, currency, effective_from, paid_days_off")

      if (branchId) sq = sq.eq("branch_id", branchId)
      else if (branchIds?.length) sq = sq.in("branch_id", branchIds)

      const { data: salaries, error: salariesError } = await sq
      if (salariesError) throw salariesError

      const salaryMap = new Map(
        (salaries ?? []).map((s) => [`${s.branch_id}:${s.profile_id}`, s])
      )

      // staff table only contains non-owner members; no extra filtering needed
      return (members ?? [])
        .map((m) => ({
          ...m,
          salary: salaryMap.get(`${m.branch_id}:${m.profile_id}`) ?? null,
        })) as unknown as Member[]
    },
  })
}

export function useSearchProfiles(query: string) {
  return useQuery({
    queryKey: ["profiles", "search", query],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, phone, is_admin")
        .ilike("full_name", `%${query}%`)
        .limit(20)
      if (error) throw error
      return data ?? []
    },
    enabled: query.length >= 1,
  })
}

// ── Create ────────────────────────────────────────────────────

export interface CreateMemberInput {
  branchId: string
  profileId: string
  roleId: string | null
  monthly_salary: number | null
  currency: SalaryCurrency
  effective_from: string
  paid_days_off?: number
}

export function useCreateMember() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (input: CreateMemberInput) => {
      const { data, error } = await db
        .from("staff")
        .upsert(
          { branch_id: input.branchId, profile_id: input.profileId, role_id: input.roleId, is_active: true, account_id: accountId ?? undefined },
          { onConflict: "branch_id,profile_id" }
        )
      if (error) throw error

      if (input.monthly_salary != null) {
        const { error: se } = await db
          .from("salary_structures")
          .upsert(
            {
              branch_id:      input.branchId,
              profile_id:     input.profileId,
              monthly_salary: input.monthly_salary,
              currency:       input.currency,
              effective_from: input.effective_from,
              paid_days_off:  input.paid_days_off ?? 0,
              account_id:     accountId ?? undefined,
            },
            { onConflict: "branch_id,profile_id" }
          )
        if (se) throw se
      }

      return data
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["members"] })
      qc.invalidateQueries({ queryKey: ["branches", v.branchId, "members"] })
      qc.invalidateQueries({ queryKey: ["my-branch"] })
    },
  })
}

// ── Update ────────────────────────────────────────────────────

export interface UpdateMemberInput {
  memberId: string
  branchId: string
  profileId: string
  roleId: string | null
  monthly_salary: number | null
  currency: SalaryCurrency
  effective_from: string
  paid_days_off?: number
}

export function useUpdateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateMemberInput) => {
      const { error } = await db
        .from("staff")
        .update({ role_id: input.roleId })
        .eq("id", input.memberId)
      if (error) throw error

      if (input.monthly_salary != null) {
        const { error: se } = await db
          .from("salary_structures")
          .upsert(
            {
              branch_id:      input.branchId,
              profile_id:     input.profileId,
              monthly_salary: input.monthly_salary,
              currency:       input.currency,
              effective_from: input.effective_from,
              paid_days_off:  input.paid_days_off ?? 0,
            },
            { onConflict: "branch_id,profile_id" }
          )
        if (se) throw se
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] })
      qc.invalidateQueries({ queryKey: ["my-branch"] })
    },
  })
}

// ── Remove ────────────────────────────────────────────────────

export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await db
        .from("staff")
        .update({ is_active: false })
        .eq("id", memberId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] })
      qc.invalidateQueries({ queryKey: ["branches"] })
      qc.invalidateQueries({ queryKey: ["my-branch"] })
    },
  })
}

// ── Grouped (one entry per person, all branch assignments merged) ──

export function useGetMembersGrouped(branchId?: string, branchIds?: string[]) {
  const query = useGetMembers(branchId, branchIds)

  const grouped = useMemo((): GroupedMember[] | undefined => {
    if (!query.data) return undefined

    const map = new Map<string, GroupedMember>()

    for (const m of query.data) {
      if (!map.has(m.profile_id)) {
        map.set(m.profile_id, {
          profile_id:    m.profile_id,
          full_name:     m.profile?.full_name     ?? null,
          name_ar:       m.profile?.name_ar       ?? null,
          avatar_url:    m.profile?.avatar_url    ?? null,
          phone:         m.profile?.phone         ?? null,
          email:         (m.profile as { email?: string | null } | null)?.email ?? null,
          is_admin:      m.profile?.is_admin      ?? false,
          last_login_at: (m.profile as { last_login_at?: string | null } | null)?.last_login_at ?? null,
          assignments: [],
        })
      }
      map.get(m.profile_id)!.assignments.push({
        id:          m.id,
        branch_id:   m.branch_id,
        branch_name: m.branch?.name ?? "Unknown",
        role_id:     m.role_id,
        role:        m.role  ?? null,
        joined_at:   m.joined_at,
        salary:      m.salary
          ? { monthly_salary: m.salary.monthly_salary ?? null, currency: m.salary.currency, paid_days_off: m.salary.paid_days_off ?? 0 }
          : null,
      })
    }

    return Array.from(map.values())
  }, [query.data])

  return { ...query, data: grouped }
}

// ── Create: assign to multiple branches at once ───────────────

export interface CreateMemberMultiBranchInput {
  branchIds:      string[]
  profileId:      string
  roleId:         string | null
  monthly_salary: number | null
  currency:       SalaryCurrency
  effective_from: string
  paid_days_off?: number
}

export function useCreateMemberMultiBranch() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (input: CreateMemberMultiBranchInput) => {
      for (const branchId of input.branchIds) {
        const { error: bme } = await db
          .from("staff")
          .upsert(
            { branch_id: branchId, profile_id: input.profileId, role_id: input.roleId, is_active: true, account_id: accountId ?? undefined },
            { onConflict: "branch_id,profile_id" }
          )
        if (bme) throw bme

        if (input.monthly_salary != null) {
          const { error: se } = await db
            .from("salary_structures")
            .upsert(
              {
                branch_id:      branchId,
                profile_id:     input.profileId,
                monthly_salary: input.monthly_salary,
                currency:       input.currency,
                effective_from: input.effective_from,
                paid_days_off:  input.paid_days_off ?? 0,
              },
              { onConflict: "branch_id,profile_id" }
            )
          if (se) throw se
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] })
      qc.invalidateQueries({ queryKey: ["my-branch"] })
    },
  })
}
