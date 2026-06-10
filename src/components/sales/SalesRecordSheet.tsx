import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format, parseISO } from "date-fns"
import {
  ChevronDown,
  ChevronUp,
  Clock,
  ImageIcon,
  Info,
  Lock,
  Pencil,
  TrendingUp,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { useIsMobile } from "@/hooks/use-mobile"
import { useAuth } from "@/hooks/useAuth"
import { useSalesEditHistory } from "@/hooks/useSales"
import { useUpsertSalesRecord } from "@/hooks/useSalesMutations"
import { uploadSalesReceipt } from "@/lib/storage"
import { formatSalesDate } from "@/lib/sales"
import { cn } from "@/lib/utils"
import type { SalesRecord } from "@/types/sales"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

// ── Schema ────────────────────────────────────────────────────

const schema = z.object({
  revenue:     z.number({ error: "Revenue is required" }).min(0),
  notes:       z.string(),
  receipt_url: z.string().min(1, "A receipt image is required"),
})
type FormValues = z.infer<typeof schema>

// ── Props ─────────────────────────────────────────────────────

interface SalesRecordSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId: string
  branchName: string
  date: Date | null
  record: SalesRecord | null | undefined
  canEdit?: boolean
}

// ── Component ─────────────────────────────────────────────────

export function SalesRecordSheet({
  open,
  onOpenChange,
  branchId,
  branchName,
  date,
  record,
  canEdit = false,
}: SalesRecordSheetProps) {
  const isMobile = useIsMobile()
  const { profile } = useAuth()

  // view → reading existing record; edit → filling the form
  const [mode, setMode]           = useState<"view" | "edit">("view")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const upsert = useUpsertSalesRecord()

  const { data: history, isLoading: historyLoading } = useSalesEditHistory(
    record?.id,
    historyOpen,
  )

  const isLocked     = record?.status === "locked"
  const formReadOnly = isLocked && !canEdit
  const dateStr      = date ? format(date, "yyyy-MM-dd") : undefined

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      revenue:     record?.revenue ?? (undefined as unknown as number),
      notes:       record?.notes   ?? "",
      receipt_url: record?.receipt_url ?? "",
    },
  })

  // Reset state when sheet opens for a different day
  useEffect(() => {
    if (!open) return
    const isNew = !record
    setMode(isNew ? "edit" : "view")
    setHistoryOpen(false)
    setPreviewUrl(record?.receipt_url ?? null)
    form.reset({
      revenue:     record?.revenue     ?? (undefined as unknown as number),
      notes:       record?.notes       ?? "",
      receipt_url: record?.receipt_url ?? "",
    })
  }, [open, record?.id])

  // ── Image upload ─────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewUrl(URL.createObjectURL(file))
    setUploading(true)
    try {
      const url = await uploadSalesReceipt(file)
      form.setValue("receipt_url", url, { shouldValidate: true })
    } catch {
      toast.error("Failed to upload image")
      setPreviewUrl(record?.receipt_url ?? null)
    } finally {
      setUploading(false)
    }
  }

  function clearImage() {
    setPreviewUrl(null)
    form.setValue("receipt_url", "", { shouldValidate: true })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ── Save ─────────────────────────────────────────────────────

  async function handleSave(values: FormValues) {
    if (!dateStr) return
    try {
      await upsert.mutateAsync({
        branch_id:    branchId,
        date:         dateStr,
        revenue:      values.revenue,
        notes:        values.notes || null,
        status:       "locked",
        receipt_url:  values.receipt_url,
        submitted_by: profile?.id ?? null,
        submitted_at: new Date().toISOString(),
      })
      toast.success("Sales record saved")
      onOpenChange(false)
    } catch {
      toast.error("Failed to save record")
    }
  }

  const isBusy = upsert.isPending || uploading

  // ── Shared header ─────────────────────────────────────────────

  const header = (
    <SheetHeader className="shrink-0 border-b px-6 py-4">
      <SheetTitle className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        {branchName}
      </SheetTitle>
      <SheetDescription className="mt-0.5 flex items-center gap-2">
        {date ? formatSalesDate(date) : "—"}
        {isLocked && (
          <span className="flex items-center gap-1">
            <Lock className="h-3 w-3" />
            Locked
          </span>
        )}
      </SheetDescription>
    </SheetHeader>
  )

  // ── View mode ─────────────────────────────────────────────────

  if (mode === "view" && record) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-lg",
          )}
        >
          {header}

          {/* ── Scrollable body ─── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Revenue */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Revenue</p>
              <p className="text-2xl font-bold tabular-nums">
                EGP {record.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            {/* Notes */}
            {record.notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{record.notes}</p>
              </div>
            )}

            {/* Receipt image */}
            {record.receipt_url ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Receipt</p>
                <a
                  href={record.receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border"
                >
                  <img
                    src={record.receipt_url}
                    alt="Sales receipt"
                    className="w-full max-h-64 object-cover"
                  />
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
                <ImageIcon className="h-4 w-4 shrink-0" />
                No receipt image
              </div>
            )}

            <Separator />

            {/* Edit history callout */}
            <Alert className="bg-muted/50 border-border py-3">
              <Info className="h-4 w-4 text-muted-foreground" />
              <AlertDescription className="text-xs text-muted-foreground leading-snug">
                All edits to this record are tracked.{" "}
                <button
                  type="button"
                  className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                  onClick={() => setHistoryOpen((v) => !v)}
                >
                  {historyOpen ? "Hide" : "View"} edit history
                </button>
              </AlertDescription>
            </Alert>

            {/* Edit history collapsible */}
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-sm font-semibold"
                >
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Edit history
                  </span>
                  {historyOpen
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3">
                {historyLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : !history?.length ? (
                  <p className="text-sm text-muted-foreground">No edits yet.</p>
                ) : (
                  history.map((h) => (
                    <div key={h.id} className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {(h.editor as { full_name?: string | null } | null)?.full_name ?? "Unknown"}
                        </span>
                        <span className="text-muted-foreground">
                          {format(parseISO(h.edited_at), "MMM d, yyyy HH:mm")}
                        </span>
                      </div>
                      <div className="space-y-0.5 text-muted-foreground">
                        {h.previous_revenue !== h.new_revenue && (
                          <p>
                            Revenue:{" "}
                            <span className="line-through">EGP {h.previous_revenue?.toLocaleString()}</span>
                            {" "}→ EGP {h.new_revenue?.toLocaleString()}
                          </p>
                        )}
                        {h.previous_notes !== h.new_notes && <p>Notes changed</p>}
                        {h.previous_status !== h.new_status && (
                          <p>
                            Status: <span className="capitalize">{h.previous_status}</span>
                            {" "}→ <span className="capitalize">{h.new_status}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* ── Footer ─── */}
          <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {canEdit && !formReadOnly && (
              <Button onClick={() => setMode("edit")}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // ── Edit mode ─────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-lg",
        )}
      >
        {header}

        <Form {...form}>
          <form
            className="flex flex-col flex-1 overflow-hidden"
            onSubmit={form.handleSubmit(handleSave)}
          >
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Revenue */}
              <FormField
                control={form.control}
                name="revenue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Revenue</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none pointer-events-none">
                          EGP
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                          className="pl-12"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : Number(e.target.value),
                            )
                          }
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Shift summary, notable events…"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Receipt image — required */}
              <FormField
                control={form.control}
                name="receipt_url"
                render={() => (
                  <FormItem>
                    <FormLabel>
                      Receipt Image
                      <span className="ml-1 text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                        {previewUrl ? (
                          <div className="relative overflow-hidden rounded-lg border">
                            <img
                              src={previewUrl}
                              alt="Receipt preview"
                              className="w-full max-h-48 object-cover"
                            />
                            {uploading && (
                              <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-sm">
                                Uploading…
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={clearImage}
                              className="absolute top-2 right-2 rounded-full bg-background/80 p-1 shadow-sm hover:bg-background"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                              "flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6",
                              "text-sm text-muted-foreground transition-colors",
                              "hover:border-primary/40 hover:bg-accent/30",
                            )}
                          >
                            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                            <span>Tap to add receipt image</span>
                          </button>
                        )}
                      </>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Edit history (only for existing records) */}
              {record && (
                <>
                  <Separator />
                  <Alert className="bg-muted/50 border-border py-3">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <AlertDescription className="text-xs text-muted-foreground leading-snug">
                      All edits to this record are tracked.{" "}
                      <button
                        type="button"
                        className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                        onClick={() => setHistoryOpen((v) => !v)}
                      >
                        {historyOpen ? "Hide" : "View"} edit history
                      </button>
                    </AlertDescription>
                  </Alert>
                  <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between text-sm font-semibold"
                      >
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          Edit history
                        </span>
                        {historyOpen
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        }
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 space-y-3">
                      {historyLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      ) : !history?.length ? (
                        <p className="text-sm text-muted-foreground">No edits yet.</p>
                      ) : (
                        history.map((h) => (
                          <div key={h.id} className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">
                                {(h.editor as { full_name?: string | null } | null)?.full_name ?? "Unknown"}
                              </span>
                              <span className="text-muted-foreground">
                                {format(parseISO(h.edited_at), "MMM d, yyyy HH:mm")}
                              </span>
                            </div>
                            <div className="space-y-0.5 text-muted-foreground">
                              {h.previous_revenue !== h.new_revenue && (
                                <p>
                                  Revenue:{" "}
                                  <span className="line-through">EGP {h.previous_revenue?.toLocaleString()}</span>
                                  {" "}→ EGP {h.new_revenue?.toLocaleString()}
                                </p>
                              )}
                              {h.previous_notes !== h.new_notes && <p>Notes changed</p>}
                              {h.previous_status !== h.new_status && (
                                <p>
                                  Status: <span className="capitalize">{h.previous_status}</span>
                                  {" "}→ <span className="capitalize">{h.new_status}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </>
              )}
            </div>

            {/* ── Footer ─── */}
            <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => record ? setMode("view") : onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isBusy}>
                {isBusy ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
