import { useState } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
import { useFormatters } from "@/lib/format"
import { useIsMobile } from "@/hooks/use-mobile"
import { useLanguage } from "@/contexts/LanguageContext"
import { useAddAdjustment, useUpsertPayrollRecord } from "@/hooks/useAttendanceMutations"
import { supabase } from "@/lib/supabase"
import { useQueryClient } from "@tanstack/react-query"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

// ── Schema ────────────────────────────────────────────────────

const schema = z.object({
  type:   z.enum(["bonus", "deduction", "debt"]),
  amount: z.string().min(1, "Amount is required"),
  reason: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// ── Type color helpers ────────────────────────────────────────

function typeValueColor(type: string) {
  if (type === "bonus")     return "text-emerald-600 dark:text-emerald-400"
  if (type === "deduction") return "text-destructive"
  return ""
}

// ── Props ─────────────────────────────────────────────────────

interface PayrollAdjustmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staffName: string | null
  profileId: string
  branchId: string
  payrollRecordId: string | null
  baseSalary: number | null
  daysPresent: number
  paidDaysOff: number
  currency: string
  month: number
  year: number
}

// ── Component ─────────────────────────────────────────────────

export function PayrollAdjustmentDialog({
  open,
  onOpenChange,
  staffName,
  profileId,
  branchId,
  payrollRecordId,
  baseSalary,
  daysPresent,
  paidDaysOff,
  currency,
  month,
  year,
}: PayrollAdjustmentDialogProps) {
  const { t } = useLanguage()
  const { profile } = useAuth()
  const isMobile    = useIsMobile()
  const fmt         = useFormatters()
  const addAdjustment = useAddAdjustment()
  const upsertPayroll = useUpsertPayrollRecord()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "bonus", amount: "", reason: "" },
  })

  const watchedType = form.watch("type")
  const dailyRate   = baseSalary && baseSalary > 0 ? baseSalary / 30 : null

  const SHORTCUTS = [
    { label: "¼ day",   factor: 0.25 },
    { label: "½ day",   factor: 0.5  },
    { label: "¾ day",   factor: 0.75 },
    { label: "1 day",   factor: 1    },
    { label: "1½ days", factor: 1.5  },
  ]

  function handleClose() {
    form.reset()
    onOpenChange(false)
  }

  async function handleSubmit(values: FormValues) {
    if (!profile) return
    setSaving(true)
    try {
      let recordId = payrollRecordId
      if (!recordId) {
        const record = await upsertPayroll.mutateAsync({
          branch_id:    branchId,
          profile_id:   profileId,
          month,
          year,
          base_salary:  baseSalary,
          days_present: daysPresent,
          paid_days_off: paidDaysOff,
          currency,
        })
        recordId = record.id
      }

      await addAdjustment.mutateAsync({
        payroll_record_id:    recordId,
        branch_id:            branchId,
        profile_id:           profileId,
        type:                 values.type,
        amount:               Number(values.amount),
        reason:               values.reason ?? null,
        month,
        year,
        created_by:           profile.id,
        current_base:          baseSalary,
        current_days_present:  daysPresent,
        current_paid_days_off: paidDaysOff,
      })

      // When type is "debt", auto-create a matching expense entry
      if (values.type === "debt") {
        // Find or create the "Employee Debt" expense category
        const { data: existing } = await supabase
          .from("expense_categories")
          .select("id")
          .ilike("name", "employee debt")
          .maybeSingle()

        let categoryId: string | null = existing?.id ?? null

        if (!categoryId) {
          const { data: created } = await supabase
            .from("expense_categories")
            .insert({ name: "Employee Debt", icon: "banknote" })
            .select("id")
            .single()
          categoryId = created?.id ?? null
          qc.invalidateQueries({ queryKey: ["expense-categories"] })
        }

        const { error: expenseErr } = await supabase.from("expenses").insert({
          branch_id:   branchId,
          category_id: categoryId,
          amount:      Number(values.amount),
          currency,
          description: staffName ?? "Staff member",
          date:        format(new Date(), "yyyy-MM-dd"),
          added_by:    profile.id,
          receipt_url: null,
        })
        if (expenseErr) throw expenseErr

        qc.invalidateQueries({ queryKey: ["expenses"] })
      }

      toast.success(t("Adjustment saved"))
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to save adjustment"))
    } finally {
      setSaving(false)
    }
  }

  // ── Form fields (shared between Dialog and Sheet) ─────────

  const fields = (
    <div className="space-y-4">
      {/* Staff */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{t("Staff Member")}</p>
        <p className="text-sm font-medium">{staffName ?? "—"}</p>
      </div>

      <Separator />

      {/* Type */}
      <FormField
        control={form.control}
        name="type"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("Type")}</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className={typeValueColor(watchedType)}>
                  <SelectValue placeholder={t("Select type")} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="bonus"     className="text-emerald-600 dark:text-emerald-400">{t("Bonus")}</SelectItem>
                <SelectItem value="deduction" className="text-destructive">{t("Deduction")}</SelectItem>
                <SelectItem value="debt">{t("Debt")}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Shortcuts */}
      {(watchedType === "bonus" || watchedType === "deduction") && dailyRate && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {t("Quick amounts")} <span className="opacity-60">· {t("daily rate")} {fmt.money(Math.round(dailyRate), currency)}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SHORTCUTS.map(({ label, factor }) => {
              const value = Math.round(dailyRate * factor)
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => form.setValue("amount", String(value), { shouldValidate: true })}
                  className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2.5 py-1 text-xs transition-colors hover:bg-muted hover:border-foreground/20"
                >
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground">{fmt.num(value)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Amount */}
      <FormField
        control={form.control}
        name="amount"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("Amount")} ({fmt.sym(currency)})</FormLabel>
            <FormControl>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                className={cn("font-semibold tabular-nums", typeValueColor(watchedType))}
                {...field}
                onChange={(e) => field.onChange(e.target.value)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Notes */}
      <FormField
        control={form.control}
        name="reason"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("Notes")} <span className="font-normal text-muted-foreground">({t("optional")})</span></FormLabel>
            <FormControl>
              <Textarea
                placeholder={t("Add a note for this adjustment…")}
                className="resize-none"
                rows={3}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )

  // ── Mobile: bottom sheet ──────────────────────────────────

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
        <SheetContent
          side="bottom"
          className="h-[90svh] rounded-t-2xl flex flex-col gap-0 overflow-hidden p-0"
        >
          <SheetHeader className="shrink-0 border-b px-6 py-4">
            <SheetTitle className="text-start">{t("Add Adjustment")}</SheetTitle>
            <SheetDescription className="text-start">
              {staffName ?? t("Staff member")} · {month}/{year}
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {fields}
              </div>
              <div className="shrink-0 border-t bg-background px-6 py-4 flex gap-3">
                <Button type="button" variant="outline" onClick={handleClose} disabled={saving} className="flex-1">
                  {t("Cancel")}
                </Button>
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? t("Saving…") : t("Save")}
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    )
  }

  // ── Desktop: dialog ───────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Add Adjustment")}</DialogTitle>
          <DialogDescription>
            {staffName ?? t("Staff member")} · {month}/{year}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {fields}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("Saving…") : t("Save Adjustment")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
