import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, MapPin } from "lucide-react"
import { toast } from "sonner"

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
import { LocationMapPicker } from "@/components/LocationMapPicker"

// Shift settings and attendance rules are now managed per-shift in branch_shifts.

export const branchSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  name_ar: z.string(),
  address: z.string(),
  city: z.string(),
  phone: z.string(),
  is_active: z.boolean(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  location_radius_meters: z.number().int().min(10, "Minimum 10m").max(500, "Maximum 500m"),
})

export type BranchFormValues = z.infer<typeof branchSchema>

interface BranchFormProps {
  defaultValues?: Partial<BranchFormValues>
  onSubmit: (values: BranchFormValues) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

export function BranchForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = "Save",
}: BranchFormProps) {
  const [locating, setLocating] = useState(false)

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: "",
      name_ar: "",
      address: "",
      city: "",
      phone: "",
      is_active: true,
      latitude: null,
      longitude: null,
      location_radius_meters: 10,
      ...defaultValues,
    },
  })

  const { formState: { isSubmitting } } = form
  const watchedLat    = form.watch("latitude")
  const watchedLng    = form.watch("longitude")
  const watchedRadius = form.watch("location_radius_meters")

  function handleGetLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form.setValue("latitude", pos.coords.latitude, { shouldValidate: true })
        form.setValue("longitude", pos.coords.longitude, { shouldValidate: true })
        setLocating(false)
        toast.success("Location detected")
      },
      (err) => {
        toast.error(`Could not get location: ${err.message}`)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col flex-1 overflow-hidden"
      >
        {/* ── Scrollable fields ──────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Basic Information</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                General details about this branch
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Branch Name <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Downtown Branch" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name_ar"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arabic Name</FormLabel>
                    <FormControl>
                      <Input
                        dir="rtl"
                        lang="ar"
                        placeholder="مثلاً: فرع وسط البلد"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="Street address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="Cairo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="010 0000 0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator />

          {/* Location */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Location</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tap the map or drag the pin — staff must be within the radius to check in
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={handleGetLocation}
                disabled={locating}
              >
                {locating
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <MapPin className="h-3.5 w-3.5" />
                }
                My Location
              </Button>
            </div>

            <LocationMapPicker
              lat={watchedLat}
              lng={watchedLng}
              radiusMeters={watchedRadius || 10}
              onPick={(lat, lng) => {
                form.setValue("latitude",  lat, { shouldValidate: true })
                form.setValue("longitude", lng, { shouldValidate: true })
              }}
              onClear={() => {
                form.setValue("latitude",  null, { shouldValidate: true })
                form.setValue("longitude", null, { shouldValidate: true })
              }}
            />

            <FormField
              control={form.control}
              name="location_radius_meters"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Check-in Radius (meters)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="10"
                      max="500"
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Min 10m — Max 500m</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator />

          {/* Active status */}
          <FormField
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <FormItem className="flex-row items-start gap-3 rounded-lg border p-4">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-0.5 leading-none">
                  <FormLabel className="text-sm font-medium">Active</FormLabel>
                  <FormDescription>
                    Branch is open and staff can check in
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </div>

        {/* ── Sticky footer ──────────────────────────── */}
        <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  )
}
