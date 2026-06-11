import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Permission, Role, Resource, CrudField } from "@/types/permission"
import { useAuth } from "@/hooks/useAuth"
import { NAV_ITEMS, NAV_GROUPS } from "@/lib/nav"

// Permission lookup is done via staff/owners → roles → permissions.
// All permissions come from branch role assignments, never from profile flags.

export function useGetRoles() {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["roles", accountId],
    queryFn: async () => {
      if (!accountId) return []
      const { data, error } = await supabase
        .from("roles")
        .select("id, name, name_ar, level, is_system, role_type, hidden_from_assignment")
        .eq("account_id", accountId)
        .order("level", { ascending: true })
      if (!error) return data as Role[]

      // Fallback: hidden_from_assignment column may not exist yet
      const { data: noHidden, error: noHiddenErr } = await supabase
        .from("roles")
        .select("id, name, level, is_system, role_type")
        .eq("account_id", accountId)
        .order("level", { ascending: true })
      if (!noHiddenErr) return (noHidden ?? []).map((r) => ({ ...r, hidden_from_assignment: false })) as Role[]

      // Fallback: older schema without is_system / role_type either
      const { data: basic, error: basicErr } = await supabase
        .from("roles")
        .select("id, name, level")
        .eq("account_id", accountId)
        .order("level", { ascending: true })
      if (basicErr) throw basicErr
      return (basic ?? []).map((r) => ({
        ...r,
        is_system: false,
        role_type: "operational" as const,
        hidden_from_assignment: false,
      })) as Role[]
    },
    enabled: !!accountId,
  })
}

export interface RoleInput {
  name: string
  name_ar?: string | null
  level: number
  role_type?: "managerial" | "operational"
  hidden_from_assignment?: boolean
}

export function useCreateRole() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (input: RoleInput) => {
      const { data, error } = await supabase
        .from("roles")
        .insert({ ...input, account_id: accountId })
        .select()
        .single()
      if (error) throw error
      return data as Role
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles", accountId] })
      qc.invalidateQueries({ queryKey: ["permissions"] })
    },
  })
}

export function useUpdateRole(id: string) {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (input: Partial<RoleInput>) => {
      const { data, error } = await supabase
        .from("roles")
        .update(input)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data as Role
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles", accountId] })
    },
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roles").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles", accountId] })
      qc.invalidateQueries({ queryKey: ["permissions"] })
    },
  })
}

export function useGetPermissions() {
  const { accountId } = useAuth()
  return useQuery({
    queryKey: ["permissions", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissions")
        .select("*")
      if (error) throw error
      return data as Permission[]
    },
    staleTime: 30_000,
    enabled: !!accountId,
  })
}

interface UpsertPermissionInput {
  role_id: string
  resource: Resource
  can_create: boolean
  can_read: boolean
  can_update: boolean
  can_delete: boolean
}

export function useUpsertPermission() {
  const qc = useQueryClient()
  const { accountId } = useAuth()
  return useMutation({
    mutationFn: async (input: UpsertPermissionInput) => {
      const { data, error } = await supabase
        .from("permissions")
        .upsert(input, { onConflict: "role_id,resource" })
        .select()
        .single()
      if (error) throw error
      return data as Permission
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["permissions", accountId] })
      const prev = qc.getQueryData<Permission[]>(["permissions", accountId])
      qc.setQueryData<Permission[]>(["permissions", accountId], (old = []) => {
        const idx = old.findIndex(
          (p) => p.role_id === input.role_id && p.resource === input.resource
        )
        if (idx === -1) return [...old, { ...input, id: "optimistic", created_at: "" }]
        const updated = [...old]
        updated[idx] = { ...updated[idx], ...input }
        return updated
      })
      return { prev }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(["permissions", accountId], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["permissions", accountId] })
    },
  })
}

// ── useUserPermissions ────────────────────────────────────────
// Resolves permissions from the user's actual branch role in
// staff/owners (most privileged role if in multiple branches).

interface UserPermissions {
  canCreate:  (resource: Resource) => boolean
  canRead:    (resource: Resource) => boolean
  canUpdate:  (resource: Resource) => boolean
  canDelete:  (resource: Resource) => boolean
  /** Level of the user's most privileged active branch role. 0 = master. */
  roleLevel:  number
  /** True when the user has an active record in the owners table. Separate from roleLevel
   *  so that AdminGuard / sidebar can allow owner-management access regardless of the
   *  operational role assigned to the owner. */
  isOwner:    boolean
  loading:    boolean
}

