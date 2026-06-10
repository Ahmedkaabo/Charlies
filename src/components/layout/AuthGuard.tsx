import { useEffect } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { toast } from "sonner"

import { useAuth } from "@/hooks/useAuth"
import { useMyBranch } from "@/hooks/useAttendance"
import { Spinner } from "@/components/ui/spinner"

// ── AuthGuard ─────────────────────────────────────────────────
// Waits for auth + permissions (all in AuthContext).
// Non-admin users without a branch are redirected to onboarding.

export function AuthGuard() {
  const { user, profile, isAdmin, mustChangePassword, loading } = useAuth()

  const { data: myBranch } = useMyBranch(
    !loading && !!user && !isAdmin ? profile?.id : undefined
  )

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (mustChangePassword) return <Navigate to="/change-password" replace />

  if (!isAdmin && myBranch === null) return <Navigate to="/onboarding" replace />

  return <Outlet />
}

// ── RoleGuard ─────────────────────────────────────────────────
// Restricts a route to org admins only.
// Use <AdminGuard /> for routes that also allow branch owners.

export function RoleGuard() {
  const { isAdmin } = useAuth()

  useEffect(() => {
    if (!isAdmin) toast.error("Access denied")
  }, [isAdmin])

  if (!isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
