import { useEffect } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { toast } from "sonner"

import { useUserPermissions } from "@/hooks/usePermissions"
import type { Resource } from "@/types/permission"

// ── PermissionGuard ───────────────────────────────────────────
// Permissions are resolved in AuthContext and ready by the time AuthGuard
// renders its Outlet. No separate loading spinner needed here.

interface PermissionGuardProps {
  resource: Resource
}

export function PermissionGuard({ resource }: PermissionGuardProps) {
  const { canRead } = useUserPermissions()
  const denied = !canRead(resource)

  useEffect(() => {
    if (denied) toast.error("Access denied")
  }, [denied])

  if (denied) return <Navigate to="/" replace />
  return <Outlet />
}
