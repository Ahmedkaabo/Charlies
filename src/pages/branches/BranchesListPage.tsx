import { useState, useMemo } from "react"
import { Plus, Store, MapPin, MoreHorizontal, Pencil, Copy, Trash2, Search } from "lucide-react"
import { toast } from "sonner"

import { useIsMobile } from "@/hooks/use-mobile"
import { useAuth } from "@/hooks/useAuth"
import { useUserPermissions } from "@/hooks/usePermissions"
import { useMyBranches } from "@/hooks/useAttendance"
import {
  useGetBranches,
  useGetBranchCounts,
  useDeleteBranch,
  useDuplicateBranch,
  useGetBranch,
  useUpdateBranch,
  useCreateBranch,
} from "@/hooks/useBranches"
import type { Branch } from "@/types/branch"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/LanguageContext"
import { useLocalName } from "@/lib/format"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

import { BranchDetailPanel } from "./BranchDetailPage"
import { BranchForm } from "./BranchForm"
import type { BranchFormValues } from "./BranchForm"

// ── Drawer state ──────────────────────────────────────────────

type DrawerState =
  | { type: "none" }
  | { type: "create" }
  | { type: "view"; id: string }
  | { type: "edit"; id: string }

// ── Helper components ─────────────────────────────────────────

function BranchCreateContent({
  onDone,
  onCancel,
}: {
  onDone: (newId: string) => void
  onCancel: () => void
}) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const createBranch = useCreateBranch()

  async function handleSubmit(values: BranchFormValues) {
    if (!user) return
    try {
      const branch = await createBranch.mutateAsync({ ...values, owner_id: user.id })
      toast.success(t("Branch created!"))
      onDone(branch.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to create branch"))
      throw err
    }
  }

  return <BranchForm onSubmit={handleSubmit} onCancel={onCancel} submitLabel={t("Create Branch")} />
}

