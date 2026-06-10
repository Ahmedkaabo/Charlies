import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { CalendarIcon, Shield, Check, ChevronsUpDown, Eye, EyeOff } from "lucide-react"
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
import { salaryRequired } from "@/types/member"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

// ── Multi-role select ─────────────────────────────────────────

function MultiRoleSelect({
  roles,
  selectedIds,
  onChange,
}: {
  roles: { id: string; name: string; level: number }[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)

  const selected = roles.filter((r) => selectedIds.includes(r.id))
  const label =
    selected.length === 0
      ? "Select roles…"
      : selected.length === 1
      ? selected[0].name.replace(/_/g, " ")
      : `${selected.length} roles`

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal">
          <span className={selected.length === 0 ? "text-muted-foreground capitalize" : "capitalize"}>{label}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: "var(--radix-popover-trigger-width)" }}
        align="start"
      >
        <div className="max-h-52 overflow-y-auto py-1">
          {roles.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No roles available</p>
          )}
          {roles.map((r) => {
            const checked = selectedIds.includes(r.id)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggle(r.id)}
                className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm hover:bg-muted"
              >
                <div className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                )}>
                  {checked && <Check className="h-3 w-3" />}
                </div>
                <span className="capitalize">{r.name.replace(/_/g, " ")}</span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── Multi-branch dropdown ─────────────────────────────────────

function MultiBranchSelect({
  branches,
  selectedIds,
  onChange,
  singleOnly = false,
  placeholder = "Select branches…",
}: {
  branches: { id: string; name: string }[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  singleOnly?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)

  const label =
    selectedIds.length === 0
      ? placeholder
      : selectedIds.length === 1
      ? (branches.find((b) => b.id === selectedIds[0])?.name ?? placeholder)
      : `${selectedIds.length} branches selected`

  function toggle(id: string) {
    if (singleOnly) {
      onChange([id])
      setOpen(false)
    } else {
      onChange(
        selectedIds.includes(id)
          ? selectedIds.filter((x) => x !== id)
          : [...selectedIds, id]
      )
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal">
          <span className={selectedIds.length === 0 ? "text-muted-foreground" : ""}>{label}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: "var(--radix-popover-trigger-width)" }}
        align="start"
      >
        <div className="max-h-52 overflow-y-auto py-1">
          {branches.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No branches available</p>
          )}
          {branches.map((b) => {
            const checked = selectedIds.includes(b.id)
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => toggle(b.id)}
                className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm hover:bg-muted"
              >
                <div className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                )}>
                  {checked && <Check className="h-3 w-3" />}
                </div>
                {b.name}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
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
          Salary{required && <span className="text-destructive ml-1">*</span>}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {required ? "Required for this role" : "Not required for admin / owner"}
        </p>
      </div>

      {required ? (
        <>
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
                      <SelectItem value="EGP">EGP</SelectItem>
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
                      <Button variant="outline" className="w-full justify-start text-left">
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
        </>
      ) : (
        <p className="text-xs text-muted-foreground italic">No salary record needed</p>
      )}
    </div>
  )
}

// ── Schemas ───────────────────────────────────────────────────

const baseSchema = z.object({
  role_ids:       z.array(z.string()).min(1, "Select at least one role"),
  monthly_salary: z.number().nullable(),
  currency:       z.string(),
  effective_from: z.date().nullable(),
  paid_days_off:  z.number().int().min(0).max(30),
})

const createSchema = z.object({
  full_name:      z.string().min(2, "Name must be at least 2 characters"),
  name_ar:        z.string(),
  email:          z.string().email("Enter a valid email"),
  phone:          z.string().min(7, "Enter a valid phone number"),
  password:       z.string().min(8, "Password must be at least 8 characters"),
  role_ids:       z.array(z.string()).min(1, "Select at least one role"),
  monthly_salary: z.number().nullable(),
  currency:       z.string(),
  effective_from: z.date().nullable(),
  paid_days_off:  z.number().int().min(0).max(30),
})

