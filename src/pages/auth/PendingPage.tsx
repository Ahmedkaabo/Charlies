import { useEffect } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { Clock, LogOut } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/hooks/useAuth"
import { useMyBranch } from "@/hooks/useAttendance"
import { Button } from "@/components/ui/button"

// ── PendingPage ───────────────────────────────────────────────
// Shown to users who signed up via an invite link but have not
// yet been assigned to a branch by an admin.
// Polls useMyBranch every 30 s and navigates to / the moment
// the admin adds them to a branch.

export function PendingPage() {
  const { user, profile, signOut, loading } = useAuth()
  const navigate = useNavigate()

  const { data: myBranch, refetch } = useMyBranch(
    !loading && user ? profile?.id : undefined
  )

  // Auto-check every 30 seconds
  useEffect(() => {
    const id = setInterval(() => refetch(), 30_000)
    return () => clearInterval(id)
  }, [refetch])

  // Admitted once an admin assigns a branch
  useEffect(() => {
    if (myBranch) navigate("/", { replace: true })
  }, [myBranch, navigate])

  async function handleSignOut() {
    await signOut()
    toast.success("Signed out")
    navigate("/login", { replace: true })
  }

  // Unauthenticated → login
  if (!loading && !user) return <Navigate to="/login" replace />

  // Admin somehow landed here → dashboard
  if (!loading && profile?.is_admin) return <Navigate to="/" replace />

  const name = profile?.full_name ?? user?.email ?? ""

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Clock className="h-8 w-8 text-muted-foreground" />
      </div>

      <div className="space-y-2 max-w-sm">
        <h1 className="text-xl font-semibold">Waiting for approval</h1>
        <p className="text-sm text-muted-foreground">
          Hi{name ? ` ${name.split(" ")[0]}` : ""}, your account has been created.
          An admin needs to assign you to a branch before you can access the system.
        </p>
        <p className="text-xs text-muted-foreground/60 pt-1">
          This page checks automatically every 30 seconds.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 w-full max-w-xs">
        <Button variant="outline" className="w-full" onClick={() => refetch()}>
          Check now
        </Button>
        <Button
          variant="ghost"
          className="w-full text-muted-foreground gap-2"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  )
}
