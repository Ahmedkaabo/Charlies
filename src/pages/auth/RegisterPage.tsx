import { useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Info } from "lucide-react"
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
    subtitle:           "Cafe management",
    cardTitleNew:       "Create your organization",
    cardTitleInvite:    "Join your team",
    cardDescNew:        "Set up your CHARLIES account — you'll be the admin",
    cardDescInvite:     "Fill in the details below to join the team",
    infoNew:            "A new organization will be created for you. Next, you'll add your first branch to get started.",
    infoInvite:         "You're joining via an invite link. Select your branch after signing up to get instant access.",
    orgName:            "Organization name",
    orgNamePlaceholder: "Charlies Cafe",
    fullName:           "Full name",
    fullNamePlaceholder:"Ahmed Mostafa",
    phone:              "Phone number",
    phonePlaceholder:   "010 0000 0000",
    password:           "Password",
    confirmPassword:    "Confirm password",
    submit:             "Create account",
    submitting:         "Creating account…",
    hasAccount:         "Already have an account?",
    signIn:             "Sign in",
    created:            "Account created!",
    toggleLang:         "ع",
    // validation
    orgNameMin:         "Organization name must be at least 2 characters",
    fullNameMin:        "Name must be at least 2 characters",
    phoneMin:           "Please enter a valid phone number",
    passwordMin:        "Password must be at least 8 characters",
    passwordUpper:      "Must contain an uppercase letter",
    passwordNumber:     "Must contain a number",
    passwordMatch:      "Passwords don't match",
  },
  ar: {
    subtitle:           "إدارة الكافيه",
    cardTitleNew:       "إنشاء مؤسستك",
    cardTitleInvite:    "انضم إلى فريقك",
    cardDescNew:        "أنشئ حسابك في CHARLIES — ستكون المسؤول",
    cardDescInvite:     "أدخل البيانات أدناه للانضمام إلى الفريق",
    infoNew:            "سيتم إنشاء مؤسسة جديدة لك. بعد ذلك، ستضيف فرعك الأول للبدء.",
    infoInvite:         "أنت تنضم عبر رابط دعوة. اختر فرعك بعد التسجيل للحصول على وصول فوري.",
    orgName:            "اسم المؤسسة",
    orgNamePlaceholder: "كافيه تشارليز",
    fullName:           "الاسم الكامل",
    fullNamePlaceholder:"أحمد مصطفى",
    phone:              "رقم الهاتف",
    phonePlaceholder:   "٠١٠ ٠٠٠٠ ٠٠٠٠",
    password:           "كلمة المرور",
    confirmPassword:    "تأكيد كلمة المرور",
    submit:             "إنشاء حساب",
    submitting:         "جارٍ إنشاء الحساب...",
    hasAccount:         "لديك حساب بالفعل؟",
    signIn:             "تسجيل الدخول",
    created:            "تم إنشاء الحساب!",
    toggleLang:         "EN",
    // validation
    orgNameMin:         "اسم المؤسسة يجب أن يكون حرفين على الأقل",
    fullNameMin:        "الاسم يجب أن يكون حرفين على الأقل",
    phoneMin:           "أدخل رقم هاتف صحيح",
    passwordMin:        "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
    passwordUpper:      "يجب أن تحتوي على حرف كبير",
    passwordNumber:     "يجب أن تحتوي على رقم",
    passwordMatch:      "كلمتا المرور غير متطابقتين",
  },
} as const

type NewOrgValues = {
  orgName: string
  fullName: string
  phone: string
  password: string
  confirmPassword: string
}
type InviteValues = Omit<NewOrgValues, "orgName">
type FormValues   = NewOrgValues | InviteValues

export function RegisterPage() {
  const navigate         = useNavigate()
  const [searchParams]   = useSearchParams()
  const inviteToken      = searchParams.get("invite") ?? undefined
  const isInvite         = !!inviteToken
  const { signUp }       = useAuth()
  const { isAr, toggle } = useLanguage()
  const [submitting, setSubmitting] = useState(false)

  const tr = translations[isAr ? "ar" : "en"]

  const schema = useMemo(() => {
    const base = z.object({
      fullName:        z.string().min(2, tr.fullNameMin),
      phone:           z.string().min(7, tr.phoneMin),
      password:        z.string()
        .min(8, tr.passwordMin)
        .regex(/[A-Z]/, tr.passwordUpper)
        .regex(/[0-9]/, tr.passwordNumber),
      confirmPassword: z.string(),
    })

    if (isInvite) {
      return base.refine((d) => d.password === d.confirmPassword, {
        message: tr.passwordMatch,
        path: ["confirmPassword"],
      })
    }

    return base.extend({
      orgName: z.string().min(2, tr.orgNameMin),
    }).refine((d) => d.password === d.confirmPassword, {
      message: tr.passwordMatch,
      path: ["confirmPassword"],
    })
  }, [isAr, isInvite]) // eslint-disable-line react-hooks/exhaustive-deps

  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      orgName:         "",
      fullName:        "",
      phone:           "",
      password:        "",
      confirmPassword: "",
    },
  })

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    const phone         = values.phone.trim()
    const internalEmail = `${phone.replace(/\D/g, "")}@charlies.internal`
    const orgName       = !isInvite ? (values as NewOrgValues).orgName : undefined

    const { error } = await signUp(internalEmail, values.password, values.fullName, phone, {
      inviteToken,
      orgName,
    })
    setSubmitting(false)

    if (error) {
      toast.error(error)
      return
    }

    toast.success(tr.created)
    navigate(isInvite ? "/onboarding" : "/org-setup", { replace: true })
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
          <p className="text-sm text-muted-foreground">{tr.subtitle}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isInvite ? tr.cardTitleInvite : tr.cardTitleNew}</CardTitle>
            <CardDescription>{isInvite ? tr.cardDescInvite : tr.cardDescNew}</CardDescription>
          </CardHeader>

          <CardContent>
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{isInvite ? tr.infoInvite : tr.infoNew}</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">

                {!isInvite && (
                  <FormField
                    control={form.control}
                    name="orgName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tr.orgName}</FormLabel>
                        <FormControl>
                          <Input placeholder={tr.orgNamePlaceholder} autoComplete="organization" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tr.fullName}</FormLabel>
                      <FormControl>
                        <Input placeholder={tr.fullNamePlaceholder} autoComplete="name" {...field} />
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
                      <FormLabel>{tr.phone}</FormLabel>
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
                      <FormLabel>{tr.password}</FormLabel>
                      <FormControl>
                        <Input dir="ltr" type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
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
                      <FormLabel>{tr.confirmPassword}</FormLabel>
                      <FormControl>
                        <Input dir="ltr" type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
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
            <span className="text-muted-foreground">{tr.hasAccount}&nbsp;</span>
            <Link to="/login" className="font-medium hover:underline">{tr.signIn}</Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