const editSchema = baseSchema.extend({
  full_name:    z.string().min(2, "Name must be at least 2 characters"),
  email:        z.string().email("Enter a valid email"),
  phone:        z.string(),
  new_password: z.string().min(8, "Minimum 8 characters").or(z.literal("")),
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
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])
  const [branchError, setBranchError]             = useState("")

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      full_name: "", name_ar: "", email: "", phone: "", password: "",
      role_ids: [], monthly_salary: null, currency: "EGP",
      effective_from: new Date(), paid_days_off: 4,
    },
  })

  const watchedRoleIds = form.watch("role_ids")
  const selectedRoles  = roles.filter((r) => watchedRoleIds.includes(r.id))
  const minLevel       = selectedRoles.length > 0 ? Math.min(...selectedRoles.map((r) => r.level)) : null
  const needsSalary    = minLevel !== null && minLevel > 2
  const isSingleBranch = minLevel !== null && minLevel >= 3

  async function onSubmit(values: CreateValues) {
    if (selectedBranchIds.length === 0) {
      setBranchError("Select at least one branch")
      return
    }
    if (needsSalary && !values.monthly_salary) {
      form.setError("monthly_salary", { message: "Salary is required for this role" })
      return
    }
    try {
      const profileId = await createAuthUser(
        values.email.trim(),
        values.password,
        values.full_name.trim(),
        values.phone.trim()
      )

      const profileUpdates: Record<string, unknown> = { account_id: accountId }
      if (values.name_ar?.trim()) profileUpdates.name_ar = values.name_ar.trim()
      await supabase.from("profiles").update(profileUpdates).eq("id", profileId)

      await createMulti.mutateAsync({
        branchIds:      selectedBranchIds,
        profileId,
        roleIds:        values.role_ids,
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
        <SheetTitle className="text-left">New Staff</SheetTitle>
        <SheetDescription className="text-left">
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
                      <FormLabel>Arabic Name</FormLabel>
                      <FormControl>
                        <Input
                          dir="rtl"
                          lang="ar"
                          placeholder="أحمد مصطفى"
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" autoComplete="off" {...field} />
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
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="010 0000 0000" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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

            {/* Role first, then Branch */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Role & Branch</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Role determines if multi-branch is allowed</p>
              </div>

              <FormField
                control={form.control}
                name="role_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <MultiRoleSelect
                        roles={roles}
                        selectedIds={field.value}
                        onChange={(ids) => {
                          field.onChange(ids)
                          const lvl = ids.length > 0 ? Math.min(...roles.filter(r => ids.includes(r.id)).map(r => r.level)) : null
                          if (lvl !== null && lvl >= 3 && selectedBranchIds.length > 1) {
                            setSelectedBranchIds(selectedBranchIds.slice(0, 1))
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-1.5">
                <label className="text-sm font-medium leading-none">Branch</label>
                <MultiBranchSelect
                  branches={branches}
                  selectedIds={selectedBranchIds}
                  onChange={(ids) => { setSelectedBranchIds(ids); setBranchError("") }}
                  singleOnly={isSingleBranch}
                  placeholder="Select branch…"
                />
                {isSingleBranch && (
                  <p className="text-xs text-muted-foreground">This role is limited to one branch</p>
                )}
                {branchError && (
                  <p className="text-sm font-medium text-destructive">{branchError}</p>
                )}
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
  const [calendarOpen,   setCalendarOpen]   = useState(false)
  const [showPassword,   setShowPassword]   = useState(false)

  const primary = groupedMember.assignments[0]

  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(
    () => groupedMember.assignments.map((a) => a.branch_id)
  )

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      full_name:      groupedMember.full_name ?? "",
      email:          groupedMember.email     ?? "",
      phone:          groupedMember.phone     ?? "",
      new_password:   "",
      role_ids:       primary?.role_ids?.length ? primary.role_ids : (primary?.role_id ? [primary.role_id] : []),
      monthly_salary: primary?.salary?.monthly_salary ?? null,
      currency:       primary?.salary?.currency       ?? "EGP",
      effective_from: new Date(),
      paid_days_off:  primary?.salary?.paid_days_off  ?? 4,
    },
  })

  const watchedRoleIds   = form.watch("role_ids")
  const selectedRoles    = roles.filter((r) => watchedRoleIds.includes(r.id))
  const minLevel         = selectedRoles.length > 0 ? Math.min(...selectedRoles.map((r) => r.level)) : null
  const needsSalary      = minLevel !== null ? minLevel > 2 : salaryRequired({
    profile: { is_admin: groupedMember.is_admin } as never,
    role:    primary?.role ?? null,
  })
  const isSingleBranch = minLevel !== null && minLevel >= 3
  const isSaving = updateMember.isPending || removeMember.isPending || createMulti.isPending

  async function onSubmit(values: EditValues) {
    if (selectedBranchIds.length === 0) return
    if (needsSalary && !values.monthly_salary) {
      form.setError("monthly_salary", { message: "Salary is required for this role" })
      return
    }

    try {
      // 1. Update profile name + phone (always works)
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

      // 3. Branch / role / salary mutations
      const oldIds    = groupedMember.assignments.map((a) => a.branch_id)
      const toAdd     = selectedBranchIds.filter((id) => !oldIds.includes(id))
      const toRemove  = groupedMember.assignments.filter((a) => !selectedBranchIds.includes(a.branch_id))
      const toUpdate  = groupedMember.assignments.filter((a) =>  selectedBranchIds.includes(a.branch_id))
      const effectiveFrom = (values.effective_from ?? new Date()).toISOString().slice(0, 10)

      for (const a of toRemove) await removeMember.mutateAsync(a.id)

      if (toAdd.length > 0) {
        await createMulti.mutateAsync({
          branchIds:      toAdd,
          profileId:      groupedMember.profile_id,
          roleIds:        values.role_ids,
          monthly_salary: needsSalary ? values.monthly_salary : null,
          currency:       values.currency as SalaryCurrency,
          effective_from: effectiveFrom,
          paid_days_off:  needsSalary ? values.paid_days_off : 0,
        })
      }

      for (const a of toUpdate) {
        await updateMember.mutateAsync({
          memberId:       a.id,
          branchId:       a.branch_id,
          profileId:      groupedMember.profile_id,
          roleIds:        values.role_ids,
          monthly_salary: needsSalary ? values.monthly_salary : null,
          currency:       values.currency as SalaryCurrency,
          effective_from: effectiveFrom,
          paid_days_off:  needsSalary ? values.paid_days_off : 0,
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
            <SheetTitle className="text-left">{groupedMember.full_name ?? "Staff"}</SheetTitle>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {groupedMember.is_admin && (
                <Badge variant="default" className="text-xs gap-1">
                  <Shield className="h-3 w-3" />Owner
                </Badge>
              )}
              {groupedMember.email && (
                <span className="text-xs text-muted-foreground truncate">{groupedMember.email}</span>
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
                <p className="text-xs text-muted-foreground mt-0.5">Name updates instantly · email/password require service role key</p>
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

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" autoComplete="off" {...field} />
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
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="010 0000 0000" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                          className="pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword
                            ? <EyeOff className="h-4 w-4" />
                            : <Eye    className="h-4 w-4" />
                          }
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
                <p className="text-xs text-muted-foreground mt-0.5">Where and in what capacity</p>
              </div>

              <FormField
                control={form.control}
                name="role_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <MultiRoleSelect
                        roles={roles}
                        selectedIds={field.value}
                        onChange={(ids) => {
                          field.onChange(ids)
                          const lvl = ids.length > 0 ? Math.min(...roles.filter(r => ids.includes(r.id)).map(r => r.level)) : null
                          if (lvl !== null && lvl >= 3 && selectedBranchIds.length > 1) {
                            setSelectedBranchIds(selectedBranchIds.slice(0, 1))
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-1.5">
                <label className="text-sm font-medium leading-none">Branch</label>
                <MultiBranchSelect
                  branches={branches}
                  selectedIds={selectedBranchIds}
                  onChange={(ids) => {
                    setSelectedBranchIds(isSingleBranch ? ids.slice(0, 1) : ids)
                  }}
                  singleOnly={isSingleBranch}
                  placeholder="Select branch…"
                />
                {isSingleBranch && (
                  <p className="text-xs text-muted-foreground">This role is limited to one branch</p>
                )}
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
