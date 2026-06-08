import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { Permission, Resource } from "@/types/permission"

// ── Types ─────────────────────────────────────────────────────

export type SystemRole =
  | "owner"
  | "branch_owner"
  | "area_manager"
  | "branch_manager"
  | "staff"

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  system_role: SystemRole
  is_admin: boolean
  account_id: string | null
  created_at: string
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  systemRole: SystemRole
  isAdmin: boolean
  accountId: string | null
  accountCode: number | null
  mustChangePassword: boolean
  loading: boolean
  // Resolved permission helpers — available as soon as loading = false
  canCreate: (resource: Resource) => boolean
  canRead:   (resource: Resource) => boolean
  canUpdate: (resource: Resource) => boolean
  canDelete: (resource: Resource) => boolean
  canMoveTreasury: () => boolean
  canSeeTreasury:  () => boolean
  roleLevel: number
  isOwner:   boolean
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string, phone?: string, inviteToken?: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
}

// ── Context ───────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Helpers ───────────────────────────────────────────────────

// Checks the current user's active status.
// System admins (is_admin = true) are always active.
// For everyone else: no records → brand-new user, not yet assigned → active.
// Has records → at least one must be is_active = true.
async function checkUserActive(userId: string): Promise<boolean> {
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", userId)
    .maybeSingle()

  if (!profileRow) return false
  if (profileRow.is_admin) return true

  const [staffRes, ownerRes] = await Promise.all([
    supabase.from("staff").select("id, is_active").eq("profile_id", userId),
    supabase.from("owners").select("id, is_active").eq("profile_id", userId),
  ])

  const all = [...(staffRes.data ?? []), ...(ownerRes.data ?? [])]
  if (all.length === 0) return true
  return all.some((r) => r.is_active)
}

type BranchRole = { role_id: string | null; role: { level: number } | null; isOwner: boolean }

// Fetch the user's active branch roles (staff + owners tables).
async function fetchBranchRoles(profileId: string): Promise<BranchRole[]> {
  const [staffRes, ownerRes] = await Promise.all([
    supabase.from("staff").select("role_id").eq("profile_id", profileId).eq("is_active", true),
    supabase.from("owners").select("id, role_id").eq("profile_id", profileId).eq("is_active", true).limit(1),
  ])
  if (staffRes.error) throw staffRes.error

  type OwnerRow = { id: string; role_id?: string | null }
  let ownerRow: OwnerRow | undefined

  if (!ownerRes.error) {
    ownerRow = (ownerRes.data ?? [])[0] as OwnerRow | undefined
  } else {
    // role_id column may not exist yet — plain existence check
    const { data: plain } = await supabase
      .from("owners").select("id").eq("profile_id", profileId).eq("is_active", true).limit(1)
    if ((plain ?? []).length > 0) ownerRow = { id: (plain![0] as { id: string }).id, role_id: null }
  }

  if (ownerRow) {
    const rid = ownerRow.role_id ?? null
    if (rid) return [{ role_id: rid, role: { level: 1 }, isOwner: true }]

    // No explicit role — look up the "Branch Owner" system role
    const { data: branchOwnerRole } = await supabase
      .from("roles").select("id").eq("name", "Branch Owner").maybeSingle()
    if (branchOwnerRole?.id) return [{ role_id: branchOwnerRole.id, role: { level: 1 }, isOwner: true }]

    // Branch Owner role not yet seeded → full-access sentinel
    return [{ role_id: null as string | null, role: { level: -1 }, isOwner: true }]
  }

  return (staffRes.data ?? []).map((r) => ({ role_id: r.role_id, role: null, isOwner: false }))
}

