import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Coffee, MapPin } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/hooks/useAuth"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Spinner } from "@/components/ui/spinner"

// ── OrgSetupPage ─────────────────────────────────────────────
// Reached by new org owners immediately after signup.
// Guides them through creating their first branch and assigns
// them the non-deletable Branch Owner role on that branch.
// Redirects to / once a branch exists.

const schema = z.object({
  branchName: z.string().min(2, "Branch name must be at least 2 characters"),
  city:       z.string().optional(),
  address:    z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function OrgSetupPage() {
  const navigate   = useNavigate()
  const qc         = useQueryClient()
  const { user, isAdmin, accountId, loading: authLoading } = useAuth()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { branchName: "", city: "", address: "" },
  })

  // ── Guards ────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  // Not logged in → login
  if (!user) return <Navigate to="/login" replace />

  // Not an org admin (invited staff) → onboarding
  if (!isAdmin) return <Navigate to="/onboarding" replace />

  // ── Branch creation ───────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    if (!user || !accountId) return
    setSubmitting(true)

    try {
      // 1. Create the branch.
      const { data: branch, error: branchErr } = await supabase
        .from("branches")
        .insert({
          name:       values.branchName.trim(),
          city:       values.city?.trim() || null,
          address:    values.address?.trim() || null,
          account_id: accountId,
          owner_id:   user.id,
          is_active:  true,
        })
        .select("id")
        .single()

      if (branchErr || !branch) {
        toast.error(branchErr?.message ?? "Failed to create branch")
        setSubmitting(false)
        return
      }

      // 2. Add the org admin to owners with no roles (full access by is_admin flag).
      await supabase
        .from("owners")
        .upsert(
          { branch_id: branch.id, profile_id: user.id, is_active: true, account_id: accountId, role_ids: [], role_id: null },
          { onConflict: "branch_id,profile_id" },
        )

      // 3. Invalidate caches and go to dashboard.
      await qc.invalidateQueries({ queryKey: ["my-branch-roles"] })
      await qc.invalidateQueries({ queryKey: ["branches"] })
      toast.success("Branch created — welcome!")
      navigate("/", { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
      setSubmitting(false)
    }
  }

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
          <CardHeader>
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <MapPin className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-center">Add your first branch</CardTitle>
            <CardDescription className="text-center">
              Every org needs at least one branch. You'll be assigned as Branch Owner
              with full access — this role cannot be removed.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="branchName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch name <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Main Branch" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Cairo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="123 Tahrir Square" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full mt-2" disabled={submitting}>
                  {submitting ? "Setting up…" : "Create branch & go to dashboard"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
