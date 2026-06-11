import { useState } from "react"
import {
  ShieldCheck, Plus, Pencil, Trash2, Check, X, ChevronRight,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useLocalName } from "@/lib/format"
import { useIsMobile } from "@/hooks/use-mobile"
import { useLanguage } from "@/contexts/LanguageContext"

import {
  useGetRoles,
  useGetPermissions,
  useUpsertPermission,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  findPermission,
  buildToggled,
} from "@/hooks/usePermissions"
import { CRUD_FIELDS } from "@/types/permission"
import type { Role, Resource, CrudField } from "@/types/permission"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Switch } from "@/components/ui/switch"

// ── Resource metadata ─────────────────────────────────────────

interface ResourceMeta {
  label: string
  actions: Partial<Record<CrudField, string>>
}

const RESOURCE_META: Record<Resource, ResourceMeta> = {
  branches: {
    label: "Branches",
    actions: {
      can_read:   "View branch list & details",
      can_create: "Create new branches",
      can_update: "Edit branch settings & shifts",
      can_delete: "Delete branches",
    },
  },
  staff: {
    label: "Staff",
    actions: {
      can_read:   "View staff list & profiles",
      can_create: "Add staff to branches",
      can_update: "Edit staff roles & salary",
      can_delete: "Remove staff from branches",
    },
  },
  checkin: {
    label: "Check-in",
    actions: {
      can_read:   "View own attendance history",
      can_create: "Check in to a shift",
      can_update: "Check out from a shift",
    },
  },
  attendance: {
    label: "Attendance",
    actions: {
      can_read:   "View own attendance records only",
      can_create: "View all staff records in assigned branches",
      can_update: "Export attendance to CSV",
      can_delete: "Edit & delete attendance records",
    },
  },
  payroll: {
    label: "Payroll",
    actions: {
      can_read:   "View own payroll record only",
      can_create: "View all staff payroll & financial analytics",
      can_update: "Add bonuses, deductions & adjustments",
      can_delete: "Delete payroll adjustments",
    },
  },
  expenses: {
    label: "Expenses",
    actions: {
      can_read:   "View expense records",
      can_create: "Submit new expenses",
      can_update: "Edit expenses & view analytics charts",
      can_delete: "Delete expenses",
    },
  },
  sales: {
    label: "Sales",
    actions: {
      can_read:   "View daily sales records",
      can_create: "Log new sales entries",
      can_update: "Edit sales records & lock / unlock days",
    },
  },
  finance: {
    label: "Finance",
    actions: {
      can_read:   "View revenue, expenses, profit & owner payouts",
      can_create: "Add credit / debit adjustments",
      can_update: "Manage branch ownership & stocks",
      can_delete: "Delete finance adjustments",
    },
  },
  balance: {
    label: "Balance",
    actions: {
      can_read: "View balance summary (sales, expenses & remaining)",
    },
  },
  branch_breakdown: {
    label: "Branch Breakdown",
    actions: {
      can_read: "View per-branch balance breakdown table",
    },
  },
  treasury: {
    label: "Main Treasury",
    actions: {
      can_read:   "View Main Treasury card & total",
      can_create: "Move money to / from main treasury",
      can_update: "Edit treasury transfers",
      can_delete: "Delete treasury transfers",
    },
  },
  pool_transfers: {
    label: "Pool Transfers",
    actions: {
      can_read:   "View transfers between sales & expenses pools",
      can_create: "Move money between sales and expenses pools",
      can_update: "Edit pool transfer records",
      can_delete: "Delete pool transfer records",
    },
  },
  settings: {
    label: "Settings",
    actions: {
      can_read:   "View system settings",
      can_update: "Change system settings",
    },
  },
  permissions: {
    label: "Roles & Permissions",
    actions: {
      can_read:   "View roles & permissions",
      can_create: "Create new roles",
      can_update: "Edit role permissions",
      can_delete: "Delete roles",
    },
  },
  owners: {
    label: "Owners",
    actions: {
      can_read:   "View business owners",
      can_create: "Add new owners",
      can_update: "Edit owner assignments",
      can_delete: "Remove owners",
    },
  },
}

const RESOURCE_GROUPS: { label: string; resources: Resource[] }[] = [
  {
    label: "Staff & Operations",
    resources: ["branches", "staff", "checkin", "attendance", "payroll"],
  },
  {
    label: "Financial",
    resources: ["expenses", "sales", "finance"],
  },
  {
    label: "Balance & Treasury",
    resources: ["balance", "branch_breakdown", "treasury", "pool_transfers"],
  },
  {
    label: "System",
    resources: ["settings", "permissions", "owners"],
  },
]

// ── Helpers ───────────────────────────────────────────────────

