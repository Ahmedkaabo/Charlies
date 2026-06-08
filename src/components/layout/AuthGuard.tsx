import { useEffect } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { toast } from "sonner"

import { useAuth } from "@/hooks/useAuth"
import { useMyBranch } from "@/hooks/useAttendance"
import type { SystemRole } from "@/hooks/useAuth"
import { Spinner } from "@/components/ui/spinner"

// ── AuthGuard ─────────────────────────────────────────────────
// Single loading phase: waits for auth + permissions (all in AuthContext).
// Branch check for onboarding is non-blocking: the redirect fires once the
// branch query resolves, not before.

export function AuthGuard() {
  const { user, profile, isAdmin, mustChangePassword, loading } = useAuth()

  // Non-blocking onboarding check — only needed for staff (non-admin) users.
  // Never holds up the spinner; redirects once resolved if no branch is found.
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

  // myBranch === null  → resolved, no branch assigned → onboarding
  // myBranch === undefined → still loading → let through (rare new-user path)
  if (!isAdmin && myBranch === null) return <Navigate to="/onboarding" replace />

  return <Outlet />
}

// ── RoleGuard ─────────────────────────────────────────────────

interface RoleGuardProps {
  allowedRoles: SystemRole[]
}

export function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const { systemRole, isAdmin } = useAuth()
  const denied = !isAdmin && !allowedRoles.includes(systemRole)

  useEffect(() => {
    if (denied) toast.error("Access denied")
  }, [denied])

  if (denied) return <Navigate to="/" replace />
  return <Outlet />
}
