import { format, parseISO } from "date-fns"
import { Pencil, Trash2, ExternalLink, UserCircle, Truck } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { useIsMobile } from "@/hooks/use-mobile"
import { useGetExpenseEdits } from "@/hooks/useExpenses"
import { supabase } from "@/lib/supabase"
import { getCategoryIcon } from "@/components/expenses/AddExpenseSheet"
import { cn } from "@/lib/utils"
import type { Expense, ExpenseEdit } from "@/types/expense"
import { useFormatters } from "@/lib/format"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

// ── Helpers ────────────────────────────────────────────────


function fmtDate(s: string) {
  return format(parseISO(s), "MMM d, yyyy")
}

function fmtDateTime(s: string) {
  return format(parseISO(s), "MMM d, yyyy · h:mm a")
}

// ── Adder profile query ────────────────────────────────────

function useAdderProfile(profileId: string | null) {
  return useQuery({
    queryKey: ["profiles", profileId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", profileId!)
        .maybeSingle()
      return data as { id: string; full_name: string | null; avatar_url: string | null } | null
    },
    enabled: !!profileId,
  })
}

// ── Avatar initials ────────────────────────────────────────

function initials(name: string | null) {
  if (!name) return "?"
  const p = name.trim().split(/\s+/)
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : p[0].slice(0, 2)).toUpperCase()
}

// ── Props ──────────────────────────────────────────────────

interface ExpenseDetailSheetProps {
  open: boolean
  expense: Expense | undefined
  onEdit?: (expense: Expense) => void
  onDelete?: (expense: Expense) => void
  onClose: () => void
}

// ── Component ──────────────────────────────────────────────

export function ExpenseDetailSheet({
  open,
  expense,
  onEdit,
  onDelete,
  onClose,
}: ExpenseDetailSheetProps) {
  const isMobile = useIsMobile()
  const fmt = useFormatters()

  const { data: edits = [], isLoading: editsLoading } = useGetExpenseEdits(
    expense?.id ?? "",
    open && !!expense,
  )
  const { data: adder, isLoading: adderLoading } = useAdderProfile(
    expense?.added_by ?? null,
  )

  if (!expense) return null

  const Icon        = getCategoryIcon(expense.category?.icon ?? null)
  const wasEdited   = !!expense.edited_at

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-2xl",
        )}
      >
        {/* ── Header ─────────────────────────────────── */}
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base">
                {expense.category?.name ?? "Uncategorized"}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-1.5 mt-0.5">
                <span>{expense.branch?.name ?? "—"}</span>
                <span className="text-muted-foreground/40">·</span>
                <span>{fmtDate(expense.date)}</span>
                {wasEdited && (
                  <Pencil className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* ── Scrollable body ─────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Amount */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Amount</p>
            <p className="text-3xl font-bold tabular-nums">{fmt.egp(expense.amount, 2)}</p>
          </div>

          <Separator />

          {/* Description */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Description</p>
            <p className="text-sm">{expense.description ?? "—"}</p>
          </div>

          {/* Supplier */}
          {expense.supplier && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Supplier</p>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">{expense.supplier.name}</p>
                </div>
              </div>
            </>
          )}

          {/* Receipt */}
          {expense.receipt_url && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Receipt</p>
                <div className="relative w-fit">
                  <img
                    src={expense.receipt_url}
                    alt="Receipt"
                    className="max-h-48 rounded-lg border object-cover"
                  />
                  <a
                    href={expense.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-2 end-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-background transition-colors"
                    title="Open full size"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Added by */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Added by</p>
            {adderLoading ? (
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : adder ? (
              <div className="flex items-center gap-2">
                {adder.avatar_url ? (
                  <img
                    src={adder.avatar_url}
                    alt={adder.full_name ?? ""}
                    className="h-8 w-8 rounded-full object-cover border shrink-0"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {initials(adder.full_name)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{adder.full_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{fmtDateTime(expense.created_at)}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <UserCircle className="h-8 w-8" />
                <p className="text-sm">Unknown · {fmtDateTime(expense.created_at)}</p>
              </div>
            )}
          </div>

          {/* Edit history — only when edited */}
          {wasEdited && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Edit History</p>
                  <Pencil className="h-3 w-3 text-amber-500 fill-amber-500" />
                </div>

                {editsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="space-y-1.5">
                        <Skeleton className="h-3 w-48" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    ))}
                  </div>
                ) : edits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No history available</p>
                ) : (
                  <div className="space-y-4">
                    {edits.map((edit: ExpenseEdit) => (
                      <div
                        key={edit.id}
                        className="border-s-2 border-amber-400 ps-3 space-y-1.5"
                      >
                        <div className="flex items-center gap-1.5">
                          <Pencil className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {edit.editor?.full_name ?? "Unknown"}
                            </span>
                            {" · "}
                            {fmtDateTime(edit.edited_at)}
                          </p>
                        </div>
                        {Object.entries(edit.changes).map(([field, change]) => (
                          <div key={field} className="text-xs ps-4">
                            <span className="font-medium text-muted-foreground">{field}: </span>
                            <span className="line-through text-muted-foreground/50">{change.from || "—"}</span>
                            <span className="text-muted-foreground mx-1">→</span>
                            <span className="font-medium">{change.to || "—"}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────── */}
        {(onEdit || onDelete) && (
          <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between gap-3">
            {onDelete && (
              <Button
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                onClick={() => { onClose(); onDelete(expense) }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            {onEdit && (
              <Button onClick={() => onEdit(expense)} className="ms-auto">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
