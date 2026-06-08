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

  console.log("Attempting selfie upload:", { path, type: file.type, size: file.size })

  // Try to remove existing first, but don't fail if it doesn't exist
  const { error: removeError } = await supabase.storage
    .from("attendance-selfies")
    .remove([path])
  
  if (removeError) {
    console.warn("Selfie remove attempt info:", removeError)
  }

  // Use upsert: true to allow overwriting
  const { error } = await supabase.storage
    .from("attendance-selfies")
    .upload(path, file, { 
      contentType: file.type || "image/jpeg",
      upsert: true 
    })

  if (error) {
    console.error("Selfie upload failed:", error)
    throw error
  }

  const { data: { publicUrl } } = supabase.storage
    .from("attendance-selfies")
    .getPublicUrl(path)

  console.log("Selfie upload successful. Public URL:", publicUrl)
  return publicUrl
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
