import { useState } from "react"
import { useParams, Link, useSearchParams } from "react-router-dom"
import {
  ChevronLeft,
  MapPin,
  ExternalLink,
  Phone,
  Building2,
  Calendar,
  Users,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Clock,
  AlertCircle,
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { useLanguage } from "@/contexts/LanguageContext"

import { useGetBranch, useGetBranchMembers } from "@/hooks/useBranches"
import { useBranchOwnership } from "@/hooks/useBranchOwnership"
import {
  useGetBranchShifts,
  useCreateShift,
  useUpdateShift,
  useDeleteShift,
} from "@/hooks/useBranchShifts"
import type { BranchShift } from "@/types/branch"
import { formatShiftTime } from "@/lib/attendance"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
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
import { ShiftForm } from "./ShiftForm"
import type { ShiftFormValues } from "./ShiftForm"

// ── Helpers ───────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return "??"
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase()
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  )
}

// ── Shift card ────────────────────────────────────────────────

function ShiftCard({
  shift,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  shift: BranchShift
  onEdit: (s: BranchShift) => void
  onDuplicate: (s: BranchShift) => void
  onDelete: (s: BranchShift) => void
}) {
  const { t } = useLanguage()

  return (
    <Card className="py-0">
      <CardContent className="p-5 space-y-4">

        {/* ── Title row ───────────────────────────────── */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-semibold truncate">{shift.name}</p>
            <Badge
              variant={shift.is_active ? "default" : "secondary"}
              className="shrink-0"
            >
              {shift.is_active ? t("Active") : t("Inactive")}
            </Badge>
          </div>
          <div className="flex items-center gap-0.5 shrink-0 -mt-1 -mr-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title={t("Duplicate shift")}
              onClick={() => onDuplicate(shift)}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title={t("Edit shift")}
              onClick={() => onEdit(shift)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              title={t("Delete shift")}
              onClick={() => onDelete(shift)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* ── Time ────────────────────────────────────── */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="font-medium tabular-nums">
            {formatShiftTime(shift.shift_start)} – {formatShiftTime(shift.shift_end)}
          </span>
          <span className="text-muted-foreground">
            · ±{shift.checkin_window_minutes} {t("min window")}
          </span>
        </div>

        {/* ── Attendance tiers ────────────────────────── */}
        <div className="overflow-hidden rounded-lg border text-xs">
          <div className="grid grid-cols-3 divide-x divide-border text-center">
            <div className="px-2 py-2.5">
              <p className="text-muted-foreground">{"< "}{shift.full_day_hours}h</p>
              <p className="font-semibold mt-0.5">{t("0 days")}</p>
            </div>
            <div className="px-2 py-2.5 bg-muted/20">
              <p className="text-muted-foreground">
                {shift.full_day_hours}–{shift.overtime_hours}h
              </p>
              <p className="font-semibold mt-0.5">{t("1.0 day")}</p>
            </div>
            <div className="px-2 py-2.5">
              <p className="text-muted-foreground">≥ {shift.overtime_hours}h</p>
              <p className="font-semibold mt-0.5">{t("1.5 days")}</p>
            </div>
          </div>
        </div>

        {/* ── Late penalty ────────────────────────────── */}
        {shift.late_deduction_enabled &&
          shift.late_per_minutes &&
          shift.late_deduct_hours ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span className="text-amber-800 dark:text-amber-300">
              {t("Late deduction: every")} {shift.late_per_minutes} {t("min late")}
              {shift.late_grace_minutes > 0
                ? ` (${t("after")} ${shift.late_grace_minutes} ${t("min grace")})`
                : ""}
              {" "}→ −{shift.late_deduct_hours}h
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ── Shifts tab ────────────────────────────────────────────────

type ShiftSheet =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit"; shift: BranchShift }

function ShiftsTab({ branchId }: { branchId: string }) {
  const { t } = useLanguage()
  const isMobile = useIsMobile()
  const { data: shifts, isLoading, isError, error } = useGetBranchShifts(branchId)
  const createShift = useCreateShift()
  const [sheet, setSheet] = useState<ShiftSheet>({ type: "none" })
  const [deleting, setDeleting] = useState<BranchShift | null>(null)

  const editShift = useUpdateShift(
    sheet.type === "edit" ? sheet.shift.id : "",
    branchId
  )
  const deleteShift = useDeleteShift(branchId)

  async function handleCreate(values: ShiftFormValues) {
    await createShift.mutateAsync({ ...values, branch_id: branchId })
    toast.success(t("Shift created!"))
    setSheet({ type: "none" })
  }

  async function handleUpdate(values: ShiftFormValues) {
    await editShift.mutateAsync(values)
    toast.success(t("Shift updated!"))
    setSheet({ type: "none" })
  }

  async function handleDuplicate(shift: BranchShift) {
    try {
      await createShift.mutateAsync({
        branch_id:              branchId,
        name:                   `${shift.name} (Copy)`,
        shift_start:            shift.shift_start,
        shift_end:              shift.shift_end,
        checkin_window_minutes: shift.checkin_window_minutes,
        full_day_hours:         shift.full_day_hours,
        overtime_hours:         shift.overtime_hours,
        late_grace_minutes:     shift.late_grace_minutes,
        late_deduction_enabled: shift.late_deduction_enabled,
        late_per_minutes:       shift.late_per_minutes,
        late_deduct_hours:      shift.late_deduct_hours,
        is_active:              false,
      })
      toast.success(t("Shift duplicated — it's inactive by default"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to duplicate shift"))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteShift.mutateAsync(deleting.id)
      toast.success(t("Shift deleted"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to delete shift"))
    } finally {
      setDeleting(null)
    }
  }

  if (isLoading) {
    return (
      <div className="mt-4 grid grid-cols-1 gap-3">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {t("Failed to load shifts:")}
        {" "}
        {error instanceof Error ? error.message : t("Unknown error")}
      </div>
    )
  }

  return (
    <>
      {/* ── Toolbar ─────────────────────────────────── */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {shifts?.length ?? 0} {t("shift")}{shifts?.length !== 1 ? t("s") : ""}
        </p>
        <Button onClick={() => setSheet({ type: "create" })}>
          <Plus className="h-4 w-4" />
          {t("Add Shift")}
        </Button>
      </div>

      {/* ── Empty state ─────────────────────────────── */}
      {(!shifts || shifts.length === 0) && (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-lg border py-14 text-center">
          <div className="rounded-full bg-muted p-4">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">{t("No shifts yet")}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("Add a shift to define check-in windows and attendance rules")}
            </p>
          </div>
          <Button onClick={() => setSheet({ type: "create" })}>
            <Plus className="h-4 w-4" />
            {t("Add Shift")}
          </Button>
        </div>
      )}

      {/* ── Shift cards ─────────────────────────────── */}
      {shifts && shifts.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-3">
          {shifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              onEdit={(s) => setSheet({ type: "edit", shift: s })}
              onDuplicate={handleDuplicate}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      {/* ── Shift sheet (add / edit) ─────────────────── */}
      <Sheet
        open={sheet.type !== "none"}
        onOpenChange={(open) => { if (!open) setSheet({ type: "none" }) }}
      >
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-2xl"
          )}
        >
          <SheetHeader className="shrink-0 border-b px-6 py-4">
            <SheetTitle className="text-left">
              {sheet.type === "create" ? t("New Shift") : t("Edit Shift")}
            </SheetTitle>
            <SheetDescription className="text-left">
              {sheet.type === "create"
                ? t("Configure check-in times and attendance rules")
                : sheet.type === "edit"
                ? sheet.shift.name
                : ""}
            </SheetDescription>
          </SheetHeader>

          {sheet.type === "create" && (
            <ShiftForm
              onSubmit={handleCreate}
              onCancel={() => setSheet({ type: "none" })}
              submitLabel={t("Create Shift")}
            />
          )}
          {sheet.type === "edit" && (
            <ShiftForm
              defaultValues={{
                name:                   sheet.shift.name,
                shift_start:            sheet.shift.shift_start.slice(0, 5),
                shift_end:              sheet.shift.shift_end.slice(0, 5),
                checkin_window_minutes: sheet.shift.checkin_window_minutes,
                full_day_hours:         sheet.shift.full_day_hours,
                overtime_hours:         sheet.shift.overtime_hours,
                late_grace_minutes:     sheet.shift.late_grace_minutes,
                late_deduction_enabled: sheet.shift.late_deduction_enabled,
                late_per_minutes:       sheet.shift.late_per_minutes,
                late_deduct_hours:      sheet.shift.late_deduct_hours,
                is_active:              sheet.shift.is_active,
              }}
              onSubmit={handleUpdate}
              onCancel={() => setSheet({ type: "none" })}
              submitLabel={t("Save Changes")}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete confirm ───────────────────────────── */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete shift?")}</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.name}" {t("will be permanently deleted. Existing attendance logs linked to this shift will not be affected.")}
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

// ── Overview tab (details + location left, members right) ─────

function OverviewTab({ branchId, onEdit }: { branchId: string; onEdit?: () => void }) {
  const { t } = useLanguage()
  const { data: branch } = useGetBranch(branchId)
  const { data: members, isLoading: membersLoading } = useGetBranchMembers(branchId)

  if (!branch) return null

  const hasLocation = branch.latitude !== null && branch.longitude !== null

  return (
    <div className="mt-4 grid gap-4">

      {/* ── Left: Details + Location ──────────────────── */}
      <div className="space-y-4">

        {/* Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("Details")}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border pt-0">
            {branch.address && (
              <InfoRow icon={Building2} label={t("Address")} value={branch.address} />
            )}
            {branch.city && (
              <InfoRow icon={MapPin} label={t("City")} value={branch.city} />
            )}
            {branch.phone && (
              <InfoRow icon={Phone} label={t("Phone")} value={branch.phone} />
            )}
            <InfoRow
              icon={Calendar}
              label={t("Created")}
              value={format(new Date(branch.created_at), "d MMM yyyy")}
            />
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("Location")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {hasLocation ? (
              <div className="space-y-3">
                <div className="divide-y divide-border">
                  <InfoRow
                    icon={MapPin}
                    label={t("Coordinates")}
                    value={`${branch.latitude!.toFixed(6)}, ${branch.longitude!.toFixed(6)}`}
                  />
                  <InfoRow
                    icon={MapPin}
                    label={t("Check-in Radius")}
                    value={`${branch.location_radius_meters}m`}
                  />
                </div>
                <Separator />
                <a
                  href={`https://maps.google.com/?q=${branch.latitude},${branch.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("View on Google Maps")}
                </a>
                <p className="text-xs text-muted-foreground">
                  {t("Staff must be within")}{" "}
                  <span className="font-medium text-foreground">
                    {branch.location_radius_meters}m
                  </span>{" "}
                  {t("of this location to check in")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <MapPin className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t("No location set")}</p>
                {onEdit ? (
                  <Button variant="outline" onClick={onEdit}>{t("Add Location")}</Button>
                ) : (
                  <Button variant="outline" asChild>
                    <Link to={`/branches/${branchId}/edit`}>{t("Add Location")}</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Right: Staff ─────────────────────────────── */}
      <Card className="h-fit">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("Staff")}
            </CardTitle>
            {!membersLoading && (
              <span className="text-xs text-muted-foreground">
                {members?.length ?? 0}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-1">
          {membersLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg p-2">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </>
          ) : !members || members.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Users className="h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t("No staff yet")}</p>
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/40 transition-colors"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {getInitials(member.profile?.full_name)}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {member.profile?.full_name ?? t("Staff")}
                  </span>
                  {member.role && (
                    <span className="text-xs text-muted-foreground capitalize">
                      {member.role.name.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Owners tab — read-only equity view (managed from Owners module) ──

function OwnersTab({ branchId }: { branchId: string }) {
  const { t } = useLanguage()
  const { data: ownerships = [], isLoading } = useBranchOwnership(branchId)
  const totalStocks = ownerships.reduce((s, o) => s + o.stocks, 0)

  return (
    <div className="mt-4 space-y-3">
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-16 ml-auto" />
            </div>
          ))}
        </div>
      ) : ownerships.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border py-12 text-center">
          <Users className="h-7 w-7 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t("No ownership configured.")}</p>
          <p className="text-xs text-muted-foreground">{t("Assign owners and their equity from the Owners module.")}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {ownerships.length} {t("owner")}{ownerships.length !== 1 ? t("s") : ""} · {t("manage from the Owners module")}
          </p>
          <div className="space-y-2">
            {ownerships.map((o) => {
              const profile = o.profile as { full_name?: string | null } | null
              const pct     = totalStocks > 0 ? ((o.stocks / totalStocks) * 100).toFixed(1) : "0"
              return (
                <div key={o.id} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {getInitials(profile?.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{profile?.full_name ?? t("Unknown")}</p>
                    <p className="text-xs text-muted-foreground">{o.stocks} {t("stocks")} · {pct}% {t("equity")}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Panel (used inside a Sheet — no page chrome) ─────────────

export function BranchDetailPanel({
  branchId,
  onEdit,
}: {
  branchId: string
  onEdit?: () => void
}) {
  const { t } = useLanguage()
  const { data: branch, isLoading, isError } = useGetBranch(branchId)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (isError || !branch) {
    return (
      <p className="text-sm text-destructive">{t("Branch not found.")}</p>
    )
  }

  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">{t("Overview")}</TabsTrigger>
        <TabsTrigger value="shifts">{t("Shifts")}</TabsTrigger>
        <TabsTrigger value="owners">{t("Owners")}</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <OverviewTab branchId={branchId} onEdit={onEdit} />
      </TabsContent>
      <TabsContent value="shifts">
        <ShiftsTab branchId={branchId} />
      </TabsContent>
      <TabsContent value="owners">
        <OwnersTab branchId={branchId} />
      </TabsContent>
    </Tabs>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function BranchDetailPage() {
  const { t } = useLanguage()
  const { id = "" } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const defaultTab = searchParams.get("tab") ?? "overview"

  const { data: branch, isLoading, isError } = useGetBranch(id)

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (isError || !branch) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-sm text-destructive">{t("Branch not found.")}</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">

      {/* ── Header ──────────────────────────────────── */}
      <div>
        <Link
          to="/branches"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          {t("Branches")}
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">{branch.name}</h1>
            <div className="flex items-center gap-2">
              <Badge variant={branch.is_active ? "default" : "secondary"}>
                {branch.is_active ? t("Active") : t("Inactive")}
              </Badge>
              {branch.city && (
                <span className="text-sm text-muted-foreground">{branch.city}</span>
              )}
            </div>
          </div>
          <Button variant="outline" asChild className="shrink-0">
            <Link to={`/branches/${id}/edit`}>{t("Edit Branch")}</Link>
          </Button>
        </div>
      </div>

      <Separator />

      {/* ── Tabs ────────────────────────────────────── */}
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="overview">{t("Overview")}</TabsTrigger>
          <TabsTrigger value="shifts">{t("Shifts")}</TabsTrigger>
          <TabsTrigger value="owners">{t("Owners")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab branchId={id} />
        </TabsContent>

        <TabsContent value="shifts">
          <ShiftsTab branchId={id} />
        </TabsContent>

        <TabsContent value="owners">
          <OwnersTab branchId={id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
