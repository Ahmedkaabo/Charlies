import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Coffee, Info } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

const schema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  phone:    z.string().min(7, "Please enter a valid phone number"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type FormValues = z.infer<typeof schema>

export function RegisterPage() {
  const navigate         = useNavigate()
  const [searchParams]   = useSearchParams()
  const inviteToken      = searchParams.get("invite") ?? undefined
  const { signUp }       = useAuth()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", phone: "", password: "", confirmPassword: "" },
  })

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    const phone = values.phone.trim()
    const internalEmail = `${phone.replace(/\D/g, "")}@charlies.internal`
    const { error } = await signUp(internalEmail, values.password, values.fullName, phone, inviteToken)
    setSubmitting(false)

    if (error) {
      toast.error(error)
      return
    }

    toast.success("Account created!")
    // New org admin → go to dashboard (AuthGuard admits them because isAdmin=true)
    // Invite staff → go to onboarding to pick their branch
    navigate(inviteToken ? "/onboarding" : "/", { replace: true })
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
            <CardTitle>{inviteToken ? "Join your team" : "Create your organization"}</CardTitle>
            <CardDescription>
              {inviteToken
                ? "Fill in the details below to join the team"
                : "Set up your CHARLIES account — you'll be the admin"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {inviteToken
                ? <p>You're joining via an invite link. Select your branch after signing up to get instant access.</p>
                : <p>A new organization will be created for you. You'll have <strong>full admin access</strong> to add branches, staff, and owners.</p>
              }
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input placeholder="Ahmed Mostafa" autoComplete="name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone number</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="010 0000 0000"
                          autoComplete="tel"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full mt-2" disabled={submitting}>
                  {submitting ? "Creating account…" : "Create account"}
                </Button>
              </form>
            </Form>
          </CardContent>

          <CardFooter className="justify-center text-sm">
            <span className="text-muted-foreground">Already have an account?&nbsp;</span>
            <Link to="/login" className="font-medium hover:underline">Sign in</Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
