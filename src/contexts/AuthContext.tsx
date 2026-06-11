import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Permission, Resource } from "@/types/permission"

// ── Types ─────────────────────────────────────────────────────

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  is_admin: boolean
  account_id: string | null
  created_at: string
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  /** True when the user is the org admin (created the org or explicitly granted admin). */
  isAdmin: boolean
  accountId: string | null
  accountCode: number | null
  /** URL-safe slug identifying the organisation — used in invite links. */
  orgSlug: string | null
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
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone?: string,
    opts?: { inviteToken?: string; orgName?: string }
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
}

// ── Context ───────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Helpers ───────────────────────────────────────────────────

async function checkUserActive(userId: string): Promise<boolean> {
  const { data: profileRow, error: profileErr } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", userId)
    .maybeSingle()

  // Network/RLS error — can't determine status, assume active to avoid spurious sign-out
  if (profileErr) return true
  // Profile genuinely not found
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

async function fetchBranchRoles(
  profileId: string,
  profileIsAdmin: boolean,
  _accountId: string | null,
): Promise<BranchRole[]> {
  // Org admins always get full access — no role lookup needed.
  if (profileIsAdmin) {
    return [{ role_id: null as string | null, role: { level: -1 }, isOwner: false }]
  }

  const [staffRes, ownerRes] = await Promise.all([
    supabase.from("staff").select("role_id, role_ids").eq("profile_id", profileId).eq("is_active", true),
    // No .limit(1) — collect role_ids from ALL branch rows; a random single row may have empty role_ids
    supabase.from("owners").select("role_id, role_ids").eq("profile_id", profileId).eq("is_active", true),
  ])
  if (staffRes.error) throw staffRes.error

  // Determine owner status; if the owner query errored, fall back to a plain existence check
  let isOwner = !ownerRes.error && (ownerRes.data ?? []).length > 0
  if (ownerRes.error) {
    const { data: plain } = await supabase
      .from("owners").select("id").eq("profile_id", profileId).eq("is_active", true).limit(1)
    if ((plain ?? []).length > 0) {
      // Is an owner but role data unavailable — grant full access via sentinel
      return [{ role_id: null as string | null, role: { level: -1 }, isOwner: true }]
    }
  }

  // Collect role IDs from ALL rows of each table (union across branches)
  const ownerRoleIds = new Set<string>()
  const staffRoleIds = new Set<string>()

  for (const r of (ownerRes.data ?? []) as any[]) {
    const ids: string[] = r.role_ids?.length ? r.role_ids : (r.role_id ? [r.role_id] : [])
    ids.forEach((id: string) => ownerRoleIds.add(id))
  }
  for (const r of (staffRes.data ?? []) as any[]) {
    const ids: string[] = r.role_ids?.length ? r.role_ids : (r.role_id ? [r.role_id] : [])
    ids.forEach((id: string) => staffRoleIds.add(id))
  }

  // Resolve levels for all role IDs in one query
  const allIds = new Set<string>([...ownerRoleIds, ...staffRoleIds])
  const roleLevelMap: Record<string, number> = {}
  if (allIds.size > 0) {
    const { data: rd } = await supabase.from("roles").select("id, level").in("id", [...allIds])
    for (const r of rd ?? []) roleLevelMap[r.id] = r.level
  }

  if (isOwner) {
    if (ownerRoleIds.size > 0) {
      return [...ownerRoleIds].map(id => ({ role_id: id, role: { level: roleLevelMap[id] ?? 1 }, isOwner: true }))
    }
    // Owner has no roles assigned — isOwner flag preserved but no permissions
    return [{ role_id: null as string | null, role: { level: 99 }, isOwner: true }]
  }

  // Staff: one BranchRole entry per unique role across all branches
  return [...staffRoleIds].map(id => ({ role_id: id, role: { level: roleLevelMap[id] ?? 99 }, isOwner: false }))
}

function computePerms(
  _isAdmin: boolean,
  branchRoles: BranchRole[] | undefined,
  permissions: Permission[] | undefined,
): Omit<AuthContextValue, "user"|"session"|"profile"|"isAdmin"|"accountId"|"accountCode"|"orgSlug"|"mustChangePassword"|"loading"|"signIn"|"signUp"|"signOut"|"resetPassword"> {
  const full = (ownerFlag: boolean) => ({
    canCreate: () => true, canRead: () => true, canUpdate: () => true, canDelete: () => true,
    canMoveTreasury: () => true, canSeeTreasury: () => true,
    roleLevel: 0, isOwner: ownerFlag,
  })

  // No isAdmin bypass: all users (including org admin) go through the roles/permissions
  // system. The admin user is assigned the "Admin" system role by fetchBranchRoles.
  if (!branchRoles) return {
    canCreate: () => false, canRead: () => false, canUpdate: () => false, canDelete: () => false,
    canMoveTreasury: () => false, canSeeTreasury: () => false,
    roleLevel: 99, isOwner: false,
  }

  const allRoleIds = new Set<string>(
    branchRoles.map(r => r.role_id).filter((id): id is string => id !== null)
  )
  const levels = branchRoles.map(r => (r.role as { level?: number } | null)?.level ?? 99)
  const myRoleLevel = levels.length ? Math.min(...levels) : 99
  const isOwner = branchRoles.some(r => (r as { isOwner?: boolean }).isOwner === true)

  if (myRoleLevel === -1) return full(isOwner)

  // Grant permission if ANY of the user's roles has it
  const anyPerm = (resource: Resource, field: string): boolean =>
    allRoleIds.size > 0 && !!permissions?.some(
      p => allRoleIds.has(p.role_id) && p.resource === resource && (p as any)[field]
    )

  return {
    canCreate:       (r) => anyPerm(r, 'can_create'),
    canRead:         (r) => anyPerm(r, 'can_read'),
    canUpdate:       (r) => anyPerm(r, 'can_update'),
    canDelete:       (r) => anyPerm(r, 'can_delete'),
    canMoveTreasury: ()  => anyPerm('treasury', 'can_create'),
    canSeeTreasury:  ()  => anyPerm('treasury', 'can_read'),
    roleLevel: myRoleLevel,
    isOwner,
  }
}

// Generate a URL-safe slug from a plain-text org name.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

// ── Provider ──────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [session,     setSession]     = useState<Session | null>(null)
  const [user,        setUser]        = useState<User | null>(null)
  const [profile,     setProfile]     = useState<Profile | null>(null)
  const [accountCode, setAccountCode] = useState<number | null>(null)
  const [orgSlug,     setOrgSlug]     = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const userIdRef           = useRef<string | null>(null)
  const profileLoadedForRef = useRef<string | null>(null)

  async function loadProfile(userId: string | undefined) {
    if (!userId) { setProfile(null); setAccountCode(null); setOrgSlug(null); return }

    // Try with slug (post-migration-085); fall back if column doesn't exist yet.
    type Row = Profile & { account?: { code: number; slug?: string } | null }
    let row: Row | null = null

    const { data: withSlug, error: slugErr } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, phone, is_admin, account_id, created_at, account:accounts(code, slug)")
      .eq("id", userId)
      .single()

    if (!slugErr) {
      row = withSlug as Row | null
    } else {
      // Pre-migration: slug column absent — query without it
      const { data: noSlug } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, phone, is_admin, account_id, created_at, account:accounts(code)")
        .eq("id", userId)
        .single()
      row = noSlug as Row | null
    }

    // If the profile has no account_id (e.g. admin-created staff whose
    // sync trigger hasn't run yet), find it from the staff table and
    // repair the profile so all account-scoped queries work immediately.
    if (row && !row.account_id) {
      const { data: staffRow } = await supabase
        .from("staff")
        .select("account_id")
        .eq("profile_id", userId)
        .eq("is_active", true)
        .not("account_id", "is", null)
        .limit(1)
        .maybeSingle()

      if (staffRow?.account_id) {
        await supabase
          .from("profiles")
          .update({ account_id: staffRow.account_id })
          .eq("id", userId)

        const { data: patched } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, phone, is_admin, account_id, created_at, account:accounts(code, slug)")
          .eq("id", userId)
          .single()
        if (patched) row = patched as Row

        // Force branchRoles/permissions to refetch now that account is known
        queryClient.invalidateQueries({ queryKey: ["my-branch-roles"] })
        queryClient.invalidateQueries({ queryKey: ["permissions", staffRow.account_id] })
      }
    }

    setProfile(row ? { ...row, account: undefined } as Profile : null)
    setAccountCode(row?.account?.code ?? null)
    setOrgSlug(row?.account?.slug ?? null)
  }

  async function verifyActiveOrSignOut(userId: string) {
    const active = await checkUserActive(userId)
    if (!active) await supabase.auth.signOut()
  }

  // ── Pre-load permissions table ────────────────────────────────

  const accountId = profile?.account_id ?? null

  const { data: permissions, isLoading: permsLoading } = useQuery({
    queryKey: ["permissions", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("permissions").select("*")
      if (error) throw error
      return (data ?? []) as Permission[]
    },
    enabled: !!user && !!accountId,
    staleTime: 30_000,
  })

  // ── Pre-load branch roles ─────────────────────────────────────

  const isAdmin = profile?.is_admin === true

  const { data: branchRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ["my-branch-roles", profile?.id],
    queryFn: () => fetchBranchRoles(profile!.id, isAdmin, profile?.account_id ?? null),
    enabled: !!profile?.id,
    staleTime: 60_000,
  })

  const loading = authLoading || (!!user && (!profile || permsLoading || rolesLoading))

  const perms = useMemo(
    () => computePerms(isAdmin, branchRoles, permissions),
    [isAdmin, branchRoles, permissions],
  )

  // ── Session bootstrap ─────────────────────────────────────────

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
          setOrgSlug(null)
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
            verifyActiveOrSignOut(newSession.user.id)
          }
        }
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  // ── Periodic active-status check ─────────────────────────────

  useEffect(() => {
    const check = () => { if (userIdRef.current) verifyActiveOrSignOut(userIdRef.current) }
    const interval = setInterval(check, 2 * 60_000)
    const handleVisibility = () => { if (!document.hidden) check() }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", handleVisibility) }
  }, [])


  const mustChangePassword = user?.user_metadata?.must_change_password === true

  // ── Auth actions ──────────────────────────────────────────────

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

  async function signUp(
    email: string,
    password: string,
    fullName: string,
    phone?: string,
    opts?: { inviteToken?: string; orgName?: string },
  ) {
    const { inviteToken, orgName } = opts ?? {}

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone:     phone ?? null,
          // Keep system_role in metadata for backwards-compat with the pre-085 trigger
          // (migration 063 reads it to set is_admin=true for new org owners).
          // The trigger in migration 085 ignores this field — safe to remove after 085 is applied.
          system_role: inviteToken ? "staff" : "owner",
        },
      },
    })
    if (error) return { error: error.message ?? null }

    if (data.user) {
      if (inviteToken) {
        // ── Invited user: link profile to the invite's account ──
        const { data: invite, error: inviteErr } = await supabase
          .from("account_invites")
          .select("id, account_id, expires_at, max_uses, uses")
          .eq("token", inviteToken)
          .single()

        if (inviteErr || !invite) return { error: "Invalid invite link" }
        if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { error: "Invite link has expired" }
        if (invite.max_uses !== null && invite.uses >= invite.max_uses) return { error: "Invite link has reached its usage limit" }

        await supabase
          .from("profiles")
          .update({ account_id: invite.account_id, ...(phone ? { phone } : {}) })
          .eq("id", data.user.id)

        await supabase
          .from("account_invites")
          .update({ uses: invite.uses + 1 })
          .eq("id", invite.id)

      } else {
        // ── New org: call the atomic RPC to bootstrap the organisation ──
        const name = orgName?.trim() || `${fullName}'s Organization`
        const slug = slugify(name) || "org"

        const { error: rpcErr } = await supabase.rpc("create_organization", {
          p_name: name,
          p_slug: slug,
        })
        if (rpcErr) return { error: rpcErr.message }
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
        isAdmin,
        accountId,
        accountCode,
        orgSlug,
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
