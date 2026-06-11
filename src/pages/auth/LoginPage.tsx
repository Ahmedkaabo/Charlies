import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import logoUrl from "@/assets/logo.svg"
import { useAuth } from "@/hooks/useAuth"
import { useLanguage } from "@/hooks/useLanguage"
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

const translations = {
  en: {
    subtitle:       "Cafe management",
    cardTitle:      "Sign in",
    cardDesc:       "Enter your phone number and password",
    phoneLabel:     "Phone number",
    phonePlaceholder: "010 0000 0000",
    passwordLabel:  "Password",
    forgotPassword: "Forgot password?",
    submit:         "Sign in",
    submitting:     "Signing in…",
    noAccount:      "Don't have an account?",
    signUp:         "Sign up",
    welcomeBack:    "Welcome back!",
    phoneRequired:  "Phone number is required",
    passwordRequired: "Password is required",
    toggleLang:     "ع",
  },
  ar: {
    subtitle:       "إدارة الكافيه",
    cardTitle:      "تسجيل الدخول",
    cardDesc:       "أدخل رقم هاتفك وكلمة المرور",
    phoneLabel:     "رقم الهاتف",
    phonePlaceholder: "٠١٠ ٠٠٠٠ ٠٠٠٠",
    passwordLabel:  "كلمة المرور",
    forgotPassword: "نسيت كلمة المرور؟",
    submit:         "تسجيل الدخول",
    submitting:     "جارٍ تسجيل الدخول...",
    noAccount:      "ليس لديك حساب؟",
    signUp:         "إنشاء حساب",
    welcomeBack:    "مرحباً بعودتك!",
    phoneRequired:  "رقم الهاتف مطلوب",
    passwordRequired: "كلمة المرور مطلوبة",
    toggleLang:     "EN",
  },
} as const

type FormValues = { phone: string; password: string }

export function LoginPage() {
  const navigate           = useNavigate()
  const { signIn }         = useAuth()
  const { isAr, toggle }   = useLanguage()
  const [submitting, setSubmitting] = useState(false)

  const tr = translations[isAr ? "ar" : "en"]

  const schema = useMemo(() =>
    z.object({
      phone:    z.string().min(1, tr.phoneRequired),
      password: z.string().min(1, tr.passwordRequired),
    }),
  [isAr]) // eslint-disable-line react-hooks/exhaustive-deps

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: "", password: "" },
  })

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    const { error } = await signIn(values.phone.trim(), values.password)
    setSubmitting(false)

    if (error) {
      toast.error(error)
      return
    }

    toast.success(tr.welcomeBack)
    navigate("/", { replace: true })
  }

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      lang={isAr ? "ar" : "en"}
      style={isAr ? { fontFamily: "'IBM Plex Sans Arabic', sans-serif" } : undefined}
      className="relative flex min-h-svh items-center justify-center bg-muted/30 px-4 py-12"
    >
      {/* Language toggle */}
      <button
        onClick={toggle}
        className="fixed top-4 right-4 z-10 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm hover:bg-muted transition-colors"
      >
        {tr.toggleLang}
      </button>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src={logoUrl} alt="CHARLIES" className="h-9 w-auto" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{tr.cardTitle}</CardTitle>
            <CardDescription>{tr.cardDesc}</CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tr.phoneLabel}</FormLabel>
                      <FormControl>
                        <Input
                          dir="ltr"
                          type="tel"
                          placeholder={tr.phonePlaceholder}
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
                      <div className="flex items-center justify-between">
                        <FormLabel>{tr.passwordLabel}</FormLabel>
                        <Link
                          to="/forgot-password"
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {tr.forgotPassword}
                        </Link>
                      </div>
                      <FormControl>
                        <Input
                          dir="ltr"
                          type="password"
                          placeholder="••••••••"
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full mt-2" disabled={submitting}>
                  {submitting ? tr.submitting : tr.submit}
                </Button>
              </form>
            </Form>
          </CardContent>

          <CardFooter className="justify-center text-sm">
            <span className="text-muted-foreground">{tr.noAccount}&nbsp;</span>
            <Link to="/register" className="font-medium hover:underline">{tr.signUp}</Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
