import { useState } from "react"
import {
  Tag, Plus, Trash2, ChevronRight, X, Check,
} from "lucide-react"
import { toast } from "sonner"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { useGetExpenseCategories } from "@/hooks/useExpenses"
import {
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
} from "@/hooks/useExpenseCategoryMutations"
import {
  useGetCategorySuppliers,
  useGetSuppliers,
  useLinkSupplierToCategory,
  useUnlinkSupplierFromCategory,
} from "@/hooks/useSuppliers"
import { getCategoryIcon } from "@/components/expenses/AddExpenseSheet"
import { ICON_OPTIONS } from "@/components/expenses/CategoryFormSheet"
import type { ExpenseCategory } from "@/types/expense"
import { useLanguage } from "@/contexts/LanguageContext"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// ── Add Category Dialog ────────────────────────────────────────

function AddCategoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { t } = useLanguage()
  const create = useCreateExpenseCategory()
  const [name,   setName]   = useState("")
  const [icon,   setIcon]   = useState("more-horizontal")
  const [isCogs, setIsCogs] = useState(false)

  function reset() {
    setName("")
    setIcon("more-horizontal")
    setIsCogs(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { toast.error(t("Name is required")); return }
    try {
      await create.mutateAsync({ name: trimmed, icon, is_cogs: isCogs })
      toast.success(t("Category added"))
      reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to add category"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("New Category")}</DialogTitle>
          <DialogDescription>{t("Add a new expense category.")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("Name")} <span className="text-destructive">*</span></Label>
            <Input
              placeholder={t("e.g. Cleaning")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>{t("Icon")}</Label>
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

          <div className="flex items-start gap-3 rounded-lg border p-4">
            <Switch id="cogs-new" checked={isCogs} onCheckedChange={setIsCogs} />
            <div className="space-y-0.5 leading-none">
              <Label htmlFor="cogs-new" className="text-sm font-medium cursor-pointer">{t("COGS")}</Label>
              <p className="text-xs text-muted-foreground">{t("Cost of Goods Sold")}</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t("Adding…") : t("Add Category")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Category Drawer ────────────────────────────────────────────

function CategoryDrawer({
  category,
  onClose,
  onDeleted,
}: {
  category: ExpenseCategory | null
  onClose: () => void
  onDeleted: () => void
}) {
  const { t } = useLanguage()
  const isMobile = useIsMobile()
  const update   = useUpdateExpenseCategory()
  const del      = useDeleteExpenseCategory()
  const link     = useLinkSupplierToCategory()
  const unlink   = useUnlinkSupplierFromCategory()

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [name,   setName]   = useState(category?.name ?? "")
  const [icon,   setIcon]   = useState(category?.icon ?? "more-horizontal")
  const [isCogs, setIsCogs] = useState(category?.is_cogs ?? false)
  const [addingSupplier, setAddingSupplier] = useState<string>("")

  // Sync state when a different category opens
  const [lastId, setLastId] = useState<string | null>(null)
  if (category && category.id !== lastId) {
    setLastId(category.id)
    setName(category.name)
    setIcon(category.icon ?? "more-horizontal")
    setIsCogs(category.is_cogs)
    setAddingSupplier("")
  }
  if (!category && lastId !== null) {
    setLastId(null)
  }

  const { data: linkedSuppliers = [], isLoading: suppliersLoading } =
    useGetCategorySuppliers(category?.id ?? null)
  const { data: allSuppliers = [] } = useGetSuppliers()

  const unlinkedSuppliers = allSuppliers.filter(
    (s) => !linkedSuppliers.some((ls) => ls.id === s.id),
  )

  async function handleSave() {
    if (!category) return
    const trimmed = name.trim()
    if (!trimmed) { toast.error(t("Name is required")); return }
    try {
      await update.mutateAsync({ id: category.id, name: trimmed, icon, is_cogs: isCogs })
      toast.success(t("Category updated"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to update"))
    }
  }

  async function handleDelete() {
    if (!category) return
    try {
      await del.mutateAsync(category.id)
      toast.success(`"${category.name}" ${t("deleted")}`)
      setConfirmDelete(false)
      onDeleted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to delete"))
    }
  }

  async function handleLinkSupplier() {
    if (!category || !addingSupplier) return
    try {
      await link.mutateAsync({ categoryId: category.id, supplierId: addingSupplier })
      setAddingSupplier("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to link supplier"))
    }
  }

  async function handleUnlink(supplierId: string) {
    if (!category) return
    try {
      await unlink.mutateAsync({ categoryId: category.id, supplierId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to unlink supplier"))
    }
  }

  const SelectedIcon = getCategoryIcon(icon)

  return (
    <>
      <Sheet
        open={category !== null}
        onOpenChange={(v) => { if (!v) { onClose(); setAddingSupplier("") } }}
      >
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-lg",
          )}
        >
          {category && (
            <>
              {/* ── Header ─────────────────────────────── */}
              <SheetHeader className="shrink-0 border-b px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                    <SelectedIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <SheetTitle className="truncate">{category.name}</SheetTitle>
                    <SheetDescription className="text-xs">
                      {t("Changes save when you click Save")}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              {/* ── Content ────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                {/* Name */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">{t("Details")}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("Name and type")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Name")}</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <Switch
                      id="is-cogs"
                      checked={isCogs}
                      onCheckedChange={setIsCogs}
                    />
                    <div className="space-y-0.5 leading-none">
                      <Label htmlFor="is-cogs" className="text-sm font-medium cursor-pointer">
                        {t("Cost of Goods Sold (COGS)")}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t("Mark if this category directly affects product cost")}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Icon picker */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">{t("Icon")}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("Choose an icon for this category")}</p>
                  </div>
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

                <Separator />

                {/* Suppliers */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">{t("Suppliers")}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("Suppliers linked to this category")}
                    </p>
                  </div>

                  {suppliersLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                          <Skeleton className="h-4 flex-1 max-w-[140px]" />
                          <Skeleton className="h-6 w-6 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : linkedSuppliers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("No suppliers linked yet.")}</p>
                  ) : (
                    <div className="divide-y rounded-lg border">
                      {linkedSuppliers.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                          <span className="flex-1 text-sm font-medium">{s.name}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleUnlink(s.id)}
                            disabled={unlink.isPending}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {unlinkedSuppliers.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Select
                        value={addingSupplier}
                        onValueChange={setAddingSupplier}
                      >
                        <SelectTrigger className="flex-1 h-9 text-sm">
                          <SelectValue placeholder={t("Add a supplier…")} />
                        </SelectTrigger>
                        <SelectContent>
                          {unlinkedSuppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 shrink-0"
                        onClick={handleLinkSupplier}
                        disabled={!addingSupplier || link.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {allSuppliers.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t("No suppliers available. Add suppliers from the Suppliers page first.")}
                    </p>
                  )}
                </div>
              </div>

              {/* ── Footer ─────────────────────────────── */}
              <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("Delete")}
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => { onClose(); setAddingSupplier("") }}>
                    {t("Close")}
                  </Button>
                  <Button onClick={handleSave} disabled={update.isPending}>
                    {update.isPending ? t("Saving…") : t("Save Changes")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete category?")}</AlertDialogTitle>
            <AlertDialogDescription>
              "{category?.name}" {t("will be removed. Expenses using this category will become uncategorized.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Category Card ──────────────────────────────────────────────

function CategoryCard({
  category,
  onClick,
}: {
  category: ExpenseCategory
  onClick: () => void
}) {
  const { t } = useLanguage()
  const Icon = getCategoryIcon(category.icon)
  return (
    <button onClick={onClick} className="group block w-full text-start">
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3.5 transition-shadow group-hover:shadow-md">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-muted shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="flex-1 min-w-0 text-sm font-medium truncate">{category.name}</span>
        {category.is_cogs && (
          <Badge variant="secondary" className="text-xs shrink-0">{t("COGS")}</Badge>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </button>
  )
}

// ── Skeleton ───────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border px-4 py-3.5">
          <Skeleton className="h-8 w-8 rounded shrink-0" />
          <Skeleton className="h-4 flex-1 max-w-[160px]" />
          <Skeleton className="h-4 w-4 ms-auto" />
        </div>
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

export function CategoriesSettingsPage() {
  const { t } = useLanguage()
  const { data: categories = [], isLoading } = useGetExpenseCategories()
  const [activeCategory, setActiveCategory] = useState<ExpenseCategory | null>(null)
  const [addOpen, setAddOpen]               = useState(false)

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-xl">

      {/* ── Header ─────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold">{t("Expense Categories")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("Manage categories and their linked suppliers.")}
        </p>
      </div>

      {/* ── List ───────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">{t("Categories")}</h2>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("Add Category")}
          </Button>
        </div>

        {isLoading ? (
          <ListSkeleton />
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Tag className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{t("No categories yet")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("Add your first expense category to get started")}
              </p>
            </div>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("Add Category")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                onClick={() => setActiveCategory(cat)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Detail drawer ──────────────────────────── */}
      <CategoryDrawer
        category={activeCategory}
        onClose={() => setActiveCategory(null)}
        onDeleted={() => setActiveCategory(null)}
      />

      {/* ── Add dialog ─────────────────────────────── */}
      <AddCategoryDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
