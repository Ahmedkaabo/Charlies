import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { Coffee, MapPin, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/hooks/useAuth"
import { useMyBranch } from "@/hooks/useAttendance"
import { useGetBranches } from "@/hooks/useBranches"
import { useGetRoles } from "@/hooks/usePermissions"
import { useCreateMember } from "@/hooks/useMembers"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

// ── OnboardingPage ────────────────────────────────────────────
// Only reached by invite users (non-admin with no branch).
// New org admins never land here — AuthGuard lets them through.
// Branch selection is REQUIRED — there is no skip.

export function OnboardingPage() {
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const { user, loading: authLoading } = useAuth()
  const { data: myBranch, isLoading: branchCheckLoading } = useMyBranch(user?.id)
  const { data: branches, isLoading: branchesLoading }    = useGetBranches()
  const { data: roles }  = useGetRoles()
  const createMember     = useCreateMember()
  const [joining, setJoining] = useState<string | null>(null)

  async function handleSelectBranch(branchId: string) {
    if (!user) return
    const defaultRole = roles?.find((r) => r.name.toLowerCase() === "bar")
      ?? roles?.find((r) => !r.is_system)
    if (!defaultRole) {
      toast.error("No role configured — ask your admin to set up roles first")
      return
    }

    setJoining(branchId)
    try {
      await createMember.mutateAsync({
        branchId,
        profileId:      user.id,
        roleIds:        [defaultRole.id],
        monthly_salary: null,
        currency:       "EGP",
        effective_from: new Date().toISOString().slice(0, 10),
      })
      await qc.refetchQueries({ queryKey: ["my-branch"] })
      toast.success("Welcome aboard!")
      navigate("/", { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join branch")
      setJoining(null)
    }
  }

  // ── Guards ────────────────────────────────────────────────────

  if (authLoading || (user && branchCheckLoading)) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (user && myBranch) return <Navigate to="/" replace />

  if (!user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-12">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mx-auto">
            <Coffee className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to your address. Once confirmed, sign in
            and you'll be prompted to choose your branch.
          </p>
          <Button variant="outline" onClick={() => navigate("/login")}>Sign in</Button>
        </div>
      </div>
    )
  }

  // ── Branch selection ──────────────────────────────────────────

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-lg space-y-6">

        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Coffee className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Choose your branch</h1>
          <p className="text-sm text-muted-foreground">
            Select the branch you work at to get instant access.
          </p>
        </div>

        <div className="space-y-2">
          {branchesLoading && Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}

          {!branchesLoading && branches?.length === 0 && (
            <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
              <p className="font-medium">No branches available yet.</p>
              <p className="mt-1 text-xs">Your admin hasn't created any branches. Ask them to add one.</p>
            </div>
          )}

          {branches?.map((branch) => {
            const isJoining = joining === branch.id
            return (
              <button
                key={branch.id}
                disabled={joining !== null}
                onClick={() => handleSelectBranch(branch.id)}
                className="flex w-full items-center gap-4 rounded-lg border bg-card px-4 py-3.5 text-left transition-shadow hover:shadow-md disabled:opacity-60"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{branch.name}</p>
                  {branch.city && (
                    <p className="text-xs text-muted-foreground">{branch.city}</p>
                  )}
                </div>
                {isJoining ? <Spinner /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>
            )
          })}
        </div>

      </div>
    </div>
  )
}
