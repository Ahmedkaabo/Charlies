import { useState } from "react"
import { Plus, Tag, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { useGetExpenseCategories } from "@/hooks/useExpenses"
import { useDeleteExpenseCategory } from "@/hooks/useExpenseCategoryMutations"
import { getCategoryIcon } from "@/components/expenses/AddExpenseSheet"
import { CategoryFormSheet } from "@/components/expenses/CategoryFormSheet"
import type { ExpenseCategory } from "@/types/expense"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
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

// ── Sheet state ────────────────────────────────────────────────

type SheetState =
  | { open: false }
  | { open: true; category?: ExpenseCategory }

// ── Skeleton ───────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="divide-y rounded-lg border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-8 w-8 rounded shrink-0" />
          <Skeleton className="h-4 flex-1 max-w-[160px]" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="ml-auto h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

export function CategoriesSettingsPage() {
  const { data: categories = [], isLoading } = useGetExpenseCategories()
  const deleteCategory = useDeleteExpenseCategory()

  const [sheet, setSheet]           = useState<SheetState>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<ExpenseCategory | null>(null)

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteCategory.mutateAsync(deleteTarget.id)
      toast.success("Category deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Expense Categories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage categories used for classifying expenses
          </p>
        </div>
        <Button onClick={() => setSheet({ open: true })}>
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      {/* ── List ───────────────────────────────────── */}
      {isLoading ? (
        <ListSkeleton />
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Tag className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No categories yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add your first expense category to get started
            </p>
          </div>
          <Button onClick={() => setSheet({ open: true })}>
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {categories.map((cat) => {
            const Icon = getCategoryIcon(cat.icon)
            return (
              <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-muted shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>

                <p className="flex-1 text-sm font-medium">{cat.name}</p>

                {cat.is_cogs && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    COGS
                  </Badge>
                )}

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setSheet({ open: true, category: cat })}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteTarget(cat)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add / edit sheet ───────────────────────── */}
      <CategoryFormSheet
        open={sheet.open}
        onOpenChange={(v) => { if (!v) setSheet({ open: false }) }}
        category={sheet.open ? sheet.category : undefined}
      />

      {/* ── Delete confirmation ─────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be removed. Expenses using this category will become uncategorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
