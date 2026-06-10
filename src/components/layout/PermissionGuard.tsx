import { useEffect } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { toast } from "sonner"

import { useAuth } from "@/hooks/useAuth"
import type { Resource } from "@/types/permission"

// ── PermissionGuard ───────────────────────────────────────────
// Uses AuthContext's pre-resolved canRead so it is always in sync with the
// authoritative permission state. Guarding on `loading` prevents false
// denials during brief query refetch windows (e.g. token refresh, stale time).

interface PermissionGuardProps {
  resource: Resource
}

export function PermissionGuard({ resource }: PermissionGuardProps) {
  const { canRead, loading } = useAuth()
  const denied = !loading && !canRead(resource)

  useEffect(() => {
    if (denied) toast.error("Access denied")
  }, [denied])

  if (loading) return null
  if (denied) return <Navigate to="/" replace />
  return <Outlet />
}
