import { useState } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Tag,
  Utensils,
  Coffee,
  Zap,
  Flame,
  Droplets,
  Wifi,
  Truck,
  Car,
  Home,
  Building2,
  Wrench,
  Sparkles,
  Scissors,
  Package,
  ShoppingCart,
  Banknote,
  Wallet,
  Megaphone,
  Cpu,
  ClipboardList,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useIsMobile } from "@/hooks/use-mobile"
import { useGetExpenseCategories } from "@/hooks/useExpenses"
import {
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
} from "@/hooks/useExpenseCategoryMutations"
import { getCategoryIcon } from "@/components/expenses/AddExpenseSheet"
import { cn } from "@/lib/utils"
import type { ExpenseCategory } from "@/types/expense"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
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

// ── Icon options ───────────────────────────────────────────────

const ICON_OPTIONS: { value: string; icon: LucideIcon; label: string }[] = [
  { value: "utensils",        icon: Utensils,      label: "Food"      },
  { value: "coffee",          icon: Coffee,         label: "Drinks"    },
  { value: "zap",             icon: Zap,            label: "Electric"  },
  { value: "flame",           icon: Flame,          label: "Gas"       },
  { value: "droplets",        icon: Droplets,       label: "Water"     },
  { value: "wifi",            icon: Wifi,           label: "Internet"  },
  { value: "truck",           icon: Truck,          label: "Transport" },
  { value: "car",             icon: Car,            label: "Vehicle"   },
  { value: "home",            icon: Home,           label: "Rent"      },
  { value: "building-2",      icon: Building2,      label: "Office"    },
  { value: "wrench",          icon: Wrench,         label: "Repair"    },
  { value: "sparkles",        icon: Sparkles,       label: "Cleaning"  },
  { value: "scissors",        icon: Scissors,       label: "Services"  },
  { value: "package",         icon: Package,        label: "Supplies"  },
  { value: "shopping-cart",   icon: ShoppingCart,   label: "Shopping"  },
  { value: "banknote",        icon: Banknote,       label: "Payment"   },
  { value: "wallet",          icon: Wallet,         label: "Finance"   },
  { value: "megaphone",       icon: Megaphone,      label: "Marketing" },
  { value: "cpu",             icon: Cpu,            label: "Equipment" },
  { value: "clipboard-list",  icon: ClipboardList,  label: "Admin"     },
  { value: "more-horizontal", icon: MoreHorizontal, label: "Other"     },
]

// ── View state ─────────────────────────────────────────────────

type View =
  | { type: "list" }
  | { type: "form"; category?: ExpenseCategory }

// ── Category form (create / edit) ─────────────────────────────

function CategoryForm({
  category,
  onBack,
}: {
  category?: ExpenseCategory
  onBack: () => void
}) {
  const [name, setName] = useState(category?.name ?? "")
  const [icon, setIcon] = useState(category?.icon ?? "more-horizontal")

  const create = useCreateExpenseCategory()
  const update = useUpdateExpenseCategory()
  const isPending = create.isPending || update.isPending

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) { toast.error("Name is required"); return }
    try {
      if (category) {
        await update.mutateAsync({ id: category.id, name: trimmed, icon })
        toast.success("Category updated")
      } else {
        await create.mutateAsync({ name: trimmed, icon })
        toast.success("Category added")
      }
      onBack()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    }
  }

  return (
    <form
      className="flex flex-col flex-1 overflow-hidden"
      onSubmit={(e) => { e.preventDefault(); handleSave() }}
    >
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">Name</p>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cleaning"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Icon</p>
          <div className="grid grid-cols-7 gap-1.5">
            {ICON_OPTIONS.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                title={label}
                onClick={() => setIcon(value)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg border p-2 transition-colors",
                  icon === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent hover:border-border hover:bg-muted text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[9px] leading-none truncate w-full text-center">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : category ? "Save Changes" : "Add Category"}
        </Button>
      </div>
    </form>
  )
}

// ── Category list ──────────────────────────────────────────────

function CategoryList({
  categories,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
}: {
  categories: ExpenseCategory[]
  isLoading: boolean
  onAdd: () => void
  onEdit: (cat: ExpenseCategory) => void
  onDelete: (cat: ExpenseCategory) => void
}) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          ))
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Tag className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No categories yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Add your first expense category</p>
            </div>
            <Button onClick={onAdd}>
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          </div>
        ) : (
          categories.map((cat) => {
            const Icon = getCategoryIcon(cat.icon)
            return (
              <div
                key={cat.id}
                className="flex items-center gap-3 rounded-lg border px-4 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded bg-muted shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="flex-1 text-sm font-medium">{cat.name}</p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={() => onEdit(cat)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(cat)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          })
        )}
      </div>

      {!isLoading && categories.length > 0 && (
        <div className="shrink-0 border-t bg-background px-6 py-4">
          <Button onClick={onAdd} className="w-full">
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </div>
      )}
    </div>
  )
}

// ── ManageCategoriesSheet ──────────────────────────────────────

export function ManageCategoriesSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const isMobile = useIsMobile()
  const { data: categories = [], isLoading } = useGetExpenseCategories()
  const deleteCategory = useDeleteExpenseCategory()

  const [view, setView] = useState<View>({ type: "list" })
  const [deleteTarget, setDeleteTarget] = useState<ExpenseCategory | null>(null)

  function handleClose() {
    setView({ type: "list" })
    onOpenChange(false)
  }

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

  const isFormView = view.type === "form"

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-md",
          )}
        >
          <SheetHeader className="shrink-0 border-b px-6 py-4">
            <div className="flex items-center gap-2">
              {isFormView && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="-ml-2 h-8 w-8 shrink-0"
                  onClick={() => setView({ type: "list" })}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="min-w-0">
                <SheetTitle>
                  {isFormView
                    ? view.category ? "Edit Category" : "New Category"
                    : "Manage Categories"
                  }
                </SheetTitle>
                {!isFormView && (
                  <SheetDescription>
                    Add, edit, or remove expense categories
                  </SheetDescription>
                )}
              </div>
            </div>
          </SheetHeader>

          {view.type === "list" ? (
            <CategoryList
              categories={categories}
              isLoading={isLoading}
              onAdd={() => setView({ type: "form" })}
              onEdit={(cat) => setView({ type: "form", category: cat })}
              onDelete={setDeleteTarget}
            />
          ) : (
            <CategoryForm
              category={view.category}
              onBack={() => setView({ type: "list" })}
            />
          )}
        </SheetContent>
      </Sheet>

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
    </>
  )
}
