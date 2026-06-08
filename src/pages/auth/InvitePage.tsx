import { useParams, useNavigate } from "react-router-dom"
import { Coffee, Users } from "lucide-react"

import { useGetInviteByToken } from "@/hooks/useAccount"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

export function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { data: invite, isLoading, isError } = useGetInviteByToken(token ?? null)

  // invite?.accounts is usually an object but can be inferred as array if join is many-to-one
  const orgAccount = (Array.isArray(invite?.accounts) ? invite.accounts[0] : invite?.accounts) as { name: string; code: number } | null
  const orgName = orgAccount?.name ?? "this organization"
  const orgCode = orgAccount?.code ?? null
  const isExpired = invite?.expires_at ? new Date(invite.expires_at) < new Date() : false
  const isMaxed = invite?.max_uses != null ? invite.uses >= invite.max_uses : false
  const isInvalid = isError || isExpired || isMaxed

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Coffee className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">CHARLIES</h1>
          <p className="text-sm text-muted-foreground">Cafe management</p>
        </div>

        <Card>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle>You've been invited</CardTitle>
            <CardDescription>
              {isLoading && "Loading invite details…"}
              {isExpired && "This invite link has expired."}
              {isMaxed && "This invite link has reached its usage limit."}
              {isError && !isExpired && !isMaxed && "This invite link is invalid or no longer active."}
              {!isLoading && !isInvalid && (
                <>
                  Join <strong>{orgName}</strong> on CHARLIES
                  {orgCode !== null && (
                    <span className="block mt-1 font-mono text-xs text-muted-foreground/70">
                      Account ID: {orgCode}
                    </span>
                  )}
                </>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-3 pt-4">
            {isLoading && (
              <div className="flex justify-center py-2">
                <Spinner />
              </div>
            )}

            {!isLoading && isInvalid && (
              <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
                Go to login
              </Button>
            )}

            {!isLoading && !isInvalid && (
              <>
                <Button className="w-full" onClick={() => navigate(`/register?invite=${token}`)}>
                  Create account &amp; join
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => navigate("/login")}>
                  Already have an account? Sign in
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
