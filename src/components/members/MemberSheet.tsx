import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { CalendarIcon, Shield, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { createClient } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

import {
  useCreateMemberMultiBranch,
  useUpdateMember,
  useRemoveMember,
} from "@/hooks/useMembers"
import { useGetBranches } from "@/hooks/useBranches"
import { useGetRoles, useUserPermissions } from "@/hooks/usePermissions"
import { useAuth } from "@/hooks/useAuth"
import type { GroupedMember, SalaryCurrency } from "@/types/member"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calendar } from "@/components/ui/calendar"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// ── Helpers ───────────────────────────────────────────────────

function getInitials(name?: string | null) {
  if (!name) return "??"
  const p = name.trim().split(/\s+/)
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0].slice(0, 2).toUpperCase()
}

// Creates a new auth user without touching the current session
async function createAuthUser(
  email: string,
  password: string,
  fullName: string,
  phone: string
): Promise<string> {
  // Use a noop storage so this temp client never shares the auth storage key
  // with the main client. Without this, GoTrueClient fires storage events that
  // contaminate the main session (causing the current admin to appear signed out).
  const noopStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  const tempClient = createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storage: noopStorage } }
  )
  const { data, error } = await tempClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone, must_change_password: true } },
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error("Failed to create account")
  return data.user.id
}

// ── Salary section ────────────────────────────────────────────