export function useUserPermissions(): UserPermissions {
  const { profile }                                        = useAuth()
  const { data: permissions, isLoading: permsLoading }    = useGetPermissions()

  // Fetch the user's active role.
  // Owners (owners table) use their assigned role_id; if none is set they get full access.
  // Staff (staff table) use their branch role as before.
  const { data: branchRoles, isLoading: roleLoading } = useQuery({
    queryKey: ["my-branch-roles", profile?.id],
    queryFn: async () => {
      // Admin users always get the full-access sentinel — same as fetchBranchRoles
      // in AuthContext. This queryFn may become canonical after staleTime expires
      // (React Query uses the last-registered queryFn), so it must handle admins.
      if (profile?.is_admin) {
        return [{ role_id: null as string | null, role: { level: -1 }, isOwner: false }]
      }

      const [staffRes, ownerRes] = await Promise.all([
        supabase.from("staff").select("role_id, role_ids").eq("profile_id", profile!.id).eq("is_active", true),
        supabase.from("owners").select("role_id, role_ids").eq("profile_id", profile!.id).eq("is_active", true),
      ])
      if (staffRes.error) throw staffRes.error

      let isOwner = !ownerRes.error && (ownerRes.data ?? []).length > 0
      if (ownerRes.error) {
        const { data: plain } = await supabase
          .from("owners").select("id").eq("profile_id", profile!.id).eq("is_active", true).limit(1)
        if ((plain ?? []).length > 0) {
          return [{ role_id: null as string | null, role: { level: -1 }, isOwner: true }]
        }
      }

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
        // Owner has no roles assigned — preserve isOwner flag but grant no permissions
        return [{ role_id: null as string | null, role: { level: 99 }, isOwner: true }]
      }

      return [...staffRoleIds].map(id => ({ role_id: id, role: { level: roleLevelMap[id] ?? 99 }, isOwner: false }))
    },
    enabled: !!profile?.id,
    staleTime: 60_000,
  })

  const loading = permsLoading || roleLoading

  // All users go through the roles/permissions lookup — including org admins.
  // Admins are routed to the "Admin" system role by fetchBranchRoles in AuthContext
  // (same queryKey, AuthContext's queryFn runs first and is cached here).

  const allBranchRoles = branchRoles ?? []
  const allRoleIds = new Set<string>(
    allBranchRoles.map(r => r.role_id).filter((id): id is string => id !== null)
  )
  const levels = allBranchRoles.map(r => (r as any).role?.level ?? 99)
  const myRoleLevel = levels.length ? Math.min(...levels) : 99
  const isOwner = allBranchRoles.some(r => (r as any).isOwner === true)

  // Sentinel: no role seeded yet — grant full access
  if (myRoleLevel === -1) {
    return {
      canCreate: () => true,
      canRead:   () => true,
      canUpdate: () => true,
      canDelete: () => true,
      roleLevel: 0,
      isOwner,
      loading:   false,
    }
  }

  // Grant permission if ANY of the user's roles has it
  function anyPerm(resource: Resource, field: string): boolean {
    return allRoleIds.size > 0 && !!permissions?.some(
      p => allRoleIds.has(p.role_id) && p.resource === resource && (p as any)[field]
    )
  }

  return {
    canCreate: (r) => anyPerm(r, 'can_create'),
    canRead:   (r) => anyPerm(r, 'can_read'),
    canUpdate: (r) => anyPerm(r, 'can_update'),
    canDelete: (r) => anyPerm(r, 'can_delete'),
    roleLevel: myRoleLevel,
    isOwner,
    loading,
  }
}

// ── useVisibleNavItems ────────────────────────────────────────
// Filters NAV_ITEMS to only items the current user can read.
// While permissions are loading, all items are returned (optimistic)
// so the sidebar doesn't flash empty.

export function useVisibleNavItems() {
  const { isAdmin } = useAuth()
  const { canRead, loading } = useUserPermissions()

  const items = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdmin) return false
    if (!item.resource) return true
    return loading || canRead(item.resource)
  })

  return { items, loading }
}

// ── useVisibleNavGroups ───────────────────────────────────────
// Like useVisibleNavItems but preserves group structure for the sidebar.

export function useVisibleNavGroups() {
  const { isAdmin } = useAuth()
  const { canRead, loading } = useUserPermissions()

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.adminOnly && !isAdmin) return false
      if (!item.resource) return true
      return loading || canRead(item.resource)
    }),
  })).filter((group) => group.items.length > 0)

  return { groups, loading }
}

// ── Helper: find a permission from the flat list by role + resource
export function findPermission(
  permissions: Permission[] | undefined,
  roleId: string,
  resource: Resource
): Permission | undefined {
  return permissions?.find((p) => p.role_id === roleId && p.resource === resource)
}

// Helper: toggle one CRUD field, preserving the rest
export function buildToggled(
  existing: Permission | undefined,
  roleId: string,
  resource: Resource,
  field: CrudField,
  value: boolean
): UpsertPermissionInput {
  return {
    role_id: roleId,
    resource,
    can_create: existing?.can_create ?? false,
    can_read:   existing?.can_read   ?? false,
    can_update: existing?.can_update ?? false,
    can_delete: existing?.can_delete ?? false,
    [field]: value,
  }
}