function BranchEditContent({
  branchId,
  onDone,
  onCancel,
}: {
  branchId: string
  onDone: () => void
  onCancel: () => void
}) {
  const { t } = useLanguage()
  const { data: branch, isLoading } = useGetBranch(branchId)
  const updateBranch = useUpdateBranch(branchId)

  async function handleSubmit(values: BranchFormValues) {
    try {
      await updateBranch.mutateAsync(values)
      toast.success(t("Branch updated!"))
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to update branch"))
      throw err
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }
  if (!branch) return null

  return (
    <BranchForm
      defaultValues={{
        name: branch.name,
        name_ar: branch.name_ar ?? "",
        address: branch.address ?? "",
        city: branch.city ?? "",
        phone: branch.phone ?? "",
        is_active: branch.is_active,
        latitude: branch.latitude,
        longitude: branch.longitude,
        location_radius_meters: branch.location_radius_meters,
      }}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      submitLabel={t("Save Changes")}
    />
  )
}

// ── Page ──────────────────────────────────────────────────────

export function BranchesListPage() {
  const { t } = useLanguage()
  const ln = useLocalName()
  const isMobile = useIsMobile()
  const { isAdmin, profile } = useAuth()
  const { canCreate, canUpdate, canDelete: canDeletePerm } = useUserPermissions()
  const { data: allBranches, isLoading, isError } = useGetBranches()
  const { data: myBranches = [] } = useMyBranches(profile?.id)
  // Admins always see all branches; non-admins are scoped to their own
  const branches = isAdmin ? allBranches : myBranches

  const canAddBranch    = canCreate("branches")
  const canEditBranch   = canUpdate("branches")
  const canDeleteBranch = canDeletePerm("branches")
  const hasActions      = canEditBranch || canDeleteBranch
  const { data: counts } = useGetBranchCounts()
  const deleteBranch    = useDeleteBranch()
  const duplicateBranch = useDuplicateBranch()
  const [pendingDelete, setPendingDelete] = useState<Branch | null>(null)
  const [drawer, setDrawer] = useState<DrawerState>({ type: "none" })

  const [search, setSearch] = useState("")

  const activeCount = branches?.filter((b) => b.is_active).length ?? 0

  const filtered = useMemo(() => {
    const list = branches ?? []
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.city?.toLowerCase().includes(q) ||
        b.address?.toLowerCase().includes(q),
    )
  }, [branches, search])

  const activeId = drawer.type !== "none" && drawer.type !== "create" ? drawer.id : null
  const activeBranch = branches?.find((b) => b.id === activeId) ?? null

  async function handleDelete() {
    if (!pendingDelete) return
    try {
      await deleteBranch.mutateAsync(pendingDelete.id)
      toast.success(t("Branch deleted"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to delete branch"))
    } finally {
      setPendingDelete(null)
    }
  }

  async function handleDuplicate(branch: Branch) {
    try {
      const copy = await duplicateBranch.mutateAsync(branch.id)
      toast.success(`"${copy.name}" ${t("created — inactive by default")}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to duplicate branch"))
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{t("Branches")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading
              ? t("Loading…")
              : `${branches?.length ?? 0} ${t("total")} · ${activeCount} ${t("active")}`}
          </p>
        </div>
        {canAddBranch && (
          <Button onClick={() => setDrawer({ type: "create" })}>
            <Plus className="h-4 w-4" />
            {t("Add Branch")}
          </Button>
        )}
      </div>

      {/* ── Search ──────────────────────────────────────── */}
      {!isLoading && !!branches?.length && (
        <div className="relative w-full sm:w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t("Search branches…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      )}

      {/* ── Error ───────────────────────────────────────── */}
      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {t("Failed to load branches. Please refresh and try again.")}
        </div>
      )}

      {/* ── Empty ───────────────────────────────────────── */}
      {!isLoading && !isError && branches?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Store className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">{t("No branches found")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("Add your first branch to get started")}</p>
          </div>
          <Button onClick={() => setDrawer({ type: "create" })}>
            <Plus className="h-4 w-4" />
            {t("Add Branch")}
          </Button>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────── */}
      {(isLoading || (branches && branches.length > 0)) && (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground whitespace-nowrap sticky start-0 z-10 bg-muted/40 relative after:pointer-events-none after:absolute after:end-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']">{t("Branch")}</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground whitespace-nowrap">{t("Location")}</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground whitespace-nowrap">{t("Shifts")}</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground whitespace-nowrap">{t("Owners")}</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground whitespace-nowrap">{t("Staff")}</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground whitespace-nowrap">{t("Status")}</th>
                {hasActions && <th className="px-4 py-3 w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 text-start sticky start-0 z-10 bg-background relative after:pointer-events-none after:absolute after:end-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']"><Skeleton className="h-4 w-36" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-8" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-8" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-8" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      {hasActions && <td className="px-4 py-3" />}
                    </tr>
                  ))
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={hasActions ? 7 : 6} className="px-4 py-3">
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <Store className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{t("No branches found")}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t("Try adjusting your search")}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                  : filtered.map((branch) => (
                    <tr
                      key={branch.id}
                      className="hover:bg-muted/30 cursor-pointer group"
                      onClick={() => setDrawer({ type: "view", id: branch.id })}
                    >
                      <td className="px-4 py-3 font-medium text-start sticky start-0 z-10 bg-background sm:group-hover:bg-muted/30 relative after:pointer-events-none after:absolute after:end-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']">
                        {branch.name}
                        {branch.name_ar && (
                          <span className="ml-2 text-xs text-muted-foreground" dir="rtl">
                            {branch.name_ar}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {branch.latitude !== null ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {branch.location_radius_meters}{t("m radius")}
                          </span>
                        ) : (
                          t("Not set")
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {counts?.get(branch.id)?.shifts ?? 0}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {counts?.get(branch.id)?.owners ?? 0}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {counts?.get(branch.id)?.members ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={branch.is_active ? "default" : "secondary"}>
                          {branch.is_active ? t("Active") : t("Inactive")}
                        </Badge>
                      </td>
                      {hasActions && (
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canEditBranch && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDrawer({ type: "edit", id: branch.id })
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                  {t("Edit")}
                                </DropdownMenuItem>
                              )}
                              {canAddBranch && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDuplicate(branch)
                                  }}
                                >
                                  <Copy className="h-4 w-4" />
                                  {t("Duplicate")}
                                </DropdownMenuItem>
                              )}
                              {canDeleteBranch && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setPendingDelete(branch)
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    {t("Delete")}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      )}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Branch Sheet ────────────────────────────────── */}
      <Sheet
        open={drawer.type !== "none"}
        onOpenChange={(open) => { if (!open) setDrawer({ type: "none" }) }}
      >
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-xl"
          )}
        >
          {/* Dynamic header */}
          <SheetHeader className="shrink-0 border-b px-6 py-4">
            {drawer.type === "create" && (
              <>
                <SheetTitle className="text-left">{t("New Branch")}</SheetTitle>
                <SheetDescription className="text-left">
                  {t("Add a new location to your network")}
                </SheetDescription>
              </>
            )}
            {(drawer.type === "view" || drawer.type === "edit") && activeBranch && (
              <>
                {drawer.type === "view" ? (
                  <div className="space-y-1.5 min-w-0">
                    <SheetTitle className="text-left">{ln(activeBranch.name, activeBranch.name_ar)}</SheetTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={activeBranch.is_active ? "default" : "secondary"}>
                        {activeBranch.is_active ? t("Active") : t("Inactive")}
                      </Badge>
                      {activeBranch.city && (
                        <span className="text-sm text-muted-foreground">{activeBranch.city}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <SheetTitle className="text-left">{t("Edit Branch")}</SheetTitle>
                    <SheetDescription className="text-left">{activeBranch.name}</SheetDescription>
                  </>
                )}
              </>
            )}
            {(drawer.type === "view" || drawer.type === "edit") && !activeBranch && (
              <SheetTitle className="text-left">
                <Skeleton className="h-5 w-40" />
              </SheetTitle>
            )}
          </SheetHeader>

          {/* Dynamic content */}
          {drawer.type === "create" && (
            <BranchCreateContent
              onDone={(newId) => setDrawer({ type: "view", id: newId })}
              onCancel={() => setDrawer({ type: "none" })}
            />
          )}
          {drawer.type === "view" && (
            <>
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <BranchDetailPanel
                  branchId={drawer.id}
                  onEdit={() =>
                    setDrawer({ type: "edit", id: (drawer as { type: "view"; id: string }).id })
                  }
                />
              </div>
              <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-end">
                <Button
                  variant="outline"
                  onClick={() =>
                    setDrawer({ type: "edit", id: (drawer as { type: "view"; id: string }).id })
                  }
                >
                  <Pencil className="h-4 w-4" />
                  {t("Edit Branch")}
                </Button>
              </div>
            </>
          )}
          {drawer.type === "edit" && (
            <BranchEditContent
              branchId={drawer.id}
              onDone={() =>
                setDrawer({ type: "view", id: (drawer as { type: "edit"; id: string }).id })
              }
              onCancel={() =>
                setDrawer({ type: "view", id: (drawer as { type: "edit"; id: string }).id })
              }
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete confirm ──────────────────────────────── */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete branch?")}</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.name}" {t("and all its associated data will be permanently deleted. This action cannot be undone.")}
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
    </div>
  )
}