function SalarySection({
  control,
  required,
  calendarOpen,
  onCalendarOpen,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any
  required: boolean
  calendarOpen: boolean
  onCalendarOpen: (v: boolean) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">
          Salary{required && <span className="text-destructive ms-1">*</span>}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {required ? "Required for this role" : "Optional — can be left at 0"}
        </p>
      </div>

      <div className="flex gap-3">
        <FormField
          control={control}
          name="monthly_salary"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Monthly Salary</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : Number(e.target.value))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="currency"
          render={({ field }) => (
            <FormItem className="w-28">
              <FormLabel>Currency</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="EGP">ج.م. (EGP)</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="effective_from"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Effective From</FormLabel>
            <Popover open={calendarOpen} onOpenChange={onCalendarOpen}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button variant="outline" className="w-full justify-start text-start">
                    <CalendarIcon className="h-4 w-4 shrink-0" />
                    {field.value ? format(field.value, "d MMM yyyy") : "Pick a date"}
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={field.value ?? undefined}
                  onSelect={(d) => { field.onChange(d ?? null); onCalendarOpen(false) }}
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="paid_days_off"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Paid Days Off / month</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={0}
                max={30}
                placeholder="4"
                value={field.value ?? 4}
                onChange={(e) => field.onChange(Number(e.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

// ── Schemas ───────────────────────────────────────────────────

const createSchema = z.object({
  full_name:      z.string().min(2, "Name must be at least 2 characters"),
  name_ar:        z.string().min(1, "Arabic name is required"),
  phone:          z.string().min(7, "Enter a valid phone number"),
  password:       z.string().min(8, "Password must be at least 8 characters"),
  branch_id:      z.string().min(1, "Select a branch"),
  role_id:        z.string().min(1, "Select a role"),
  monthly_salary: z.number().nullable(),
  currency:       z.string(),
  effective_from: z.date().nullable(),
  paid_days_off:  z.number().int().min(0).max(30),
})

const editSchema = z.object({
  full_name:      z.string().min(2, "Name must be at least 2 characters"),
  email:          z.string().email("Enter a valid email"),
  phone:          z.string(),
  new_password:   z.string().min(8, "Minimum 8 characters").or(z.literal("")),
  branch_id:      z.string().min(1, "Select a branch"),
  role_id:        z.string().min(1, "Select a role"),
  monthly_salary: z.number().nullable(),
  currency:       z.string(),
  effective_from: z.date().nullable(),
  paid_days_off:  z.number().int().min(0).max(30),
})

type CreateValues = z.infer<typeof createSchema>
type EditValues   = z.infer<typeof editSchema>

// ── Create content ────────────────────────────────────────────

function CreateContent({
  onClose,
  roles,
  branches,
}: {
  onClose: () => void
  roles: { id: string; name: string; level: number }[]
  branches: { id: string; name: string }[]
}) {
  const { accountId } = useAuth()
  const createMulti = useCreateMemberMultiBranch()
  const [calendarOpen, setCalendarOpen] = useState(false)

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      full_name: "", name_ar: "", phone: "", password: "",
      branch_id: "", role_id: "",
      monthly_salary: null, currency: "EGP",
      effective_from: new Date(), paid_days_off: 4,
    },
  })

  const watchedRoleId  = form.watch("role_id")
  const selectedRole   = roles.find((r) => r.id === watchedRoleId)
  const needsSalary    = selectedRole ? selectedRole.level > 2 : false

  async function onSubmit(values: CreateValues) {
    if (needsSalary && values.monthly_salary === null) {
      form.setError("monthly_salary", { message: "Salary is required for this role" })
      return
    }
    try {
      const generatedEmail = `${values.phone.replace(/\D/g, "")}@staff.charlies.app`
      const profileId = await createAuthUser(
        generatedEmail,
        values.password,
        values.full_name.trim(),
        values.phone.trim()
      )

      const profileUpdates: Record<string, unknown> = { account_id: accountId }
      if (values.name_ar?.trim()) profileUpdates.name_ar = values.name_ar.trim()
      await supabase.from("profiles").update(profileUpdates).eq("id", profileId)

      await createMulti.mutateAsync({
        branchIds:      [values.branch_id],
        profileId,
        roleIds:        [values.role_id],
        monthly_salary: needsSalary ? values.monthly_salary : null,
        currency:       values.currency as SalaryCurrency,
        effective_from: (values.effective_from ?? new Date()).toISOString().slice(0, 10),
        paid_days_off:  needsSalary ? values.paid_days_off : 0,
      })

      toast.success("Staff created")
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create staff")
    }
  }

  return (
    <>
      <SheetHeader className="border-b px-6 py-4">
        <SheetTitle className="text-start">New Staff</SheetTitle>
        <SheetDescription className="text-start">
          Create an account and assign them to a branch
        </SheetDescription>
      </SheetHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* Personal info */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Personal Info</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Account details for the new staff member</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Ahmed Mostafa" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name_ar"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Arabic Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input dir="rtl" lang="ar" placeholder="أحمد مصطفى" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="010 0000 0000" autoComplete="off" {...field} />
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
                    <FormLabel>Initial Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Role & Branch */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Role & Branch</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="role_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select role…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roles.length === 0
                            ? <div className="px-2 py-1.5 text-sm text-muted-foreground">No roles available</div>
                            : roles.map((r) => (
                                <SelectItem key={r.id} value={r.id} className="capitalize">
                                  {r.name.replace(/_/g, " ")}
                                </SelectItem>
                              ))
                          }
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="branch_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select branch…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {branches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            <SalarySection
              control={form.control}
              required={needsSalary}
              calendarOpen={calendarOpen}
              onCalendarOpen={setCalendarOpen}
            />
          </div>

          <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMulti.isPending}>
              {createMulti.isPending ? "Creating…" : "Create Staff"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  )
}

// ── Edit content ──────────────────────────────────────────────

function EditContent({
  groupedMember,
  onClose,
  roles,
  branches,
}: {
  groupedMember: GroupedMember
  onClose: () => void
  roles: { id: string; name: string; level: number }[]
  branches: { id: string; name: string }[]
}) {
  const updateMember  = useUpdateMember()
  const removeMember  = useRemoveMember()
  const createMulti   = useCreateMemberMultiBranch()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const primary = groupedMember.assignments[0]
  const primaryRoleId = primary?.role_ids?.[0] ?? primary?.role_id ?? ""

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      full_name:      groupedMember.full_name ?? "",
      email:          groupedMember.email     ?? "",
      phone:          groupedMember.phone     ?? "",
      new_password:   "",
      branch_id:      primary?.branch_id      ?? "",
      role_id:        primaryRoleId,
      monthly_salary: primary?.salary?.monthly_salary ?? null,
      currency:       primary?.salary?.currency       ?? "EGP",
      effective_from: new Date(),
      paid_days_off:  primary?.salary?.paid_days_off  ?? 4,
    },
  })

  const watchedRoleId = form.watch("role_id")
  const selectedRole  = roles.find((r) => r.id === watchedRoleId)
  const needsSalary   = selectedRole ? selectedRole.level > 2 : false
  const isSaving = updateMember.isPending || removeMember.isPending || createMulti.isPending

  async function onSubmit(values: EditValues) {
    if (needsSalary && values.monthly_salary === null) {
      form.setError("monthly_salary", { message: "Salary is required for this role" })
      return
    }

    try {
      // 1. Update profile name + phone
      await supabase
        .from("profiles")
        .update({ full_name: values.full_name.trim(), phone: values.phone.trim() || null })
        .eq("id", groupedMember.profile_id)

      // 2. Update email / password via admin API (requires service role key)
      const authChanges: { email?: string; password?: string } = {}
      if (values.email.trim() !== groupedMember.email) authChanges.email = values.email.trim()
      if (values.new_password) authChanges.password = values.new_password

      if (Object.keys(authChanges).length > 0) {
        if (!supabaseAdmin) {
          toast.error("Add VITE_SUPABASE_SERVICE_ROLE_KEY to .env to update email/password")
          return
        }
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(
          groupedMember.profile_id,
          authChanges
        )
        if (authErr) throw authErr
      }

      // 3. Branch / role / salary
      const effectiveFrom = (values.effective_from ?? new Date()).toISOString().slice(0, 10)
      const salaryPayload = {
        monthly_salary: needsSalary ? values.monthly_salary : null,
        currency:       values.currency as SalaryCurrency,
        effective_from: effectiveFrom,
        paid_days_off:  needsSalary ? values.paid_days_off : 0,
      }

      if (primary && primary.branch_id === values.branch_id) {
        // Branch unchanged — update in place
        await updateMember.mutateAsync({
          memberId:  primary.id,
          branchId:  primary.branch_id,
          profileId: groupedMember.profile_id,
          roleIds:   [values.role_id],
          ...salaryPayload,
        })
      } else {
        // Branch changed — remove all old assignments, create new one
        for (const a of groupedMember.assignments) {
          await removeMember.mutateAsync(a.id)
        }
        await createMulti.mutateAsync({
          branchIds: [values.branch_id],
          profileId: groupedMember.profile_id,
          roleIds:   [values.role_id],
          ...salaryPayload,
        })
      }

      toast.success("Staff updated")
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    }
  }

  return (
    <>
      <SheetHeader className="border-b px-6 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {getInitials(groupedMember.full_name)}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <SheetTitle className="text-start">{groupedMember.full_name ?? "Staff"}</SheetTitle>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {groupedMember.is_admin && (
                <Badge variant="default" className="text-xs gap-1">
                  <Shield className="h-3 w-3" />Owner
                </Badge>
              )}
              {groupedMember.phone && (
                <span className="text-xs text-muted-foreground">{groupedMember.phone}</span>
              )}
            </div>
          </div>
        </div>
      </SheetHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* Personal info */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Personal Info</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Name and phone update instantly · password requires service role key</p>
              </div>

              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Ahmed Mostafa" autoComplete="off" {...field} />
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
                    <FormLabel>Mobile</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="010 0000 0000" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="new_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password <span className="text-muted-foreground font-normal">(leave blank to keep current)</span></FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className="pe-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Role & Branch */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Role & Branch</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="role_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select role…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roles.length === 0
                            ? <div className="px-2 py-1.5 text-sm text-muted-foreground">No roles available</div>
                            : roles.map((r) => (
                                <SelectItem key={r.id} value={r.id} className="capitalize">
                                  {r.name.replace(/_/g, " ")}
                                </SelectItem>
                              ))
                          }
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="branch_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select branch…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {branches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            <SalarySection
              control={form.control}
              required={needsSalary}
              calendarOpen={calendarOpen}
              onCalendarOpen={setCalendarOpen}
            />
          </div>

          <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  )
}

// ── Public API ────────────────────────────────────────────────

export type MemberSheetMode =
  | { type: "create" }
  | { type: "edit"; groupedMember: GroupedMember }

export function MemberSheet({
  mode,
  onClose,
}: {
  mode: MemberSheetMode | null
  onClose: () => void
}) {
  const isMobile = useIsMobile()
  const { isAdmin } = useAuth()
  const { roleLevel } = useUserPermissions()
  const { data: branches  = [] } = useGetBranches()
  const { data: allRoles  = [] } = useGetRoles()

  // System roles (is_system=true, e.g. Owner) and roles hidden from assignment are never shown in selectors.
  // Non-admins can only assign roles with higher level numbers than their own.
  const assignableRoles = allRoles.filter((r) => !r.is_system && !r.hidden_from_assignment)
  const roles = isAdmin
    ? assignableRoles
    : assignableRoles.filter((r) => r.level > roleLevel)

  return (
    <Sheet open={mode !== null} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-2xl"
        )}
      >
        {mode?.type === "create" && (
          <CreateContent onClose={onClose} roles={roles} branches={branches} />
        )}
        {mode?.type === "edit" && (
          <EditContent
            groupedMember={mode.groupedMember}
            onClose={onClose}
            roles={roles}
            branches={branches}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
