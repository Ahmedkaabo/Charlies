import { useState } from "react"
import { Users, Plus, Pencil, Trash2, MoreHorizontal } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

import { useGetMembersGrouped, useDeleteMember } from "@/hooks/useMembers"
import { useGetRoles } from "@/hooks/usePermissions"
import { useGetBranches } from "@/hooks/useBranches"
import { useMyBranches } from "@/hooks/useAttendance"
import { useAuth } from "@/hooks/useAuth"
import { useUserPermissions } from "@/hooks/usePermissions"
import type { GroupedMember } from "@/types/member"
import { MemberSheet } from "@/components/members/MemberSheet"
import type { MemberSheetMode } from "@/components/members/MemberSheet"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MultiSelect } from "@/components/ui/multi-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

// ── Helpers ───────────────────────────────────────────────────

function getInitials(name?: string | null) {
  if (!name) return "??"
  const p = name.trim().split(/\s+/)
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0].slice(0, 2).toUpperCase()
}

function roleVariant(level: number): "default" | "secondary" | "outline" {
  if (level <= 1) return "default"
  if (level <= 3) return "secondary"
  return "outline"
}

// ── Table skeleton ────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            {["Staff", "Status", "Branches", "Role", "Salary", "Since", "Last Login", ""].map((h, i) => (
              <TableHead key={i} className={i === 0 ? "sticky left-0 z-10 bg-muted/40 relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']" : undefined}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell className="sticky left-0 z-10 bg-background relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </TableCell>
              <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
              <TableCell><Skeleton className="h-5 w-32 rounded-full" /></TableCell>
              <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-7 w-7 rounded" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ── Empty ─────────────────────────────────────────────────────

