import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { toast } from "sonner"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { isDayEditable, formatSalesDate } from "@/lib/sales"
import type { SalesRecord } from "@/types/sales"

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

const schema = z.object({
  revenue: z.number().min(0, "Must be ≥ 0"),
  notes:   z.string(),
})
type FormValues = z.infer<typeof schema>

function useUpsertSalesRecord() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      branchId,
      date,
      revenue,
      notes,
      existingId,
    }: {
      branchId: string
      date: string
      revenue: number
      notes: string
      existingId?: string
    }) => {
      if (existingId) {
        const { error } = await supabase
          .from("sales_records")
          .update({ revenue, notes: notes || null, submitted_by: user?.id, submitted_at: new Date().toISOString(), status: "submitted" })
          .eq("id", existingId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("sales_records")
          .insert({
            branch_id:    branchId,
            date,
            revenue,
            notes:        notes || null,
            status:       "submitted",
            submitted_by: user?.id,
            submitted_at: new Date().toISOString(),
          })
        if (error) throw error
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sales-records"] })
      qc.invalidateQueries({ queryKey: ["sales-record", vars.branchId, vars.date] })
    },
  })
}

interface SalesRecordSheetProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
  branchId:     string
  branchName:   string
  date:         Date | null
  record:       SalesRecord | null
  canEdit:      boolean
}

export function SalesRecordSheet({
  open,
  onOpenChange,
  branchId,
  branchName,
  date,
  record,
  canEdit,
}: SalesRecordSheetProps) {
  const isMobile = useIsMobile()
  const upsert   = useUpsertSalesRecord()

  const editable = date ? isDayEditable(date, record, canEdit) : false
  const dateStr  = date ? format(date, "yyyy-MM-dd") : ""

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { revenue: record?.revenue ?? 0, notes: record?.notes ?? "" },
  })

  useEffect(() => {
    form.reset({ revenue: record?.revenue ?? 0, notes: record?.notes ?? "" })
  }, [record, open])

  async function onSubmit(values: FormValues) {
    try {
      await upsert.mutateAsync({
        branchId,
        date:       dateStr,
        revenue:    values.revenue,
        notes:      values.notes,
        existingId: record?.id,
      })
      toast.success("Sales record saved")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    }
  }

  const statusColor: Record<string, string> = {
    draft:     "bg-muted text-muted-foreground",
    submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    locked:    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-md"
        )}
      >
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-left text-base">
              {date ? formatSalesDate(date) : "Sales Record"}
            </SheetTitle>
            {record?.status && (
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", statusColor[record.status] ?? "")}>
                {record.status}
              </span>
            )}
          </div>
          <SheetDescription className="text-left">{branchName}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!editable && record ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                <p className="text-2xl font-semibold">{record.revenue.toLocaleString()}</p>
              </div>
              {record.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{record.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <Form {...form}>
              <form id="sales-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="revenue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Revenue</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0"
                          disabled={!editable}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Any remarks for this day…"
                          disabled={!editable}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          )}
        </div>

        {editable && (
          <div className="border-t px-6 py-4 flex gap-3 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form="sales-form" disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : record ? "Update" : "Submit"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
