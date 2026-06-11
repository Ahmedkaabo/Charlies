import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useLanguage } from "@/contexts/LanguageContext"

// ── Schema ────────────────────────────────────────────────────

export const shiftSchema = z
  .object({
    name:                  z.string().min(1, "Name is required"),
    shift_start:           z.string().min(1, "Start time is required"),
    shift_end:             z.string().min(1, "End time is required"),
    checkin_window_minutes: z.number().int().min(1).max(120),
    full_day_hours:        z.number().min(0.5).max(24),
    overtime_hours:        z.number().min(0.5).max(24),
    late_grace_minutes:    z.number().int().min(0).max(120),
    late_deduction_enabled: z.boolean(),
    late_per_minutes:      z.number().int().min(1).nullable(),
    late_deduct_hours:     z.number().min(0.25).nullable(),
    is_active:             z.boolean(),
  })
  .refine((d) => d.overtime_hours > d.full_day_hours, {
    message: "Must be greater than full day hours",
    path: ["overtime_hours"],
  })
  .refine(
    (d) =>
      !d.late_deduction_enabled ||
      (d.late_per_minutes !== null && d.late_deduct_hours !== null),
    {
      message: "Required when late deduction is enabled",
      path: ["late_per_minutes"],
    }
  )

export type ShiftFormValues = z.infer<typeof shiftSchema>

// ── Props ─────────────────────────────────────────────────────

interface ShiftFormProps {
  defaultValues?: Partial<ShiftFormValues>
  onSubmit: (values: ShiftFormValues) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

// ── Component ─────────────────────────────────────────────────

export function ShiftForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = "Save",
}: ShiftFormProps) {
  const { t } = useLanguage()
  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      name: "",
      shift_start: "09:00",
      shift_end: "17:00",
      checkin_window_minutes: 15,
      full_day_hours: 8,
      overtime_hours: 12,
      late_grace_minutes: 0,
      late_deduction_enabled: false,
      late_per_minutes: null,
      late_deduct_hours: null,
      is_active: true,
      ...defaultValues,
    },
  })

  const { formState: { isSubmitting } } = form
  const lateEnabled = form.watch("late_deduction_enabled")
  const fullDay     = form.watch("full_day_hours")
  const overtime    = form.watch("overtime_hours")

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Shift Basics */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">{t("Shift Details")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("Name this shift and set its time window")}
              </p>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Shift Name")} <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder={t("e.g. Morning Shift")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="shift_start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Start Time")}</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shift_end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("End Time")}</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="checkin_window_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Check-in Window (minutes)")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="120"
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("Staff can check in ±")}
                    {field.value}
                    {t(" min around shift start")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex-row items-start gap-3 rounded-lg border p-4">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-0.5 leading-none">
                    <FormLabel className="text-sm font-medium">{t("Active")}</FormLabel>
                    <FormDescription>
                      {t("Staff can check in against this shift")}
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>

          <Separator />

          {/* Hour Rules */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">{t("Attendance Hour Rules")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("How many hours determine the daily attendance value")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="full_day_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Full Day Hours")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0.5"
                        max="24"
                        step="0.5"
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>{t("Minimum to count as 1.0 day")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="overtime_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Overtime Hours")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0.5"
                        max="24"
                        step="0.5"
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>{t("Counts as 1.5 days")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Live tier preview */}
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              <p>
                <span className="font-medium text-foreground">{t("0 days")}</span>
                {" "}{t("— below")}{" "}{fullDay}h
              </p>
              <p>
                <span className="font-medium text-foreground">{t("1.0 day")}</span>
                {" "}— {fullDay}h – {overtime}h
              </p>
              <p>
                <span className="font-medium text-foreground">{t("1.5 days")}</span>
                {" "}{t("— ")}{overtime}h {t("or more")}
              </p>
            </div>
          </div>

          <Separator />

          {/* Late Penalty */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">{t("Late Penalty")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("Automatically deduct hours from staff who arrive late")}
              </p>
            </div>

            <FormField
              control={form.control}
              name="late_deduction_enabled"
              render={({ field }) => (
                <FormItem className="flex-row items-start gap-3 rounded-lg border p-4">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-0.5 leading-none">
                    <FormLabel className="text-sm font-medium">{t("Enable Late Deduction")}</FormLabel>
                    <FormDescription>
                      {t("Deduct hours from total when staff check in late")}
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {lateEnabled && (
              <>
                <FormField
                  control={form.control}
                  name="late_grace_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Grace Period (minutes)")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="120"
                          value={field.value}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("Lateness within this window is ignored")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("Deduction Rule")}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-muted-foreground">{t("Per every")}</span>
                    <FormField
                      control={form.control}
                      name="late_per_minutes"
                      render={({ field }) => (
                        <FormItem className="w-24">
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              placeholder="30"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(e.target.value === "" ? null : Number(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <span className="text-sm text-muted-foreground">{t("min late → deduct")}</span>
                    <FormField
                      control={form.control}
                      name="late_deduct_hours"
                      render={({ field }) => (
                        <FormItem className="w-24">
                          <FormControl>
                            <Input
                              type="number"
                              min="0.25"
                              step="0.25"
                              placeholder="0.5"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(e.target.value === "" ? null : Number(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <span className="text-sm text-muted-foreground">{t("hrs")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("Example: late by 45 min with a 30-min rule → deduct")}{" "}
                    {form.watch("late_deduct_hours") ?? 0.5}h
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Sticky footer ──────────────────────────── */}
        <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {t("Cancel")}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {t(submitLabel)}
          </Button>
        </div>
      </form>
    </Form>
  )
}