function formatRoleName(name: string) {
  return name.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

// ── Add-role dialog ───────────────────────────────────────────

const roleSchema = z.object({
  name: z.string().min(1, "Required").regex(/^[a-z_]+$/, "Lowercase & underscores only"),
  name_ar: z.string().optional(),
  hidden_from_assignment: z.boolean(),
})
type RoleFormValues = z.infer<typeof roleSchema>

function AddRoleDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { t } = useLanguage()
  const createRole = useCreateRole()
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: "", name_ar: "", hidden_from_assignment: false },
  })

  async function onSubmit(values: RoleFormValues) {
    try {
      await createRole.mutateAsync({ ...values, name_ar: values.name_ar?.trim() || null, level: 5 })
      toast.success(t("Role created"))
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to create role"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("New Role")}</DialogTitle>
          <DialogDescription>
            {t("Roles group permissions together and can be assigned to branch staff.")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Name")}</FormLabel>
                  <FormControl>
                    <Input placeholder="branch_manager" {...field} />
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
                  <FormLabel>{t("Arabic Name")}</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: مدير الفرع" dir="rtl" lang="ar" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hidden_from_assignment"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm">{t("Hide from staff assignment")}</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t("This role won't appear when assigning roles to staff members.")}
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={createRole.isPending}>
                {createRole.isPending ? t("Creating…") : t("Create Role")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ── Rename field ──────────────────────────────────────────────

function RenameField({
  role,
  onSaved,
}: {
  role: Role
  onSaved: (newName: string) => void
}) {
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(role.name)
  const updateRole = useUpdateRole(role.id)

  function cancel() {
    setValue(role.name)
    setEditing(false)
  }

  async function save() {
    const trimmed = value.trim()
    if (!trimmed || trimmed === role.name) { cancel(); return }
    try {
      await updateRole.mutateAsync({ name: trimmed })
      onSaved(trimmed)
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to rename"))
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter")  save()
            if (e.key === "Escape") cancel()
          }}
          className="h-8 text-base font-semibold"
          autoFocus
        />
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={save} disabled={updateRole.isPending}>
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={cancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <SheetTitle className="text-left">{formatRoleName(role.name)}</SheetTitle>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0 text-muted-foreground"
        onClick={() => setEditing(true)}
        title={t("Rename")}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ── Resource section ──────────────────────────────────────────

function ResourceSection({ role, resource }: { role: Role; resource: Resource }) {
  const { t } = useLanguage()
  const { data: permissions } = useGetPermissions()
  const upsert   = useUpsertPermission()
  const existing = findPermission(permissions, role.id, resource)
  const meta     = RESOURCE_META[resource]

  // Only render fields that have a defined label for this resource
  const applicableFields = CRUD_FIELDS.filter(({ key }) => meta.actions[key] !== undefined)

  const allOn  = applicableFields.every(({ key }) => existing?.[key] ?? false)
  const someOn = applicableFields.some(({ key }) => existing?.[key] ?? false)
  const headerChecked = allOn ? true : someOn ? "indeterminate" : false

  async function handleToggle(field: CrudField, value: boolean) {
    try {
      await upsert.mutateAsync(buildToggled(existing, role.id, resource, field, value))
    } catch {
      toast.error(t("Failed to save permission"))
    }
  }

  async function handleToggleAll(value: boolean) {
    try {
      await upsert.mutateAsync({
        role_id:    role.id,
        resource,
        can_read:   value && "can_read"   in meta.actions,
        can_create: value && "can_create" in meta.actions,
        can_update: value && "can_update" in meta.actions,
        can_delete: value && "can_delete" in meta.actions,
      })
    } catch {
      toast.error(t("Failed to save permissions"))
    }
  }

  return (
    <div className="rounded-lg border divide-y divide-border">
      <div className="flex items-center gap-3 px-5 py-3 bg-muted/40">
        <Checkbox
          checked={headerChecked}
          onCheckedChange={(v) => handleToggleAll(v === true)}
        />
        <span className="text-sm font-semibold">{t(meta.label)}</span>
      </div>

      {applicableFields.map(({ key }) => (
        <div key={key} className="flex items-center gap-3 px-5 py-3">
          <Checkbox
            checked={existing?.[key] ?? false}
            onCheckedChange={(v) => handleToggle(key, v === true)}
          />
          <span className="text-sm">{t(meta.actions[key]!)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Role drawer ───────────────────────────────────────────────

function RoleDrawer({
  role,
  onClose,
  onDeleted,
}: {
  role: Role | null
  onClose: () => void
  onDeleted: () => void
}) {
  const { t } = useLanguage()
  const isMobile   = useIsMobile()
  const deleteRole = useDeleteRole()
  const updateRole = useUpdateRole(role?.id ?? "")
  const [confirmDelete, setConfirmDelete]           = useState(false)
  const [localName, setLocalName]                   = useState<string | null>(null)
  const [localHidden, setLocalHidden]               = useState<boolean | null>(null)
  const [nameArValue, setNameArValue]               = useState(role?.name_ar ?? "")

  const displayName   = localName   ?? (role ? role.name : "")
  const displayHidden = localHidden ?? (role?.hidden_from_assignment ?? false)

  async function handleNameArBlur() {
    if (!role) return
    const trimmed = nameArValue.trim()
    const current = role.name_ar ?? ""
    if (trimmed === current) return
    try {
      await updateRole.mutateAsync({ name_ar: trimmed || null })
    } catch {
      setNameArValue(current)
      toast.error(t("Failed to update role"))
    }
  }

  async function handleToggleHidden(value: boolean) {
    if (!role) return
    setLocalHidden(value)
    try {
      await updateRole.mutateAsync({ hidden_from_assignment: value })
    } catch {
      setLocalHidden(!value)
      toast.error(t("Failed to update role"))
    }
  }

  async function handleDelete() {
    if (!role) return
    try {
      await deleteRole.mutateAsync(role.id)
      toast.success(`"${formatRoleName(role.name)}" ${t("deleted")}`)
      setConfirmDelete(false)
      onDeleted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to delete"))
    }
  }

  return (
    <>
      <Sheet open={role !== null} onOpenChange={(v) => { if (!v) { onClose(); setLocalName(null); setLocalHidden(null); setNameArValue("") } }}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-lg"
          )}
        >
          {role && (
            <>
              {/* Header */}
              <SheetHeader className="border-b px-6 py-4">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <RenameField
                      role={{ ...role, name: displayName }}
                      onSaved={setLocalName}
                    />
                    <input
                      className="w-full text-sm text-muted-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-0.5 transition-colors"
                      value={nameArValue}
                      onChange={(e) => setNameArValue(e.target.value)}
                      onBlur={handleNameArBlur}
                      placeholder={t("Arabic Name")}
                      dir="rtl"
                      lang="ar"
                    />
                    <SheetDescription className="text-xs">
                      {t("Changes save automatically")}
                    </SheetDescription>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{t("Hide from staff assignment")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("This role won't appear when assigning roles to staff members.")}
                      </p>
                    </div>
                    <Switch
                      checked={displayHidden}
                      onCheckedChange={handleToggleHidden}
                      disabled={updateRole.isPending}
                    />
                  </div>
                </div>
              </SheetHeader>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {RESOURCE_GROUPS.map((group, gi) => (
                  <div key={group.label} className="space-y-3">
                    {gi > 0 && <Separator className="mb-3" />}
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                      {t(group.label)}
                    </p>
                    {group.resources.map((resource) => (
                      <ResourceSection key={resource} role={role} resource={resource} />
                    ))}
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("Delete Role")}
                </Button>
                <Button variant="outline" onClick={() => { onClose(); setLocalName(null) }}>
                  {t("Close")}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete role?")}</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{role ? formatRoleName(role.name) : ""}</strong>{" "}
              {t("will be removed. Branch staff assigned this role will lose it. This cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Role card ─────────────────────────────────────────────────

function RoleCard({ role, onClick }: { role: Role; onClick: () => void }) {
  const ln = useLocalName()
  return (
    <button onClick={onClick} className="group block w-full text-left">
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3.5 transition-shadow group-hover:shadow-md">
        <span className="flex-1 min-w-0 text-sm font-medium truncate">
          {ln(formatRoleName(role.name), role.name_ar)}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
      </div>
    </button>
  )
}

// ── Skeleton ──────────────────────────────────────────────────

function RolesListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border px-4 py-3.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-4 ml-auto" />
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function PermissionsPage() {
  const { t } = useLanguage()
  const { data: roles, isLoading } = useGetRoles()
  const [activeRole, setActiveRole] = useState<Role | null>(null)
  const [addOpen, setAddOpen]       = useState(false)

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-xl">

      {/* ── Header ─────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold">{t("Roles & Permissions")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("Select a role to configure its permissions.")}
        </p>
      </div>

      {/* ── Admin note ─────────────────────────────── */}
      <div className="flex items-center gap-2.5 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span>
          <span className="font-medium text-foreground">{t("Owner")}</span>{" "}
          {t("always has full access and is not affected by role permissions.")}
        </span>
      </div>

      {/* ── Roles list ─────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">{t("Roles")}</h2>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("Add Role")}
          </Button>
        </div>

        {isLoading ? (
          <RolesListSkeleton />
        ) : (
          <div className="space-y-2">
            {roles?.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                onClick={() => setActiveRole(role)}
              />
            ))}
            {!roles?.length && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("No roles yet. Add one to get started.")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Role drawer ────────────────────────────── */}
      <RoleDrawer
        role={activeRole}
        onClose={() => setActiveRole(null)}
        onDeleted={() => setActiveRole(null)}
      />

      {/* ── Add role dialog ─────────────────────────── */}
      <AddRoleDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
