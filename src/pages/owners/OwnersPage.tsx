import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Minus, Pencil, Trash2, Check, ChevronsUpDown, MoreHorizontal, Users, ShieldCheck, Phone, Languages } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

import {
  useGetOwners,
  useCreateOwner,
  useAddOwnerToBranch,
  useRemoveOwnerFromBranch,
  useDeleteOwner,
  useSetOwnerManagerStatus,
  useUpdateOwnerRoles,
} from "@/hooks/useOwners"
import { useOwnershipByProfile, useUpsertOwnership } from "@/hooks/useBranchOwnership"
import { useGetBranches } from "@/hooks/useBranches"
import { useGetRoles, useUserPermissions } from "@/hooks/usePermissions"
import type { Owner } from "@/types/owner"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// ── Helpers ───────────────────────────────────────────────────

function getInitials(name?: string | null) {
  if (!name) return "??"
  const p = name.trim().split(/\s+/)
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0].slice(0, 2).toUpperCase()
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
          <span className={cn("capitalize", selected.length === 0 && "text-muted-foreground")}>{label}</span>
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

// ── Multi-branch select ───────────────────────────────────────

function MultiBranchSelect({
  branches,
  selectedIds,
  onChange,
}: {
  branches: { id: string; name: string }[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)

  const label =
    selectedIds.length === 0
      ? "Select branches…"
      : selectedIds.length === 1
      ? (branches.find((b) => b.id === selectedIds[0])?.name ?? "1 branch")
      : `${selectedIds.length} branches selected`

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
                onClick={() =>
                  onChange(
                    checked ? selectedIds.filter((x) => x !== b.id) : [...selectedIds, b.id]
                  )
                }
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

// ── Add Owner sheet ───────────────────────────────────────────

const createSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  name_ar:   z.string(),
  phone:     z.string().min(7, "Enter a valid phone number"),
  password:  z.string().min(8, "Password must be at least 8 characters"),
  role_ids:  z.array(z.string()).min(1, "Select at least one role"),
})
type CreateValues = z.infer<typeof createSchema>

function AddOwnerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const isMobile = useIsMobile()
  const { data: branches = [] } = useGetBranches()
  const { data: allRoles = [] } = useGetRoles()
  const createOwner = useCreateOwner()

  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { full_name: "", name_ar: "", phone: "", password: "", role_ids: [] },
  })

  async function onSubmit(values: CreateValues) {
    try {
      await createOwner.mutateAsync({
        full_name:  values.full_name,
        name_ar:    values.name_ar || null,
        phone:      values.phone,
        password:   values.password,
        branchIds:  selectedBranchIds,
        roleIds:    values.role_ids,
      })
      toast.success("Owner created")
      form.reset()
      setSelectedBranchIds([])
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create owner")
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn("flex flex-col gap-0 overflow-hidden p-0", isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-lg")}
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="text-left">New Owner</SheetTitle>
          <SheetDescription className="text-left">Create an owner account with branch access</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Personal Info</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Account details for the new owner</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="full_name" render={({ field }) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl>
                      <Input placeholder="Ahmed Mostafa" autoComplete="off" {...field} />
                    </FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="name_ar" render={({ field }) => (
                    <FormItem><FormLabel>Arabic Name</FormLabel><FormControl>
                      <Input dir="rtl" lang="ar" placeholder="أحمد مصطفى" autoComplete="off" {...field} />
                    </FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone</FormLabel><FormControl>
                    <Input type="tel" placeholder="010 0000 0000" autoComplete="off" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Initial Password</FormLabel><FormControl>
                    <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Role</h3>
                </div>
                <FormField control={form.control} name="role_ids" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <MultiRoleSelect
                        roles={allRoles}
                        selectedIds={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Branch Access</h3>
                </div>

                {/* Branch multi-select */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium leading-none">
                    Branches
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <MultiBranchSelect
                    branches={branches}
                    selectedIds={selectedBranchIds}
                    onChange={setSelectedBranchIds}
                  />
                  <p className="text-xs text-muted-foreground">
                    You can assign branches later from this page.
                  </p>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between gap-3">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={createOwner.isPending}>
                {createOwner.isPending ? "Creating…" : "Add Owner"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

// ── Owner sheet (details + roles + branches) ──────────────────

function OwnerSheet({
  profileId,
  open,
  onClose,
  canEdit,
}: {
  profileId: string
  open: boolean
  onClose: () => void
  canEdit: boolean
}) {
  const isMobile = useIsMobile()
  const { data: owners = [] }      = useGetOwners()
  const { data: allBranches = [] } = useGetBranches()
  const { data: ownerships = [] }  = useOwnershipByProfile(profileId)
  const { data: allRoles = [] }    = useGetRoles()
  const addBranch    = useAddOwnerToBranch()
  const removeBranch = useRemoveOwnerFromBranch()
  const updateStocks = useUpsertOwnership()
  const updateRoles  = useUpdateOwnerRoles()

  const [pendingBranchId, setPendingBranchId] = useState<string | null>(null)
  const [pendingStocks,   setPendingStocks]   = useState("")
  const [stockDrafts,     setStockDrafts]     = useState<Record<string, string>>({})

  const user            = owners.find((u) => u.profile_id === profileId)
  const assignedIds     = new Set(user?.branches.map((b) => b.branch_id) ?? [])
  const availableBranches = allBranches.filter((b) => !assignedIds.has(b.id))
  const assignableRoles = allRoles

  // Current roles from the owner record
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(() => user?.role_ids ?? [])

  // Sync when user data loads
  if (user && JSON.stringify(user.role_ids) !== JSON.stringify(selectedRoleIds) && !updateRoles.isPending) {
    setSelectedRoleIds(user.role_ids ?? [])
  }

  async function handleRoleChange(ids: string[]) {
    setSelectedRoleIds(ids)
    try {
      await updateRoles.mutateAsync({ profileId, roleIds: ids })
    } catch {
      toast.error("Failed to update roles")
    }
  }

  function ownershipFor(branchId: string) {
    return ownerships.find((o) => o.branch_id === branchId)
  }

  function stockDraft(branchId: string) {
    const current = ownershipFor(branchId)?.stocks ?? 0
    return branchId in stockDrafts ? stockDrafts[branchId] : String(current > 0 ? current : 1)
  }

  async function handleSaveStocks(branchId: string) {
    const n = parseFloat(stockDrafts[branchId] ?? "")
    const current = ownershipFor(branchId)?.stocks ?? 0
    if (isNaN(n) || n < 1 || n === current) return
    try {
      await updateStocks.mutateAsync({ branch_id: branchId, profile_id: profileId, stocks: n })
      setStockDrafts((d) => { const c = { ...d }; delete c[branchId]; return c })
    } catch {
      toast.error("Failed to update stocks")
    }
  }

  function adjustStocks(branchId: string, delta: number) {
    const current = parseFloat(stockDraft(branchId)) || 1
    const next    = Math.max(1, current + delta)
    setStockDrafts((d) => ({ ...d, [branchId]: String(next) }))
    updateStocks
      .mutateAsync({ branch_id: branchId, profile_id: profileId, stocks: next })
      .then(() => setStockDrafts((d) => { const c = { ...d }; delete c[branchId]; return c }))
      .catch(() => toast.error("Failed to update stocks"))
  }

  async function handleAdd() {
    const n = parseFloat(pendingStocks)
    if (!pendingBranchId || isNaN(n) || n <= 0) return
    try {
      await addBranch.mutateAsync({ profileId, branchId: pendingBranchId, stocks: n, roleIds: selectedRoleIds })
      toast.success("Branch added")
      setPendingBranchId(null)
      setPendingStocks("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add branch")
    }
  }

  async function handleRemove(assignmentId: string, branchId: string, branchName: string) {
    try {
      await removeBranch.mutateAsync({ assignmentId, branchId, profileId })
      toast.success(`Removed from ${branchName}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove branch")
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn("flex flex-col gap-0 overflow-hidden p-0", isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-lg")}
      >
        {/* ── Header ────────────────────────────── */}
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              {getInitials(user?.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-left">{user?.full_name ?? "Owner"}</SheetTitle>
                {user?.is_master && (
                  <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground shrink-0">
                    master
                  </span>
                )}
              </div>
              <SheetDescription className="text-left space-y-0.5 mt-0.5">
                {user?.phone && (
                  <span className="flex items-center gap-1.5 text-xs">
                    <Phone className="h-3 w-3 shrink-0" />
                    {user.phone}
                  </span>
                )}
                {user?.name_ar && (
                  <span className="flex items-center gap-1.5 text-xs" dir="rtl" lang="ar">
                    <Languages className="h-3 w-3 shrink-0" style={{ direction: "ltr" }} />
                    {user.name_ar}
                  </span>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* ── Roles ─────────────────────────────── */}
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Roles</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Determines permissions across all branches</p>
              </div>

              {user?.is_master ? (
                <div className="space-y-1.5">
                  <span className="inline-flex rounded-md border border-amber-400/30 bg-amber-400/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-xs font-medium">
                    Full Access
                  </span>
                  <p className="text-xs text-muted-foreground">Master account has unrestricted access to all modules.</p>
                </div>
              ) : canEdit ? (
                <MultiRoleSelect
                  roles={assignableRoles}
                  selectedIds={selectedRoleIds}
                  onChange={handleRoleChange}
                />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedRoleIds.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No roles assigned</p>
                  ) : (
                    assignableRoles
                      .filter((r) => selectedRoleIds.includes(r.id))
                      .map((r) => (
                        <span key={r.id} className="rounded-md border border-primary/30 bg-primary/5 text-primary px-2 py-0.5 text-xs font-medium capitalize">
                          {r.name.replace(/_/g, " ")}
                        </span>
                      ))
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* ── Assigned branches ─────────────────── */}
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Branch Access & Equity</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Stocks represent ownership share per branch</p>
              </div>

              {user?.branches.length === 0 && (
                <p className="text-sm text-muted-foreground">No branches assigned yet.</p>
              )}

              <div className="space-y-2">
                {user?.branches.map((b) => {
                  const draft   = stockDraft(b.branch_id)
                  const current = ownershipFor(b.branch_id)?.stocks ?? 0
                  const dirty   = draft !== "" && parseFloat(draft) !== current
                  return (
                    <div key={b.assignment_id} className="flex items-center gap-3 rounded-lg border px-4 py-2.5">
                      <span className="flex-1 text-sm font-medium truncate">{b.branch_name}</span>
                      {canEdit && (
                        <>
                          <div className="flex items-center shrink-0 rounded-md border overflow-hidden h-8">
                            <button
                              type="button"
                              className="px-2 h-full flex items-center border-r text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
                              disabled={updateStocks.isPending}
                              onClick={() => adjustStocks(b.branch_id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              className="w-10 text-center text-sm bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                              value={draft}
                              onChange={(e) => setStockDrafts((d) => ({ ...d, [b.branch_id]: e.target.value }))}
                              onBlur={() => dirty && handleSaveStocks(b.branch_id)}
                              onKeyDown={(e) => e.key === "Enter" && dirty && handleSaveStocks(b.branch_id)}
                            />
                            <button
                              type="button"
                              className="px-2 h-full flex items-center border-l text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
                              disabled={updateStocks.isPending}
                              onClick={() => adjustStocks(b.branch_id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <Button
                            size="icon" variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                            disabled={removeBranch.isPending}
                            onClick={() => handleRemove(b.assignment_id, b.branch_id, b.branch_name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* ── Add branch ──────────────────────── */}
              {canEdit && availableBranches.length > 0 && (
                <div className="space-y-2">
                  {availableBranches.map((b) => (
                    pendingBranchId === b.id ? (
                      <div key={b.id} className="rounded-lg border p-3 space-y-2">
                        <p className="text-sm font-medium">{b.name}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center rounded-md border overflow-hidden h-8">
                            <button
                              type="button"
                              className="px-2 h-full flex items-center border-r text-muted-foreground hover:bg-muted transition-colors"
                              onClick={() => setPendingStocks((v) => String(Math.max(1, (parseInt(v) || 1) - 1)))}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              autoFocus
                              className="w-10 text-center text-sm bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                              value={pendingStocks}
                              onChange={(e) => setPendingStocks(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                            />
                            <button
                              type="button"
                              className="px-2 h-full flex items-center border-l text-muted-foreground hover:bg-muted transition-colors"
                              onClick={() => setPendingStocks((v) => String((parseInt(v) || 0) + 1))}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <Button size="sm" onClick={handleAdd} disabled={!pendingStocks || addBranch.isPending}>
                            Add
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setPendingBranchId(null); setPendingStocks("1") }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        key={b.id}
                        type="button"
                        disabled={addBranch.isPending || !!pendingBranchId}
                        onClick={() => { setPendingBranchId(b.id); setPendingStocks("1") }}
                        className="flex w-full items-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                        {b.name}
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>

          </div>

          <div className="shrink-0 border-t bg-background px-6 py-4 flex justify-end">
            <Button variant="outline" onClick={onClose}>Done</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Main page ─────────────────────────────────────────────────

export function OwnersPage() {
  const { canCreate, canUpdate, canDelete: canDeletePerm } = useUserPermissions()
  const canAddOwner    = canCreate("owners")
  const canEditOwner   = canUpdate("owners")
  const canDeleteOwner = canDeletePerm("owners")

  const { data: users, isLoading, isError } = useGetOwners()
  const { data: allRoles = [] }             = useGetRoles()
  const deleteUser     = useDeleteOwner()
  const setManagerStatus = useSetOwnerManagerStatus()

  const [addOpen, setAddOpen]           = useState(false)
  const [editTarget, setEditTarget]     = useState<Owner | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Owner | null>(null)

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteUser.mutateAsync(deleteTarget.profile_id)
      toast.success(`${deleteTarget.full_name ?? "User"} removed`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove user")
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* ── Header ───────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Owners</h1>
          {users && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {users.length} {users.length === 1 ? "owner" : "owners"}
            </p>
          )}
        </div>
        {canAddOwner && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Owner
          </Button>
        )}
      </div>

      {/* ── Error ────────────────────────────────────── */}
      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load users. Please try again.
        </div>
      )}

      {/* ── Table ────────────────────────────────────── */}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap w-52 sticky left-0 z-10 bg-muted/40 relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']">Owner</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Branches</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap w-36">Role</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap w-32">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Manager
                </div>
              </th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {/* Loading */}
            {isLoading && Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3 sticky left-0 z-10 bg-background relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']"><div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-28" /></div></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
                <td className="px-4 py-3"><Skeleton className="h-5 w-9 rounded-full" /></td>
                <td className="px-4 py-3"><Skeleton className="h-7 w-14" /></td>
              </tr>
            ))}

            {/* Empty */}
            {!isLoading && !isError && users?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-3">
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">No owners found</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Add your first owner to get started</p>
                    </div>
                    {canAddOwner && (
                      <Button onClick={() => setAddOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Add Owner
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {/* Rows */}
            {!isLoading && users?.map((user) => {
              return (
                <tr key={user.profile_id} className="hover:bg-muted/30 cursor-pointer group" onClick={() => setEditTarget(user)}>
                  {/* User */}
                  <td className="px-4 py-3 sticky left-0 z-10 bg-background sm:group-hover:bg-muted/30 relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {getInitials(user.full_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{user.full_name ?? "—"}</p>
                          {user.is_master && (
                            <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground shrink-0">
                              master
                            </span>
                          )}
                        </div>
                        {user.phone && (
                          <p className="text-xs text-muted-foreground">{user.phone}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Branches */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex gap-1">
                      {user.branches.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No branches</span>
                      ) : user.branches.map((b) => (
                        <span
                          key={b.assignment_id}
                          className="rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                        >
                          {b.branch_name}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {user.is_master ? (
                      <span className="rounded-md border border-amber-400/30 bg-amber-400/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                        Full Access
                      </span>
                    ) : (() => {
                      const roles = allRoles.filter((r) => user.role_ids.includes(r.id))
                      if (roles.length === 0) return <span className="text-xs text-muted-foreground">—</span>
                      return (
                        <div className="flex gap-1">
                          {roles.map((r) => (
                            <span key={r.id} className="rounded-md border border-primary/30 bg-primary/5 text-primary px-2 py-0.5 text-xs font-medium capitalize whitespace-nowrap">
                              {r.name.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      )
                    })()}
                  </td>

                  {/* Manager toggle */}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={user.is_fee_manager}
                      disabled={setManagerStatus.isPending || !canEditOwner}
                      onCheckedChange={(checked) =>
                        canEditOwner && setManagerStatus.mutate({ profileId: user.profile_id, isFeeManager: checked })
                      }
                    />
                  </td>

                  {/* Actions */}
                  {(canEditOwner || canDeleteOwner) && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canEditOwner && (
                              <DropdownMenuItem onClick={() => setEditTarget(user)}>
                                <Pencil className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {canDeleteOwner && !user.is_master && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(user)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Add sheet ────────────────────────────────── */}
      <AddOwnerSheet open={addOpen} onClose={() => setAddOpen(false)} />

      {/* ── Owner sheet ──────────────────────────────── */}
      {editTarget && (
        <OwnerSheet
          profileId={editTarget.profile_id}
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          canEdit={canEditOwner}
        />
      )}

      {/* ── Delete confirmation ───────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove owner?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.full_name ?? "This owner"}</strong> will be removed from all
              branches. Their account is kept and can be re-added later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