function EmptyState({ canAdd, onAdd }: { canAdd: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Users className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">No staff found</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {canAdd ? "Add your first staff member to get started" : "No staff to display"}
        </p>
      </div>
      {canAdd && (
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Add Staff
        </Button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export function MembersPage() {
  const { isAdmin, profile } = useAuth()
  const { canCreate, canUpdate, canDelete: canDeletePerm, isOwner } = useUserPermissions()
  const { data: allRolesRaw = [] } = useGetRoles()
  const roles = allRolesRaw.filter((r) => !r.is_system)
  const { data: allBranches = [] } = useGetBranches()
  const { data: myBranches  = [] } = useMyBranches(profile?.id)
  const branches    = myBranches.length > 0 ? myBranches : allBranches
  const myBranchIds = myBranches.length > 0 ? myBranches.map((b) => b.id) : undefined
  const { data: groupedMembers, isLoading, isError } = useGetMembersGrouped(undefined, myBranchIds)
  const deleteMember = useDeleteMember()

  const [sheet, setSheet]               = useState<MemberSheetMode | null>(null)
  const [removeTarget, setRemoveTarget] = useState<{ profileId: string; name: string } | null>(null)
  const [search, setSearch]             = useState("")
  const [roleFilters, setRoleFilters]   = useState<string[]>([])
  const [branchFilters, setBranchFilters] = useState<string[]>([])

  const canSeeAll  = isAdmin || isOwner
  const canAdd     = canCreate("staff")
  const canEdit    = canUpdate("staff")
  const canRemove  = canDeletePerm("staff")
  const hasActions = canEdit || canRemove

  // Filter and visibility
  const visible = groupedMembers?.filter((gm) => {
    if (!canSeeAll) {
      if (gm.is_admin) return false
      if (gm.assignments.every((a) => (a.role?.level ?? 99) <= 1)) return false
    }
    return true
  })

  const filtered = visible?.filter((gm) => {
    const name = gm.full_name?.toLowerCase() ?? ""
    if (search && !name.includes(search.toLowerCase())) return false
    if (roleFilters.length > 0 && !gm.assignments.some((a) => roleFilters.includes(a.role_id))) return false
    if (branchFilters.length > 0 && !gm.assignments.some((a) => branchFilters.includes(a.branch_id))) return false
    return true
  })

  async function confirmRemove() {
    if (!removeTarget) return
    try {
      await deleteMember.mutateAsync(removeTarget.profileId)
      toast.success(`${removeTarget.name} removed`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove")
    } finally {
      setRemoveTarget(null)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* ── Header ────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Staff</h1>
          {visible && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {visible.length} {visible.length === 1 ? "staff member" : "staff members"}
            </p>
          )}
        </div>
        {canAdd && (
          <Button onClick={() => setSheet({ type: "create" })}>
            <Plus className="h-4 w-4" />
            Add Staff
          </Button>
        )}
      </div>

      {/* ── Toolbar ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-52"
        />
        <MultiSelect
          options={roles.map((r) => ({ value: r.id, label: r.name.replace(/_/g, " ") }))}
          selected={roleFilters}
          onChange={setRoleFilters}
          placeholder="All roles"
          className="w-40"
        />
        <MultiSelect
          options={branches.map((b) => ({ value: b.id, label: b.name }))}
          selected={branchFilters}
          onChange={setBranchFilters}
          placeholder="All branches"
          className="w-44"
        />
      </div>

      {/* ── Error ─────────────────────────────────────── */}
      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load staff. Please try again.
        </div>
      )}

      {/* ── Loading ───────────────────────────────────── */}
      {isLoading && <TableSkeleton />}

      {/* ── Empty ─────────────────────────────────────── */}
      {!isLoading && !isError && visible?.length === 0 && (
        <EmptyState canAdd={canAdd} onAdd={() => setSheet({ type: "create" })} />
      )}

      {/* ── Table ─────────────────────────────────────── */}
      {!isLoading && !isError && visible && visible.length > 0 && (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-52 sticky left-0 z-10 bg-muted/40 relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']">Staff</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Branches</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Since</TableHead>
                <TableHead>Last Login</TableHead>
                {hasActions && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered && filtered.length > 0 ? (
                filtered.map((gm) => {
                  // Use first assignment for primary role/salary/date
                  const first = gm.assignments[0]
                  const earliestJoin = gm.assignments.reduce(
                    (min, a) => (a.joined_at < min ? a.joined_at : min),
                    gm.assignments[0].joined_at
                  )
                  const primarySalary = gm.assignments.find((a) => a.salary?.monthly_salary)?.salary

                  return (
                    <TableRow key={gm.profile_id} className={hasActions ? "cursor-pointer group" : undefined} onClick={canEdit ? () => setSheet({ type: "edit", groupedMember: gm }) : undefined}>
                      {/* Member */}
                      <TableCell className="sticky left-0 z-10 bg-background sm:group-hover:bg-muted/50 relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                            {getInitials(gm.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{gm.full_name ?? "—"}</p>
                            {gm.is_admin && (
                              <p className="text-xs text-muted-foreground">Owner</p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        {gm.last_login_at ? (
                          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/40 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                            Pending
                          </Badge>
                        )}
                      </TableCell>

                      {/* Branches — all assignments as chips */}
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {gm.assignments.map((a) => (
                            <span
                              key={a.id}
                              className="inline-block rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-medium"
                            >
                              {a.branch_name}
                            </span>
                          ))}
                        </div>
                      </TableCell>

                      {/* Role — primary assignment */}
                      <TableCell>
                        {first?.role ? (
                          <Badge variant={roleVariant(first.role.level)} className="capitalize">
                            {first.role.name.replace(/_/g, " ")}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Salary (primary) */}
                      <TableCell>
                        {primarySalary?.monthly_salary ? (
                          <span className="text-sm">
                            {primarySalary.currency}{" "}
                            {primarySalary.monthly_salary.toLocaleString("en-EG")}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Since (earliest) */}
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(earliestJoin), "d MMM yyyy")}
                      </TableCell>

                      {/* Last Login */}
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {gm.last_login_at
                          ? format(new Date(gm.last_login_at), "d MMM yyyy, HH:mm")
                          : <span className="text-xs italic">Never</span>
                        }
                      </TableCell>

                      {/* Actions */}
                      {hasActions && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canEdit && (
                                  <DropdownMenuItem
                                    onClick={() => setSheet({ type: "edit", groupedMember: gm })}
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                )}
                                {canRemove && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => setRemoveTarget({ profileId: gm.profile_id, name: gm.full_name ?? "Staff" })}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Remove
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={hasActions ? 8 : 7}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No staff match the current filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Sheet ─────────────────────────────────────── */}
      <MemberSheet
        mode={sheet}
        onClose={() => setSheet(null)}
      />

      {/* ── Remove confirmation ────────────────────────── */}
      <AlertDialog open={!!removeTarget} onOpenChange={(v) => { if (!v) setRemoveTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove staff member?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removeTarget?.name}</strong> will be permanently removed from all branches.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
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
