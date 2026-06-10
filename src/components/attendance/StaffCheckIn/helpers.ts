import { format } from "date-fns"
import { supabase } from "@/lib/supabase"

export function todayString() {
  return format(new Date(), "yyyy-MM-dd")
}

export function getGeoPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12_000,
    })
  )
}

export async function uploadSelfie(
  file: File,
  profileId: string,
  kind: "checkin" | "checkout"
): Promise<string> {
  const ext = file.type.includes("png")
    ? "png"
    : file.type.includes("webp")
    ? "webp"
    : "jpg"
  const path = `${profileId}/${todayString()}-${kind}.${ext}`
  const { error } = await supabase.storage
    .from("attendance-selfies")
    .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" })
  if (error) throw error
  return supabase.storage.from("attendance-selfies").getPublicUrl(path).data.publicUrl
}

export function statusVariant(
  s: string
): "default" | "secondary" | "outline" | "destructive" {
  if (s === "present") return "default"
  if (s === "late") return "secondary"
  return "destructive"
}

export function statusLabel(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
