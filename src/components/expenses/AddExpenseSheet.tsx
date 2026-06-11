import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import {
  Receipt,
  Utensils,
  Zap,
  Truck,
  Wrench,
  Package,
  Home,
  Coffee,
  ShoppingCart,
  Banknote,
  Megaphone,
  Droplets,
  Wallet,
  Cpu,
  MoreHorizontal,
  Sparkles,
  Building2,
  Car,
  Flame,
  Wifi,
  Scissors,
  ClipboardList,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { useIsMobile } from "@/hooks/use-mobile"
import { useAuth } from "@/hooks/useAuth"
import { useLanguage } from "@/contexts/LanguageContext"
import { useGetBranches, useGetBranchMembers } from "@/hooks/useBranches"
import { useGetExpenseCategories } from "@/hooks/useExpenses"
import { useCreateExpense, useUpdateExpense } from "@/hooks/useExpenseMutations"
import { useGetCategorySuppliers } from "@/hooks/useSuppliers"
import { uploadReceipt } from "@/lib/storage"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { useFormatters, useLocalName } from "@/lib/format"
import type { Expense } from "@/types/expense"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// ── Category icon lookup ───────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  // Food & drink
  utensils:          Utensils,
  coffee:            Coffee,
  // Utilities
  zap:               Zap,
  electricity:       Zap,
  flame:             Flame,
  gas:               Flame,
  droplets:          Droplets,
  water:             Droplets,
  wifi:              Wifi,
  internet:          Wifi,
  // Transport
  truck:             Truck,
  transport:         Truck,
  car:               Car,
  vehicle:           Car,
  // Property
  home:              Home,
  rent:              Home,
  "building-2":      Building2,
  building2:         Building2,
  office:            Building2,
  // Maintenance & repairs
  wrench:            Wrench,
  maintenance:       Wrench,
  scissors:          Scissors,
  cleaning:          Sparkles,
  sparkles:          Sparkles,
  // Supplies & inventory
  package:           Package,
  supplies:          Package,
  "shopping-cart":   ShoppingCart,
  shoppingcart:      ShoppingCart,
  // Finance & payroll
  banknote:          Banknote,
  wallet:            Wallet,
  salary:            Wallet,
  // Marketing
  megaphone:         Megaphone,
  marketing:         Megaphone,
  // Technology
  cpu:               Cpu,
  equipment:         Cpu,
  // Admin
  "clipboard-list":  ClipboardList,
  clipboardlist:     ClipboardList,
  "more-horizontal": MoreHorizontal,
  other:             MoreHorizontal,
}

export function getCategoryIcon(icon: string | null): LucideIcon {
  if (!icon) return Receipt
  return ICON_MAP[icon.toLowerCase()] ?? Receipt
}

// ── Helpers ────────────────────────────────────────────────

// ── Zod schema ─────────────────────────────────────────────

const schema = z.object({
  branch_id:   z.string().min(1, "Branch is required"),
  category_id: z.string().min(1, "Category is required"),
  supplier_id: z.string().nullable(),
  amount:      z.number().positive("Amount is required"),
  description: z.string().min(1, "Description is required"),
  member_id:   z.string().nullable(),
})

type FormValues = z.infer<typeof schema>

// ── Props ──────────────────────────────────────────────────

interface AddExpenseSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultBranchId?: string
  expense?: Expense
}

// ── Component ──────────────────────────────────────────────

