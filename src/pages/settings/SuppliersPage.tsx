import { useState } from "react"
import {
  Truck, Plus, Pencil, Trash2, ChevronRight,
  Phone, Mail, User, FileText, Receipt,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  useGetSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useGetSupplierExpenses,
} from "@/hooks/useSuppliers"
import { getCategoryIcon } from "@/components/expenses/AddExpenseSheet"
import type { Supplier } from "@/types/expense"
import { useLanguage } from "@/contexts/LanguageContext"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { Label } from "@/components/ui/label"

// ── Form helpers ───────────────────────────────────────────────

interface SupplierFormValues {
  name: string
  contact_person: string
  phone: string
  email: string
  notes: string
}

function emptyForm(): SupplierFormValues {
  return { name: "", contact_person: "", phone: "", email: "", notes: "" }
}

function toForm(s: Supplier): SupplierFormValues {
  return {
    name:           s.name,
    contact_person: s.contact_person ?? "",
    phone:          s.phone ?? "",
    email:          s.email ?? "",
    notes:          s.notes ?? "",
  }
}

// ── Add Supplier Dialog ────────────────────────────────────────

function AddSupplierDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { t } = useLanguage()
  const create = useCreateSupplier()
  const [form, setForm] = useState<SupplierFormValues>(emptyForm())

  function set(key: keyof SupplierFormValues, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) { toast.error(t("Supplier name is required")); return }
    try {
      await create.mutateAsync({
        name,
        contact_person: form.contact_person.trim() || null,
        phone:          form.phone.trim() || null,
        email:          form.email.trim() || null,
        notes:          form.notes.trim() || null,
      })
      toast.success(t("Supplier added"))
      setForm(emptyForm())
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to add supplier"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setForm(emptyForm()); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("New Supplier")}</DialogTitle>
          <DialogDescription>{t("Add a supplier that can be linked to expense categories.")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("Name")} <span className="text-destructive">*</span></Label>
            <Input
              placeholder={t("e.g. Cairo Electric Co.")}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>{t("Contact Person")}</Label>
            <Input
              placeholder={t("e.g. Ahmed Khalil")}
              value={form.contact_person}
              onChange={(e) => set("contact_person", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("Phone")}</Label>
              <Input
                placeholder={t("+20 10 …")}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Email")}</Label>
              <Input
                type="email"
                placeholder={t("supplier@example.com")}
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("Notes")}</Label>
            <Textarea
              placeholder={t("Any additional notes…")}
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t("Adding…") : t("Add Supplier")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Supplier Drawer ────────────────────────────────────────────

function SupplierDrawer({
  supplier,
  onClose,
  onDeleted,
}: {
  supplier: Supplier | null
  onClose: () => void
  onDeleted: () => void
}) {
  const { t } = useLanguage()
  const isMobile = useIsMobile()
  const update   = useUpdateSupplier()
  const del      = useDeleteSupplier()

  const [editing, setEditing]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm]                 = useState<SupplierFormValues>(emptyForm())

  // Sync form & reset edit mode when a new supplier is opened
  const [lastId, setLastId] = useState<string | null>(null)
  if (supplier && supplier.id !== lastId) {
    setLastId(supplier.id)
    setForm(toForm(supplier))
    setEditing(false)
  }
  if (!supplier && lastId !== null) {
    setLastId(null)
    setEditing(false)
  }

  function setField(key: keyof SupplierFormValues, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  function startEdit() {
    if (supplier) setForm(toForm(supplier))
    setEditing(true)
  }

  function cancelEdit() {
    if (supplier) setForm(toForm(supplier))
    setEditing(false)
  }

  async function handleSave() {
    if (!supplier) return
    const name = form.name.trim()
    if (!name) { toast.error(t("Name is required")); return }
    try {
      await update.mutateAsync({
        id:             supplier.id,
        name,
        contact_person: form.contact_person.trim() || null,
        phone:          form.phone.trim() || null,
        email:          form.email.trim() || null,
        notes:          form.notes.trim() || null,
      })
      toast.success(t("Supplier updated"))
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to update"))
    }
  }

  async function handleDelete() {
    if (!supplier) return
    try {
      await del.mutateAsync(supplier.id)
      toast.success(`"${supplier.name}" ${t("deleted")}`)
      setConfirmDelete(false)
      onDeleted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to delete"))
    }
  }

  const { data: expenses = [], isLoading: expensesLoading } = useGetSupplierExpenses(
    !editing ? supplier?.id ?? null : null,
  )

  const totalSpend = expenses.reduce((s, e) => s + (e.amount as number), 0)

  return (
    <>
      <Sheet open={supplier !== null} onOpenChange={(v) => { if (!v) { onClose(); setEditing(false) } }}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-lg",
          )}
        >
          {supplier && (
            <>
              {/* ── Header ─────────────────────────────── */}
              <SheetHeader className="shrink-0 border-b px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SheetTitle className="truncate">{supplier.name}</SheetTitle>
                    <SheetDescription className="text-xs">
                      {editing ? t("Edit supplier details") : t("Supplier details & expenses")}
                    </SheetDescription>
                  </div>
                  {!editing && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-muted-foreground"
                      onClick={startEdit}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </SheetHeader>

              {/* ── Content ────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                {editing ? (
                  /* ── Edit form ─────────────────────── */
                  <>
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold">{t("Supplier Info")}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{t("Basic details")}</p>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>{t("Name")} <span className="text-destructive">*</span></Label>
                          <Input value={form.name} onChange={(e) => setField("name", e.target.value)} autoFocus />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("Contact Person")}</Label>
                          <Input
                            placeholder={t("e.g. Ahmed Khalil")}
                            value={form.contact_person}
                            onChange={(e) => setField("contact_person", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold">{t("Contact")}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{t("Phone and email")}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>{t("Phone")}</Label>
                          <Input
                            placeholder={t("+20 10 …")}
                            value={form.phone}
                            onChange={(e) => setField("phone", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("Email")}</Label>
                          <Input
                            type="email"
                            placeholder={t("supplier@example.com")}
                            value={form.email}
                            onChange={(e) => setField("email", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>{t("Notes")}</Label>
                      <Textarea
                        placeholder={t("Any additional notes…")}
                        rows={3}
                        value={form.notes}
                        onChange={(e) => setField("notes", e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  /* ── View mode ─────────────────────── */
                  <>
                    <div className="space-y-3">
                      {supplier.contact_person && (
                        <div className="flex items-center gap-3 text-sm">
                          <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span>{supplier.contact_person}</span>
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center gap-3 text-sm">
                          <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span>{supplier.phone}</span>
                        </div>
                      )}
                      {supplier.email && (
                        <div className="flex items-center gap-3 text-sm">
                          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span>{supplier.email}</span>
                        </div>
                      )}
                      {supplier.notes && (
                        <div className="flex items-start gap-3 text-sm">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                          <span className="text-muted-foreground">{supplier.notes}</span>
                        </div>
                      )}
                      {!supplier.contact_person && !supplier.phone && !supplier.email && !supplier.notes && (
                        <p className="text-sm text-muted-foreground">{t("No contact details on record.")}</p>
                      )}
                    </div>

                    <Separator />

                    {/* Expenses from this supplier */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold">{t("Expenses")}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{t("Latest 50 from this supplier")}</p>
                        </div>
                        {expenses.length > 0 && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            EGP {totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Badge>
                        )}
                      </div>

                      {expensesLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                              <Skeleton className="h-7 w-7 rounded shrink-0" />
                              <div className="flex-1 space-y-1">
                                <Skeleton className="h-3.5 w-40" />
                                <Skeleton className="h-3 w-24" />
                              </div>
                              <Skeleton className="h-4 w-20" />
                            </div>
                          ))}
                        </div>
                      ) : expenses.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <Receipt className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground">{t("No expenses recorded yet")}</p>
                        </div>
                      ) : (
                        <div className="divide-y rounded-lg border">
                          {expenses.map((exp) => {
                            const cat = exp.category as { id: string; name: string; icon: string | null } | null
                            const Icon = getCategoryIcon(cat?.icon ?? null)
                            return (
                              <div key={exp.id} className="flex items-center gap-3 px-4 py-3">
                                <div className="flex h-7 w-7 items-center justify-center rounded bg-muted shrink-0">
                                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{exp.description ?? "—"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(exp.date as string), "dd MMM yyyy")}
                                    {" · "}
                                    {(exp.branch as { name: string } | null)?.name ?? "—"}
                                  </p>
                                </div>
                                <span className="text-sm font-medium shrink-0">
                                  EGP {(exp.amount as number).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
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
                {editing ? (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={cancelEdit}>
                      {t("Cancel")}
                    </Button>
                    <Button onClick={handleSave} disabled={update.isPending}>
                      {update.isPending ? t("Saving…") : t("Save Changes")}
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => { onClose(); setEditing(false) }}>
                    {t("Close")}
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete supplier?")}</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{supplier?.name}</strong> {t("will be removed. Expenses linked to this supplier will lose their supplier reference. This cannot be undone.")}
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

// ── Supplier Card ──────────────────────────────────────────────

function SupplierCard({ supplier, onClick }: { supplier: Supplier; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group block w-full text-left">
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3.5 transition-shadow group-hover:shadow-md">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
          <Truck className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{supplier.name}</p>
          {(supplier.contact_person || supplier.phone) && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {supplier.contact_person ?? supplier.phone}
            </p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </button>
  )
}

// ── Skeleton ───────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border px-4 py-3.5">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-4" />
        </div>
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

export function SuppliersPage() {
  const { t } = useLanguage()
  const { data: suppliers = [], isLoading } = useGetSuppliers()
  const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(null)
  const [addOpen, setAddOpen]               = useState(false)

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-xl">

      {/* ── Header ─────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold">{t("Suppliers")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("Manage suppliers linked to expense categories.")}
        </p>
      </div>

      {/* ── Suppliers list ─────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">{t("All Suppliers")}</h2>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("Add Supplier")}
          </Button>
        </div>

        {isLoading ? (
          <ListSkeleton />
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Truck className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{t("No suppliers yet")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("Add your first supplier to link it to expense categories")}
              </p>
            </div>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("Add Supplier")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {suppliers.map((supplier) => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                onClick={() => setActiveSupplier(supplier)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Detail drawer ──────────────────────────── */}
      <SupplierDrawer
        supplier={activeSupplier}
        onClose={() => setActiveSupplier(null)}
        onDeleted={() => setActiveSupplier(null)}
      />

      {/* ── Add dialog ─────────────────────────────── */}
      <AddSupplierDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
