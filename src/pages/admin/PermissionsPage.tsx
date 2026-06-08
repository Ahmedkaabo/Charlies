import { useState } from "react"
import {
  ShieldCheck, Plus, Pencil, Trash2, Check, X, ChevronRight,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

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
      can_read:          "View balance summary pools",
      can_see_treasury:  "See main treasury details & cards",
      can_move_treasury: "Move money to/from main treasury",
      can_create:        "Add internal pool transfers (Sales/Exp)",
      can_update:        "Edit existing transfers",
      can_delete:        "Delete transfers",
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

const RESOURCE_ORDER: Resource[] = [
  "branches", "staff", "checkin", "attendance", "payroll", "expenses", "sales", "finance", "balance", "settings", "permissions", "owners",
]

// ── Helpers ───────────────────────────────────────────────────

function formatRoleName(name: string) {
  return name.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

// ── Add-role dialog ───────────────────────────────────────────

const roleSchema = z.object({
  name: z.string().min(1, "Required").regex(/^[a-z_]+$/, "Lowercase & underscores only"),
})
type RoleFormValues = z.infer<typeof roleSchema>

function AddRoleDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const createRole = useCreateRole()
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: "" },
  })

  async function onSubmit(values: RoleFormValues) {
    try {
      await createRole.mutateAsync({ ...values, level: 5 })
      toast.success("Role created")
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create role")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>New Role</DialogTitle>
          <DialogDescription>
            Roles group permissions together and can be assigned to branch staff.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="branch_manager" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRole.isPending}>
                {createRole.isPending ? "Creating…" : "Create Role"}
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
      toast.error(err instanceof Error ? err.message : "Failed to rename")
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

  // System roles cannot be renamed
  if (role.is_system) {
    return <SheetTitle className="text-left">{formatRoleName(role.name)}</SheetTitle>
  }

  return (
    <div className="flex items-center gap-1.5">
      <SheetTitle className="text-left">{formatRoleName(role.name)}</SheetTitle>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0 text-muted-foreground"
        onClick={() => setEditing(true)}
        title="Rename"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ── Resource section ──────────────────────────────────────────

function ResourceSection({ role, resource }: { role: Role; resource: Resource }) {
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
      toast.error("Failed to save permission")
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
        can_move_treasury: value && "can_move_treasury" in meta.actions,
        can_see_treasury:  value && "can_see_treasury"  in meta.actions,
      })
    } catch {
      toast.error("Failed to save permissions")
    }
  }

  return (
    <div className="rounded-lg border divide-y divide-border">
      <div className="flex items-center gap-3 px-5 py-3 bg-muted/40">
        <Checkbox
          checked={headerChecked}
          onCheckedChange={(v) => handleToggleAll(v === true)}
        />
        <span className="text-sm font-semibold">{meta.label}</span>
      </div>

      {applicableFields.map(({ key }) => (
        <div key={key} className="flex items-center gap-3 px-5 py-3">
          <Checkbox
            checked={existing?.[key] ?? false}
            onCheckedChange={(v) => handleToggle(key, v === true)}
          />
          <span className="text-sm">{meta.actions[key]}</span>
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
  const isMobile   = useIsMobile()
  const deleteRole = useDeleteRole()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [localName, setLocalName]         = useState<string | null>(null)

  const displayName = localName ?? (role ? role.name : "")

  async function handleDelete() {
    if (!role) return
    try {
      await deleteRole.mutateAsync(role.id)
      toast.success(`"${formatRoleName(role.name)}" deleted`)
      setConfirmDelete(false)
      onDeleted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  return (
    <>
      <Sheet open={role !== null} onOpenChange={(v) => { if (!v) { onClose(); setLocalName(null) } }}>
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
                <div className="space-y-1.5">
                  <RenameField
                    role={{ ...role, name: displayName }}
                    onSaved={setLocalName}
                  />
                  <SheetDescription className="text-xs">
                    Changes save automatically
                  </SheetDescription>
                </div>
              </SheetHeader>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {RESOURCE_ORDER.map((resource, i) => (
                  <div key={resource}>
                    {i > 0 && <Separator className="mb-6" />}
                    <ResourceSection role={role} resource={resource} />
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between gap-3">
                {role?.is_system ? (
                  <span className="text-xs text-muted-foreground">System role — cannot be deleted</span>
                ) : (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Role
                  </Button>
                )}
                <Button variant="outline" onClick={() => { onClose(); setLocalName(null) }}>
                  Close
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
            <AlertDialogTitle>Delete role?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{role ? formatRoleName(role.name) : ""}</strong> will be removed.
              Branch staff assigned this role will lose it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Role card ─────────────────────────────────────────────────

function RoleCard({ role, onClick }: { role: Role; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group block w-full text-left">
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3.5 transition-shadow group-hover:shadow-md">
        <span className="flex-1 min-w-0 text-sm font-medium truncate">
          {formatRoleName(role.name)}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
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
  const { data: roles, isLoading } = useGetRoles()
  const [activeRole, setActiveRole] = useState<Role | null>(null)
  const [addOpen, setAddOpen]       = useState(false)

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-xl">

      {/* ── Header ─────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold">Roles & Permissions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Select a role to configure its permissions.
        </p>
      </div>

      {/* ── Admin note ─────────────────────────────── */}
      <div className="flex items-center gap-2.5 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span>
          <span className="font-medium text-foreground">Owner</span> always has full access
          and is not affected by role permissions.
        </span>
      </div>

      {/* ── Roles list ─────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">Roles</h2>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Role
          </Button>
        </div>

        {isLoading ? (
          <RolesListSkeleton />
        ) : (
          <div className="space-y-2">
            {roles?.filter((r) => !r.is_system || r.name === "Branch Owner").map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                onClick={() => setActiveRole(role)}
              />
            ))}
            {!roles?.length && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No roles yet. Add one to get started.
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