// Compute the resolved permission helpers from branch roles + permissions table.
function computePerms(
  isAdmin: boolean,
  branchRoles: BranchRole[] | undefined,
  permissions: Permission[] | undefined,
): Omit<AuthContextValue, "user"|"session"|"profile"|"systemRole"|"isAdmin"|"accountId"|"accountCode"|"mustChangePassword"|"loading"|"signIn"|"signUp"|"signOut"|"resetPassword"> {
  const full = (ownerFlag: boolean) => ({
    canCreate: () => true, canRead: () => true, canUpdate: () => true, canDelete: () => true,
    canMoveTreasury: () => true, canSeeTreasury: () => true,
    roleLevel: 0, isOwner: ownerFlag,
  })

  if (isAdmin) return full(false)
  if (!branchRoles) return {
    canCreate: () => false, canRead: () => false, canUpdate: () => false, canDelete: () => false,
    canMoveTreasury: () => false, canSeeTreasury: () => false,
    roleLevel: 99, isOwner: false,
  }

  const sorted = branchRoles.slice().sort((a, b) => {
    const la = (a.role as { level?: number } | null)?.level ?? 99
    const lb = (b.role as { level?: number } | null)?.level ?? 99
    return la - lb
  })

  const myRoleId    = sorted[0]?.role_id ?? null
  const myRoleLevel = (sorted[0]?.role as { level?: number } | null)?.level ?? 99
  const isOwner     = (sorted[0] as { isOwner?: boolean } | undefined)?.isOwner === true

  if (myRoleLevel === -1) return full(true)

  const perm = (resource: Resource) =>
    myRoleId && permissions
      ? permissions.find((p) => p.role_id === myRoleId && p.resource === resource)
      : undefined

  // Owners (in the owners table) always have full read access — they should see
  // the same nav items and page structure as the system admin. Write/delete
  // permissions still come from their assigned role.
  if (isOwner) {
    return {
      canCreate: (r) => perm(r)?.can_create ?? false,
      canRead:   () => true,
      canUpdate: (r) => perm(r)?.can_update ?? false,
      canDelete: (r) => perm(r)?.can_delete ?? false,
      canMoveTreasury: () => perm("balance")?.can_move_treasury ?? false,
      canSeeTreasury:  () => true,
      roleLevel: myRoleLevel,
      isOwner: true,
    }
  }

  return {
    canCreate: (r) => perm(r)?.can_create ?? false,
    canRead:   (r) => perm(r)?.can_read   ?? false,
    canUpdate: (r) => perm(r)?.can_update ?? false,
    canDelete: (r) => perm(r)?.can_delete ?? false,
    canMoveTreasury: () => perm("balance")?.can_move_treasury ?? false,
    canSeeTreasury:  () => perm("balance")?.can_see_treasury  ?? false,
    roleLevel: myRoleLevel,
    isOwner,
  }
}