export function AddExpenseSheet({ open, onOpenChange, defaultBranchId, expense }: AddExpenseSheetProps) {
  const { t } = useLanguage()
  const isEditMode = !!expense
  const isMobile   = useIsMobile()
  const { user }   = useAuth()
  const qc         = useQueryClient()
  const fmt        = useFormatters()
  const ln         = useLocalName()

  const [receiptFile, setReceiptFile]   = useState<File | null>(null)
  const [receiptError, setReceiptError] = useState<string | null>(null)
  const [uploading, setUploading]       = useState(false)

  const { data: branches   = [] } = useGetBranches()
  const { data: categories = [] } = useGetExpenseCategories()
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      branch_id:   defaultBranchId ?? "",
      category_id: "",
      supplier_id: null,
      amount:      0,
      description: "",
      member_id:   null,
    },
  })

  const watchedBranchId   = form.watch("branch_id")
  const watchedCategoryId = form.watch("category_id")

  const selectedCategory = categories.find((c) => c.id === watchedCategoryId)
  const isDebtCategory   = selectedCategory?.name.toLowerCase() === "employee debt"

  // Suppliers: only show suppliers linked to the selected category
  const { data: visibleSuppliers = [] } = useGetCategorySuppliers(watchedCategoryId || null)

  // Reset supplier when category changes
  useEffect(() => {
    form.setValue("supplier_id", null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedCategoryId])

  // Load branch members only when debt category is selected and branch is set
  const { data: rawMembers = [] } = useGetBranchMembers(
    isDebtCategory ? watchedBranchId : "",
  )

  // Deduplicate by profile_id in case a member has multiple branch_member rows
  const branchMembers = rawMembers.filter(
    (m, i, arr) => arr.findIndex((x) => x.profile_id === m.profile_id) === i,
  )
  // Admins are already excluded at the hook level (useGetBranchMembers filters is_admin)

  // Clear member when category switches away from Salary
  useEffect(() => {
    if (!isDebtCategory) form.setValue("member_id", null)
  }, [isDebtCategory])

  // Reset form whenever the sheet opens / expense changes
  useEffect(() => {
    if (open) {
      form.reset(
        expense
          ? {
              branch_id:   expense.branch_id,
              category_id: expense.category_id ?? "",
              supplier_id: expense.supplier_id ?? null,
              amount:      expense.amount,
              description: expense.description ?? "",
              member_id:   null,
            }
          : {
              branch_id:   defaultBranchId ?? "",
              category_id: "",
              supplier_id: null,
              amount:      0,
              description: "",
              member_id:   null,
            },
      )
      setReceiptFile(null)
      setReceiptError(null)
    }
  }, [open, expense?.id])

  // ── Payroll debt helper ─────────────────────────────────

  async function syncPayrollDebt(profileId: string, branchId: string, amount: number, reason: string) {
    const now   = new Date()
    const month = now.getMonth() + 1
    const year  = now.getFullYear()

    // Find existing payroll record for this member/branch/month
    const { data: existing } = await supabase
      .from("payroll_records")
      .select("id, base_salary, days_present")
      .eq("profile_id", profileId)
      .eq("branch_id", branchId)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle()

    let recordId: string

    if (existing) {
      recordId = existing.id
    } else {
      const { data: created, error } = await supabase
        .from("payroll_records")
        .insert({
          branch_id:        branchId,
          profile_id:       profileId,
          month,
          year,
          base_salary:      null,
          total_bonuses:    0,
          total_deductions: 0,
          total_debts:      0,
          days_present:     0,
          net_salary:       null,
          currency:         "EGP",
          is_finalized:     false,
        })
        .select("id")
      if (error) throw error
      if (!created?.length) throw new Error("Failed to create payroll record")
      recordId = created[0].id
    }

    // Insert the debt adjustment
    const { error: adjError } = await supabase
      .from("payroll_adjustments")
      .insert({
        payroll_record_id: recordId,
        branch_id:         branchId,
        profile_id:        profileId,
        type:              "debt",
        amount,
        reason,
        month,
        year,
        created_by:        user!.id,
      })
    if (adjError) throw adjError

    // Recalculate record totals
    const { data: allAdj } = await supabase
      .from("payroll_adjustments")
      .select("type, amount")
      .eq("payroll_record_id", recordId)

    let bonuses = 0, deductions = 0, debts = 0
    for (const a of allAdj ?? []) {
      const amt = Number(a.amount)
      if      (a.type === "bonus")     bonuses    += amt
      else if (a.type === "deduction") deductions += amt
      else if (a.type === "debt")      debts      += amt
    }

    const base  = existing?.base_salary ?? null
    const days  = existing?.days_present ?? 0
    const earned = base ? (base / 30) * days : 0

    await supabase
      .from("payroll_records")
      .update({
        total_bonuses:    bonuses,
        total_deductions: deductions,
        total_debts:      debts,
        net_salary:       earned + bonuses - deductions - debts,
      })
      .eq("id", recordId)

    qc.invalidateQueries({ queryKey: ["payroll"] })
  }

  // ── Submit ──────────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    // Supplier required when the selected category has linked suppliers
    if (visibleSuppliers.length > 0 && !isDebtCategory && !values.supplier_id) {
      form.setError("supplier_id", { message: "Supplier is required for this category" })
      return
    }

    // Debt category requires a member
    if (isDebtCategory && !values.member_id) {
      form.setError("member_id", { message: "Select a staff member for employee debt expenses" })
      return
    }

    // Receipt required only in create mode and not a debt category
    if (!isEditMode && !isDebtCategory && !receiptFile) {
      setReceiptError(t("Receipt image is required"))
      return
    }

    try {
      setUploading(true)

      let receipt_url = expense?.receipt_url ?? null
      if (receiptFile) receipt_url = await uploadReceipt(receiptFile)

      if (isEditMode && expense) {
        const changes: Record<string, { from: string; to: string }> = {}

        if (values.amount !== expense.amount)
          changes["Amount"] = { from: fmt.egp(expense.amount, 2), to: fmt.egp(values.amount, 2) }
        if (values.branch_id !== expense.branch_id) {
          const fromName = branches.find(b => b.id === expense.branch_id)?.name ?? expense.branch_id
          const toName   = branches.find(b => b.id === values.branch_id)?.name  ?? values.branch_id
          changes["Branch"] = { from: fromName, to: toName }
        }
        if (values.category_id !== (expense.category_id ?? "")) {
          const fromName = expense.category?.name ?? "Uncategorized"
          const toName   = categories.find(c => c.id === values.category_id)?.name ?? "Uncategorized"
          changes["Category"] = { from: fromName, to: toName }
        }
        if (values.description !== (expense.description ?? ""))
          changes["Description"] = { from: expense.description ?? "", to: values.description }
        if (receiptFile)
          changes["Receipt"] = { from: "Previous image", to: "New image" }

        if (values.supplier_id !== (expense.supplier_id ?? null)) {
          const fromName = expense.supplier?.name ?? "None"
          const toName   = visibleSuppliers.find(s => s.id === values.supplier_id)?.name ?? "None"
          changes["Supplier"] = { from: fromName, to: toName }
        }

        await updateExpense.mutateAsync({
          id: expense.id,
          data: {
            branch_id:   values.branch_id,
            category_id: values.category_id || null,
            supplier_id: values.supplier_id || null,
            amount:      values.amount,
            description: values.description,
            receipt_url,
          },
          changes,
          edited_by: user!.id,
        })
        toast.success(t("Expense updated"))
      } else {
        await createExpense.mutateAsync({
          branch_id:   values.branch_id,
          category_id: values.category_id || null,
          supplier_id: values.supplier_id || null,
          amount:      values.amount,
          currency:    "EGP",
          description: values.description,
          date:        format(new Date(), "yyyy-MM-dd"),
          receipt_url,
          added_by:    user?.id ?? null,
        })

        // Salary → also create a payroll debt for the selected member
        if (isDebtCategory && values.member_id) {
          await syncPayrollDebt(values.member_id, values.branch_id, values.amount, values.description)
        }

        toast.success(t("Expense added"))
      }

      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to save expense"))
    } finally {
      setUploading(false)
    }
  }

  const isPending = uploading || createExpense.isPending || updateExpense.isPending

  // ── Render ──────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-2xl",
        )}
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle>{isEditMode ? t("Edit Expense") : t("Add Expense")}</SheetTitle>
          <SheetDescription>
            {isEditMode
              ? t("Update this expense. Changes are logged with a timestamp.")
              : t("Record a new expense for a branch.")}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* ── Branch & Category ────────────────────── */}
              <div>
                <h3 className="text-sm font-semibold">{t("Details")}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("Where and what this expense is for")}
                </p>
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="branch_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Branch")}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("Select a branch")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {branches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{ln(b.name, b.name_ar)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Category")}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("Select a category")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((c) => {
                            const Icon = getCategoryIcon(c.icon)
                            return (
                              <SelectItem key={c.id} value={c.id}>
                                <span className="flex items-center gap-2">
                                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                  {ln(c.name, c.name_ar)}
                                </span>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Supplier — shown when the selected category has linked suppliers, or all suppliers exist */}
                {visibleSuppliers.length > 0 && !isDebtCategory && (
                  <FormField
                    control={form.control}
                    name="supplier_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("Supplier")}</FormLabel>
                        <Select
                          value={field.value ?? ""}
                          onValueChange={(v) => field.onChange(v || null)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("Select a supplier")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {visibleSuppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{ln(s.name, s.name_ar)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Member — only shown for Salary category */}
                {isDebtCategory && (
                  <FormField
                    control={form.control}
                    name="member_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("Staff")}
                          <span className="text-destructive ms-0.5">*</span>
                        </FormLabel>
                        <Select
                          value={field.value ?? ""}
                          onValueChange={(v) => field.onChange(v || null)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={
                                !watchedBranchId
                                  ? t("Select a branch first")
                                  : t("Select a staff member")
                              } />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {branchMembers.map((m) => (
                              <SelectItem key={m.profile_id} value={m.profile_id}>
                                {m.profile?.full_name ?? "—"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <Separator />

              {/* ── Amount ───────────────────────────────── */}
              <div>
                <h3 className="text-sm font-semibold">{t("Amount")}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isEditMode
                    ? t("Update the cost of this expense")
                    : t("How much this expense cost (date is recorded as today)")}
                </p>
              </div>

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Amount")} ({fmt.sym("EGP")})</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={field.value === 0 ? "" : field.value}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? 0 : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              {/* ── Notes & Receipt ──────────────────────── */}
              <div>
                <h3 className="text-sm font-semibold">
                  {isDebtCategory ? t("Notes") : t("Notes & Receipt")}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isDebtCategory
                    ? t("Description of this debt")
                    : t("Description and proof of purchase")}
                </p>
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Description")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={
                            isDebtCategory
                              ? t("e.g. Salary advance for June")
                              : t("e.g. Monthly electricity bill for downtown branch")
                          }
                          rows={3}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Receipt — hidden for Employee Debt expenses */}
                {!isDebtCategory && (
                  <div className="space-y-2">
                    <FormLabel>
                      {t("Receipt Image")}
                      {!isEditMode && <span className="text-destructive ms-0.5">*</span>}
                    </FormLabel>

                    {isEditMode && expense?.receipt_url && !receiptFile && (
                      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-2">
                        <img
                          src={expense.receipt_url}
                          alt="Current receipt"
                          className="h-12 w-12 rounded object-cover shrink-0"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("Current receipt — upload a new image to replace it")}
                        </p>
                      </div>
                    )}

                    <Input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null
                        setReceiptFile(file)
                        if (file) setReceiptError(null)
                      }}
                    />
                    {receiptFile && (
                      <p className="text-xs text-muted-foreground truncate">{receiptFile.name}</p>
                    )}
                    {receiptError && (
                      <p className="text-sm text-destructive">{receiptError}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer ───────────────────────────────── */}
            <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? t("Saving…") : isEditMode ? t("Save Changes") : t("Add Expense")}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
