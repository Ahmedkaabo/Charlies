import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Permission, Role, Resource, CrudField } from "@/types/permission"
import { useAuth } from "@/hooks/useAuth"
import { NAV_ITEMS, NAV_GROUPS } from "@/lib/nav"

// Permission lookup is done via branch_members → roles directly,
// not via profiles.system_role, so role assignments always reflect
// what the manager set in branch_members regardless of the profile value.

export function useGetRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("id, name, level, is_system, role_type")
        .order("level", { ascending: true })
      if (!error) return data as Role[]

      // Fallback: newer columns (is_system, role_type) may not exist yet
      const { data: basic, error: basicErr } = await supabase
        .from("roles")
        .select("id, name, level")
        .order("level", { ascending: true })
      if (basicErr) throw basicErr
      return (basic ?? []).map((r) => ({
        ...r,
        is_system: false,
        role_type:  "operational" as const,
      })) as Role[]
    },
  })
}

export interface RoleInput {
  name: string
  level: number
  role_type?: "managerial" | "operational"
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RoleInput) => {
      const { data, error } = await supabase
        .from("roles")
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as Role
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] })
      qc.invalidateQueries({ queryKey: ["permissions"] })
    },
  })
}

export function useUpdateRole(id: string) {
  const qc = useQueryClient()
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
      qc.invalidateQueries({ queryKey: ["roles"] })
    },
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roles").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] })
      qc.invalidateQueries({ queryKey: ["permissions"] })
    },
  })
}

export function useGetPermissions() {
  return useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissions")
        .select("*")
      if (error) throw error
      return data as Permission[]
    },
  })
}

interface UpsertPermissionInput {
  role_id: string
  resource: Resource
  can_create: boolean
  can_read: boolean
  can_update: boolean
  can_delete: boolean
  can_move_treasury: boolean
  can_see_treasury: boolean
}

export function useUpsertPermission() {
  const qc = useQueryClient()
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
    // Optimistic update: flip the value immediately in cache
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["permissions"] })
      const prev = qc.getQueryData<Permission[]>(["permissions"])
      qc.setQueryData<Permission[]>(["permissions"], (old = []) => {
        const idx = old.findIndex(
          (p) => p.role_id === input.role_id && p.resource === input.resource
        )
        if (idx === -1) {
          return [...old, { ...input, id: "optimistic", created_at: "" }]
        }
        const updated = [...old]
        updated[idx] = { ...updated[idx], ...input }
        return updated
      })
      return { prev }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(["permissions"], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["permissions"] })
    },
  })
}

// ── useUserPermissions ────────────────────────────────────────
// Reads pre-resolved permissions from AuthContext (loaded once on startup).
// loading is always false here — AuthGuard already waited for it.

export interface UserPermissions {
  canCreate:  (resource: Resource) => boolean
  canRead:    (resource: Resource) => boolean
  canUpdate:  (resource: Resource) => boolean
  canDelete:  (resource: Resource) => boolean
  canMoveTreasury: () => boolean
  canSeeTreasury:  () => boolean
  roleLevel:  number
  isOwner:    boolean
  loading:    boolean
}

export function useUserPermissions(): UserPermissions {
  const { canCreate, canRead, canUpdate, canDelete, canMoveTreasury, canSeeTreasury, roleLevel, isOwner, loading } = useAuth()
  return { canCreate, canRead, canUpdate, canDelete, canMoveTreasury, canSeeTreasury, roleLevel, isOwner, loading }
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
    return isAdmin || loading || canRead(item.resource)
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
      return isAdmin || loading || canRead(item.resource)
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
    can_move_treasury: existing?.can_move_treasury ?? false,
    can_see_treasury:  existing?.can_see_treasury  ?? false,
    [field]: value,
  }
}
