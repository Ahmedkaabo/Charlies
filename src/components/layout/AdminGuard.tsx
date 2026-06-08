import { useEffect } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { toast } from "sonner"

import { useAuth } from "@/hooks/useAuth"
import { useUserPermissions } from "@/hooks/usePermissions"
import { Spinner } from "@/components/ui/spinner"

// ── AdminGuard ────────────────────────────────────────────────
// Grants access to:
//   • system admins (is_admin = true)
//   • any user with an active record in the owners table (isOwner = true)
//     — regardless of the operational role level assigned to them.
// All other authenticated users are redirected to /.

export function AdminGuard() {
  const { isAdmin, loading: authLoading } = useAuth()
  const { isOwner, loading: permsLoading } = useUserPermissions()

  const loading = authLoading || permsLoading
  const allowed = isAdmin || isOwner

  useEffect(() => {
    if (!loading && !allowed) toast.error("Access denied")
  }, [loading, allowed])

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!allowed) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