// ── Provider ──────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session,     setSession]     = useState<Session | null>(null)
  const [user,        setUser]        = useState<User | null>(null)
  const [profile,     setProfile]     = useState<Profile | null>(null)
  const [accountCode, setAccountCode] = useState<number | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const userIdRef           = useRef<string | null>(null)
  const profileLoadedForRef = useRef<string | null>(null)

  async function loadProfile(userId: string | undefined) {
    if (!userId) { setProfile(null); setAccountCode(null); return }
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, phone, system_role, is_admin, account_id, created_at, account:accounts(code)")
      .eq("id", userId)
      .single()
    const row = data as (Profile & { account?: { code: number } | null }) | null
    setProfile(row ? { ...row, account: undefined } as Profile : null)
    setAccountCode(row?.account?.code ?? null)
  }

  async function verifyActiveOrSignOut(userId: string) {
    const active = await checkUserActive(userId)
    if (!active) await supabase.auth.signOut()
  }

  // ── Pre-load permissions table (starts as soon as session is known) ──
  // Runs in parallel with loadProfile — cached by the time any page needs it.

  const { data: permissions, isLoading: permsLoading } = useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("permissions").select("*")
      if (error) throw error
      return (data ?? []) as Permission[]
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  })

  // ── Pre-load branch roles (starts after profile is known) ──────────────

  const isAdmin = profile?.is_admin === true || profile?.system_role === "owner"

  const { data: branchRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ["my-branch-roles", profile?.id],
    queryFn: () => fetchBranchRoles(profile!.id),
    enabled: !!profile?.id && !isAdmin,
    staleTime: 60_000,
  })

  // ── Unified loading state ──────────────────────────────────────────────
  // Admins: loading = auth only (no permission queries needed)
  // Non-admins: loading = auth + permissions table + branch roles

  const loading = authLoading || (!isAdmin && !!profile && (permsLoading || rolesLoading))

  // ── Resolved permission helpers ────────────────────────────────────────

  const perms = useMemo(
    () => computePerms(isAdmin, isAdmin ? [] : branchRoles, permissions),
    [isAdmin, branchRoles, permissions],
  )

  // ── Session bootstrap & auth state listener ───────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session
      if (s?.user) {
        setSession(s)
        setUser(s.user)
        userIdRef.current = s.user.id
        profileLoadedForRef.current = s.user.id
        await loadProfile(s.user.id)
      }
      setAuthLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession)
        setUser(newSession?.user ?? null)
        userIdRef.current = newSession?.user?.id ?? null

        if (!newSession) {
          setProfile(null)
          setAccountCode(null)
          profileLoadedForRef.current = null
        } else {
          if (profileLoadedForRef.current !== newSession.user?.id) {
            profileLoadedForRef.current = newSession.user?.id ?? null
            await loadProfile(newSession.user?.id)
          }

          if (event === "SIGNED_IN" && newSession.user) {
            supabase
              .from("profiles")
              .update({ last_login_at: new Date().toISOString() })
              .eq("id", newSession.user.id)
              .then(() => {})
          }

          if (event === "TOKEN_REFRESHED" && newSession.user) {
            profileLoadedForRef.current = null  // force profile reload after refresh
            verifyActiveOrSignOut(newSession.user.id)
          }
        }
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  // ── Periodic active-status check ──────────────────────────────────────

  useEffect(() => {
    const check = () => { if (userIdRef.current) verifyActiveOrSignOut(userIdRef.current) }
    const interval = setInterval(check, 2 * 60_000)
    const handleVisibility = () => { if (!document.hidden) check() }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", handleVisibility) }
  }, [])

  const systemRole: SystemRole = profile?.system_role ?? "staff"
  const accountId              = profile?.account_id ?? null
  const mustChangePassword     = user?.user_metadata?.must_change_password === true

  // ── Auth actions ──────────────────────────────────────────────────────

  async function signIn(identifier: string, password: string) {
    const isEmail = identifier.includes("@")
    let authError: string | null = null
    let userId: string | null = null

    if (isEmail) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: identifier, password })
      authError = error?.message ?? null
      userId = data.user?.id ?? null
    } else {
      const { data: email, error: rpcErr } = await supabase.rpc("get_email_by_phone", { p_phone: identifier })
      if (rpcErr || !email) return { error: "No account found with this phone number" }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      authError = error?.message ?? null
      userId = data.user?.id ?? null
    }

    if (authError) return { error: authError }

    if (userId) {
      const active = await checkUserActive(userId)
      if (!active) {
        await supabase.auth.signOut()
        return { error: "Your account has been deactivated. Please contact your administrator." }
      }
    }

    return { error: null }
  }

  async function signUp(email: string, password: string, fullName: string, phone?: string, inviteToken?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name:   fullName,
          phone:       phone ?? null,
          system_role: inviteToken ? "staff" : "owner",
        },
      },
    })
    if (error) return { error: error.message ?? null }

    if (data.user) {
      const db = supabaseAdmin ?? supabase
      const profilePatch: Record<string, unknown> = {}
      if (phone) profilePatch.phone = phone

      if (inviteToken) {
        const { data: invite, error: inviteErr } = await db
          .from("account_invites")
          .select("id, account_id, expires_at, max_uses, uses")
          .eq("token", inviteToken)
          .single()

        if (inviteErr || !invite) return { error: "Invalid invite link" }
        if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { error: "Invite link has expired" }
        if (invite.max_uses !== null && invite.uses >= invite.max_uses) return { error: "Invite link has reached its usage limit" }

        profilePatch.account_id = invite.account_id
        await db.from("profiles").update(profilePatch).eq("id", data.user.id)
        await db.from("account_invites").update({ uses: invite.uses + 1 }).eq("id", invite.id)
      } else {
        const { data: account } = await db
          .from("accounts")
          .insert({ name: `${fullName}'s Organization`, owner_id: data.user.id })
          .select("id")
          .single()
        if (account) profilePatch.account_id = account.id
        await db.from("profiles").update(profilePatch).eq("id", data.user.id)
      }

      await loadProfile(data.user.id)
    }

    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: error?.message ?? null }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        systemRole,
        isAdmin,
        accountId,
        accountCode,
        mustChangePassword,
        loading,
        ...perms,
        signIn,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}
