import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "./useAuth"

export function useAccountMembers() {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["account-members", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, phone, system_role, is_admin, created_at")
        .eq("account_id", accountId!)
        .order("created_at", { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useCreateInvite() {
  const { accountId, profile } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (opts?: { expiresAt?: string; maxUses?: number }) => {
      const { data, error } = await supabase
        .from("account_invites")
        .insert({
          account_id: accountId!,
          created_by: profile!.id,
          expires_at: opts?.expiresAt ?? null,
          max_uses: opts?.maxUses ?? null,
        })
        .select("token")
        .single()
      if (error) throw error
      return data.token as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["account-invites", accountId] }),
  })
}

export function useGetInviteByToken(token: string | null) {
  return useQuery({
    queryKey: ["invite", token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_invites")
        .select("id, account_id, expires_at, max_uses, uses, accounts(name, code)")
        .eq("token", token!)
        .single()
      if (error) throw error
      return data
    },
  })
}
